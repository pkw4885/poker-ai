"""Model registry for version management and checkpoint tracking."""

from __future__ import annotations

import json
import os
import pickle
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ModelMetadata:
    """Metadata for a saved model checkpoint."""

    version: int
    name: str
    created_at: float  # Unix timestamp
    training_iterations: int = 0
    elo_rating: float = 1500.0
    notes: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)


class ModelRegistry:
    """Version-managed model checkpoint registry.

    Stores model artefacts and metadata on disk.

    Parameters
    ----------
    base_dir:
        Directory where checkpoints are saved.
    """

    def __init__(self, base_dir: str) -> None:
        self.base_dir = base_dir
        self._metadata: Dict[int, ModelMetadata] = {}
        self._next_version = 1
        os.makedirs(base_dir, exist_ok=True)
        self._load_index()

    # -------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------

    def save(
        self,
        model_data: Any,
        name: str = "model",
        training_iterations: int = 0,
        elo_rating: float = 1500.0,
        notes: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Save a model checkpoint and return its version number."""
        version = self._next_version
        self._next_version += 1

        meta = ModelMetadata(
            version=version,
            name=name,
            created_at=time.time(),
            training_iterations=training_iterations,
            elo_rating=elo_rating,
            notes=notes,
            extra=extra or {},
        )
        self._metadata[version] = meta

        # Save model data
        model_path = self._model_path(version)
        with open(model_path, "wb") as f:
            pickle.dump(model_data, f)

        # Update index
        self._save_index()
        return version

    def load(self, version: int) -> Any:
        """Load the model data for a given version.

        Raises ``KeyError`` if the version does not exist.
        """
        if version not in self._metadata:
            raise KeyError(f"Model version {version} not found")
        model_path = self._model_path(version)
        with open(model_path, "rb") as f:
            return pickle.load(f)

    def get_metadata(self, version: int) -> ModelMetadata:
        """Return metadata for *version*."""
        if version not in self._metadata:
            raise KeyError(f"Model version {version} not found")
        return self._metadata[version]

    def list_versions(self) -> List[int]:
        """Return all version numbers in order."""
        return sorted(self._metadata.keys())

    def latest_version(self) -> Optional[int]:
        """Return the most recent version number, or *None* if empty."""
        versions = self.list_versions()
        return versions[-1] if versions else None

    def update_elo(self, version: int, elo_rating: float) -> None:
        """Update the Elo rating stored in a checkpoint's metadata."""
        if version not in self._metadata:
            raise KeyError(f"Model version {version} not found")
        self._metadata[version].elo_rating = elo_rating
        self._save_index()

    # -------------------------------------------------------------------
    # Internal
    # -------------------------------------------------------------------

    def _model_path(self, version: int) -> str:
        return os.path.join(self.base_dir, f"model_v{version}.pkl")

    def _index_path(self) -> str:
        return os.path.join(self.base_dir, "registry_index.json")

    def _save_index(self) -> None:
        index = {
            "next_version": self._next_version,
            "models": {
                str(v): asdict(m) for v, m in self._metadata.items()
            },
        }
        with open(self._index_path(), "w") as f:
            json.dump(index, f, indent=2)

    def _load_index(self) -> None:
        path = self._index_path()
        if not os.path.exists(path):
            return
        with open(path, "r") as f:
            index = json.load(f)
        self._next_version = index.get("next_version", 1)
        for v_str, m_dict in index.get("models", {}).items():
            v = int(v_str)
            self._metadata[v] = ModelMetadata(**m_dict)
