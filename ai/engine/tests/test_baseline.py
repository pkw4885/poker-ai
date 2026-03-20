"""Tests for baseline AI at all difficulty levels."""

from __future__ import annotations

import pytest

from poker_engine import Action, ActionType, Game, ValidActions
from poker_engine.constants import GamePhase, BETTING_PHASES

from ai.engine.baseline import BaselineAI, Difficulty, get_hand_tier
from poker_engine.card import str_to_card


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_game(seed: int = 42) -> Game:
    """Create a 3-player game and start a hand."""
    game = Game(player_names=["Alice", "Bob", "Charlie"], starting_stacks=1000, seed=seed)
    game.start_hand()
    return game


def _action_is_valid(action: Action, valid: ValidActions) -> bool:
    """Check whether *action* is allowed by *valid*."""
    if action.type == ActionType.FOLD:
        return valid.can_fold
    if action.type == ActionType.CHECK:
        return valid.can_check
    if action.type == ActionType.CALL:
        return valid.can_call
    if action.type == ActionType.RAISE:
        return valid.can_raise and valid.min_raise <= action.amount <= valid.max_raise
    if action.type == ActionType.ALL_IN:
        return valid.can_raise or valid.can_call
    return False


# ---------------------------------------------------------------------------
# Tests: each difficulty returns a valid action
# ---------------------------------------------------------------------------

class TestBaselineReturnsValidActions:
    """Ensure every difficulty returns an action accepted by ValidActions."""

    @pytest.mark.parametrize("difficulty", list(Difficulty))
    def test_returns_valid_action_preflop(self, difficulty: Difficulty) -> None:
        game = _setup_game(seed=1)
        state = game.state
        valid = game.get_valid_actions()
        ai = BaselineAI(difficulty=difficulty, seed=99)
        action = ai.choose_action(state, valid)

        assert isinstance(action, Action)
        assert _action_is_valid(action, valid), (
            f"{difficulty.value} AI returned invalid action {action} "
            f"for valid={valid}"
        )

    @pytest.mark.parametrize("difficulty", list(Difficulty))
    def test_returns_valid_action_postflop(self, difficulty: Difficulty) -> None:
        """Play through preflop to reach the flop, then ask the AI."""
        game = _setup_game(seed=7)

        # Play preflop: everyone calls/checks until we reach a post-flop phase
        safety = 0
        while game.phase in BETTING_PHASES and game.state.street.value <= 1 and safety < 30:
            valid = game.get_valid_actions()
            if valid.can_check:
                game.act(Action(type=ActionType.CHECK))
            elif valid.can_call:
                game.act(Action(type=ActionType.CALL, amount=valid.call_amount))
            else:
                game.act(Action(type=ActionType.FOLD))
            safety += 1

        # If we haven't reached postflop, skip
        if game.phase not in BETTING_PHASES:
            pytest.skip("Hand ended before postflop")

        state = game.state
        valid = game.get_valid_actions()
        ai = BaselineAI(difficulty=difficulty, seed=99)
        action = ai.choose_action(state, valid)

        assert isinstance(action, Action)
        assert _action_is_valid(action, valid)


# ---------------------------------------------------------------------------
# Tests: AI doesn't crash on various game states
# ---------------------------------------------------------------------------

class TestBaselineRobustness:
    """Ensure the AI doesn't crash across many random seeds."""

    @pytest.mark.parametrize("seed", range(10))
    @pytest.mark.parametrize("difficulty", list(Difficulty))
    def test_no_crash_full_hand(self, seed: int, difficulty: Difficulty) -> None:
        """Run a full hand with one AI player and two callers."""
        game = Game(
            player_names=["AI", "Caller1", "Caller2"],
            starting_stacks=1000,
            seed=seed,
        )
        game.start_hand()
        ai = BaselineAI(difficulty=difficulty, seed=seed + 100)

        safety = 0
        while game.phase in BETTING_PHASES and safety < 50:
            pid = game.current_player_idx
            valid = game.get_valid_actions()
            state = game.state

            if pid == 0:
                action = ai.choose_action(state, valid)
            else:
                # Simple caller
                if valid.can_check:
                    action = Action(type=ActionType.CHECK)
                elif valid.can_call:
                    action = Action(type=ActionType.CALL, amount=valid.call_amount)
                else:
                    action = Action(type=ActionType.FOLD)

            assert _action_is_valid(action, valid), (
                f"Invalid action {action} on seed={seed}, difficulty={difficulty.value}"
            )
            game.act(action)
            safety += 1

        # Hand should have finished
        assert game.phase == GamePhase.HAND_OVER or safety >= 50


# ---------------------------------------------------------------------------
# Tests: hand tier classification
# ---------------------------------------------------------------------------

class TestHandTier:
    def test_pocket_aces_tier1(self) -> None:
        cards = [str_to_card("As"), str_to_card("Ah")]
        assert get_hand_tier(cards) == 1

    def test_pocket_kings_tier1(self) -> None:
        cards = [str_to_card("Ks"), str_to_card("Kh")]
        assert get_hand_tier(cards) == 1

    def test_ak_suited_tier1(self) -> None:
        cards = [str_to_card("As"), str_to_card("Ks")]
        assert get_hand_tier(cards) == 1

    def test_ak_offsuit_tier2(self) -> None:
        cards = [str_to_card("As"), str_to_card("Kh")]
        assert get_hand_tier(cards) == 2

    def test_low_pair_tier4(self) -> None:
        cards = [str_to_card("3s"), str_to_card("3h")]
        assert get_hand_tier(cards) == 4

    def test_junk_tier5(self) -> None:
        cards = [str_to_card("7s"), str_to_card("2h")]
        assert get_hand_tier(cards) == 5
