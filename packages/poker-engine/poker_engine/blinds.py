"""Blind structure management for cash games and tournaments."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class BlindLevel:
    """A single blind level."""

    small_blind: int
    big_blind: int
    ante: int = 0
    duration_hands: int = 0  # 0 = no limit (cash game)


# Default cash game blind structure
DEFAULT_CASH_BLINDS = BlindLevel(small_blind=5, big_blind=10)

# Standard tournament blind schedule
DEFAULT_TOURNAMENT_SCHEDULE = [
    BlindLevel(small_blind=10, big_blind=20, ante=0, duration_hands=20),
    BlindLevel(small_blind=15, big_blind=30, ante=0, duration_hands=20),
    BlindLevel(small_blind=25, big_blind=50, ante=5, duration_hands=20),
    BlindLevel(small_blind=50, big_blind=100, ante=10, duration_hands=20),
    BlindLevel(small_blind=75, big_blind=150, ante=15, duration_hands=20),
    BlindLevel(small_blind=100, big_blind=200, ante=25, duration_hands=20),
    BlindLevel(small_blind=150, big_blind=300, ante=30, duration_hands=20),
    BlindLevel(small_blind=200, big_blind=400, ante=50, duration_hands=15),
    BlindLevel(small_blind=300, big_blind=600, ante=75, duration_hands=15),
    BlindLevel(small_blind=500, big_blind=1000, ante=100, duration_hands=15),
]


class BlindManager:
    """Manages blind levels for a game."""

    def __init__(
        self,
        schedule: list[BlindLevel] | None = None,
        is_tournament: bool = False,
    ):
        if schedule:
            self._schedule = schedule
        elif is_tournament:
            self._schedule = DEFAULT_TOURNAMENT_SCHEDULE
        else:
            self._schedule = [DEFAULT_CASH_BLINDS]

        self._level_index = 0
        self._hands_at_level = 0

    @property
    def current_level(self) -> BlindLevel:
        return self._schedule[self._level_index]

    @property
    def small_blind(self) -> int:
        return self.current_level.small_blind

    @property
    def big_blind(self) -> int:
        return self.current_level.big_blind

    @property
    def ante(self) -> int:
        return self.current_level.ante

    @property
    def level_number(self) -> int:
        return self._level_index + 1

    def advance_hand(self) -> bool:
        """Call after each hand. Returns True if blind level increased."""
        self._hands_at_level += 1
        duration = self.current_level.duration_hands
        if duration > 0 and self._hands_at_level >= duration:
            if self._level_index < len(self._schedule) - 1:
                self._level_index += 1
                self._hands_at_level = 0
                return True
        return False
