"""Monte Carlo hand strength estimation."""

from __future__ import annotations

import random
from typing import List

from treys import Deck as TreysDeck

from poker_engine.hand_eval import evaluate_hand


def _remaining_deck(exclude: List[int]) -> List[int]:
    """Return all cards not in the exclude set."""
    exclude_set = set(exclude)
    return [c for c in TreysDeck.GetFullDeck() if c not in exclude_set]


def estimate_hand_strength(
    hole_cards: List[int],
    board: List[int],
    num_simulations: int = 1000,
    num_opponents: int = 1,
    rng: random.Random | None = None,
) -> float:
    """Estimate hand strength via Monte Carlo simulation.

    Deals out random remaining board cards and opponent hands,
    then computes the fraction of simulations where our hand wins or ties.

    Args:
        hole_cards: Our two hole cards (treys int format).
        board: Community cards revealed so far (0-5 cards).
        num_simulations: Number of Monte Carlo trials.
        num_opponents: Number of opponent hands to simulate.
        rng: Optional random.Random instance for reproducibility.

    Returns:
        Float between 0.0 and 1.0 representing estimated hand strength.
    """
    if rng is None:
        rng = random.Random()

    known_cards = list(hole_cards) + list(board)
    remaining = _remaining_deck(known_cards)
    cards_needed_for_board = 5 - len(board)
    cards_per_sim = cards_needed_for_board + 2 * num_opponents

    if len(remaining) < cards_per_sim:
        # Not enough cards for even one simulation; return 0.5
        return 0.5

    wins = 0
    ties = 0

    for _ in range(num_simulations):
        rng.shuffle(remaining)
        idx = 0

        # Complete the board
        sim_board = list(board) + remaining[idx : idx + cards_needed_for_board]
        idx += cards_needed_for_board

        # Our hand score
        our_score = evaluate_hand(hole_cards, sim_board)

        # Simulate opponents
        we_win = True
        any_tie = False
        for _ in range(num_opponents):
            opp_cards = remaining[idx : idx + 2]
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
