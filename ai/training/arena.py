"""Model evaluation arena — pit two strategies against each other."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from poker_engine import Action, ActionType, Game, GamePhase, ValidActions
from poker_engine.constants import BETTING_PHASES
from poker_engine.game_state import GameState


StrategyFn = Callable[[GameState, ValidActions], Action]


@dataclass
class ArenaResult:
    """Outcome of an arena match."""

    num_hands: int
    wins_p0: int
    wins_p1: int
    draws: int
    total_chips_p0: float
    total_chips_p1: float

    @property
    def win_rate_p0(self) -> float:
        return self.wins_p0 / max(self.num_hands, 1)

    @property
    def win_rate_p1(self) -> float:
        return self.wins_p1 / max(self.num_hands, 1)

    @property
    def avg_chips_p0(self) -> float:
        return self.total_chips_p0 / max(self.num_hands, 1)

    @property
    def avg_chips_p1(self) -> float:
        return self.total_chips_p1 / max(self.num_hands, 1)


class Arena:
    """Pit two strategies against each other over N hands.

    Parameters
    ----------
    strategy_a:
        Strategy callable for player 0.
    strategy_b:
        Strategy callable for player 1.
    starting_stack:
        Chip count per hand.
    seed:
        RNG seed.
    """

    def __init__(
        self,
        strategy_a: StrategyFn,
        strategy_b: StrategyFn,
        starting_stack: int = 1000,
        seed: Optional[int] = None,
    ) -> None:
        self.strategy_a = strategy_a
        self.strategy_b = strategy_b
        self.starting_stack = starting_stack
        self._rng = random.Random(seed)

    def play_hands(self, num_hands: int) -> ArenaResult:
        """Play *num_hands* heads-up hands and return results."""
        wins_a = 0
        wins_b = 0
        draws = 0
        chips_a = 0.0
        chips_b = 0.0

        for _ in range(num_hands):
            game_seed = self._rng.randint(0, 2**31)
            game = Game(
                player_names=["A", "B"],
                starting_stacks=self.starting_stack,
                seed=game_seed,
            )
            game.start_hand()

            safety = 0
            while game.phase in BETTING_PHASES and safety < 100:
                state = game.state
                valid = game.get_valid_actions()
                pid = game.current_player_idx
                player = state.current_player

                if player is None:
                    break

                if pid == 0:
                    action = self.strategy_a(state, valid)
                else:
                    action = self.strategy_b(state, valid)

                game.act(action)
                safety += 1

            reward_a = float(game.players[0].stack - self.starting_stack)
            reward_b = float(game.players[1].stack - self.starting_stack)
            chips_a += reward_a
            chips_b += reward_b

            if reward_a > 0:
                wins_a += 1
            elif reward_b > 0:
                wins_b += 1
            else:
                draws += 1

        return ArenaResult(
            num_hands=num_hands,
            wins_p0=wins_a,
            wins_p1=wins_b,
            draws=draws,
            total_chips_p0=chips_a,
            total_chips_p1=chips_b,
        )


def make_baseline_strategy(difficulty: str, seed: int = 0) -> StrategyFn:
    """Create a strategy function from a BaselineAI difficulty level.

    Parameters
    ----------
    difficulty:
        One of ``"easy"``, ``"medium"``, ``"hard"``.
    seed:
        RNG seed for the baseline AI.
    """
    from ai.engine.baseline import BaselineAI, Difficulty

    diff_map = {
        "easy": Difficulty.EASY,
        "medium": Difficulty.MEDIUM,
        "hard": Difficulty.HARD,
    }
    ai = BaselineAI(difficulty=diff_map[difficulty], seed=seed)

    def _strategy(state: GameState, valid: ValidActions) -> Action:
        return ai.choose_action(state, valid)

    return _strategy
