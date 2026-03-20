"""Rule-based AI with 3 difficulty levels for Texas Hold'em."""

from __future__ import annotations

import random
from enum import Enum
from typing import Dict, List, Optional, Tuple

from poker_engine import Action, ActionType, ValidActions
from poker_engine.card import card_to_str
from poker_engine.constants import GamePhase, Street, BETTING_PHASES
from poker_engine.game_state import GameState

from .hand_strength import estimate_hand_strength


class Difficulty(Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ---------------------------------------------------------------------------
# Preflop hand tiers
# ---------------------------------------------------------------------------

# Cards are represented as rank-pair strings: e.g. "AKs" (suited), "AKo" (off)
# Pocket pairs: "AA", "KK", etc.

_TIER_1 = {"AA", "KK", "QQ", "AKs"}
_TIER_2 = {"JJ", "TT", "AQs", "AKo", "AQo"}
_TIER_3 = {"99", "88", "77", "AJs", "ATs", "KQs", "KQo"}
_TIER_4_PAIRS = {"66", "55", "44", "33", "22"}
_TIER_4_SUITED_CONNECTORS = {
    "JTs", "T9s", "98s", "87s", "76s", "65s", "54s",
}
_TIER_4_SUITED_ACES = {
    "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
}
_TIER_4 = _TIER_4_PAIRS | _TIER_4_SUITED_CONNECTORS | _TIER_4_SUITED_ACES


def _hole_cards_to_key(hole_cards: List[int]) -> str:
    """Convert two treys-int hole cards to a canonical string like 'AKs'."""
    s1 = card_to_str(hole_cards[0])  # e.g. "As"
    s2 = card_to_str(hole_cards[1])

    rank1, suit1 = s1[0], s1[1]
    rank2, suit2 = s2[0], s2[1]

    rank_order = "23456789TJQKA"
    r1_idx = rank_order.index(rank1)
    r2_idx = rank_order.index(rank2)

    # Put higher rank first
    if r1_idx < r2_idx:
        rank1, rank2 = rank2, rank1
        suit1, suit2 = suit2, suit1

    if rank1 == rank2:
        return rank1 + rank2  # pocket pair
    suited = "s" if suit1 == suit2 else "o"
    return rank1 + rank2 + suited


def get_hand_tier(hole_cards: List[int]) -> int:
    """Return the preflop tier (1-5) for a pair of hole cards."""
    key = _hole_cards_to_key(hole_cards)
    if key in _TIER_1:
        return 1
    if key in _TIER_2:
        return 2
    if key in _TIER_3:
        return 3
    if key in _TIER_4:
        return 4
    return 5


# ---------------------------------------------------------------------------
# AI decision helpers
# ---------------------------------------------------------------------------

def _make_fold(valid: ValidActions) -> Action:
    if valid.can_fold:
        return Action(type=ActionType.FOLD)
    # Shouldn't happen, but check is always safe
    return Action(type=ActionType.CHECK)


def _make_check_or_fold(valid: ValidActions) -> Action:
    if valid.can_check:
        return Action(type=ActionType.CHECK)
    return _make_fold(valid)


def _make_call(valid: ValidActions) -> Action:
    if valid.can_call:
        return Action(type=ActionType.CALL, amount=valid.call_amount)
    if valid.can_check:
        return Action(type=ActionType.CHECK)
    return _make_fold(valid)


def _make_raise(valid: ValidActions, amount: Optional[int] = None) -> Action:
    if not valid.can_raise:
        return _make_call(valid)
    if amount is None:
        amount = valid.min_raise
    amount = max(valid.min_raise, min(amount, valid.max_raise))
    return Action(type=ActionType.RAISE, amount=amount)


# ---------------------------------------------------------------------------
# Easy AI: loose-passive, plays too many hands, rarely raises
# ---------------------------------------------------------------------------

def _easy_decide(
    state: GameState,
    valid: ValidActions,
    rng: random.Random,
) -> Action:
    """Loose-passive: calls too much, rarely raises, occasionally folds."""
    r = rng.random()

    # Rarely fold (only 15% of the time when facing a bet)
    if valid.can_call and r < 0.15:
        return _make_fold(valid)

    # Rarely raise (5%)
    if valid.can_raise and r > 0.95:
        return _make_raise(valid, valid.min_raise)

    # Default: call or check
    return _make_call(valid)


# ---------------------------------------------------------------------------
# Medium AI: preflop charts + basic pot odds
# ---------------------------------------------------------------------------

def _medium_decide(
    state: GameState,
    valid: ValidActions,
    rng: random.Random,
) -> Action:
    """Uses preflop hand tiers and basic pot odds post-flop."""
    player = state.current_player
    if player is None or not player.hole_cards:
        return _make_check_or_fold(valid)

    hole_cards = player.hole_cards

    # --- Preflop ---
    if state.street == Street.PREFLOP:
        tier = get_hand_tier(hole_cards)
        if tier == 1:
            # Premium: always raise big
            raise_amt = valid.min_raise + (valid.max_raise - valid.min_raise) // 2 if valid.can_raise else 0
            return _make_raise(valid, raise_amt)
        elif tier == 2:
            # Strong: raise
            return _make_raise(valid, valid.min_raise)
        elif tier == 3:
            # Medium: call or small raise
            if rng.random() < 0.3 and valid.can_raise:
                return _make_raise(valid, valid.min_raise)
            return _make_call(valid)
        elif tier == 4:
            # Marginal: call if cheap
            if valid.can_call and valid.call_amount <= state.big_blind * 3:
                return _make_call(valid)
            return _make_check_or_fold(valid)
        else:
            # Weak: fold unless free
            return _make_check_or_fold(valid)

    # --- Post-flop: basic pot odds ---
    pot = state.total_pot
    to_call = valid.call_amount if valid.can_call else 0

    # Simple hand strength: use tier as rough proxy
    tier = get_hand_tier(hole_cards)
    strength = 1.0 - (tier - 1) * 0.2  # tier1=1.0, tier5=0.2

    if to_call > 0:
        pot_odds = to_call / (pot + to_call) if (pot + to_call) > 0 else 1.0
        if strength > pot_odds:
            if strength > 0.7 and rng.random() < 0.4:
                return _make_raise(valid, valid.min_raise)
            return _make_call(valid)
        else:
            return _make_fold(valid)
    else:
        # No bet to call
        if strength > 0.6 and rng.random() < 0.5:
            return _make_raise(valid, valid.min_raise)
        return _make_check_or_fold(valid)


# ---------------------------------------------------------------------------
# Hard AI: Monte Carlo hand strength + position-aware bet sizing
# ---------------------------------------------------------------------------

def _get_position(state: GameState) -> str:
    """Return position category: 'early', 'middle', 'late', or 'blind'."""
    player = state.current_player
    if player is None:
        return "middle"

    pid = player.id
    n_players = len([p for p in state.players if p.is_in_hand])

    if pid == state.dealer_pos:
        return "late"
    if pid == state.small_blind_pos or pid == state.big_blind_pos:
        return "blind"

    # Rough: first third = early, else middle/late
    active_ids = [p.id for p in state.players if p.is_in_hand]
    if not active_ids:
        return "middle"
    try:
        pos_index = active_ids.index(pid)
    except ValueError:
        return "middle"

    frac = pos_index / max(len(active_ids) - 1, 1)
    if frac < 0.33:
        return "early"
    elif frac < 0.66:
        return "middle"
    return "late"


def _hard_decide(
    state: GameState,
    valid: ValidActions,
    rng: random.Random,
) -> Action:
    """Monte Carlo hand strength with position-aware bet sizing."""
    player = state.current_player
    if player is None or not player.hole_cards:
        return _make_check_or_fold(valid)

    hole_cards = player.hole_cards
    board = state.board
    position = _get_position(state)

    # Number of opponents still in hand
    num_opponents = max(1, len(state.in_hand_players) - 1)

    # --- Preflop: use tier-based strategy with position awareness ---
    if state.street == Street.PREFLOP:
        tier = get_hand_tier(hole_cards)
        position_tightness = {
            "early": 0,
            "middle": 1,
            "late": 2,
            "blind": 1,
        }.get(position, 1)

        playable_tier = 3 + position_tightness  # early: 3, middle: 4, late: 5

        if tier == 1:
            # Premium: big raise
            raise_amt = state.big_blind * 4 if valid.can_raise else 0
            return _make_raise(valid, max(valid.min_raise, raise_amt) if valid.can_raise else 0)
        elif tier == 2:
            return _make_raise(valid, valid.min_raise)
        elif tier <= playable_tier:
            if valid.can_call and valid.call_amount <= state.big_blind * 3:
                return _make_call(valid)
            return _make_check_or_fold(valid)
        else:
            return _make_check_or_fold(valid)

    # --- Post-flop: Monte Carlo hand strength ---
    strength = estimate_hand_strength(
        hole_cards, board,
        num_simulations=300,
        num_opponents=num_opponents,
        rng=rng,
    )

    pot = state.total_pot
    to_call = valid.call_amount if valid.can_call else 0

    # Position modifier: in late position we can be more aggressive
    aggression_bonus = {"early": -0.05, "middle": 0.0, "late": 0.05, "blind": -0.02}.get(position, 0.0)
    effective_strength = strength + aggression_bonus

    if to_call > 0:
        pot_odds = to_call / (pot + to_call) if (pot + to_call) > 0 else 1.0

        if effective_strength > 0.8:
            # Very strong: raise big
            raise_amt = int(pot * 0.75)
            return _make_raise(valid, max(valid.min_raise, raise_amt) if valid.can_raise else 0)
        elif effective_strength > 0.6:
            # Good: raise sometimes, call otherwise
            if rng.random() < 0.35:
                return _make_raise(valid, valid.min_raise)
            return _make_call(valid)
        elif effective_strength > pot_odds:
            # Decent pot odds: call
            return _make_call(valid)
        else:
            return _make_fold(valid)
    else:
        # No bet to face
        if effective_strength > 0.7:
            raise_amt = int(pot * 0.6)
            return _make_raise(valid, max(valid.min_raise, raise_amt) if valid.can_raise else 0)
        elif effective_strength > 0.5 and rng.random() < 0.4:
            return _make_raise(valid, valid.min_raise)
        else:
            return _make_check_or_fold(valid)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class BaselineAI:
    """Rule-based AI with configurable difficulty.

    Usage:
        ai = BaselineAI(difficulty=Difficulty.HARD, seed=42)
        action = ai.choose_action(game_state, valid_actions)
    """

    def __init__(
        self,
        difficulty: Difficulty = Difficulty.MEDIUM,
        seed: int | None = None,
    ):
        self.difficulty = difficulty
        self._rng = random.Random(seed)

    def choose_action(
        self,
        state: GameState,
        valid_actions: ValidActions,
    ) -> Action:
        """Choose an action given the current game state and valid actions.

        Args:
            state: Current game state snapshot.
            valid_actions: The valid actions for the current player.

        Returns:
            An Action to take.
        """
        if self.difficulty == Difficulty.EASY:
            return _easy_decide(state, valid_actions, self._rng)
        elif self.difficulty == Difficulty.MEDIUM:
            return _medium_decide(state, valid_actions, self._rng)
        else:
            return _hard_decide(state, valid_actions, self._rng)
