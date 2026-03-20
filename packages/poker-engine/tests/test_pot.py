"""Tests for pot and side pot calculations."""

from poker_engine.pot import PotManager


class TestPotManager:
    def test_simple_pot_no_all_in(self):
        pm = PotManager()
        pm.calculate_pots({0: 100, 1: 100}, folded_ids=set())
        assert pm.total == 200
        assert len(pm.pots) == 1
        assert pm.pots[0].eligible_player_ids == {0, 1}

    def test_one_player_all_in_less(self):
        """Player 0 all-in for 50, player 1 bets 100."""
        pm = PotManager()
        pm.calculate_pots({0: 50, 1: 100}, folded_ids=set())
        assert pm.total == 150
        assert len(pm.pots) == 2
        # Main pot: 50 from each = 100
        assert pm.pots[0].amount == 100
        assert pm.pots[0].eligible_player_ids == {0, 1}
        # Side pot: 50 from player 1
        assert pm.pots[1].amount == 50
        assert pm.pots[1].eligible_player_ids == {1}

    def test_two_all_ins_different_amounts(self):
        """Player 0: 30, Player 1: 60, Player 2: 100."""
        pm = PotManager()
        pm.calculate_pots({0: 30, 1: 60, 2: 100}, folded_ids=set())
        assert pm.total == 190
        assert len(pm.pots) == 3
        # Main pot: 30*3 = 90
        assert pm.pots[0].amount == 90
        assert pm.pots[0].eligible_player_ids == {0, 1, 2}
        # Side pot 1: 30*2 = 60
        assert pm.pots[1].amount == 60
        assert pm.pots[1].eligible_player_ids == {1, 2}
        # Side pot 2: 40*1 = 40
        assert pm.pots[2].amount == 40
        assert pm.pots[2].eligible_player_ids == {2}

    def test_folded_player_contributes_but_not_eligible(self):
        """Player 0 folds after betting 50, players 1 and 2 continue."""
        pm = PotManager()
        pm.calculate_pots({0: 50, 1: 100, 2: 100}, folded_ids={0})
        assert pm.total == 250
        # Main pot: 50*3 = 150, only 1 and 2 eligible
        assert pm.pots[0].amount == 150
        assert pm.pots[0].eligible_player_ids == {1, 2}
        # Side pot: 50*2 = 100
        assert pm.pots[1].amount == 100
        assert pm.pots[1].eligible_player_ids == {1, 2}

    def test_four_way_all_in(self):
        """4 players all-in for different amounts."""
        pm = PotManager()
        pm.calculate_pots({0: 25, 1: 50, 2: 75, 3: 100}, folded_ids=set())
        assert pm.total == 250
        assert len(pm.pots) == 4

        # Main: 25*4 = 100
        assert pm.pots[0].amount == 100
        assert pm.pots[0].eligible_player_ids == {0, 1, 2, 3}

        # Side 1: 25*3 = 75
        assert pm.pots[1].amount == 75
        assert pm.pots[1].eligible_player_ids == {1, 2, 3}

        # Side 2: 25*2 = 50
        assert pm.pots[2].amount == 50
        assert pm.pots[2].eligible_player_ids == {2, 3}

        # Side 3: 25*1 = 25
        assert pm.pots[3].amount == 25
        assert pm.pots[3].eligible_player_ids == {3}

    def test_all_equal_bets(self):
        """All players bet the same amount."""
        pm = PotManager()
        pm.calculate_pots({0: 100, 1: 100, 2: 100}, folded_ids=set())
        assert pm.total == 300
        assert len(pm.pots) == 1
        assert pm.pots[0].eligible_player_ids == {0, 1, 2}

    def test_empty_pot(self):
        pm = PotManager()
        pm.calculate_pots({}, folded_ids=set())
        assert pm.total == 0

    def test_all_folded_except_one(self):
        pm = PotManager()
        pm.calculate_pots({0: 50, 1: 50, 2: 100}, folded_ids={0, 1})
        assert pm.total == 200
        # Player 2 is the only eligible player
        for pot in pm.pots:
            if pot.amount > 0:
                assert 2 in pot.eligible_player_ids

    def test_pot_display(self):
        pm = PotManager()
        pm.calculate_pots({0: 50, 1: 100}, folded_ids=set())
        display = pm.get_pot_display()
        assert len(display) == 2
        assert display[0]["name"] == "Main Pot"
        assert display[1]["name"] == "Side Pot 1"
