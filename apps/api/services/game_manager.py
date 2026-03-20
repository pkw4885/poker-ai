"""Game manager — handles active games, AI opponents, and state management."""

from __future__ import annotations

import sys
import os
import uuid
import time
from typing import Any

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from poker_engine import (
    Game,
    Action,
    ActionType,
    GamePhase,
)
from poker_engine.actions import ValidActions


class AIPlayer:
    """Simple rule-based AI for immediate gameplay (baseline)."""

    def __init__(self, difficulty: str = "medium"):
        self.difficulty = difficulty

    def decide(self, valid_actions: ValidActions, game: Game) -> Action:
        """Make a decision based on valid actions."""
        import random

        if self.difficulty == "easy":
            return self._easy_decide(valid_actions, random)
        elif self.difficulty == "hard":
            return self._hard_decide(valid_actions, game, random)
        else:
            return self._medium_decide(valid_actions, random)

    def _easy_decide(self, va: ValidActions, rng: Any) -> Action:
        """Loose-passive: calls most hands, rarely raises."""
        r = rng.random()
        if va.can_check:
            return Action(type=ActionType.CHECK)
        if va.can_call and r < 0.8:
            return Action(type=ActionType.CALL)
        if r < 0.05 and va.can_raise:
            return Action(type=ActionType.RAISE, amount=va.min_raise)
        if va.can_call:
            return Action(type=ActionType.CALL)
        return Action(type=ActionType.FOLD)

    def _medium_decide(self, va: ValidActions, rng: Any) -> Action:
        """Uses basic pot odds and occasional raises."""
        r = rng.random()
        if va.can_check:
            if r < 0.2 and va.can_raise:
                return Action(type=ActionType.RAISE, amount=va.min_raise)
            return Action(type=ActionType.CHECK)
        if va.can_call:
            if r < 0.15 and va.can_raise:
                return Action(type=ActionType.RAISE, amount=va.min_raise)
            if r < 0.75:
                return Action(type=ActionType.CALL)
            return Action(type=ActionType.FOLD)
        return Action(type=ActionType.FOLD)

    def _hard_decide(self, va: ValidActions, game: Game, rng: Any) -> Action:
        """More aggressive, position-aware."""
        r = rng.random()
        if va.can_check:
            if r < 0.35 and va.can_raise:
                amount = va.min_raise + int((va.max_raise - va.min_raise) * rng.random() * 0.3)
                return Action(type=ActionType.RAISE, amount=min(amount, va.max_raise))
            return Action(type=ActionType.CHECK)
        if va.can_call:
            if r < 0.25 and va.can_raise:
                amount = va.min_raise + int((va.max_raise - va.min_raise) * rng.random() * 0.4)
                return Action(type=ActionType.RAISE, amount=min(amount, va.max_raise))
            if r < 0.65:
                return Action(type=ActionType.CALL)
            return Action(type=ActionType.FOLD)
        return Action(type=ActionType.FOLD)


class ActiveGame:
    """Represents an active game session."""

    def __init__(
        self,
        game_id: str,
        num_opponents: int,
        starting_stack: int = 10000,
        small_blind: int = 5,
        big_blind: int = 10,
        difficulty: str = "medium",
        is_tournament: bool = True,
    ):
        self.game_id = game_id
        self.created_at = time.time()

        names = ["You"] + [f"AI_{i}" for i in range(1, num_opponents + 1)]
        from poker_engine.blinds import BlindManager, BlindLevel

        if is_tournament:
            blind_mgr = BlindManager(is_tournament=True)
        else:
            blind_mgr = BlindManager(schedule=[BlindLevel(small_blind, big_blind)])
        self.game = Game(names, starting_stacks=starting_stack, blind_manager=blind_mgr)
        self.ai_players = {
            i: AIPlayer(difficulty) for i in range(1, num_opponents + 1)
        }
        self.hand_started = False

    def start_new_hand(self) -> dict:
        """Start a new hand and run AI actions until it's the human's turn."""
        self.game.start_hand()
        self.hand_started = True
        return self._run_ai_turns()

    def human_action(self, action_type: str, amount: int = 0) -> dict:
        """Process human player's action, then run AI turns."""
        if not self.hand_started:
            return {"error": "No hand in progress"}

        at = ActionType(action_type)
        action = Action(type=at, amount=amount, player_id=0)
        self.game.act(action)

        return self._run_ai_turns()

    def _run_ai_turns(self) -> dict:
        """Run AI player turns until it's human's turn or hand is over."""
        ai_actions = []
        while True:
            if self.game.phase == GamePhase.HAND_OVER:
                self.hand_started = False
                break

            current_idx = self.game.current_player_idx
            if current_idx == 0:
                # Human's turn
                break

            if current_idx in self.ai_players:
                va = self.game.get_valid_actions()
                ai_action = self.ai_players[current_idx].decide(va, self.game)
                ai_action = Action(
                    type=ai_action.type,
                    amount=ai_action.amount,
                    player_id=current_idx,
                )
                self.game.act(ai_action)
                ai_actions.append({
                    "player_id": current_idx,
                    "type": ai_action.type.value,
                    "amount": ai_action.amount,
                })
            else:
                break

        return self._get_response(ai_actions)

    def _get_response(self, ai_actions: list | None = None) -> dict:
        """Build the response dict for the frontend."""
        state = self.game.state
        player_view = state.get_player_view(0)

        response: dict[str, Any] = {
            "game_state": player_view,
            "phase": state.phase.value,
            "hand_over": state.is_hand_over,
            "ai_actions": ai_actions or [],
        }

        if not state.is_hand_over and state.current_player_idx == 0:
            va = self.game.get_valid_actions(0)
            response["valid_actions"] = va.to_list()
            response["is_my_turn"] = True
        else:
            response["valid_actions"] = []
            response["is_my_turn"] = False

        if state.is_hand_over:
            response["hand_results"] = self.game.hand_results
            # Only reveal cards of players still in hand at showdown
            for p in state.players:
                if p.is_in_hand:
                    for pv in response["game_state"]["players"]:
                        if pv["id"] == p.id:
                            pv["hole_cards"] = p.hole_cards

        return response


# In-memory game store
_games: dict[str, ActiveGame] = {}


def create_game(
    num_opponents: int = 3,
    starting_stack: int = 10000,
    small_blind: int = 5,
    big_blind: int = 10,
    difficulty: str = "medium",
    is_tournament: bool = True,
) -> tuple[str, dict]:
    """Create a new game and start the first hand."""
    game_id = str(uuid.uuid4())[:8]
    active = ActiveGame(
        game_id, num_opponents, starting_stack, small_blind, big_blind, difficulty, is_tournament
    )
    _games[game_id] = active
    result = active.start_new_hand()
    return game_id, result


def get_game(game_id: str) -> ActiveGame | None:
    return _games.get(game_id)


def remove_game(game_id: str) -> None:
    _games.pop(game_id, None)
