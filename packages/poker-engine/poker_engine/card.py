"""Card representation and conversion utilities."""

from __future__ import annotations

from treys import Card as TreysCard

RANKS = "23456789TJQKA"
SUITS = "shdc"  # spades, hearts, diamonds, clubs

RANK_NAMES = {
    "2": "Two", "3": "Three", "4": "Four", "5": "Five",
    "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine",
    "T": "Ten", "J": "Jack", "Q": "Queen", "K": "King", "A": "Ace",
}

SUIT_NAMES = {
    "s": "Spades", "h": "Hearts", "d": "Diamonds", "c": "Clubs",
}


def card_to_str(card_int: int) -> str:
    """Convert treys integer card to string like 'As', 'Kh'."""
    return TreysCard.int_to_str(card_int)


def str_to_card(card_str: str) -> int:
    """Convert string like 'As', 'Kh' to treys integer card."""
    return TreysCard.new(card_str)


def card_to_pretty(card_int: int) -> str:
    """Convert treys integer card to pretty string like 'A♠'."""
    return TreysCard.int_to_pretty_str(card_int)


def pretty_cards(cards: list[int]) -> str:
    """Convert list of treys integer cards to pretty string."""
    return " ".join(card_to_pretty(c) for c in cards)


def validate_card_str(card_str: str) -> bool:
    """Validate that a card string is valid (e.g., 'As', 'Kh')."""
    if len(card_str) != 2:
        return False
    return card_str[0] in RANKS and card_str[1] in SUITS
