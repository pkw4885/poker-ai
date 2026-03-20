"""WebSocket endpoint for real-time room gameplay."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from core.auth import decode_token
from database import get_db
from services.room_game_manager import (
    RoomGame,
    create_room_game,
    get_room_game,
    remove_room_game,
    TURN_TIMEOUT_SECONDS,
)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections per room."""

    def __init__(self) -> None:
        # room_id -> {user_id: WebSocket}
        self._rooms: dict[int, dict[int, WebSocket]] = {}
        # room_id -> turn timer task
        self._turn_timers: dict[int, asyncio.Task[None]] = {}

    def add(self, room_id: int, user_id: int, ws: WebSocket) -> None:
        if room_id not in self._rooms:
            self._rooms[room_id] = {}
        self._rooms[room_id][user_id] = ws

    def remove(self, room_id: int, user_id: int) -> None:
        if room_id in self._rooms:
            self._rooms[room_id].pop(user_id, None)
            if not self._rooms[room_id]:
                del self._rooms[room_id]

    def get_connections(self, room_id: int) -> dict[int, WebSocket]:
        return self._rooms.get(room_id, {})

    async def broadcast(self, room_id: int, event: str, data: dict[str, Any]) -> None:
        """Send an event to all connected players in a room."""
        conns = self.get_connections(room_id)
        message = json.dumps({"event": event, "data": data})
        closed: list[int] = []
        for uid, ws in conns.items():
            try:
                await ws.send_text(message)
            except Exception:
                closed.append(uid)
        for uid in closed:
            self.remove(room_id, uid)

    async def send_to_user(
        self, room_id: int, user_id: int, event: str, data: dict[str, Any]
    ) -> None:
        """Send an event to a specific user in a room."""
        conns = self.get_connections(room_id)
        ws = conns.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps({"event": event, "data": data}))
            except Exception:
                self.remove(room_id, user_id)

    def cancel_turn_timer(self, room_id: int) -> None:
        task = self._turn_timers.pop(room_id, None)
        if task and not task.done():
            task.cancel()

    def set_turn_timer(self, room_id: int, task: asyncio.Task[None]) -> None:
        self.cancel_turn_timer(room_id)
        self._turn_timers[room_id] = task


manager = ConnectionManager()


async def _broadcast_game_state(room_id: int, room_game: RoomGame) -> None:
    """Broadcast personalized game state to each player and handle turn notifications."""
    conns = manager.get_connections(room_id)

    for uid, ws in list(conns.items()):
        state = room_game.get_player_state(uid)
        try:
            await ws.send_text(json.dumps({"event": "game_state_update", "data": state}))
        except Exception:
            manager.remove(room_id, uid)

    # If hand is over, broadcast hand_over
    full_state = room_game.get_full_state()
    if full_state.get("hand_over"):
        await manager.broadcast(room_id, "hand_over", full_state)
        return

    # Notify active player it's their turn and start timer
    current_seat = full_state.get("current_player_seat")
    if current_seat is not None:
        # Find user_id for this seat
        target_uid = room_game.seat_to_user.get(current_seat)
        if target_uid is not None:
            player_state = room_game.get_player_state(target_uid)
            await manager.send_to_user(
                room_id,
                target_uid,
                "your_turn",
                {
                    "valid_actions": player_state.get("valid_actions", []),
                    "timeout": TURN_TIMEOUT_SECONDS,
                },
            )
            # Start turn timer
            _start_turn_timer(room_id, room_game)


def _start_turn_timer(room_id: int, room_game: RoomGame) -> None:
    """Start a countdown timer for the current player's turn."""

    async def _timer() -> None:
        for remaining in range(TURN_TIMEOUT_SECONDS, 0, -1):
            await asyncio.sleep(1)
            if remaining % 5 == 0 or remaining <= 5:
                await manager.broadcast(
                    room_id, "turn_timer", {"remaining": remaining}
                )
        # Time's up — auto-fold
        try:
            room_game.auto_fold_current()
            await _broadcast_game_state(room_id, room_game)
        except (ValueError, Exception):
            pass

    task = asyncio.ensure_future(_timer())
    manager.set_turn_timer(room_id, task)


