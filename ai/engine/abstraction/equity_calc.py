"""Equity calculator using Monte Carlo simulation."""

from __future__ import annotations

import random
from typing import List

from treys import Deck as TreysDeck

from poker_engine.hand_eval import evaluate_hand


def _remaining_deck(exclude: List[int]) -> List[int]:
    """Return all 52 cards minus those in *exclude*."""
    exclude_set = set(exclude)
    return [c for c in TreysDeck.GetFullDeck() if c not in exclude_set]


def calculate_equity(
    hole_cards: List[int],
    board: List[int],
    num_opponents: int = 1,
    simulations: int = 1000,
    rng: random.Random | None = None,
) -> float:
    """Estimate the equity (win probability) of a hand via Monte Carlo.

    Randomly completes the board and deals opponent hands, then checks
    how often our hand is the best.

    Args:
        hole_cards: Our two hole cards (treys int format).
        board: Community cards so far (0-5 cards).
        num_opponents: Number of opponents to simulate.
        simulations: Number of Monte Carlo trials.
        rng: Optional RNG for reproducibility.

    Returns:
        Float in [0.0, 1.0] representing estimated equity.
    """
    if rng is None:
        rng = random.Random()

    known = list(hole_cards) + list(board)
    remaining = _remaining_deck(known)
    board_needed = 5 - len(board)
    cards_per_sim = board_needed + 2 * num_opponents

    if len(remaining) < cards_per_sim:
        return 0.5

    wins = 0
    ties = 0

    for _ in range(simulations):
        rng.shuffle(remaining)
        idx = 0

        sim_board = list(board) + remaining[idx : idx + board_needed]
        idx += board_needed

        our_score = evaluate_hand(hole_cards, sim_board)

        best_opp = 7463  # worse than worst possible hand
        for _ in range(num_opponents):
            opp_hand = remaining[idx : idx + 2]
            idx += 2
            opp_score = evaluate_hand(opp_hand, sim_board)
            if opp_score < best_opp:
                best_opp = opp_score

        if our_score < best_opp:
            wins += 1
        elif our_score == best_opp:
            ties += 1

    return (wins + ties * 0.5) / simulations
