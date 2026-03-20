"""Hand strength evaluation for poker AI.

Provides:
- Chen formula for preflop hand ranking
- Preflop hand tier classification (1-5)
- Postflop hand strength using treys evaluator (normalized 0-1)
- Draw detection (flush draws, straight draws)
"""

from __future__ import annotations

import random
from typing import List

from treys import Card as TreysCard, Deck as TreysDeck

from poker_engine.hand_eval import evaluate_hand
from poker_engine.card import card_to_str


# ---------------------------------------------------------------------------
# Card helpers
# ---------------------------------------------------------------------------

_RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
}

_RANK_ORDER = "23456789TJQKA"


def _card_rank(card_int: int) -> str:
    """Extract rank character from a treys card integer."""
    return card_to_str(card_int)[0]


def _card_suit(card_int: int) -> str:
    """Extract suit character from a treys card integer."""
    return card_to_str(card_int)[1]


def _rank_index(rank: str) -> int:
    """Numeric index for a rank character (2=0, A=12)."""
    return _RANK_ORDER.index(rank)


# ---------------------------------------------------------------------------
# Chen formula
# ---------------------------------------------------------------------------

def chen_score(hole_cards: List[int]) -> float:
    """Compute the Chen formula score for a two-card starting hand.

    The Chen formula assigns a numeric value to preflop starting hands:
    - Pair: value of pair * 2, minimum 5 (so 22 = 5, AA = 20 .. adjusted)
    - Highest card value: A=10, K=8, Q=7, J=6, T-2 = face/2
    - Suited bonus: +2
    - Gap penalty: -1 per gap between ranks
    - Connectivity bonus: 0-gap = +1 (no additional penalty)
    - If final score < 0, round up to 0

    Returns:
        Float score (higher = stronger).
    """
    r1 = _card_rank(hole_cards[0])
    r2 = _card_rank(hole_cards[1])
    s1 = _card_suit(hole_cards[0])
    s2 = _card_suit(hole_cards[1])

    v1 = _RANK_VALUES[r1]
    v2 = _RANK_VALUES[r2]

    # Ensure v1 >= v2
    if v1 < v2:
        v1, v2 = v2, v1

    def _chen_card_value(v: int) -> float:
        if v == 14:  # Ace
            return 10.0
        if v == 13:  # King
            return 8.0
        if v == 12:  # Queen
            return 7.0
        if v == 11:  # Jack
            return 6.0
        return v / 2.0

    # Start with highest card value
    score = _chen_card_value(v1)

    # Pair bonus
    if v1 == v2:
        score = max(_chen_card_value(v1) * 2, 5.0)
        return score  # Pairs don't get gap/suited adjustments

    # Suited bonus
    if s1 == s2:
        score += 2.0

    # Gap penalty
    gap = v1 - v2 - 1
    if gap == 0:
        # Connected: +1 bonus
        score += 1.0
    elif gap == 1:
        # One-gap: -1
        score -= 1.0
    elif gap == 2:
        # Two-gap: -2
        score -= 2.0
    elif gap == 3:
        # Three-gap: -4
        score -= 4.0
    else:
        # Four+ gap: -5
        score -= 5.0

    # Bonus for low connected cards that can make straights
    # (both cards <= Q and gap <= 1)
    # This is part of the standard Chen formula

    return max(score, 0.0)


# ---------------------------------------------------------------------------
# Preflop hand tiers (table-based, more accurate than Chen alone)
# ---------------------------------------------------------------------------

_TIER_1 = {"AA", "KK", "QQ", "AKs"}
_TIER_2 = {"JJ", "TT", "AQs", "AKo", "AJs"}
_TIER_3 = {
    "99", "88", "77",
    "ATs", "AQo", "AJo", "ATo",
    "KQs", "KJs", "KQo",
    "QJs",
}
_TIER_4_PAIRS = {"66", "55", "44", "33", "22"}
_TIER_4_SUITED_CONNECTORS = {
    "JTs", "T9s", "98s", "87s", "76s", "65s", "54s",
}
_TIER_4_SUITED_ACES = {
    "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
}
_TIER_4 = _TIER_4_PAIRS | _TIER_4_SUITED_CONNECTORS | _TIER_4_SUITED_ACES