@router.websocket("/room/{room_id}")
async def websocket_room(
    websocket: WebSocket,
    room_id: int,
    token: str = Query(...),
) -> None:
    """WebSocket endpoint for real-time room gameplay."""
    # Verify JWT
    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id: int = payload["user_id"]
    username: str = payload.get("username", "")

    # Verify user is in the room
    conn = get_db()
    try:
        membership = conn.execute(
            "SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?",
            (room_id, user_id),
        ).fetchone()
        if not membership:
            await websocket.close(code=4003, reason="Not a member of this room")
            return

        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            await websocket.close(code=4004, reason="Room not found")
            return
    finally:
        conn.close()

    await websocket.accept()
    manager.add(room_id, user_id, websocket)

    # Notify others
    await manager.broadcast(
        room_id,
        "player_joined",
        {"user_id": user_id, "username": username},
    )

    # If game is in progress, send current state
    room_game = get_room_game(room_id)
    if room_game:
        state = room_game.get_player_state(user_id)
        await websocket.send_text(
            json.dumps({"event": "game_state_update", "data": state})
        )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event")

            if event == "start_game":
                await _handle_start_game(room_id, user_id, websocket)

            elif event == "player_action":
                await _handle_player_action(
                    room_id,
                    user_id,
                    msg.get("data", {}),
                )

            elif event == "new_hand":
                await _handle_new_hand(room_id, user_id)

    except WebSocketDisconnect:
        pass
    finally:
        manager.remove(room_id, user_id)
        manager.cancel_turn_timer(room_id)
        await manager.broadcast(
            room_id,
            "player_left",
            {"user_id": user_id, "username": username},
        )


async def _handle_start_game(room_id: int, user_id: int, ws: WebSocket) -> None:
    """Handle game start request from host."""
    conn = get_db()
    try:
        room = conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()
        if not room:
            return
        if room["host_user_id"] != user_id:
            await ws.send_text(
                json.dumps({"event": "error", "data": {"message": "Only host can start"}})
            )
            return
        if room["status"] != "waiting":
            await ws.send_text(
                json.dumps({"event": "error", "data": {"message": "Game already started"}})
            )
            return

        # Get all human players in the room
        players_rows = conn.execute(
            "SELECT rp.seat_index, rp.user_id, u.username "
            "FROM room_players rp JOIN users u ON rp.user_id = u.id "
            "WHERE rp.room_id = ? ORDER BY rp.seat_index",
            (room_id,),
        ).fetchall()

        human_players = [
            {"id": p["user_id"], "username": p["username"], "seat": p["seat_index"]}
            for p in players_rows
        ]

        conn.execute("UPDATE rooms SET status = 'playing' WHERE id = ?", (room_id,))
        conn.commit()
    finally:
        conn.close()

    room_game = create_room_game(
        room_id=room_id,
        human_players=human_players,
        ai_count=room["ai_count"],
        ai_difficulty=room["ai_difficulty"],
    )

    room_game.start_hand()
    await manager.broadcast(room_id, "game_started", {"room_id": room_id})
    await _broadcast_game_state(room_id, room_game)


async def _handle_player_action(
    room_id: int, user_id: int, data: dict[str, Any]
) -> None:
    """Handle a player action (fold, call, raise, check)."""
    room_game = get_room_game(room_id)
    if not room_game:
        return

    manager.cancel_turn_timer(room_id)

    action_type = data.get("action_type", "")
    amount = data.get("amount", 0)

    try:
        room_game.player_action(user_id, action_type, amount)
    except ValueError as e:
        await manager.send_to_user(
            room_id, user_id, "error", {"message": str(e)}
        )
        return

    await _broadcast_game_state(room_id, room_game)


async def _handle_new_hand(room_id: int, user_id: int) -> None:
    """Handle new hand request."""
    room_game = get_room_game(room_id)
    if not room_game:
        return

    try:
        room_game.start_hand()
    except Exception:
        return

    await _broadcast_game_state(room_id, room_game)
