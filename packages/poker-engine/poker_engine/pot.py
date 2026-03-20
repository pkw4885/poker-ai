"""Pot and side pot calculations per WSOP rules."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Pot:
    """Represents a pot (main or side) with eligible players."""

    amount: int = 0
    eligible_player_ids: set[int] = field(default_factory=set)

    def copy(self) -> Pot:
        return Pot(amount=self.amount, eligible_player_ids=set(self.eligible_player_ids))


class PotManager:
    """Manages main pot and side pots.

    Side pots are created when a player goes all-in for less than the
    current bet. Each pot tracks which players are eligible to win it.

    WSOP Rules:
    - Table stakes: can only bet chips on the table
    - All-in player is only eligible for the pot they contributed to
    - Multiple side pots possible with multiple all-in players
    """

    def __init__(self) -> None:
        self.pots: list[Pot] = [Pot()]

    @property
    def total(self) -> int:
        """Total amount across all pots."""
        return sum(p.amount for p in self.pots)

    def calculate_pots(self, players_bets: dict[int, int], folded_ids: set[int]) -> None:
        """Recalculate all pots from player total bets.

        This is the core side-pot algorithm:
        1. Sort players by total bet amount
        2. For each unique bet level, create a pot with contributions from all players
        3. Mark eligible players (contributed at least that level, not folded)

        Args:
            players_bets: {player_id: total_bet_this_hand}
            folded_ids: set of player_ids who have folded
        """
        if not players_bets:
            self.pots = [Pot()]
            return

        # Get all unique bet levels, sorted ascending
        all_players = sorted(players_bets.items(), key=lambda x: x[1])
        bet_levels = sorted(set(bet for _, bet in all_players if bet > 0))

        if not bet_levels:
            self.pots = [Pot()]
            return

        self.pots = []
        prev_level = 0

        for level in bet_levels:
            increment = level - prev_level
            if increment <= 0:
                continue

            pot = Pot()
            for pid, total_bet in all_players:
                contribution = min(total_bet, level) - min(total_bet, prev_level)
                if contribution > 0:
                    pot.amount += contribution
                    if pid not in folded_ids:
                        pot.eligible_player_ids.add(pid)

            if pot.amount > 0:
                self.pots.append(pot)
            prev_level = level

        if not self.pots:
            self.pots = [Pot()]

    def get_pot_display(self) -> list[dict]:
        """Get a display-friendly representation of all pots."""
        result = []
        for i, pot in enumerate(self.pots):
            name = "Main Pot" if i == 0 else f"Side Pot {i}"
            result.append({
                "name": name,
                "amount": pot.amount,
                "eligible_players": sorted(pot.eligible_player_ids),
            })
        return result

    def copy(self) -> PotManager:
        pm = PotManager()
        pm.pots = [p.copy() for p in self.pots]
        return pm