def hole_cards_to_key(hole_cards: List[int]) -> str:
    """Convert two treys-int hole cards to a canonical string like 'AKs'."""
    s1 = card_to_str(hole_cards[0])
    s2 = card_to_str(hole_cards[1])

    rank1, suit1 = s1[0], s1[1]
    rank2, suit2 = s2[0], s2[1]

    r1_idx = _rank_index(rank1)
    r2_idx = _rank_index(rank2)

    if r1_idx < r2_idx:
        rank1, rank2 = rank2, rank1
        suit1, suit2 = suit2, suit1

    if rank1 == rank2:
        return rank1 + rank2  # pocket pair
    suited = "s" if suit1 == suit2 else "o"
    return rank1 + rank2 + suited


def get_hand_tier(hole_cards: List[int]) -> int:
    """Return the preflop tier (1-5) for a pair of hole cards.

    Tier 1 (Premium): AA, KK, QQ, AKs  (Chen >= 12)
    Tier 2 (Strong):  JJ, TT, AQs, AKo, AJs  (Chen >= 9)
    Tier 3 (Playable): 99-77, suited broadways, ATo+  (Chen >= 7)
    Tier 4 (Speculative): 66-22, suited connectors, suited aces  (Chen >= 5)
    Tier 5 (Trash): everything else
    """
    key = hole_cards_to_key(hole_cards)
    if key in _TIER_1:
        return 1
    if key in _TIER_2:
        return 2
    if key in _TIER_3:
        return 3
    if key in _TIER_4:
        return 4
    # Fallback: use Chen score for hands not explicitly listed
    score = chen_score(hole_cards)
    if score >= 12:
        return 1
    if score >= 9:
        return 2
    if score >= 7:
        return 3
    if score >= 5:
        return 4
    return 5


# ---------------------------------------------------------------------------
# Postflop hand strength (treys evaluator, normalized 0-1)
# ---------------------------------------------------------------------------

def postflop_hand_strength(hole_cards: List[int], board: List[int]) -> float:
    """Evaluate postflop hand strength on a 0-1 scale.

    Uses the treys evaluator which returns ranks from 1 (best) to 7462 (worst).
    Normalizes to: strength = 1 - (rank - 1) / 7461

    Returns:
        Float between 0.0 (worst) and 1.0 (best).
    """
    if len(board) < 3:
        return 0.5  # Cannot evaluate without at least 3 community cards
    rank = evaluate_hand(hole_cards, board)
    return 1.0 - (rank - 1) / 7461.0


def hand_strength_category(strength: float) -> str:
    """Categorize hand strength into descriptive labels.

    Returns one of: 'monster', 'strong', 'medium', 'weak', 'trash'.
    """
    if strength > 0.9:
        return "monster"
    if strength > 0.7:
        return "strong"
    if strength > 0.5:
        return "medium"
    if strength > 0.3:
        return "weak"
    return "trash"


# ---------------------------------------------------------------------------
# Draw detection
# ---------------------------------------------------------------------------

def _get_suit_counts(cards: List[int]) -> dict[str, int]:
    """Count cards per suit."""
    counts: dict[str, int] = {}
    for c in cards:
        s = _card_suit(c)
        counts[s] = counts.get(s, 0) + 1
    return counts


def _get_rank_set(cards: List[int]) -> set[int]:
    """Get set of rank values from a list of cards."""
    return {_RANK_VALUES[_card_rank(c)] for c in cards}


def has_flush_draw(hole_cards: List[int], board: List[int]) -> bool:
    """Check if we have a flush draw (4 cards of the same suit, needing 1 more)."""
    all_cards = list(hole_cards) + list(board)
    suit_counts = _get_suit_counts(all_cards)

    # Must have at least one hole card contributing to the flush draw
    hole_suits = [_card_suit(c) for c in hole_cards]
    for suit, count in suit_counts.items():
        if count == 4 and suit in hole_suits:
            return True
    return False


