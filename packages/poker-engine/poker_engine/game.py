"""Texas Hold'em game engine — state machine orchestrating the full game flow."""

from __future__ import annotations

from .actions import Action, ValidActions, validate_action
from .blinds import BlindManager
from .constants import ActionType, GamePhase, PlayerStatus, Street, BETTING_PHASES
from .deck import Deck
from .game_state import GameState
from .hand_eval import find_winners
from .player import Player
from .pot import PotManager


class Game:
    """Texas Hold'em game engine.

    Manages the complete lifecycle of poker hands:
    DEAL_HOLE → PREFLOP_BET → DEAL_FLOP → FLOP_BET → DEAL_TURN →
    TURN_BET → DEAL_RIVER → RIVER_BET → SHOWDOWN → HAND_OVER

    Supports 2-8 players, WSOP-compliant rules including side pots.
    """

    def __init__(
        self,
        player_names: list[str],
        starting_stacks: list[int] | int = 1000,
        blind_manager: BlindManager | None = None,
        seed: int | None = None,
    ):
        if len(player_names) < 2 or len(player_names) > 8:
            raise ValueError("Texas Hold'em requires 2-8 players")

        if isinstance(starting_stacks, int):
            starting_stacks = [starting_stacks] * len(player_names)

        self.players = [
            Player(id=i, name=name, stack=stack)
            for i, (name, stack) in enumerate(zip(player_names, starting_stacks))
        ]

        self.blind_manager = blind_manager or BlindManager()
        self.deck = Deck(seed=seed)
        self.board: list[int] = []
        self.phase = GamePhase.WAITING
        self.street = Street.PREFLOP
        self.pot_manager = PotManager()
        self.dealer_pos = 0
        self.small_blind_pos = 0
        self.big_blind_pos = 0
        self.current_player_idx = 0
        self.action_history: list[Action] = []
        self.last_raise_amount = 0
        self.hand_number = 0
        self._seed = seed
        self._hand_results: list[dict] = []
        # Tracks which active players still need to act this round.
        # When a raise occurs, all other active players are re-added.
        # When empty, the round is complete.
        self._players_to_act: set[int] = set()

    @property
    def state(self) -> GameState:
        """Get the current game state snapshot."""
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
            small_blind=self.blind_manager.small_blind,
            big_blind=self.blind_manager.big_blind,
            ante=self.blind_manager.ante,
            action_history=list(self.action_history),
            last_raise_amount=self.last_raise_amount,
            hand_number=self.hand_number,
        )

    def _alive_players(self) -> list[Player]:
        """Players with chips (not OUT)."""
        return [p for p in self.players if p.status != PlayerStatus.OUT]

    def _in_hand_players(self) -> list[Player]:
        """Players still in the current hand."""
        return [p for p in self.players if p.is_in_hand]

    def _active_players(self) -> list[Player]:
        """Players that can still act."""
        return [p for p in self.players if p.is_active]

    def start_hand(self) -> GameState:
        """Start a new hand. Returns the initial game state."""
        alive = self._alive_players()
        if len(alive) < 2:
            raise ValueError("Need at least 2 players with chips")

        self.hand_number += 1

        # Reset for new hand
        for p in self.players:
            p.reset_for_new_hand()

        self.board = []
        self.action_history = []
        self.pot_manager = PotManager()
        self.last_raise_amount = self.blind_manager.big_blind

        # Advance dealer position
        if self.hand_number > 1:
            self.dealer_pos = self._next_alive_pos(self.dealer_pos)

        # Set blind positions
        alive_count = len(alive)
        if alive_count == 2:
            # Heads-up: dealer is small blind
            self.small_blind_pos = self.dealer_pos
            self.big_blind_pos = self._next_alive_pos(self.dealer_pos)
        else:
            self.small_blind_pos = self._next_alive_pos(self.dealer_pos)
            self.big_blind_pos = self._next_alive_pos(self.small_blind_pos)

        # Reset deck
        seed = None if self._seed is None else self._seed + self.hand_number
        self.deck.reset(seed=seed)

        # Post antes
        if self.blind_manager.ante > 0:
            for p in self.players:
                if p.status != PlayerStatus.OUT:
                    p.bet(self.blind_manager.ante)

        # Post blinds
        sb_player = self.players[self.small_blind_pos]
        bb_player = self.players[self.big_blind_pos]
        sb_player.bet(self.blind_manager.small_blind)
        bb_player.bet(self.blind_manager.big_blind)

        # Deal hole cards
        self.phase = GamePhase.DEAL_HOLE
        for p in self.players:
            if p.status != PlayerStatus.OUT:
                p.hole_cards = self.deck.deal(2)

        # Move to preflop betting
        self.phase = GamePhase.PREFLOP_BET
        self.street = Street.PREFLOP

        # Preflop: all active players need to act.
        # First to act is left of BB.
        self._players_to_act = {p.id for p in self._active_players()}
        self.current_player_idx = self._next_active_pos(self.big_blind_pos)

        # Update pots
        self._update_pots()

        # Check if only one (or zero) players can act
        if len(self._active_players()) <= 1:
            if len(self._in_hand_players()) <= 1:
                self._end_hand_single_winner(self._in_hand_players())
            else:
                self._run_to_showdown()

        return self.state

    def get_valid_actions(self, player_id: int | None = None) -> ValidActions:
        """Get valid actions for the current (or specified) player."""
        if player_id is None:
            player = self.players[self.current_player_idx]
        else:
            player = self.players[player_id]

        if not player.is_active:
            return ValidActions()

        # Current highest bet in this round
        max_bet = max(p.current_bet for p in self.players)
        to_call = max_bet - player.current_bet

        valid = ValidActions()
        valid.can_fold = True

        if to_call == 0:
            valid.can_check = True
        else:
            valid.can_call = True
            valid.call_amount = min(to_call, player.stack)

        # Raise is possible if player has more chips than the call amount
        if player.stack > to_call:
            valid.can_raise = True
            # WSOP min raise: at least the size of the last raise
            min_raise_to = max_bet + max(self.last_raise_amount, self.blind_manager.big_blind)
            valid.min_raise = min(min_raise_to, player.current_bet + player.stack)
            valid.max_raise = player.current_bet + player.stack  # All-in

        return valid

    def act(self, action: Action) -> GameState:
        """Process a player action. Returns the new game state."""
        if self.phase not in BETTING_PHASES:
            raise ValueError(f"Cannot act in phase {self.phase}")

        player = self.players[self.current_player_idx]
        if action.player_id >= 0 and action.player_id != player.id:
            raise ValueError(f"Not player {action.player_id}'s turn, expected {player.id}")

        valid = self.get_valid_actions()
        is_valid, error = validate_action(action, valid)
        if not is_valid:
            raise ValueError(f"Invalid action: {error}")

        # Execute the action
        max_bet = max(p.current_bet for p in self.players)
        is_raise = False

        if action.type == ActionType.FOLD:
            player.fold()

        elif action.type == ActionType.CHECK:
            pass

        elif action.type == ActionType.CALL:
            to_call = max_bet - player.current_bet
            player.bet(min(to_call, player.stack))

        elif action.type == ActionType.RAISE:
            raise_to = action.amount
            additional = raise_to - player.current_bet
            player.bet(additional)
            new_bet = player.current_bet
            raise_size = new_bet - max_bet
            if raise_size > 0:
                self.last_raise_amount = raise_size
            is_raise = True

        elif action.type == ActionType.ALL_IN:
            remaining = player.stack
            player.bet(remaining)
            new_bet = player.current_bet
            raise_size = new_bet - max_bet
            if raise_size > 0:
                # WSOP rule: undersized all-in does not reopen betting
                if raise_size >= self.last_raise_amount:
                    self.last_raise_amount = raise_size
                    is_raise = True

        # Mark this player as having acted
        self._players_to_act.discard(player.id)

        # If a raise occurred, all other active players need to act again
        if is_raise:
            self._players_to_act = {
                p.id for p in self._active_players() if p.id != player.id
            }

        # Record action
        recorded_action = Action(
            type=action.type,
            amount=action.amount if action.type in (ActionType.RAISE, ActionType.ALL_IN) else 0,
            player_id=player.id,
        )
        self.action_history.append(recorded_action)

        # Update pots
        self._update_pots()

        # Check if hand is over (only one player left)
        in_hand = self._in_hand_players()
        if len(in_hand) <= 1:
            self._end_hand_single_winner(in_hand)
            return self.state

        # Advance to next player or next phase
        self._advance_action()

        return self.state

    def _advance_action(self) -> None:
        """Advance to the next player or the next phase."""
        active = self._active_players()

        if len(active) == 0:
            # All remaining players are all-in
            self._run_to_showdown()
            return

        # Filter _players_to_act to only include currently active players
        self._players_to_act = {
            pid for pid in self._players_to_act
            if self.players[pid].is_active
        }

        # If no one left to act, the round is complete
        if not self._players_to_act:
            self._advance_street()
            return

        # Find next active player who needs to act
        next_idx = self._next_active_pos(self.current_player_idx)
        self.current_player_idx = next_idx

    def _advance_street(self) -> None:
        """Move to the next street (deal community cards)."""
        # Reset current bets for the new round
        for p in self.players:
            p.reset_current_bet()

        self.last_raise_amount = self.blind_manager.big_blind

        if self.phase == GamePhase.PREFLOP_BET:
            self.deck.burn()
            self.board.extend(self.deck.deal(3))
            self.phase = GamePhase.FLOP_BET
            self.street = Street.FLOP

        elif self.phase == GamePhase.FLOP_BET:
            self.deck.burn()
            self.board.append(self.deck.deal_one())
            self.phase = GamePhase.TURN_BET
            self.street = Street.TURN

        elif self.phase == GamePhase.TURN_BET:
            self.deck.burn()
            self.board.append(self.deck.deal_one())
            self.phase = GamePhase.RIVER_BET
            self.street = Street.RIVER

        elif self.phase == GamePhase.RIVER_BET:
            self._showdown()
            return

        # Set up next betting round
        active = self._active_players()
        if len(active) <= 1:
            self._run_to_showdown()
            return

        # All active players need to act in the new round
        self._players_to_act = {p.id for p in active}
        # First to act is first active player left of dealer
        self.current_player_idx = self._next_active_pos(self.dealer_pos)

    def _run_to_showdown(self) -> None:
        """Deal remaining community cards and go to showdown."""
        for p in self.players:
            p.reset_current_bet()

        while len(self.board) < 5:
            self.deck.burn()
            count = 3 if len(self.board) == 0 else 1
            self.board.extend(self.deck.deal(count))

        self._showdown()

    def _showdown(self) -> None:
        """Evaluate hands and distribute pots."""
        self.phase = GamePhase.SHOWDOWN
        self.street = Street.SHOWDOWN

        # Recalculate final pots
        self._update_pots()

        in_hand = {p.id: p.hole_cards for p in self.players if p.is_in_hand}
        results = []

        for pot in self.pot_manager.pots:
            if pot.amount == 0:
                continue

            eligible_hands = {
                pid: cards
                for pid, cards in in_hand.items()
                if pid in pot.eligible_player_ids
            }

            if not eligible_hands:
                continue

            if len(eligible_hands) == 1:
                winner_id = list(eligible_hands.keys())[0]
                self.players[winner_id].stack += pot.amount
                results.append({
                    "pot_amount": pot.amount,
                    "winners": [winner_id],
                    "hand_class": "",
                })
            else:
                winner_ids, _, hand_class = find_winners(eligible_hands, self.board)
                share = pot.amount // len(winner_ids)
                remainder = pot.amount % len(winner_ids)

                for i, wid in enumerate(winner_ids):
                    extra = 1 if i < remainder else 0
                    self.players[wid].stack += share + extra

                results.append({
                    "pot_amount": pot.amount,
                    "winners": winner_ids,
                    "hand_class": hand_class,
                })

        self._hand_results = results
        self.phase = GamePhase.HAND_OVER

        # Advance blind level
        self.blind_manager.advance_hand()

    def _end_hand_single_winner(self, in_hand: list[Player]) -> None:
        """End hand when all but one player has folded."""
        self._update_pots()

        if in_hand:
            winner = in_hand[0]
            winner.stack += self.pot_manager.total

        self._hand_results = [{
            "pot_amount": self.pot_manager.total,
            "winners": [in_hand[0].id] if in_hand else [],
            "hand_class": "fold",
        }]

        self.phase = GamePhase.HAND_OVER
        self.blind_manager.advance_hand()

    def _update_pots(self) -> None:
        """Recalculate pots based on current bets."""
        bets = {p.id: p.total_bet for p in self.players if p.total_bet > 0}
        folded = {p.id for p in self.players if p.status == PlayerStatus.FOLDED}
        self.pot_manager.calculate_pots(bets, folded)

    def _next_alive_pos(self, pos: int) -> int:
        """Find the next position with an alive player (has chips)."""
        n = len(self.players)
        for i in range(1, n + 1):
            idx = (pos + i) % n
            if self.players[idx].status != PlayerStatus.OUT:
                return idx
        return pos

    def _next_active_pos(self, pos: int) -> int:
        """Find the next position with an active player (can act)."""
        n = len(self.players)
        for i in range(1, n + 1):
            idx = (pos + i) % n
            if self.players[idx].is_active:
                return idx
        return pos

    @property
    def hand_results(self) -> list[dict]:
        """Get results of the last completed hand."""
        return self._hand_results
