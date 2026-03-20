"""Hand evaluation wrapper around treys."""

from __future__ import annotations

from treys import Evaluator

_evaluator = Evaluator()

# Hand rank classes (from treys)
HAND_CLASS_NAMES = {
    1: "Straight Flush",
    2: "Four of a Kind",
    3: "Full House",
    4: "Flush",
    5: "Straight",
    6: "Three of a Kind",
    7: "Two Pair",
    8: "One Pair",
    9: "High Card",
}


def evaluate_hand(hole_cards: list[int], board: list[int]) -> int:
    """Evaluate a hand. Lower score = stronger hand.

    Returns an integer from 1 (Royal Flush) to 7462 (worst High Card).
    """
    return _evaluator.evaluate(board, hole_cards)


def hand_rank_class(score: int) -> int:
    """Get the hand rank class (1-9) from a score."""
    return _evaluator.get_rank_class(score)


def hand_class_name(score: int) -> str:
    """Get the human-readable hand class name from a score."""
    rank_class = hand_rank_class(score)
    return _evaluator.class_to_string(rank_class)


def compare_hands(
    hands: list[tuple[list[int], list[int]]],
    board: list[int],
) -> list[tuple[int, int]]:
    """Compare multiple hands against a board.

    Args:
        hands: List of (hole_cards, player_id) tuples.
        board: The community cards.

    Returns:
        List of (player_id, score) sorted by score (best first).
    """
    results = []
    for hole_cards, player_id in hands:
        score = evaluate_hand(hole_cards, board)
        results.append((player_id, score))
    results.sort(key=lambda x: x[1])
    return results


def find_winners(
    hands: dict[int, list[int]],
    board: list[int],
) -> tuple[list[int], int, str]:
    """Find winner(s) from a dict of {player_id: hole_cards}.

    Returns:
        Tuple of (winner_ids, best_score, hand_class_name).
        Multiple winner_ids indicates a split pot.
    """
    scores = {}
    for player_id, hole_cards in hands.items():
        scores[player_id] = evaluate_hand(hole_cards, board)

    best_score = min(scores.values())
    winners = [pid for pid, score in scores.items() if score == best_score]
    class_name = hand_class_name(best_score)

    return winners, best_score, class_name
