"""Constants for the poker game engine."""

from enum import Enum, auto


class Street(Enum):
    PREFLOP = auto()
    FLOP = auto()
    TURN = auto()
    RIVER = auto()
    SHOWDOWN = auto()


class ActionType(Enum):
    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    RAISE = "raise"
    ALL_IN = "all_in"


class PlayerStatus(Enum):
    ACTIVE = "active"
    FOLDED = "folded"
    ALL_IN = "all_in"
    OUT = "out"  # No chips left (tournament)


class GamePhase(Enum):
    WAITING = "waiting"
    DEAL_HOLE = "deal_hole"
    PREFLOP_BET = "preflop_bet"
    DEAL_FLOP = "deal_flop"
    FLOP_BET = "flop_bet"
    DEAL_TURN = "deal_turn"
    TURN_BET = "turn_bet"
    DEAL_RIVER = "deal_river"
    RIVER_BET = "river_bet"
    SHOWDOWN = "showdown"
    HAND_OVER = "hand_over"


class GameMode(Enum):
    CASH = "cash"
    TOURNAMENT = "tournament"


# Betting phase mapping
STREET_TO_BET_PHASE = {
    Street.PREFLOP: GamePhase.PREFLOP_BET,
    Street.FLOP: GamePhase.FLOP_BET,
    Street.TURN: GamePhase.TURN_BET,
    Street.RIVER: GamePhase.RIVER_BET,
}

BET_PHASE_TO_STREET = {v: k for k, v in STREET_TO_BET_PHASE.items()}

BETTING_PHASES = {
    GamePhase.PREFLOP_BET,
    GamePhase.FLOP_BET,
    GamePhase.TURN_BET,
    GamePhase.RIVER_BET,
}
