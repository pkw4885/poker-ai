"""Tests for the training pipeline: Arena, Elo, ReplayBuffer, ModelRegistry."""

from __future__ import annotations

import math
import os
import tempfile

import pytest

from poker_engine import Action, ActionType, ValidActions
from poker_engine.game_state import GameState

from ai.training.arena import Arena, ArenaResult, make_baseline_strategy
from ai.training.elo import EloRating, RatingHistory
from ai.training.replay_buffer import (
    Experience,
    PrioritizedReplayBuffer,
    ReplayBuffer,
)
from ai.models.registry import ModelRegistry
from ai.training.self_play import SelfPlayTrainer


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _check_or_fold_strategy(state: GameState, valid: ValidActions) -> Action:
    """Always check if possible, otherwise fold."""
    if valid.can_check:
        return Action(type=ActionType.CHECK)
    return Action(type=ActionType.FOLD)


def _call_strategy(state: GameState, valid: ValidActions) -> Action:
    """Always call or check."""
    if valid.can_check:
        return Action(type=ActionType.CHECK)
    if valid.can_call:
        return Action(type=ActionType.CALL, amount=valid.call_amount)
    return Action(type=ActionType.FOLD)


# -----------------------------------------------------------------------
# Arena Tests
# -----------------------------------------------------------------------

class TestArena:
    def test_play_hands_returns_result(self) -> None:
        arena = Arena(
            strategy_a=_call_strategy,
            strategy_b=_call_strategy,
            seed=42,
        )
        result = arena.play_hands(10)

        assert isinstance(result, ArenaResult)
        assert result.num_hands == 10
        assert result.wins_p0 + result.wins_p1 + result.draws == 10

    def test_chips_sum_to_zero(self) -> None:
        """In heads-up, total chip change should sum to zero."""
        arena = Arena(
            strategy_a=_call_strategy,
            strategy_b=_check_or_fold_strategy,
            seed=7,
        )
        result = arena.play_hands(20)

        assert abs(result.total_chips_p0 + result.total_chips_p1) < 1e-6

    def test_baseline_strategy_works(self) -> None:
        easy = make_baseline_strategy("easy", seed=1)
        medium = make_baseline_strategy("medium", seed=2)
        arena = Arena(strategy_a=easy, strategy_b=medium, seed=10)
        result = arena.play_hands(5)
        assert result.num_hands == 5

    def test_win_rate_bounds(self) -> None:
        arena = Arena(
            strategy_a=_call_strategy,
            strategy_b=_call_strategy,
            seed=99,
        )
        result = arena.play_hands(10)
        assert 0.0 <= result.win_rate_p0 <= 1.0
        assert 0.0 <= result.win_rate_p1 <= 1.0


# -----------------------------------------------------------------------
# Elo Tests
# -----------------------------------------------------------------------

class TestEloRating:
    def test_default_rating(self) -> None:
        elo = EloRating()
        assert elo.get_rating("Alice") == 1500.0

    def test_expected_score_equal(self) -> None:
        elo = EloRating()
        elo.get_rating("Alice")
        elo.get_rating("Bob")
        es = elo.expected_score("Alice", "Bob")
        assert abs(es - 0.5) < 1e-6

    def test_expected_score_higher_rated(self) -> None:
        elo = EloRating()
        elo.ratings["Alice"] = 1600.0
        elo.ratings["Bob"] = 1400.0
        assert elo.expected_score("Alice", "Bob") > 0.5
        assert elo.expected_score("Bob", "Alice") < 0.5

    def test_update_win(self) -> None:
        elo = EloRating(k_factor=32.0)
        elo.get_rating("Alice")
        elo.get_rating("Bob")

        new_a, new_b = elo.update("Alice", "Bob", score_a=1.0)
        assert new_a > 1500.0
        assert new_b < 1500.0
        # Symmetric: changes should be equal in magnitude
        assert abs((new_a - 1500.0) + (new_b - 1500.0)) < 1e-6

    def test_update_draw(self) -> None:
        elo = EloRating(k_factor=32.0)
        elo.get_rating("Alice")
        elo.get_rating("Bob")
        new_a, new_b = elo.update("Alice", "Bob", score_a=0.5)
        # Draw between equal players: no change
        assert abs(new_a - 1500.0) < 1e-6
        assert abs(new_b - 1500.0) < 1e-6

    def test_k_factor_impact(self) -> None:
        elo_low = EloRating(k_factor=16.0)
        elo_high = EloRating(k_factor=64.0)

        elo_low.get_rating("A")
        elo_low.get_rating("B")
        elo_high.get_rating("A")
        elo_high.get_rating("B")

        a_low, _ = elo_low.update("A", "B", 1.0)
        a_high, _ = elo_high.update("A", "B", 1.0)

        # Higher K should mean larger change
        assert (a_high - 1500) > (a_low - 1500)


