"""Room management API endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import get_current_user
from database import get_db

router = APIRouter()


class CreateRoomRequest(BaseModel):
    name: str
    max_players: int = 6
    ai_count: int = 0
    ai_difficulty: str = "medium"
    ai_muck: bool = False
    ai_fold_reveal: bool = True


@router.post("")
async def create_room(
    req: CreateRoomRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new room."""
    if not (1 <= len(req.name) <= 30):
        raise HTTPException(400, "Room name must be 1-30 characters")
    if not (2 <= req.max_players <= 8):
        raise HTTPException(400, "max_players must be 2-8")
    if not (0 <= req.ai_count <= 7):
        raise HTTPException(400, "ai_count must be 0-7")
    if req.ai_count >= req.max_players:
        raise HTTPException(400, "ai_count must be less than max_players")
    if req.ai_difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(400, "ai_difficulty must be easy, medium, or hard")

    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO rooms (name, host_user_id, max_players, ai_count, ai_difficulty, ai_muck, ai_fold_reveal, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting')",
            (req.name, user["id"], req.max_players, req.ai_count, req.ai_difficulty, req.ai_muck, req.ai_fold_reveal),
        )
        room_id = cur.lastrowid
        # Host auto-joins at seat 0
        conn.execute(
            "INSERT INTO room_players (room_id, user_id, seat_index) VALUES (?, ?, 0)",
            (room_id, user["id"]),
        )
        conn.commit()
    finally:
        conn.close()

    return {"room_id": room_id, "message": "Room created"}


@router.get("")
async def list_rooms() -> dict[str, Any]:
    """List active rooms with waiting status."""
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT r.*, u.username AS host_username, "
            "(SELECT COUNT(*) FROM room_players rp WHERE rp.room_id = r.id) AS player_count "
            "FROM rooms r JOIN users u ON r.host_user_id = u.id "
            "WHERE r.status = 'waiting' ORDER BY r.created_at DESC",
        ).fetchall()
    finally:
        conn.close()

    rooms = [
        {
            "id": r["id"],
            "name": r["name"],
            "host_username": r["host_username"],
            "max_players": r["max_players"],
            "ai_count": r["ai_count"],
            "ai_difficulty": r["ai_difficulty"],
            "ai_muck": bool(r["ai_muck"]),
            "ai_fold_reveal": bool(r["ai_fold_reveal"]),
            "player_count": r["player_count"],
            "status": r["status"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]
    return {"rooms": rooms}


@router.get("/{room_id}")
async def get_room(room_id: int) -> dict[str, Any]:
    """Get room details with player list."""
    conn = get_db()
    try:
        room = conn.execute(
            "SELECT r.*, u.username AS host_username FROM rooms r "
            "JOIN users u ON r.host_user_id = u.id WHERE r.id = ?",
            (room_id,),
        ).fetchone()
        if not room:
            raise HTTPException(404, "Room not found")

        players = conn.execute(
            "SELECT rp.seat_index, rp.joined_at, u.id AS user_id, u.username "
            "FROM room_players rp JOIN users u ON rp.user_id = u.id "
            "WHERE rp.room_id = ? ORDER BY rp.seat_index",
            (room_id,),
        ).fetchall()
    finally:
        conn.close()

    return {
        "room": {
            "id": room["id"],
            "name": room["name"],
            "host_user_id": room["host_user_id"],
            "host_username": room["host_username"],
            "max_players": room["max_players"],
            "ai_count": room["ai_count"],
            "ai_difficulty": room["ai_difficulty"],
            "ai_muck": bool(room["ai_muck"]),
            "ai_fold_reveal": bool(room["ai_fold_reveal"]),
            "status": room["status"],
            "created_at": room["created_at"],
        },
        "players": [
            {
                "user_id": p["user_id"],
                "username": p["username"],
                "seat_index": p["seat_index"],
                "joined_at": p["joined_at"],
            }
            for p in players
        ],
    }


@router.post("/{room_id}/join")
async def join_room(
    room_id: int,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Join an existing room."""
    conn = get_db()
    try:
        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            raise HTTPException(404, "Room not found")
        if room["status"] != "waiting":
            raise HTTPException(400, "Room is not accepting players")

        # Check if already joined
        existing = conn.execute(
            "SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?",
            (room_id, user["id"]),
        ).fetchone()
        if existing:
            raise HTTPException(400, "Already in this room")

        # Count current human players
        count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM room_players WHERE room_id = ?",
            (room_id,),
        ).fetchone()["cnt"]
        human_slots = room["max_players"] - room["ai_count"]
        if count >= human_slots:
            raise HTTPException(400, "Room is full")

        # Find next available seat (seats 0..max_players-1, AI will fill from end)
        taken = {
            r["seat_index"]
            for r in conn.execute(
                "SELECT seat_index FROM room_players WHERE room_id = ?", (room_id,)
            ).fetchall()
        }
        seat = None
        for i in range(room["max_players"]):
            if i not in taken:
                seat = i
                break
        if seat is None:
            raise HTTPException(400, "No available seats")

        conn.execute(
            "INSERT INTO room_players (room_id, user_id, seat_index) VALUES (?, ?, ?)",
            (room_id, user["id"], seat),
        )
        conn.commit()
    finally:
        conn.close()

    return {"message": "Joined room", "seat_index": seat}


@router.post("/{room_id}/leave")
async def leave_room(
    room_id: int,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Leave a room."""
    conn = get_db()
    try:
        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            raise HTTPException(404, "Room not found")
        if room["status"] != "waiting":
            raise HTTPException(400, "Cannot leave a room that is in progress")

        existing = conn.execute(
            "SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?",
            (room_id, user["id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(400, "Not in this room")

        # If host leaves, delete the room
        if room["host_user_id"] == user["id"]:
            conn.execute("DELETE FROM room_players WHERE room_id = ?", (room_id,))
            conn.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
        else:
            conn.execute(
                "DELETE FROM room_players WHERE room_id = ? AND user_id = ?",
                (room_id, user["id"]),
            )
        conn.commit()
    finally:
        conn.close()

    return {"message": "Left room"}


@router.post("/{room_id}/start")
async def start_game(
    room_id: int,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Start the game (host only)."""
    conn = get_db()
    try:
        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            raise HTTPException(404, "Room not found")
        if room["host_user_id"] != user["id"]:
            raise HTTPException(403, "Only the host can start the game")
        if room["status"] != "waiting":
            raise HTTPException(400, "Game already started or finished")

        conn.execute("UPDATE rooms SET status = 'playing' WHERE id = ?", (room_id,))
        conn.commit()
    finally:
        conn.close()

    return {"message": "Game started", "room_id": room_id}


@router.delete("/{room_id}")
async def delete_room(
    room_id: int,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a room (host only)."""
    conn = get_db()
    try:
        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            raise HTTPException(404, "Room not found")
        if room["host_user_id"] != user["id"]:
            raise HTTPException(403, "Only the host can delete the room")

        conn.execute("DELETE FROM room_players WHERE room_id = ?", (room_id,))
        conn.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
        conn.commit()
    finally:
        conn.close()

    return {"message": "Room deleted"}
