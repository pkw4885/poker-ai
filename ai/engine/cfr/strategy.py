"""Strategy profile utilities: regret matching and average strategy."""

from __future__ import annotations

from typing import Dict, List


def regret_matching(regrets: Dict[str, float]) -> Dict[str, float]:
    """Convert cumulative regrets into a strategy via regret matching.

    Positive regrets are normalised to a probability distribution.
    If all regrets are non-positive, returns a uniform distribution.

    Args:
        regrets: Mapping from action name to cumulative regret.

    Returns:
        Mapping from action name to probability.
    """
    positive = {a: max(r, 0.0) for a, r in regrets.items()}
    total = sum(positive.values())

    if total > 0:
        return {a: v / total for a, v in positive.items()}

    # Uniform fallback
    n = len(regrets)
    uniform_prob = 1.0 / n if n > 0 else 0.0
    return {a: uniform_prob for a in regrets}


def normalise_strategy(strategy: Dict[str, float]) -> Dict[str, float]:
    """Normalise a strategy so probabilities sum to 1.

    Args:
        strategy: Mapping from action to un-normalised weight.

    Returns:
        Normalised probability distribution.
    """
    total = sum(strategy.values())
    if total > 0:
        return {a: v / total for a, v in strategy.items()}
    n = len(strategy)
    uniform_prob = 1.0 / n if n > 0 else 0.0
    return {a: uniform_prob for a in strategy}


def compute_average_strategy(
    cumulative_strategy: Dict[str, float],
) -> Dict[str, float]:
    """Compute the average strategy from cumulative strategy sums.

    In CFR the average strategy converges to a Nash equilibrium.

    Args:
        cumulative_strategy: Sum of strategies weighted by reach probability
                             across all iterations.

    Returns:
        Normalised average strategy.
    """
    return normalise_strategy(cumulative_strategy)
