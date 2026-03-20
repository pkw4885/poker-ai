"""Experience replay buffers for training."""

from __future__ import annotations

import json
import os
import pickle
import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple


@dataclass
class Experience:
    """A single experience entry."""

    state: Any
    action: Any
    reward: float
    next_state: Any = None
    done: bool = False
    info: Dict[str, Any] = field(default_factory=dict)


class ReplayBuffer:
    """Fixed-capacity FIFO replay buffer.

    Parameters
    ----------
    capacity:
        Maximum number of experiences stored. Oldest entries are evicted
        when the buffer is full.
    seed:
        RNG seed for sampling.
    """

    def __init__(self, capacity: int = 100_000, seed: Optional[int] = None) -> None:
        self.capacity = capacity
        self._buffer: List[Experience] = []
        self._pos = 0  # Write cursor for ring-buffer behaviour
        self._rng = random.Random(seed)

    def add(self, experience: Experience) -> None:
        """Add an experience to the buffer."""
        if len(self._buffer) < self.capacity:
            self._buffer.append(experience)
        else:
            self._buffer[self._pos] = experience
        self._pos = (self._pos + 1) % self.capacity

    def sample(self, batch_size: int) -> List[Experience]:
        """Sample a random batch of experiences.

        Raises ``ValueError`` if the buffer has fewer entries than
        *batch_size*.
        """
        if len(self._buffer) < batch_size:
            raise ValueError(
                f"Not enough experiences ({len(self._buffer)}) "
                f"to sample batch of {batch_size}"
            )
        return self._rng.sample(self._buffer, batch_size)

    def __len__(self) -> int:
        return len(self._buffer)

    def save(self, path: str) -> None:
        """Persist the buffer to disk using pickle."""
        with open(path, "wb") as f:
            pickle.dump(
                {"buffer": self._buffer, "pos": self._pos, "capacity": self.capacity},
                f,
            )

    def load(self, path: str) -> None:
        """Load a previously saved buffer."""
        with open(path, "rb") as f:
            data = pickle.load(f)
        self._buffer = data["buffer"]
        self._pos = data["pos"]
        self.capacity = data["capacity"]


class PrioritizedReplayBuffer:
    """Replay buffer with TD-error based priority sampling.

    Higher-priority experiences are sampled more frequently.

    Parameters
    ----------
    capacity:
        Maximum number of experiences.
    alpha:
        How much prioritisation to use (0 = uniform, 1 = full priority).
    seed:
        RNG seed.
    """

    def __init__(
        self,
        capacity: int = 100_000,
        alpha: float = 0.6,
        seed: Optional[int] = None,
    ) -> None:
        self.capacity = capacity
        self.alpha = alpha
        self._buffer: List[Experience] = []
        self._priorities: List[float] = []
        self._pos = 0
        self._rng = random.Random(seed)

    def add(self, experience: Experience, td_error: float = 1.0) -> None:
        """Add an experience with a given priority (|td_error| + eps)."""
        priority = (abs(td_error) + 1e-6) ** self.alpha
        if len(self._buffer) < self.capacity:
            self._buffer.append(experience)
            self._priorities.append(priority)
        else:
            self._buffer[self._pos] = experience
            self._priorities[self._pos] = priority
        self._pos = (self._pos + 1) % self.capacity

    def sample(self, batch_size: int) -> Tuple[List[Experience], List[int]]:
        """Sample a batch weighted by priority.

        Returns ``(experiences, indices)`` so priorities can be updated.
        """
        if len(self._buffer) < batch_size:
            raise ValueError(
                f"Not enough experiences ({len(self._buffer)}) "
                f"to sample batch of {batch_size}"
            )

        total = sum(self._priorities)
        if total <= 0:
            weights = [1.0] * len(self._buffer)
        else:
            weights = self._priorities

        indices = self._rng.choices(
            range(len(self._buffer)), weights=weights, k=batch_size
        )
        experiences = [self._buffer[i] for i in indices]
        return experiences, indices

    def update_priority(self, index: int, td_error: float) -> None:
        """Update the priority of an existing entry."""
        if 0 <= index < len(self._priorities):
            self._priorities[index] = (abs(td_error) + 1e-6) ** self.alpha

    def __len__(self) -> int:
        return len(self._buffer)

    def save(self, path: str) -> None:
        with open(path, "wb") as f:
            pickle.dump(
                {
                    "buffer": self._buffer,
                    "priorities": self._priorities,
                    "pos": self._pos,
                    "capacity": self.capacity,
                    "alpha": self.alpha,
                },
                f,
            )

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            data = pickle.load(f)
        self._buffer = data["buffer"]
        self._priorities = data["priorities"]
        self._pos = data["pos"]
        self.capacity = data["capacity"]
        self.alpha = data["alpha"]
