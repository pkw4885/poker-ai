"""Self-play training loop for poker AI."""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from poker_engine import Action, ActionType, Game, GamePhase, ValidActions
from poker_engine.constants import BETTING_PHASES
from poker_engine.game_state import GameState


@dataclass
class Transition:
    """A single (state_key, action, reward) transition."""

    state_key: str
    action: str
    reward: float
    player_id: int


@dataclass
class Trajectory:
    """Sequence of transitions for one hand."""

    transitions: List[Transition] = field(default_factory=list)
    final_rewards: Dict[int, float] = field(default_factory=dict)


@dataclass
class TrainingStats:
    """Accumulated statistics across training."""

    games_played: int = 0
    total_reward_p0: float = 0.0
    total_reward_p1: float = 0.0
    elapsed_seconds: float = 0.0

    @property
    def avg_reward_p0(self) -> float:
        return self.total_reward_p0 / max(self.games_played, 1)

    @property
    def avg_reward_p1(self) -> float:
        return self.total_reward_p1 / max(self.games_played, 1)


# A strategy is a callable: (GameState, ValidActions) -> Action
StrategyFn = Callable[[GameState, ValidActions], Action]


def _default_strategy(state: GameState, valid: ValidActions) -> Action:
    """Fallback: check or call, never raise."""
    if valid.can_check:
        return Action(type=ActionType.CHECK)
    if valid.can_call:
        return Action(type=ActionType.CALL, amount=valid.call_amount)
    return Action(type=ActionType.FOLD)


class SelfPlayTrainer:
    """Runs self-play games and collects trajectories.

    Parameters
    ----------
    strategy:
        A callable ``(GameState, ValidActions) -> Action`` used by both
        players (self-play).
    starting_stack:
        Chip count for each player at the start of every hand.
    seed:
        RNG seed for the game engine.
    """

    def __init__(
        self,
        strategy: Optional[StrategyFn] = None,
        starting_stack: int = 1000,
        seed: Optional[int] = None,
    ) -> None:
        self.strategy = strategy or _default_strategy
        self.starting_stack = starting_stack
        self._rng = random.Random(seed)
        self.stats = TrainingStats()
        self.trajectories: List[Trajectory] = []

    def play_one_hand(self) -> Trajectory:
        """Play a single hand of heads-up poker and return the trajectory."""
        game_seed = self._rng.randint(0, 2**31)
        game = Game(
            player_names=["P0", "P1"],
            starting_stacks=self.starting_stack,
            seed=game_seed,
        )
        game.start_hand()

        trajectory = Trajectory()
        safety = 0

        while game.phase in BETTING_PHASES and safety < 100:
            state = game.state
            valid = game.get_valid_actions()
            pid = game.current_player_idx
            player = state.current_player

            if player is None:
                break

            action = self.strategy(state, valid)
            action_str = action.type.value

            trajectory.transitions.append(
                Transition(
                    state_key=f"hand_{self.stats.games_played}_step_{safety}",
                    action=action_str,
                    reward=0.0,  # filled in after hand ends
                    player_id=pid,
                )
            )

            game.act(action)
            safety += 1

        # Compute rewards
        for pid in (0, 1):
            reward = float(game.players[pid].stack - self.starting_stack)
            trajectory.final_rewards[pid] = reward

        # Back-fill rewards into transitions
        for t in trajectory.transitions:
            t.reward = trajectory.final_rewards.get(t.player_id, 0.0)

        return trajectory

    def run_games(self, num_games: int) -> List[Trajectory]:
        """Play *num_games* hands, collecting trajectories.

        Returns the list of trajectories from this batch.
        """
        t0 = time.monotonic()
        batch: List[Trajectory] = []

        for _ in range(num_games):
            traj = self.play_one_hand()
            batch.append(traj)
            self.trajectories.append(traj)

            self.stats.games_played += 1
            self.stats.total_reward_p0 += traj.final_rewards.get(0, 0.0)
            self.stats.total_reward_p1 += traj.final_rewards.get(1, 0.0)

        self.stats.elapsed_seconds += time.monotonic() - t0
        return batch

    def train(self, iterations: int, games_per_iteration: int = 50) -> TrainingStats:
        """Run multiple training iterations.

        Each iteration plays *games_per_iteration* hands.

        Returns the accumulated stats.
        """
        for _ in range(iterations):
            self.run_games(games_per_iteration)
        return self.stats
