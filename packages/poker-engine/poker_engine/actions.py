"""Action types and validation for Texas Hold'em."""

from __future__ import annotations

from dataclasses import dataclass

from .constants import ActionType


@dataclass(frozen=True)
class Action:
    """Represents a player action."""

    type: ActionType
    amount: int = 0
    player_id: int = -1

    def __repr__(self) -> str:
        if self.type in (ActionType.RAISE, ActionType.ALL_IN):
            return f"Action({self.type.value}, amount={self.amount}, player={self.player_id})"
        return f"Action({self.type.value}, player={self.player_id})"


@dataclass
class ValidActions:
    """Describes the valid actions for a player at a decision point."""

    can_fold: bool = True
    can_check: bool = False
    can_call: bool = False
    call_amount: int = 0
    can_raise: bool = False
    min_raise: int = 0
    max_raise: int = 0  # Player's remaining stack (for all-in)

    def to_list(self) -> list[dict]:
        """Convert to a list of action descriptions."""
        actions = []
        if self.can_fold:
            actions.append({"type": "fold"})
        if self.can_check:
            actions.append({"type": "check"})
        if self.can_call:
            actions.append({"type": "call", "amount": self.call_amount})
        if self.can_raise:
            actions.append({
                "type": "raise",
                "min_amount": self.min_raise,
                "max_amount": self.max_raise,
            })
        return actions


def validate_action(action: Action, valid: ValidActions) -> tuple[bool, str]:
    """Validate an action against the valid actions.

    Returns (is_valid, error_message).
    """
    if action.type == ActionType.FOLD:
        return (True, "") if valid.can_fold else (False, "Cannot fold here")

    if action.type == ActionType.CHECK:
        return (True, "") if valid.can_check else (False, "Cannot check, must call or fold")

    if action.type == ActionType.CALL:
        if not valid.can_call:
            return False, "Cannot call here"
        return True, ""

    if action.type == ActionType.RAISE:
        if not valid.can_raise:
            return False, "Cannot raise"
        if action.amount < valid.min_raise:
            # WSOP rule: if raise is less than min but equals all-in, it's valid
            if action.amount == valid.max_raise:
                return True, ""
            return False, f"Raise must be at least {valid.min_raise}"
        if action.amount > valid.max_raise:
            return False, f"Raise cannot exceed {valid.max_raise}"
        return True, ""

    if action.type == ActionType.ALL_IN:
        if not valid.can_raise and not valid.can_call:
            return False, "Cannot go all-in"
        return True, ""

    return False, f"Unknown action type: {action.type}"
