"""GTO-baseline poker AI with three difficulty levels.

Replaces the old random-based AIPlayer with a proper strategy:
- Preflop: Position-aware hand selection using tier system and Chen formula
- Postflop: Hand strength evaluation, pot odds, continuation bets, draw play
- Difficulty scaling: Easy (loose-passive), Medium (GTO baseline), Hard (TAG + bluffs)
"""

from __future__ import annotations

import random
from enum import Enum
from typing import List, Optional

from poker_engine import Action, ActionType, Game, ValidActions
from poker_engine.constants import GamePhase, Street, BETTING_PHASES

from .hand_strength import (
    chen_score,
    get_hand_tier,
    hole_cards_to_key,
    postflop_hand_strength,
    hand_strength_category,
    has_flush_draw,
    has_straight_draw,
    draw_equity,
    estimate_hand_strength,
)


class Difficulty(Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ---------------------------------------------------------------------------
# Action helpers
# ---------------------------------------------------------------------------

def _make_fold(va: ValidActions) -> Action:
    if va.can_fold:
        return Action(type=ActionType.FOLD)
    return Action(type=ActionType.CHECK)


def _make_check_or_fold(va: ValidActions) -> Action:
    if va.can_check:
        return Action(type=ActionType.CHECK)
    return _make_fold(va)


def _make_call(va: ValidActions) -> Action:
    if va.can_call:
        return Action(type=ActionType.CALL, amount=va.call_amount)
    if va.can_check:
        return Action(type=ActionType.CHECK)
    return _make_fold(va)


def _make_raise(va: ValidActions, amount: Optional[int] = None) -> Action:
    if not va.can_raise:
        return _make_call(va)
    if amount is None:
        amount = va.min_raise
    amount = max(va.min_raise, min(amount, va.max_raise))
    return Action(type=ActionType.RAISE, amount=amount)


# ---------------------------------------------------------------------------
# Position detection
# ---------------------------------------------------------------------------

def _get_position(player_id: int, game: Game) -> str:
    """Determine position category: 'early', 'middle', 'late', or 'blind'.

    Position is relative to the dealer button among players still in the hand.
    """
    if player_id == game.small_blind_pos:
        return "blind"
    if player_id == game.big_blind_pos:
        return "blind"
    if player_id == game.dealer_pos:
        return "late"

    # Build ordered list of active seats from left of dealer
    n = len(game.players)
    in_hand_ids = []
    pos = game.dealer_pos
    for _ in range(n):
        pos = (pos + 1) % n
        if game.players[pos].is_in_hand:
            in_hand_ids.append(pos)

    if player_id not in in_hand_ids:
        return "middle"

    idx = in_hand_ids.index(player_id)
    total = len(in_hand_ids)

    if total <= 3:
        return "late"  # Short-handed, all positions are late-ish

    # First third = early, second third = middle, last third = late
    frac = idx / max(total - 1, 1)
    if frac < 0.33:
        return "early"
    if frac < 0.66:
        return "middle"
    return "late"


# ---------------------------------------------------------------------------
# Aggression detection (was there a raise before us?)
# ---------------------------------------------------------------------------

def _facing_raise(game: Game) -> bool:
    """Check if there has been a raise action in the current betting round."""
    for action in reversed(game.action_history):
        if action.type in (ActionType.RAISE, ActionType.ALL_IN):
            return True
        # Once we hit a deal or the start, stop looking
    return False


def _facing_3bet(game: Game) -> bool:
    """Check if there have been 2+ raises in the current betting round."""
    raise_count = 0
    for action in reversed(game.action_history):
        if action.type in (ActionType.RAISE, ActionType.ALL_IN):
            raise_count += 1
    return raise_count >= 2


def _we_were_preflop_aggressor(player_id: int, game: Game) -> bool:
    """Check if this player was the last raiser preflop."""
    for action in reversed(game.action_history):
        if action.type in (ActionType.RAISE, ActionType.ALL_IN):
            return action.player_id == player_id
    return False


# ---------------------------------------------------------------------------
# Easy AI: loose-passive, plays too many hands, never bluffs, calls too much
# ---------------------------------------------------------------------------

def _easy_preflop(va: ValidActions, tier: int, rng: random.Random) -> Action:
    """Easy preflop: plays 2 tiers wider than optimal, rarely raises."""
    # Easy plays almost everything (tier <= 7 effectively means everything)
    effective_tier = tier  # No tightening

    if effective_tier <= 2:
        # Premium/Strong: even easy AI raises these
        return _make_raise(va, va.min_raise)
    if effective_tier <= 5:
        # Plays all tiers, just calls
        return _make_call(va)
    # Tier 5 trash: still calls 60% of the time (too loose)
    if rng.random() < 0.6:
        return _make_call(va)
    return _make_check_or_fold(va)


def _easy_postflop(
    va: ValidActions,
    strength: float,
    pot: int,
    rng: random.Random,
) -> Action:
    """Easy postflop: never bluffs, calls too much, rarely raises."""
    to_call = va.call_amount if va.can_call else 0

    if to_call > 0:
        # Easy AI calls way too much (only folds with very weak hands)
        if strength < 0.15:
            return _make_fold(va)
        if strength > 0.8 and rng.random() < 0.2:
            return _make_raise(va, va.min_raise)
        return _make_call(va)
    else:
        # No bet to face: check mostly, occasionally bet strong hands
        if strength > 0.75 and rng.random() < 0.3:
            bet_size = int(pot * 0.33)
            return _make_raise(va, max(va.min_raise, bet_size))
        return _make_check_or_fold(va)


# ---------------------------------------------------------------------------
# Medium AI: GTO baseline
# ---------------------------------------------------------------------------

def _medium_preflop(
    va: ValidActions,
    tier: int,
    position: str,
    facing_raise: bool,
    facing_3bet: bool,
    big_blind: int,
    rng: random.Random,
) -> Action:
    """Medium preflop: position-aware hand selection, proper sizing."""
    # Tighten ranges when facing aggression
    effective_tier = tier
    if facing_3bet:
        effective_tier = tier  # Only continue with tier 1-2
        if effective_tier > 2:
            return _make_check_or_fold(va)
        if effective_tier == 1:
            # 4-bet with premium
            raise_amt = int(big_blind * 9)
            return _make_raise(va, max(va.min_raise, raise_amt))
        # Tier 2 facing 3bet: call
        return _make_call(va)

    if facing_raise:
        # Tighten by 1 tier
        effective_tier += 1

    # Position-based opening ranges
    max_tier_by_position = {
        "early": 2,    # Only Tier 1-2
        "middle": 3,   # Tier 1-3
        "late": 4,     # Tier 1-4
        "blind": 3,    # Defend with Tier 1-3
    }
    max_playable = max_tier_by_position.get(position, 3)

    if effective_tier > max_playable:
        return _make_check_or_fold(va)

    # Raise tiers
    raise_tier_by_position = {
        "early": 1,    # Raise only Tier 1
        "middle": 2,   # Raise Tier 1-2
        "late": 3,     # Raise Tier 1-3
        "blind": 1,    # Re-raise only Tier 1
    }
    max_raise_tier = raise_tier_by_position.get(position, 2)

    if tier <= max_raise_tier:
        # Raise sizing: 2.5-3x BB for open, 3x previous raise for 3bet
        if facing_raise:
            raise_amt = va.min_raise  # Standard 3bet sizing
        else:
            raise_amt = int(big_blind * 2.5)
            # Add BB per limper (simplified: just use 3x)
            if rng.random() < 0.5:
                raise_amt = int(big_blind * 3)
        return _make_raise(va, max(va.min_raise, raise_amt))

    # Playable but not raising: call
    return _make_call(va)


def _medium_postflop(
    va: ValidActions,
    strength: float,
    category: str,
    pot: int,
    is_aggressor: bool,
    hole_cards: List[int],
    board: List[int],
    rng: random.Random,
) -> Action:
    """Medium postflop: GTO-baseline with c-bets, value bets, pot odds."""
    to_call = va.call_amount if va.can_call else 0
    d_equity = draw_equity(hole_cards, board)
    effective_strength = max(strength, strength + d_equity * 0.5)

    if to_call > 0:
        # Facing a bet
        pot_odds = to_call / (pot + to_call) if (pot + to_call) > 0 else 1.0

        if category == "monster":
            # Raise for value
            raise_amt = int(pot * 0.75)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if category == "strong":
            # Raise sometimes, call always
            if rng.random() < 0.35:
                raise_amt = int(pot * 0.6)
                return _make_raise(va, max(va.min_raise, raise_amt))
            return _make_call(va)

        if effective_strength > pot_odds + 0.05:
            # Getting the right price: call
            return _make_call(va)

        # Draws: semi-bluff raise occasionally
        if d_equity > 0.25 and rng.random() < 0.3:
            raise_amt = int(pot * 0.5)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if d_equity > 0.15 and effective_strength > pot_odds:
            return _make_call(va)

        return _make_fold(va)

    else:
        # No bet to face (we can check or bet)
        if category == "monster":
            # Value bet large
            raise_amt = int(pot * 0.75)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if category == "strong":
            # Value bet 50-66% pot
            raise_amt = int(pot * (0.5 + rng.random() * 0.16))
            return _make_raise(va, max(va.min_raise, raise_amt))

        if is_aggressor:
            # Continuation bet: bet with strong+ hands, bluff ~30%
            if strength > 0.5 or rng.random() < 0.30:
                cbet_size = int(pot * (0.5 + rng.random() * 0.16))
                return _make_raise(va, max(va.min_raise, cbet_size))

        if category == "medium":
            # Check with medium hands when not aggressor
            return _make_check_or_fold(va)

        # Draws: semi-bluff
        if d_equity > 0.25 and rng.random() < 0.4:
            raise_amt = int(pot * 0.5)
            return _make_raise(va, max(va.min_raise, raise_amt))

        return _make_check_or_fold(va)


# ---------------------------------------------------------------------------
# Hard AI: TAG + pressure, bluffs at optimal frequency, uses position
# ---------------------------------------------------------------------------

def _hard_preflop(
    va: ValidActions,
    tier: int,
    position: str,
    facing_raise: bool,
    facing_3bet: bool,
    big_blind: int,
    rng: random.Random,
) -> Action:
    """Hard preflop: tight-aggressive, positional pressure."""
    # Facing 3bet: only premium hands, 4-bet aggressively
    if facing_3bet:
        if tier == 1:
            raise_amt = int(big_blind * 10)
            return _make_raise(va, max(va.min_raise, raise_amt))
        if tier == 2 and rng.random() < 0.5:
            return _make_call(va)
        return _make_check_or_fold(va)

    # Facing raise: tighter
    if facing_raise:
        if tier == 1:
            # 3-bet premium
            raise_amt = int(va.call_amount * 3) if va.can_call else int(big_blind * 8)
            return _make_raise(va, max(va.min_raise, raise_amt))
        if tier == 2:
            # Mix of 3-bet and call
            if rng.random() < 0.4:
                raise_amt = int(va.call_amount * 3) if va.can_call else int(big_blind * 8)
                return _make_raise(va, max(va.min_raise, raise_amt))
            return _make_call(va)
        if tier == 3 and position in ("late", "blind"):
            # Defend/call in position
            if va.can_call and va.call_amount <= big_blind * 4:
                return _make_call(va)
        return _make_check_or_fold(va)

    # Opening ranges (tighter than medium, more raises)
    max_tier_by_position = {
        "early": 2,
        "middle": 3,
        "late": 4,
        "blind": 3,
    }
    max_playable = max_tier_by_position.get(position, 3)

    if tier > max_playable:
        # Occasionally steal from late position with marginal hands
        if position == "late" and tier == 5 and rng.random() < 0.15:
            raise_amt = int(big_blind * 2.5)
            return _make_raise(va, max(va.min_raise, raise_amt))
        return _make_check_or_fold(va)

    # Always raise when opening (no limping)
    if tier <= 2:
        raise_amt = int(big_blind * 3)
    elif tier <= 3:
        raise_amt = int(big_blind * 2.5)
    else:
        raise_amt = int(big_blind * 2.2)

    return _make_raise(va, max(va.min_raise, raise_amt))


def _hard_postflop(
    va: ValidActions,
    strength: float,
    category: str,
    pot: int,
    is_aggressor: bool,
    hole_cards: List[int],
    board: List[int],
    position: str,
    num_opponents: int,
    rng: random.Random,
) -> Action:
    """Hard postflop: optimal bluff frequency, positional pressure, draw aggression."""
    to_call = va.call_amount if va.can_call else 0
    d_equity = draw_equity(hole_cards, board)
    effective_strength = max(strength, strength + d_equity * 0.5)

    # Position aggression modifier
    pos_aggression = {
        "early": 0.0,
        "middle": 0.05,
        "late": 0.10,
        "blind": -0.05,
    }.get(position, 0.0)
    effective_strength += pos_aggression

    if to_call > 0:
        pot_odds = to_call / (pot + to_call) if (pot + to_call) > 0 else 1.0

        if category == "monster":
            # Slow-play sometimes in position, otherwise raise big
            if position == "late" and rng.random() < 0.2:
                return _make_call(va)
            raise_amt = int(pot * 0.8)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if category == "strong":
            # Raise for value most of the time
            if rng.random() < 0.55:
                raise_amt = int(pot * 0.65)
                return _make_raise(va, max(va.min_raise, raise_amt))
            return _make_call(va)

        # Semi-bluff with strong draws
        if d_equity > 0.3 and rng.random() < 0.5:
            raise_amt = int(pot * 0.6)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if effective_strength > pot_odds + 0.03:
            return _make_call(va)

        if d_equity > 0.15 and effective_strength > pot_odds:
            return _make_call(va)

        # Occasional bluff-raise (exploit)
        if position == "late" and rng.random() < 0.08:
            raise_amt = int(pot * 0.7)
            return _make_raise(va, max(va.min_raise, raise_amt))

        return _make_fold(va)

    else:
        # No bet to face
        if category == "monster":
            # Check-raise trap sometimes
            if rng.random() < 0.25:
                return _make_check_or_fold(va)
            raise_amt = int(pot * 0.75)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if category == "strong":
            raise_amt = int(pot * (0.55 + rng.random() * 0.2))
            return _make_raise(va, max(va.min_raise, raise_amt))

        if is_aggressor:
            # Aggressive c-betting: bet 60-70% of the time
            if strength > 0.4 or rng.random() < 0.35:
                cbet_size = int(pot * (0.5 + rng.random() * 0.2))
                return _make_raise(va, max(va.min_raise, cbet_size))

        # Semi-bluff draws aggressively
        if d_equity > 0.25 and rng.random() < 0.55:
            raise_amt = int(pot * 0.55)
            return _make_raise(va, max(va.min_raise, raise_amt))

        if category == "medium" and position == "late" and rng.random() < 0.35:
            # Position bet with medium hands
            raise_amt = int(pot * 0.45)
            return _make_raise(va, max(va.min_raise, raise_amt))

        # Occasional pure bluff from late position
        if position == "late" and category == "trash" and rng.random() < 0.12:
            raise_amt = int(pot * 0.6)
            return _make_raise(va, max(va.min_raise, raise_amt))

        return _make_check_or_fold(va)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class BaselineAI:
    """GTO-baseline poker AI with configurable difficulty.

    The decide() method matches the signature expected by game_manager:
        decide(valid_actions: ValidActions, game: Game) -> Action

    Difficulty levels:
    - Easy:   Loose-passive, plays too many hands, never bluffs, calls too much
    - Medium: GTO baseline with proper preflop ranges, pot odds, c-bets
    - Hard:   Tight-aggressive, positional pressure, optimal bluff frequency
    """

    def __init__(self, difficulty: str = "medium", seed: int | None = None):
        if isinstance(difficulty, Difficulty):
            self.difficulty = difficulty
        else:
            self.difficulty = Difficulty(difficulty)
        self._rng = random.Random(seed)

    def decide(self, valid_actions: ValidActions, game: Game) -> Action:
        """Choose an action given valid actions and game state.

        This is the main entry point, matching the AIPlayer interface
        in game_manager.py.
        """
        player_id = game.current_player_idx
        player = game.players[player_id]

        if not player.hole_cards:
            return _make_check_or_fold(valid_actions)

        hole_cards = player.hole_cards
        board = game.board
        position = _get_position(player_id, game)
        big_blind = game.blind_manager.big_blind
        pot = game.pot_manager.total
        facing_raise = _facing_raise(game)
        facing_3bet = _facing_3bet(game)
        is_aggressor = _we_were_preflop_aggressor(player_id, game)
        num_opponents = max(1, len([p for p in game.players if p.is_in_hand]) - 1)

        is_preflop = game.phase == GamePhase.PREFLOP_BET
        tier = get_hand_tier(hole_cards)

        if self.difficulty == Difficulty.EASY:
            if is_preflop:
                return _easy_preflop(valid_actions, tier, self._rng)
            strength = postflop_hand_strength(hole_cards, board) if len(board) >= 3 else 0.5
            return _easy_postflop(valid_actions, strength, pot, self._rng)

        elif self.difficulty == Difficulty.MEDIUM:
            if is_preflop:
                return _medium_preflop(
                    valid_actions, tier, position,
                    facing_raise, facing_3bet,
                    big_blind, self._rng,
                )
            strength = postflop_hand_strength(hole_cards, board) if len(board) >= 3 else 0.5
            category = hand_strength_category(strength)
            return _medium_postflop(
                valid_actions, strength, category, pot,
                is_aggressor, hole_cards, board, self._rng,
            )

        else:  # HARD
            if is_preflop:
                return _hard_preflop(
                    valid_actions, tier, position,
                    facing_raise, facing_3bet,
                    big_blind, self._rng,
                )
            # Hard uses Monte Carlo for more accurate strength estimation
            mc_strength = estimate_hand_strength(
                hole_cards, board,
                num_simulations=300,
                num_opponents=num_opponents,
                rng=self._rng,
            ) if len(board) >= 3 else 0.5
            # Also get the raw evaluator strength for categorization
            raw_strength = postflop_hand_strength(hole_cards, board) if len(board) >= 3 else 0.5
            category = hand_strength_category(raw_strength)
            # Use the higher of MC and raw for effective decisions
            strength = max(mc_strength, raw_strength * 0.8 + mc_strength * 0.2)
            return _hard_postflop(
                valid_actions, strength, category, pot,
                is_aggressor, hole_cards, board,
                position, num_opponents, self._rng,
            )
