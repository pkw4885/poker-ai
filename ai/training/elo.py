"""Elo rating system for tracking model strength."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class EloRating:
    """Standard Elo rating calculator.

    Parameters
    ----------
    default_rating:
        Starting rating for new players.
    k_factor:
        Maximum rating change per game (higher = more volatile).
    """

    default_rating: float = 1500.0
    k_factor: float = 32.0
    ratings: Dict[str, float] = field(default_factory=dict)

    def get_rating(self, player: str) -> float:
        """Return the current rating for *player*, creating if needed."""
        if player not in self.ratings:
            self.ratings[player] = self.default_rating
        return self.ratings[player]

    def expected_score(self, player_a: str, player_b: str) -> float:
        """Compute the expected score for *player_a* against *player_b*.

        Returns a value in (0, 1) representing expected win probability.
        """
        ra = self.get_rating(player_a)
        rb = self.get_rating(player_b)
        return 1.0 / (1.0 + math.pow(10.0, (rb - ra) / 400.0))

    def update(
        self,
        player_a: str,
        player_b: str,
        score_a: float,
    ) -> Tuple[float, float]:
        """Update ratings after a match.

        Parameters
        ----------
        player_a / player_b:
            Player identifiers.
        score_a:
            Actual score for *player_a*: 1.0 = win, 0.5 = draw, 0.0 = loss.

        Returns
        -------
        Tuple of new ratings ``(new_a, new_b)``.
        """
        ea = self.expected_score(player_a, player_b)
        eb = 1.0 - ea
        score_b = 1.0 - score_a

        ra = self.get_rating(player_a)
        rb = self.get_rating(player_b)

        new_a = ra + self.k_factor * (score_a - ea)
        new_b = rb + self.k_factor * (score_b - eb)

        self.ratings[player_a] = new_a
        self.ratings[player_b] = new_b

        return new_a, new_b


@dataclass
class RatingSnapshot:
    """A single point in the rating history."""

    player: str
    rating: float
    game_index: int


class RatingHistory:
    """Track Elo ratings over time.

    Wraps an :class:`EloRating` and records every update.
    """

    def __init__(
        self,
        default_rating: float = 1500.0,
        k_factor: float = 32.0,
    ) -> None:
        self.elo = EloRating(default_rating=default_rating, k_factor=k_factor)
        self.history: List[RatingSnapshot] = []
        self._game_counter = 0

    def record_game(
        self,
        player_a: str,
        player_b: str,
        score_a: float,
    ) -> Tuple[float, float]:
        """Record a game result and update ratings.

        Returns the new ratings ``(new_a, new_b)``.
        """
        new_a, new_b = self.elo.update(player_a, player_b, score_a)
        self._game_counter += 1
        self.history.append(
            RatingSnapshot(player=player_a, rating=new_a, game_index=self._game_counter)
        )
        self.history.append(
            RatingSnapshot(player=player_b, rating=new_b, game_index=self._game_counter)
        )
        return new_a, new_b

    def get_rating(self, player: str) -> float:
        return self.elo.get_rating(player)

    def get_history(self, player: Optional[str] = None) -> List[RatingSnapshot]:
        """Return rating snapshots, optionally filtered by player."""
        if player is None:
            return list(self.history)
        return [s for s in self.history if s.player == player]
