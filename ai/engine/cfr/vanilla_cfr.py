"""Vanilla CFR for Kuhn Poker.

Kuhn Poker is the simplest non-trivial poker variant:
- 3 cards: J (0), Q (1), K (2)
- 2 players, each antes 1 chip and receives 1 card
- Single betting round: check/bet, then possibly call/fold
- Pot starts at 2 (antes). Bet size is 1.

The Nash equilibrium expected value for player 1 is -1/18.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

from .info_set import InfoSet, RegretTable


# Actions in Kuhn Poker
PASS = "p"  # check / fold
BET = "b"   # bet / call

KUHN_ACTIONS: List[str] = [PASS, BET]

# Card names for display
CARD_NAMES = {0: "J", 1: "Q", 2: "K"}


def _is_terminal(history: str) -> bool:
    """Check if the action history represents a terminal node."""
    # Terminal states:
    #   "pp"  - both check -> showdown
    #   "pbp" - check, bet, fold -> bettor wins
    #   "pbb" - check, bet, call -> showdown
    #   "bp"  - bet, fold -> bettor wins
    #   "bb"  - bet, call -> showdown
    return history in ("pp", "pbp", "pbb", "bp", "bb")


def _terminal_payoff(history: str, cards: List[int]) -> float:
    """Compute the payoff for player 0 at a terminal node.

    Args:
        history: Action history string (e.g. "bp").
        cards: [player0_card, player1_card] where 0=J, 1=Q, 2=K.

    Returns:
        Payoff for player 0 (player 1's payoff is the negation).
    """
    # Determine whose "turn" it would be (to know perspective for the
    # caller that uses the current-player convention).
    # We always return from player 0's perspective here; the caller
    # flips sign when needed.

    if history == "pp":
        # Both checked -> showdown, higher card wins ante (1)
        return 1.0 if cards[0] > cards[1] else -1.0

    if history == "bp":
        # Player 0 bet, player 1 folded -> player 0 wins ante (1)
        return 1.0

    if history == "pbp":
        # Player 0 checked, player 1 bet, player 0 folded -> player 1 wins ante (1)
        return -1.0

    if history in ("bb", "pbb"):
        # Showdown after a bet+call -> higher card wins ante + bet (2)
        return 2.0 if cards[0] > cards[1] else -2.0

    raise ValueError(f"Unknown terminal history: {history}")


def _current_player(history: str) -> int:
    """Return which player acts next (0 or 1)."""
    return len(history) % 2


class KuhnCFR:
    """Vanilla CFR trainer for Kuhn Poker.

    Usage:
        trainer = KuhnCFR()
        trainer.train(iterations=10000)
        ev = trainer.expected_value()  # Should be ~ -1/18
    """

    def __init__(self) -> None:
        self.regret_table = RegretTable()
        self._iterations = 0

    def _cfr(
        self,
        cards: List[int],
        history: str,
        reach_probs: List[float],
    ) -> float:
        """Recursive CFR traversal.

        Uses the convention where the return value is always from
        **player 0's** perspective.  Regrets for the acting player are
        derived by flipping the sign when the acting player is player 1.

        Args:
            cards: [p0_card, p1_card].
            history: Action history so far.
            reach_probs: [p0_reach, p1_reach] — the probability of
                         reaching this node under each player's strategy.

        Returns:
            Expected value for **player 0** at this node.
        """
        if _is_terminal(history):
            return _terminal_payoff(history, cards)

        player = _current_player(history)
        opponent = 1 - player
        card_name = CARD_NAMES[cards[player]]
        info_key = f"{card_name}:{history}"

        node = self.regret_table.get_or_create(info_key, KUHN_ACTIONS)
        strategy = node.get_strategy(reach_probs[player])

        action_values: Dict[str, float] = {}
        node_value = 0.0

        for action in KUHN_ACTIONS:
            new_history = history + action

            new_reach = list(reach_probs)
            new_reach[player] *= strategy[action]

            # Recursive call always returns value for player 0
            action_values[action] = self._cfr(cards, new_history, new_reach)
            node_value += strategy[action] * action_values[action]

        # Regret must be from the acting player's perspective.
        # action_values and node_value are from player 0's perspective,
        # so if acting player is player 1 we negate.
        sign = 1.0 if player == 0 else -1.0

        for action in KUHN_ACTIONS:
            regret = sign * (action_values[action] - node_value)
            node.regret_sum[action] += reach_probs[opponent] * regret

        return node_value

    def train(self, iterations: int = 10000) -> float:
        """Run CFR training for the specified number of iterations.

        Each iteration cycles through all 6 possible card deals.

        Args:
            iterations: Number of training iterations.

        Returns:
            Average game value for player 0.
        """
        total_value = 0.0

        # All possible deals: permutations of 2 cards from {J, Q, K}
        deals: List[List[int]] = [
            [0, 1], [0, 2],  # J vs Q, J vs K
            [1, 0], [1, 2],  # Q vs J, Q vs K
            [2, 0], [2, 1],  # K vs J, K vs Q
        ]

        for i in range(iterations):
            for cards in deals:
                total_value += self._cfr(cards, "", [1.0, 1.0])
            self._iterations += 1

        num_deals = len(deals)
        return total_value / (iterations * num_deals)

    def expected_value(self) -> float:
        """Compute the expected value by averaging over all deals.

        Returns:
            Expected value for player 0 under the current average strategy.
        """
        deals = [
            [0, 1], [0, 2],
            [1, 0], [1, 2],
            [2, 0], [2, 1],
        ]
        total = 0.0
        for cards in deals:
            total += self._evaluate(cards, "")
        return total / len(deals)

    def _evaluate(self, cards: List[int], history: str) -> float:
        """Evaluate the expected value under the average strategy."""
        if _is_terminal(history):
            return _terminal_payoff(history, cards)

        player = _current_player(history)
        card_name = CARD_NAMES[cards[player]]
        info_key = f"{card_name}:{history}"

        if info_key not in self.regret_table:
            # Uniform if unseen
            strategy = {a: 1.0 / len(KUHN_ACTIONS) for a in KUHN_ACTIONS}
        else:
            node = self.regret_table[info_key]
            strategy = node.get_average_strategy()

        value = 0.0
        for action in KUHN_ACTIONS:
            value += strategy[action] * self._evaluate(cards, history + action)
        return value

    def get_strategy_profile(self) -> Dict[str, Dict[str, float]]:
        """Return the average strategy for every information set.

        Returns:
            Dict mapping info set key to {action: probability}.
        """
        profile: Dict[str, Dict[str, float]] = {}
        for node in self.regret_table:
            profile[node.key] = node.get_average_strategy()
        return profile
