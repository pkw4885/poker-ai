"""Tests for Vanilla CFR on Kuhn Poker."""

from __future__ import annotations

import pytest

from ai.engine.cfr.vanilla_cfr import KuhnCFR, CARD_NAMES
from ai.engine.cfr.info_set import InfoSet, RegretTable
from ai.engine.cfr.strategy import regret_matching, normalise_strategy, compute_average_strategy


# ---------------------------------------------------------------------------
# Strategy utilities
# ---------------------------------------------------------------------------

class TestStrategyUtils:
    def test_regret_matching_positive(self) -> None:
        regrets = {"a": 3.0, "b": 1.0}
        strat = regret_matching(regrets)
        assert abs(strat["a"] - 0.75) < 1e-9
        assert abs(strat["b"] - 0.25) < 1e-9

    def test_regret_matching_all_negative(self) -> None:
        regrets = {"a": -2.0, "b": -1.0}
        strat = regret_matching(regrets)
        # Uniform fallback
        assert abs(strat["a"] - 0.5) < 1e-9
        assert abs(strat["b"] - 0.5) < 1e-9

    def test_normalise_strategy(self) -> None:
        strat = normalise_strategy({"x": 2.0, "y": 8.0})
        assert abs(strat["x"] - 0.2) < 1e-9
        assert abs(strat["y"] - 0.8) < 1e-9

    def test_compute_average_strategy(self) -> None:
        cumulative = {"a": 10.0, "b": 30.0}
        avg = compute_average_strategy(cumulative)
        assert abs(avg["a"] - 0.25) < 1e-9
        assert abs(avg["b"] - 0.75) < 1e-9


# ---------------------------------------------------------------------------
# InfoSet and RegretTable
# ---------------------------------------------------------------------------

class TestInfoSet:
    def test_initial_strategy_is_uniform(self) -> None:
        node = InfoSet("K:", ["p", "b"])
        strat = node.get_strategy(1.0)
        assert abs(strat["p"] - 0.5) < 1e-9
        assert abs(strat["b"] - 0.5) < 1e-9

    def test_regret_table_get_or_create(self) -> None:
        table = RegretTable()
        node1 = table.get_or_create("K:", ["p", "b"])
        node2 = table.get_or_create("K:", ["p", "b"])
        assert node1 is node2
        assert len(table) == 1


# ---------------------------------------------------------------------------
# Kuhn Poker CFR convergence
# ---------------------------------------------------------------------------

class TestKuhnCFR:
    def test_converges_to_nash_equilibrium(self) -> None:
        """After enough iterations, EV for player 0 should be ~-1/18."""
        trainer = KuhnCFR()
        trainer.train(iterations=50000)

        ev = trainer.expected_value()
        nash_ev = -1.0 / 18.0  # ≈ -0.05556

        assert abs(ev - nash_ev) < 0.02, (
            f"Expected EV ~ {nash_ev:.5f}, got {ev:.5f}"
        )

    def test_known_strategy_properties(self) -> None:
        """Verify some known Nash equilibrium properties of Kuhn Poker.

        In any Nash equilibrium of Kuhn Poker:
        - Player 0 with K should always bet or check (both are equilibrium).
        - Player 0 with J at the root should bet (bluff) with probability
          in [0, 1/3]. The exact value depends on which equilibrium CFR
          converges to, but it must not exceed 1/3.
        - Player 1 with K facing a bet should always call.
        """
        trainer = KuhnCFR()
        trainer.train(iterations=50000)
        profile = trainer.get_strategy_profile()

        # Player 0 with J at root: should bluff at most ~1/3 of the time
        j_root = profile.get("J:", {})
        if j_root:
            bet_freq = j_root.get("b", 0)
            assert bet_freq <= 1.0 / 3.0 + 0.05, (
                f"J root bet frequency should be <= ~0.333, got {bet_freq:.3f}"
            )

        # Player 1 with K facing a bet: should always call
        k_facing_bet = profile.get("K:b", {})
        if k_facing_bet:
            call_freq = k_facing_bet.get("b", 0)  # "b" = call in response to bet
            assert call_freq > 0.9, (
                f"K facing bet should call ~100%, got {call_freq:.3f}"
            )

    def test_strategy_profile_not_empty(self) -> None:
        trainer = KuhnCFR()
        trainer.train(iterations=100)
        profile = trainer.get_strategy_profile()
        assert len(profile) > 0
        # Should have info sets for J, Q, K at various histories
        assert any("J:" in k for k in profile)
        assert any("Q:" in k for k in profile)
        assert any("K:" in k for k in profile)
