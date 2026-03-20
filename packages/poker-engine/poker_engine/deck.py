"""Deck management with optional deterministic seeding."""

from __future__ import annotations

import random

from treys import Deck as TreysDeck


class Deck:
    """A standard 52-card deck with shuffle and deal operations."""

    def __init__(self, seed: int | None = None):
        self._rng = random.Random(seed)
        self._cards: list[int] = TreysDeck.GetFullDeck()
        self._rng.shuffle(self._cards)
        self._index = 0

    def deal(self, n: int = 1) -> list[int]:
        """Deal n cards from the top of the deck."""
        if self._index + n > len(self._cards):
            raise ValueError(f"Not enough cards in deck: {len(self._cards) - self._index} left")
        dealt = self._cards[self._index : self._index + n]
        self._index += n
        return dealt

    def deal_one(self) -> int:
        """Deal a single card."""
        return self.deal(1)[0]

    def burn(self) -> None:
        """Burn one card (discard without revealing)."""
        self._index += 1

    @property
    def remaining(self) -> int:
        """Number of cards remaining in the deck."""
        return len(self._cards) - self._index

    def reset(self, seed: int | None = None) -> None:
        """Reset and reshuffle the deck."""
        if seed is not None:
            self._rng = random.Random(seed)
        self._cards = TreysDeck.GetFullDeck()
        self._rng.shuffle(self._cards)
        self._index = 0
