"""Immutable game state snapshot for the poker engine."""

from __future__ import annotations

from dataclasses import dataclass, field

from .actions import Action
from .constants import GamePhase, Street
from .player import Player
from .pot import PotManager


@dataclass
class GameState:
    """Immutable snapshot of the game state.

    Used by AI for search/lookahead and by the web layer for rendering.
    """

    players: list[Player]
    board: list[int]
    phase: GamePhase
    street: Street
    pot_manager: PotManager
    dealer_pos: int
    small_blind_pos: int
    big_blind_pos: int
    current_player_idx: int
    small_blind: int
    big_blind: int
    ante: int
    action_history: list[Action] = field(default_factory=list)
    last_raise_amount: int = 0  # Size of the last raise (for min-raise calculation)
    num_actions_this_round: int = 0
    hand_number: int = 0

    @property
    def current_player(self) -> Player | None:
        if 0 <= self.current_player_idx < len(self.players):
            return self.players[self.current_player_idx]
        return None

    @property
    def active_players(self) -> list[Player]:
        """Players still active (can act)."""
        return [p for p in self.players if p.is_active]

    @property
    def in_hand_players(self) -> list[Player]:
        """Players still in the hand (active or all-in)."""
        return [p for p in self.players if p.is_in_hand]

    @property
    def total_pot(self) -> int:
        return self.pot_manager.total

    @property
    def is_hand_over(self) -> bool:
        return self.phase == GamePhase.HAND_OVER

    def _get_last_action_for_player(self, pid: int) -> dict | None:
        """Find the most recent action by a player in the current street."""
        for action in reversed(self.action_history):
            if action.player_id == pid:
                result: dict = {"type": action.type.value}
                if action.amount > 0:
                    result["amount"] = action.amount
                return result
        return None

    def get_player_view(self, player_id: int) -> dict:
        """Get a filtered view for a specific player (hides opponents' cards)."""
        players_view = []
        for p in self.players:
            pv = {
                "id": p.id,
                "name": p.name,
                "stack": p.stack,
                "status": p.status.value,
                "current_bet": p.current_bet,
                "total_bet": p.total_bet,
                "last_action": self._get_last_action_for_player(p.id),
            }
            if p.id == player_id:
                pv["hole_cards"] = p.hole_cards
            else:
                # Always hide opponents' cards; showdown reveal is handled separately
                pv["hole_cards"] = []
            players_view.append(pv)

        return {
            "players": players_view,
            "board": self.board,
            "phase": self.phase.value,
            "street": self.street.value,
            "pots": self.pot_manager.get_pot_display(),
            "total_pot": self.total_pot,
            "dealer_pos": self.dealer_pos,
            "current_player_idx": self.current_player_idx,
            "hand_number": self.hand_number,
        }

    def get_player_view_with_settings(
        self,
        player_id: int,
        ai_muck: bool = False,
        ai_fold_reveal: bool = True,
        ai_player_ids: list[int] | None = None,
    ) -> dict:
        """Get a filtered view for a specific player with room-specific AI reveal logic.

        Args:
            player_id: The player requesting the view.
            ai_muck: If False, reveal ALL AI cards at hand over.
            ai_fold_reveal: If True, reveal folded AI players' cards.
            ai_player_ids: List of player IDs that are AI players.
        """
        view = self.get_player_view(player_id)
        if ai_player_ids is None:
            ai_player_ids = []

        ai_set = set(ai_player_ids)

        # If ai_fold_reveal is True, show folded AI players' hole cards (during play)
        if ai_fold_reveal and not self.is_hand_over:
            for p in self.players:
                if p.id in ai_set and p.is_folded and p.hole_cards:
                    view["players"][p.id]["hole_cards"] = p.hole_cards

        # If ai_muck is False (never muck), reveal ALL AI cards at hand over
        if self.is_hand_over and not ai_muck:
            for p in self.players:
                if p.id in ai_set and p.hole_cards:
                    view["players"][p.id]["hole_cards"] = p.hole_cards

        return view

    def copy(self) -> GameState:
        """Create a deep copy of the game state."""
        return GameState(
            players=[p.copy() for p in self.players],
            board=list(self.board),
            phase=self.phase,
            street=self.street,
            pot_manager=self.pot_manager.copy(),
            dealer_pos=self.dealer_pos,
            small_blind_pos=self.small_blind_pos,
            big_blind_pos=self.big_blind_pos,
            current_player_idx=self.current_player_idx,
            small_blind=self.small_blind,
            big_blind=self.big_blind,
            ante=self.ante,
            action_history=list(self.action_history),
            last_raise_amount=self.last_raise_amount,
            num_actions_this_round=self.num_actions_this_round,
            hand_number=self.hand_number,
        )
