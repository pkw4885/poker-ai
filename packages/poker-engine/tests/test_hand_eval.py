"""Tests for hand evaluation."""

from poker_engine.card import str_to_card
from poker_engine.hand_eval import evaluate_hand, find_winners, hand_class_name


def _cards(strs):
    return [str_to_card(s) for s in strs]


class TestHandEvaluation:
    def test_royal_flush_beats_straight_flush(self):
        board = _cards(["Ts", "Js", "Qs", "2d", "3c"])
        royal = _cards(["As", "Ks"])
        straight_flush = _cards(["9s", "8s"])
        assert evaluate_hand(royal, board) < evaluate_hand(straight_flush, board)

    def test_four_of_a_kind_beats_full_house(self):
        board = _cards(["Ah", "Ad", "Ac", "Kh", "2s"])
        quads = _cards(["As", "3d"])
        full_house = _cards(["Kd", "Kc"])
        assert evaluate_hand(quads, board) < evaluate_hand(full_house, board)

    def test_flush_beats_straight(self):
        board = _cards(["2h", "5h", "9h", "Ts", "Jc"])
        flush = _cards(["Kh", "3h"])
        straight = _cards(["8d", "7c"])
        assert evaluate_hand(flush, board) < evaluate_hand(straight, board)

    def test_full_house_beats_flush(self):
        board = _cards(["Ah", "Kh", "Kd", "5h", "2c"])
        full_house = _cards(["As", "Ad"])
        flush = _cards(["3h", "4h"])
        assert evaluate_hand(full_house, board) < evaluate_hand(flush, board)

    def test_two_pair_beats_one_pair(self):
        board = _cards(["Ah", "Kd", "7s", "3c", "2d"])
        two_pair = _cards(["As", "Kh"])
        one_pair = _cards(["Ad", "Qc"])
        assert evaluate_hand(two_pair, board) < evaluate_hand(one_pair, board)

    def test_high_card(self):
        board = _cards(["2h", "5d", "9s", "Jc", "3h"])
        ace_high = _cards(["As", "Kd"])
        king_high = _cards(["Kh", "Qc"])
        assert evaluate_hand(ace_high, board) < evaluate_hand(king_high, board)

    def test_hand_class_name(self):
        board = _cards(["Ah", "Kh", "Qh", "Jh", "2c"])
        score = evaluate_hand(_cards(["Th", "3d"]), board)
        assert hand_class_name(score) == "Royal Flush"

    def test_kicker_matters(self):
        board = _cards(["Ah", "Kd", "7s", "3c", "2d"])
        ace_king = _cards(["As", "Qh"])
        ace_jack = _cards(["Ad", "Jc"])
        assert evaluate_hand(ace_king, board) < evaluate_hand(ace_jack, board)


class TestFindWinners:
    def test_single_winner(self):
        board = _cards(["Ah", "Kd", "Qs", "Jc", "2h"])
        hands = {
            0: _cards(["As", "Kh"]),
            1: _cards(["7d", "8c"]),
        }
        winners, _, hand_class = find_winners(hands, board)
        assert winners == [0]
        assert hand_class == "Two Pair"

    def test_split_pot(self):
        board = _cards(["Ah", "Kd", "Qs", "Jc", "Th"])
        # Both players have the same straight (board plays)
        hands = {
            0: _cards(["2s", "3c"]),
            1: _cards(["4d", "5h"]),
        }
        winners, _, _ = find_winners(hands, board)
        assert len(winners) == 2

    def test_three_way_winner(self):
        board = _cards(["As", "Ks", "Qs", "Js", "Ts"])
        hands = {
            0: _cards(["2h", "3h"]),
            1: _cards(["4d", "5d"]),
            2: _cards(["6c", "7c"]),
        }
        winners, _, hand_class = find_winners(hands, board)
        assert len(winners) == 3
        assert hand_class == "Royal Flush"
