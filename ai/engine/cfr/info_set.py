"""Information set representation and regret table for CFR."""

from __future__ import annotations

from typing import Dict, List

from .strategy import regret_matching


class InfoSet:
    """An information set in an extensive-form game.

    Identified by a key that encodes the player's private information
    and the public action history.  Stores cumulative regrets and
    cumulative strategy weights for regret-matching CFR.

    Attributes:
        key: String identifier, e.g. "K:cb" (card K, check-bet history).
        regret_sum: Cumulative regret for each action.
        strategy_sum: Cumulative strategy weight for each action.
        actions: List of available action names.
    """

    def __init__(self, key: str, actions: List[str]) -> None:
        self.key = key
        self.actions = list(actions)
        self.regret_sum: Dict[str, float] = {a: 0.0 for a in actions}
        self.strategy_sum: Dict[str, float] = {a: 0.0 for a in actions}

    def get_strategy(self, realisation_weight: float = 1.0) -> Dict[str, float]:
        """Get the current strategy via regret matching.

        Also accumulates the strategy into ``strategy_sum`` weighted by
        the realisation weight (reach probability).

        Args:
            realisation_weight: The reach probability for the acting player.

        Returns:
            Mapping from action to probability.
        """
        strategy = regret_matching(self.regret_sum)

        for a in self.actions:
            self.strategy_sum[a] += realisation_weight * strategy[a]

        return strategy

    def get_average_strategy(self) -> Dict[str, float]:
        """Compute the average strategy (converges to Nash in CFR)."""
        total = sum(self.strategy_sum.values())
        if total > 0:
            return {a: self.strategy_sum[a] / total for a, v in self.strategy_sum.items()}
        n = len(self.actions)
        return {a: 1.0 / n for a in self.actions}

    def __repr__(self) -> str:
        avg = self.get_average_strategy()
        strat_str = ", ".join(f"{a}={p:.3f}" for a, p in avg.items())
        return f"InfoSet({self.key!r}: {strat_str})"


class RegretTable:
    """Stores InfoSet nodes keyed by their string identifier.

    Acts as the central store for a CFR training run.
    """

    def __init__(self) -> None:
        self._nodes: Dict[str, InfoSet] = {}

    def get_or_create(self, key: str, actions: List[str]) -> InfoSet:
        """Retrieve an existing InfoSet or create a new one.

        Args:
            key: The information set key.
            actions: Available actions (used only when creating).

        Returns:
            The InfoSet for this key.
        """
        if key not in self._nodes:
            self._nodes[key] = InfoSet(key, actions)
        return self._nodes[key]

    def __getitem__(self, key: str) -> InfoSet:
        return self._nodes[key]

    def __contains__(self, key: str) -> bool:
        return key in self._nodes

    def __len__(self) -> int:
        return len(self._nodes)

    def __iter__(self):
        return iter(self._nodes.values())

    @property
    def nodes(self) -> Dict[str, InfoSet]:
        """Direct access to the underlying node dict."""
        return self._nodes