class TestRatingHistory:
    def test_record_game(self) -> None:
        rh = RatingHistory()
        new_a, new_b = rh.record_game("Alice", "Bob", score_a=1.0)
        assert new_a > 1500.0
        assert new_b < 1500.0
        assert len(rh.history) == 2

    def test_get_history_filtered(self) -> None:
        rh = RatingHistory()
        rh.record_game("Alice", "Bob", score_a=1.0)
        rh.record_game("Alice", "Charlie", score_a=0.0)

        alice_hist = rh.get_history("Alice")
        assert len(alice_hist) == 2
        assert all(s.player == "Alice" for s in alice_hist)

    def test_multiple_games_converge(self) -> None:
        """If Alice always wins, her rating should keep rising."""
        rh = RatingHistory()
        for _ in range(10):
            rh.record_game("Alice", "Bob", score_a=1.0)
        assert rh.get_rating("Alice") > 1500.0
        assert rh.get_rating("Bob") < 1500.0


# -----------------------------------------------------------------------
# ReplayBuffer Tests
# -----------------------------------------------------------------------

class TestReplayBuffer:
    def test_add_and_len(self) -> None:
        buf = ReplayBuffer(capacity=100)
        for i in range(10):
            buf.add(Experience(state=i, action="a", reward=float(i)))
        assert len(buf) == 10

    def test_sample(self) -> None:
        buf = ReplayBuffer(capacity=100, seed=42)
        for i in range(20):
            buf.add(Experience(state=i, action="a", reward=float(i)))
        batch = buf.sample(5)
        assert len(batch) == 5
        assert all(isinstance(e, Experience) for e in batch)

    def test_sample_too_many_raises(self) -> None:
        buf = ReplayBuffer(capacity=100)
        buf.add(Experience(state=0, action="a", reward=0.0))
        with pytest.raises(ValueError, match="Not enough"):
            buf.sample(5)

    def test_capacity_overflow(self) -> None:
        buf = ReplayBuffer(capacity=5)
        for i in range(10):
            buf.add(Experience(state=i, action="a", reward=float(i)))
        assert len(buf) == 5

    def test_save_load(self) -> None:
        buf = ReplayBuffer(capacity=100, seed=1)
        for i in range(10):
            buf.add(Experience(state=i, action="a", reward=float(i)))

        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            path = f.name

        try:
            buf.save(path)
            buf2 = ReplayBuffer(capacity=50)
            buf2.load(path)
            assert len(buf2) == 10
            assert buf2.capacity == 100
        finally:
            os.unlink(path)


class TestPrioritizedReplayBuffer:
    def test_add_and_sample(self) -> None:
        buf = PrioritizedReplayBuffer(capacity=100, seed=42)
        for i in range(10):
            buf.add(Experience(state=i, action="a", reward=float(i)), td_error=float(i + 1))
        experiences, indices = buf.sample(5)
        assert len(experiences) == 5
        assert len(indices) == 5

    def test_priority_bias(self) -> None:
        """Higher-priority items should be sampled more often."""
        buf = PrioritizedReplayBuffer(capacity=100, alpha=1.0, seed=0)
        # Add one low-priority and one high-priority item
        buf.add(Experience(state="low", action="a", reward=0.0), td_error=0.001)
        buf.add(Experience(state="high", action="a", reward=1.0), td_error=100.0)

        high_count = 0
        total = 200
        for _ in range(total):
            exps, _ = buf.sample(1)
            if exps[0].state == "high":
                high_count += 1

        # High-priority should be sampled much more often
        assert high_count > total * 0.8

    def test_update_priority(self) -> None:
        buf = PrioritizedReplayBuffer(capacity=100, seed=1)
        buf.add(Experience(state=0, action="a", reward=0.0), td_error=1.0)
        buf.update_priority(0, td_error=100.0)
        # Should not crash
        exps, _ = buf.sample(1)
        assert len(exps) == 1

    def test_save_load(self) -> None:
        buf = PrioritizedReplayBuffer(capacity=100, seed=1)
        for i in range(5):
            buf.add(Experience(state=i, action="a", reward=float(i)), td_error=float(i + 1))

        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as f:
            path = f.name

        try:
            buf.save(path)
            buf2 = PrioritizedReplayBuffer(capacity=50)
            buf2.load(path)
            assert len(buf2) == 5
            assert buf2.capacity == 100
        finally:
            os.unlink(path)


