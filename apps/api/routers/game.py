"""Game API endpoints — REST-based game play."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.game_manager import create_game, get_game
from services.hand_history import HandHistoryStore

router = APIRouter()

_history_store = HandHistoryStore()


class CreateGameRequest(BaseModel):
    num_opponents: int = 3
    starting_stack: int = 1000
    small_blind: int = 5
    big_blind: int = 10
    difficulty: str = "medium"


class ActionRequest(BaseModel):
    action_type: str
    amount: int = 0


@router.post("/create")
async def api_create_game(request: CreateGameRequest):
    """Create a new game and start the first hand."""
    if not 1 <= request.num_opponents <= 7:
        raise HTTPException(400, "Number of opponents must be 1-7")

    game_id, result = create_game(
        num_opponents=request.num_opponents,
        starting_stack=request.starting_stack,
        small_blind=request.small_blind,
        big_blind=request.big_blind,
        difficulty=request.difficulty,
    )
    return {"game_id": game_id, **result}


@router.post("/{game_id}/action")
async def api_game_action(game_id: str, request: ActionRequest):
    """Process a player action."""
    active = get_game(game_id)
    if not active:
        raise HTTPException(404, "Game not found")

    try:
        result = active.human_action(request.action_type, request.amount)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{game_id}/new-hand")
async def api_new_hand(game_id: str):
    """Start a new hand in an existing game."""
    active = get_game(game_id)
    if not active:
        raise HTTPException(404, "Game not found")

    try:
        result = active.start_new_hand()
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/stats")
async def api_hand_history_stats():
    """Return aggregate hand history statistics for AI learning."""
    return _history_store.get_stats()


@router.get("/{game_id}/state")
async def api_game_state(game_id: str):
    """Get current game state."""
    active = get_game(game_id)
    if not active:
        raise HTTPException(404, "Game not found")

    return active._get_response()
