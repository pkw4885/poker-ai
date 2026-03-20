"""Player state management."""

from __future__ import annotations

from dataclasses import dataclass, field

from .constants import PlayerStatus


@dataclass
class Player:
    """Represents a player at the poker table."""

    id: int
    name: str
    stack: int
    hole_cards: list[int] = field(default_factory=list)
    status: PlayerStatus = PlayerStatus.ACTIVE
    current_bet: int = 0  # Bet in the current betting round
    total_bet: int = 0    # Total bet across all rounds in this hand

    @property
    def is_active(self) -> bool:
        """Player can still act (not folded, not all-in, has chips)."""
        return self.status == PlayerStatus.ACTIVE

    @property
    def is_in_hand(self) -> bool:
        """Player is still in the hand (active or all-in)."""
        return self.status in (PlayerStatus.ACTIVE, PlayerStatus.ALL_IN)

    def bet(self, amount: int) -> int:
        """Place a bet, return actual amount bet (may be less if all-in)."""
        actual = min(amount, self.stack)
        self.stack -= actual
        self.current_bet += actual
        self.total_bet += actual
        if self.stack == 0:
            self.status = PlayerStatus.ALL_IN
        return actual

    def fold(self) -> None:
        """Fold the hand."""
        self.status = PlayerStatus.FOLDED

    def reset_for_new_hand(self) -> None:
        """Reset player state for a new hand."""
        self.hole_cards = []
        self.current_bet = 0
        self.total_bet = 0
        if self.stack > 0:
            self.status = PlayerStatus.ACTIVE
        else:
            self.status = PlayerStatus.OUT

    def reset_current_bet(self) -> None:
        """Reset current bet for a new betting round."""
        self.current_bet = 0

    def copy(self) -> Player:
        """Create a deep copy of the player."""
        return Player(
            id=self.id,
            name=self.name,
            stack=self.stack,
            hole_cards=list(self.hole_cards),
            status=self.status,
            current_bet=self.current_bet,
            total_bet=self.total_bet,
        )
