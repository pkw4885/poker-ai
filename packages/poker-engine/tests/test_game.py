"""Tests for the game engine."""

import pytest
from poker_engine import Game, Action, ActionType, GamePhase, PlayerStatus


class TestGameSetup:
    def test_create_game_2_players(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        assert len(game.players) == 2

    def test_create_game_8_players(self):
        names = [f"Player{i}" for i in range(8)]
        game = Game(names, starting_stacks=1000, seed=42)
        assert len(game.players) == 8

    def test_too_few_players(self):
        with pytest.raises(ValueError):
            Game(["Alice"], starting_stacks=1000)

    def test_too_many_players(self):
        with pytest.raises(ValueError):
            Game([f"P{i}" for i in range(9)], starting_stacks=1000)


class TestStartHand:
    def test_blinds_posted(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        state = game.start_hand()
        sb = game.players[state.small_blind_pos]
        bb = game.players[state.big_blind_pos]
        # Small blind = 5, Big blind = 10 (defaults)
        assert sb.total_bet == 5
        assert bb.total_bet == 10
        assert sb.stack == 995
        assert bb.stack == 990

    def test_hole_cards_dealt(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        for p in game.players:
            assert len(p.hole_cards) == 2

    def test_phase_is_preflop_bet(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        state = game.start_hand()
        assert state.phase == GamePhase.PREFLOP_BET

    def test_heads_up_dealer_is_sb(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        state = game.start_hand()
        assert state.small_blind_pos == state.dealer_pos

    def test_3_player_positions(self):
        game = Game(["A", "B", "C"], starting_stacks=1000, seed=42)
        state = game.start_hand()
        # Dealer, SB, BB should be different
        positions = {state.dealer_pos, state.small_blind_pos, state.big_blind_pos}
        assert len(positions) == 3


class TestBasicActions:
    def test_fold(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        state = game.act(Action(type=ActionType.FOLD))
        assert state.phase == GamePhase.HAND_OVER

    def test_call_and_check(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        # SB calls
        game.act(Action(type=ActionType.CALL))
        # BB checks
        state = game.act(Action(type=ActionType.CHECK))
        # Should move to flop
        assert state.phase == GamePhase.FLOP_BET
        assert len(state.board) == 3

    def test_raise(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        valid = game.get_valid_actions()
        assert valid.can_raise
        # Raise to 20 (min raise from BB of 10)
        state = game.act(Action(type=ActionType.RAISE, amount=20))
        assert state.phase == GamePhase.PREFLOP_BET  # BB still needs to act

    def test_all_in(self):
        game = Game(["Alice", "Bob"], starting_stacks=100, seed=42)
        game.start_hand()
        state = game.act(Action(type=ActionType.ALL_IN))
        player = [p for p in game.players if p.id == state.action_history[-1].player_id][0]
        assert player.status == PlayerStatus.ALL_IN


class TestFullHand:
    def test_complete_hand_fold_preflop(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        state = game.act(Action(type=ActionType.FOLD))
        assert state.is_hand_over
        results = game.hand_results
        assert len(results) == 1

    def test_complete_hand_to_showdown(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()

        # Preflop: call, check
        game.act(Action(type=ActionType.CALL))
        game.act(Action(type=ActionType.CHECK))

        # Flop: check, check
        game.act(Action(type=ActionType.CHECK))
        game.act(Action(type=ActionType.CHECK))

        # Turn: check, check
        game.act(Action(type=ActionType.CHECK))
        game.act(Action(type=ActionType.CHECK))

        # River: check, check
        game.act(Action(type=ActionType.CHECK))
        state = game.act(Action(type=ActionType.CHECK))

        assert state.is_hand_over
        assert len(state.board) == 5

    def test_chips_conservation(self):
        """Total chips should remain constant throughout a hand."""
        game = Game(["Alice", "Bob", "Charlie"], starting_stacks=1000, seed=42)
        total_start = sum(p.stack for p in game.players)

        game.start_hand()
        game.act(Action(type=ActionType.CALL))
        game.act(Action(type=ActionType.CALL))
        game.act(Action(type=ActionType.CHECK))

        # Play through all streets
        for _ in range(3):  # flop, turn, river
            game.act(Action(type=ActionType.CHECK))
            game.act(Action(type=ActionType.CHECK))
            game.act(Action(type=ActionType.CHECK))

        total_end = sum(p.stack for p in game.players)
        assert total_start == total_end

    def test_multiple_hands(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)

        for _ in range(5):
            game.start_hand()
            game.act(Action(type=ActionType.FOLD))

        assert game.hand_number == 5

    def test_all_in_showdown(self):
        """Both players all-in preflop."""
        game = Game(["Alice", "Bob"], starting_stacks=100, seed=42)
        game.start_hand()

        # First player all-in
        game.act(Action(type=ActionType.ALL_IN))
        # Second player calls all-in
        state = game.act(Action(type=ActionType.CALL))

        assert state.is_hand_over
        assert len(state.board) == 5
        total = sum(p.stack for p in game.players)
        assert total == 200


class TestSidePots:
    def test_side_pot_three_players(self):
        """Player with fewer chips goes all-in, creating a side pot.
        Two active players remain and play continues through streets."""
        game = Game(
            ["Short", "Medium", "Deep"],
            starting_stacks=[50, 500, 500],
            seed=42,
        )
        game.start_hand()

        # First player (UTG) goes all-in with 50
        game.act(Action(type=ActionType.ALL_IN))
        # Second player calls
        game.act(Action(type=ActionType.CALL))
        # Third player (BB) calls
        state = game.act(Action(type=ActionType.CALL))

        # 2 active players remain, so game continues (flop)
        assert state.phase == GamePhase.FLOP_BET
        assert len(state.board) == 3

        # Play through remaining streets: check-check
        for _ in range(3):  # flop, turn, river
            game.act(Action(type=ActionType.CHECK))
            game.act(Action(type=ActionType.CHECK))

        assert game.phase == GamePhase.HAND_OVER

        # Total chips should be conserved
        total = sum(p.stack for p in game.players)
        assert total == 1050


class TestValidActions:
    def test_valid_actions_preflop_sb(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        valid = game.get_valid_actions()
        assert valid.can_fold
        assert valid.can_call
        assert valid.can_raise
        assert not valid.can_check  # Must call BB
        assert valid.call_amount == 5  # SB already posted 5, BB is 10

    def test_valid_actions_after_call(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        game.act(Action(type=ActionType.CALL))  # SB calls
        valid = game.get_valid_actions()
        # BB can check or raise
        assert valid.can_check
        assert valid.can_raise
        assert not valid.can_call

    def test_min_raise_amount(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        valid = game.get_valid_actions()
        # Min raise = BB + last raise = 10 + 10 = 20
        assert valid.min_raise == 20

    def test_invalid_action_raises_error(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        with pytest.raises(ValueError):
            game.act(Action(type=ActionType.CHECK))  # Can't check, need to call

    def test_raise_below_min_rejected(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        with pytest.raises(ValueError):
            game.act(Action(type=ActionType.RAISE, amount=12))  # Below min raise of 20


class TestDeck:
    def test_deterministic_dealing(self):
        """Same seed should produce same cards."""
        game1 = Game(["A", "B"], starting_stacks=1000, seed=42)
        game2 = Game(["A", "B"], starting_stacks=1000, seed=42)
        game1.start_hand()
        game2.start_hand()
        assert game1.players[0].hole_cards == game2.players[0].hole_cards
        assert game1.players[1].hole_cards == game2.players[1].hole_cards

    def test_different_seeds_different_cards(self):
        game1 = Game(["A", "B"], starting_stacks=1000, seed=42)
        game2 = Game(["A", "B"], starting_stacks=1000, seed=99)
        game1.start_hand()
        game2.start_hand()
        # Very unlikely to get same cards with different seeds
        assert game1.players[0].hole_cards != game2.players[0].hole_cards


class TestPlayerView:
    def test_hides_opponent_cards(self):
        game = Game(["Alice", "Bob"], starting_stacks=1000, seed=42)
        game.start_hand()
        state = game.state
        view = state.get_player_view(0)
        # Player 0 should see their own cards
        assert len(view["players"][0]["hole_cards"]) == 2
        # Player 0 should NOT see player 1's cards
        assert view["players"][1]["hole_cards"] == []


class TestEdgeCases:
    def test_player_with_exact_bb_stack(self):
        """Player with exactly BB amount of chips."""
        game = Game(["Alice", "Bob"], starting_stacks=[10, 1000], seed=42)
        state = game.start_hand()
        # Short stack should be forced all-in or have very limited options
        assert game.players[0].stack <= 10

    def test_three_handed_fold_to_bb(self):
        """Both players fold to BB."""
        game = Game(["A", "B", "C"], starting_stacks=1000, seed=42)
        game.start_hand()
        game.act(Action(type=ActionType.FOLD))
        state = game.act(Action(type=ActionType.FOLD))
        assert state.is_hand_over