# -----------------------------------------------------------------------
# ModelRegistry Tests
# -----------------------------------------------------------------------

class TestModelRegistry:
    def test_save_and_load(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            reg = ModelRegistry(base_dir=tmpdir)
            data = {"weights": [1, 2, 3]}
            version = reg.save(data, name="test_model", training_iterations=100)

            assert version == 1
            loaded = reg.load(version)
            assert loaded == data

    def test_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            reg = ModelRegistry(base_dir=tmpdir)
            reg.save({"w": 1}, name="v1", training_iterations=50, elo_rating=1600.0)
            meta = reg.get_metadata(1)
            assert meta.name == "v1"
            assert meta.training_iterations == 50
            assert meta.elo_rating == 1600.0

    def test_list_versions(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            reg = ModelRegistry(base_dir=tmpdir)
            reg.save({"a": 1}, name="m1")
            reg.save({"b": 2}, name="m2")
            reg.save({"c": 3}, name="m3")
            assert reg.list_versions() == [1, 2, 3]
            assert reg.latest_version() == 3

    def test_load_nonexistent_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            reg = ModelRegistry(base_dir=tmpdir)
            with pytest.raises(KeyError):
                reg.load(999)

    def test_update_elo(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            reg = ModelRegistry(base_dir=tmpdir)
            reg.save({"w": 1}, name="m")
            reg.update_elo(1, 1700.0)
            assert reg.get_metadata(1).elo_rating == 1700.0

    def test_persistence(self) -> None:
        """Registry should survive being re-created from the same dir."""
        with tempfile.TemporaryDirectory() as tmpdir:
            reg1 = ModelRegistry(base_dir=tmpdir)
            reg1.save({"x": 42}, name="persistent")

            reg2 = ModelRegistry(base_dir=tmpdir)
            assert reg2.list_versions() == [1]
            assert reg2.load(1) == {"x": 42}


# -----------------------------------------------------------------------
# SelfPlayTrainer Tests
# -----------------------------------------------------------------------

class TestSelfPlayTrainer:
    def test_play_one_hand(self) -> None:
        trainer = SelfPlayTrainer(strategy=_call_strategy, seed=42)
        traj = trainer.play_one_hand()

        assert len(traj.transitions) > 0
        assert 0 in traj.final_rewards
        assert 1 in traj.final_rewards
        # Zero-sum
        assert abs(traj.final_rewards[0] + traj.final_rewards[1]) < 1e-6

    def test_run_games(self) -> None:
        trainer = SelfPlayTrainer(strategy=_call_strategy, seed=7)
        batch = trainer.run_games(5)

        assert len(batch) == 5
        assert trainer.stats.games_played == 5

    def test_train(self) -> None:
        trainer = SelfPlayTrainer(strategy=_call_strategy, seed=99)
        stats = trainer.train(iterations=3, games_per_iteration=10)

        assert stats.games_played == 30
        assert len(trainer.trajectories) == 30

    def test_stats_tracking(self) -> None:
        trainer = SelfPlayTrainer(strategy=_call_strategy, seed=1)
        trainer.run_games(10)
        # avg_reward is well-defined
        _ = trainer.stats.avg_reward_p0
        _ = trainer.stats.avg_reward_p1
        assert trainer.stats.elapsed_seconds >= 0
