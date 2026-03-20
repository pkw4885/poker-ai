"""Room-based game manager — extends existing game logic for multiplayer rooms."""

from __future__ import annotations

import asyncio
import sys
import os
import uuid
from typing import Any, Optional

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from poker_engine import Action, ActionType, Game, GamePhase
from poker_engine.actions import ValidActions
from poker_engine.blinds import BlindManager, BlindLevel

from services.game_manager import AIPlayer

TURN_TIMEOUT_SECONDS = 30


class RoomGame:
    """Manages a game session tied to a room with human + AI players."""

    def __init__(
        self,
        room_id: int,
        human_players: list[dict[str, Any]],
        ai_count: int = 0,
        ai_difficulty: str = "medium",
        starting_stack: int = 1000,
        small_blind: int = 5,
        big_blind: int = 10,
    ):
        self.room_id = room_id
        self.game_id = str(uuid.uuid4())[:8]

        # Build player list: humans first, then AI
        self.human_players = human_players  # [{"id": user_id, "username": name, "seat": idx}, ...]
        self.ai_count = ai_count

        # Map seat_index -> user_id (for humans) or None (for AI)
        names: list[str] = []
        self.seat_to_user: dict[int, Optional[int]] = {}
        self.user_to_seat: dict[int, int] = {}
        self.ai_seats: dict[int, AIPlayer] = {}

        # Assign human players to their seats
        sorted_humans = sorted(human_players, key=lambda p: p["seat"])
        all_seats: list[dict[str, Any]] = []
        for h in sorted_humans:
            all_seats.append({"name": h["username"], "is_ai": False, "user_id": h["id"]})

        # Fill remaining seats with AI
        for i in range(ai_count):
            all_seats.append({"name": f"AI_{i + 1}", "is_ai": True, "user_id": None})

        for idx, seat in enumerate(all_seats):
            names.append(seat["name"])
            if seat["is_ai"]:
                self.ai_seats[idx] = AIPlayer(ai_difficulty)
            else:
                self.seat_to_user[idx] = seat["user_id"]
                self.user_to_seat[seat["user_id"]] = idx

        blind_mgr = BlindManager(schedule=[BlindLevel(small_blind, big_blind)])
        self.game = Game(names, starting_stacks=starting_stack, blind_manager=blind_mgr)
        self.hand_started = False
        self._turn_timer_task: Optional[asyncio.Task[None]] = None
        self._broadcast_fn: Optional[Any] = None

    def set_broadcast(self, broadcast_fn: Any) -> None:
        """Set the async broadcast function for sending events."""
        self._broadcast_fn = broadcast_fn

    def start_hand(self) -> dict[str, Any]:
        """Start a new hand and process AI turns."""
        self.game.start_hand()
        self.hand_started = True
        return self._process_ai_turns()

    def player_action(self, user_id: int, action_type: str, amount: int = 0) -> dict[str, Any]:
        """Process a human player's action."""
        if not self.hand_started:
            raise ValueError("No hand in progress")

        seat = self.user_to_seat.get(user_id)
        if seat is None:
            raise ValueError("Player not in this game")

        current = self.game.current_player_idx
        if current != seat:
            raise ValueError("Not your turn")

        self._cancel_turn_timer()

        at = ActionType(action_type)
        action = Action(type=at, amount=amount, player_id=seat)
        self.game.act(action)

        return self._process_ai_turns()

    def _process_ai_turns(self) -> dict[str, Any]:
        """Run AI turns until a human's turn or hand is over."""
        while True:
            if self.game.phase == GamePhase.HAND_OVER:
                self.hand_started = False
                self._cancel_turn_timer()
                break

            current = self.game.current_player_idx
            if current in self.ai_seats:
                va = self.game.get_valid_actions()
                ai_action = self.ai_seats[current].decide(va, self.game)
                ai_action = Action(
                    type=ai_action.type,
                    amount=ai_action.amount,
                    player_id=current,
                )
                self.game.act(ai_action)
            else:
                # Human's turn — start timer
                break

        return self.get_full_state()

    def get_full_state(self) -> dict[str, Any]:
        """Build the full game state dict."""
        state = self.game.state
        result: dict[str, Any] = {
            "game_id": self.game_id,
            "room_id": self.room_id,
            "phase": state.phase.value,
            "hand_over": state.is_hand_over,
            "players": [],
        }

        for idx, p in enumerate(state.players):
            pdata: dict[str, Any] = {
                "seat": idx,
                "name": p.name,
                "stack": p.stack,
                "bet": p.bet,
                "is_folded": p.is_folded,
                "is_all_in": p.is_all_in,
                "is_ai": idx in self.ai_seats,
            }
            result["players"].append(pdata)

        if hasattr(state, "community_cards"):
            result["community_cards"] = state.community_cards
        if hasattr(state, "pot"):
            result["pot"] = state.pot
        if hasattr(state, "pots"):
            result["pots"] = state.pots

        if state.is_hand_over:
            result["hand_results"] = self.game.hand_results
            # Reveal cards of players still in hand
            for p in state.players:
                if p.is_in_hand:
                    result["players"][p.id]["hole_cards"] = p.hole_cards

        if not state.is_hand_over:
            result["current_player_seat"] = state.current_player_idx

        return result

    def get_player_state(self, user_id: int) -> dict[str, Any]:
        """Build a state dict personalized for a specific player."""
        full = self.get_full_state()
        seat = self.user_to_seat.get(user_id)
        if seat is None:
            return full

        # Add this player's hole cards
        state = self.game.state
        if seat < len(state.players):
            player = state.players[seat]
            if hasattr(player, "hole_cards") and player.hole_cards:
                full["players"][seat]["hole_cards"] = player.hole_cards

        # Add valid actions if it's this player's turn
        if (
            not state.is_hand_over
            and state.current_player_idx == seat
        ):
            va = self.game.get_valid_actions(seat)
            full["valid_actions"] = va.to_list()
            full["is_my_turn"] = True
        else:
            full["valid_actions"] = []
            full["is_my_turn"] = False

        full["my_seat"] = seat
        return full

    def auto_fold_current(self) -> dict[str, Any]:
        """Auto-fold the current player (turn timeout)."""
        if not self.hand_started:
            raise ValueError("No hand in progress")
        current = self.game.current_player_idx
        action = Action(type=ActionType.FOLD, player_id=current)
        self.game.act(action)
        return self._process_ai_turns()

    def _cancel_turn_timer(self) -> None:
        if self._turn_timer_task and not self._turn_timer_task.done():
            self._turn_timer_task.cancel()
            self._turn_timer_task = None


# Active room games store
_room_games: dict[int, RoomGame] = {}


def create_room_game(
    room_id: int,
    human_players: list[dict[str, Any]],
    ai_count: int = 0,
    ai_difficulty: str = "medium",
) -> RoomGame:
    """Create and store a new room game."""
    rg = RoomGame(
        room_id=room_id,
        human_players=human_players,
        ai_count=ai_count,
        ai_difficulty=ai_difficulty,
    )
    _room_games[room_id] = rg
    return rg


def get_room_game(room_id: int) -> Optional[RoomGame]:
    return _room_games.get(room_id)


def remove_room_game(room_id: int) -> None:
    _room_games.pop(room_id, None)