def has_straight_draw(hole_cards: List[int], board: List[int]) -> bool:
    """Check if we have an open-ended straight draw (4 consecutive ranks).

    Also detects gutshot straight draws (4 of 5 consecutive ranks).
    """
    all_cards = list(hole_cards) + list(board)
    ranks = _get_rank_set(all_cards)
    hole_ranks = {_RANK_VALUES[_card_rank(c)] for c in hole_cards}

    # Add low-ace (1) if ace is present for wheel straights
    if 14 in ranks:
        ranks.add(1)
    if 14 in hole_ranks:
        hole_ranks.add(1)

    # Check for open-ended straight draw: 4 consecutive ranks that include a hole card
    for start in range(1, 11):  # 1..10 (A-low through T-high)
        window = set(range(start, start + 5))
        overlap = ranks & window
        # Need exactly 4 of 5 consecutive, and at least one from hole cards
        if len(overlap) >= 4 and overlap & hole_ranks:
            return True
    return False


def draw_equity(hole_cards: List[int], board: List[int]) -> float:
    """Estimate equity from draws.

    Rough heuristics:
    - Flush draw: ~35% on flop, ~19% on turn
    - Open-ended straight draw: ~31% on flop, ~17% on turn
    - Combined (flush + straight draw): ~54% on flop, ~32% on turn
    """
    cards_to_come = 5 - len(board)
    if cards_to_come <= 0:
        return 0.0

    flush = has_flush_draw(hole_cards, board)
    straight = has_straight_draw(hole_cards, board)

    equity = 0.0
    if flush and straight:
        equity = 0.54 if cards_to_come == 2 else 0.32
    elif flush:
        equity = 0.35 if cards_to_come == 2 else 0.19
    elif straight:
        equity = 0.31 if cards_to_come == 2 else 0.17

    return equity


# ---------------------------------------------------------------------------
# Monte Carlo hand strength estimation (for more accurate evaluation)
# ---------------------------------------------------------------------------

def _remaining_deck(exclude: List[int]) -> List[int]:
    """Return all cards not in the exclude set."""
    exclude_set = set(exclude)
    return [c for c in TreysDeck.GetFullDeck() if c not in exclude_set]


def estimate_hand_strength(
    hole_cards: List[int],
    board: List[int],
    num_simulations: int = 500,
    num_opponents: int = 1,
    rng: random.Random | None = None,
) -> float:
    """Estimate hand strength via Monte Carlo simulation.

    Deals random remaining board cards and opponent hands, then computes
    the fraction of simulations where our hand wins or ties.

    Returns:
        Float between 0.0 and 1.0.
    """
    if rng is None:
        rng = random.Random()

    known_cards = list(hole_cards) + list(board)
    remaining = _remaining_deck(known_cards)
    cards_needed_for_board = 5 - len(board)
    cards_per_sim = cards_needed_for_board + 2 * num_opponents

    if len(remaining) < cards_per_sim:
        return 0.5

    wins = 0
    ties = 0

    for _ in range(num_simulations):
        rng.shuffle(remaining)
        idx = 0

        sim_board = list(board) + remaining[idx:idx + cards_needed_for_board]
        idx += cards_needed_for_board

        our_score = evaluate_hand(hole_cards, sim_board)

        we_win = True
        any_tie = False
        for _ in range(num_opponents):
            opp_cards = remaining[idx:idx + 2]
            idx += 2
            opp_score = evaluate_hand(opp_cards, sim_board)
            if opp_score < our_score:
                we_win = False
                break
            elif opp_score == our_score:
                any_tie = True

        if we_win and not any_tie:
            wins += 1
        elif we_win and any_tie:
            ties += 1

    return (wins + ties * 0.5) / num_simulations
