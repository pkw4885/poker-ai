"""Hand history storage for AI learning — stores completed hands in SQLite."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any


class HandHistoryStore:
    """Stores completed poker hand data in SQLite for AI training and analysis."""

    def __init__(self, db_path: str = "data/hand_history.db") -> None:
        # Resolve relative paths from the api directory
        if not os.path.isabs(db_path):
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base, db_path)

        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self) -> None:
        cur = self._conn.cursor()
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS hand_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                hand_number INTEGER NOT NULL,
                timestamp REAL NOT NULL,
                num_players INTEGER NOT NULL,
                difficulty TEXT NOT NULL,
                -- Starting state
                dealer_pos INTEGER NOT NULL,
                small_blind INTEGER NOT NULL,
                big_blind INTEGER NOT NULL,
                -- Players JSON: [{id, name, starting_stack, hole_cards, position}]
                players_json TEXT NOT NULL,
                -- Actions JSON: [{player_id, action_type, amount, street}]
                actions_json TEXT NOT NULL,
                -- Board cards as JSON array of ints
                board_json TEXT NOT NULL,
                -- Results JSON: [{player_id, won_amount, final_stack, hand_class}]
                results_json TEXT NOT NULL,
                -- Summary
                pot_total INTEGER NOT NULL,
                winner_ids TEXT NOT NULL,
                winning_hand TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_hand_history_game ON hand_history(game_id);
            CREATE INDEX IF NOT EXISTS idx_hand_history_timestamp ON hand_history(timestamp);
            """
        )
        self._conn.commit()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save_hand(
        self,
        game_id: str,
        hand_number: int,
        difficulty: str,
        game_state: Any,
        action_history: list[Any],
        hand_results: list[dict],
        players_starting_state: list[dict],
    ) -> None:
        """Persist a completed hand to the database.

        Parameters
        ----------
        game_id : str
            Unique game identifier.
        hand_number : int
            Sequential hand number within the game.
        difficulty : str
            AI difficulty setting for this game.
        game_state : GameState-like
            The engine's state object at the end of the hand.  Expected attrs:
            ``players``, ``board``, ``dealer_pos``, ``small_blind``, ``big_blind``.
        action_history : list[Action]
            List of Action objects from the engine (type, amount, player_id).
        hand_results : list[dict]
            Result dicts from ``game.hand_results``.
        players_starting_state : list[dict]
            Pre-hand snapshot: ``[{id, name, starting_stack, hole_cards, position}]``.
        """
        # Build actions list
        actions = []
        for a in action_history:
            actions.append(
                {
                    "player_id": a.player_id,
                    "action_type": a.type.value,
                    "amount": a.amount,
                }
            )

        # Build results list with per-player details
        all_winner_ids: list[int] = []
        winning_hand = ""
        pot_total = 0
        for r in hand_results:
            all_winner_ids.extend(r.get("winners", []))
            pot_total += r.get("pot_amount", 0)
            if r.get("hand_class"):
                winning_hand = r["hand_class"]

        # Build per-player results from starting state + final state
        results = []
        for ps in players_starting_state:
            pid = ps["id"]
            # Find final stack from game_state players
            final_stack = ps["starting_stack"]
            for p in game_state.players:
                if p.id == pid:
                    final_stack = p.stack
                    break
            won_amount = final_stack - ps["starting_stack"]
            hand_class = ""
            for r in hand_results:
                if pid in r.get("winners", []):
                    hand_class = r.get("hand_class", "")
            results.append(
                {
                    "player_id": pid,
                    "won_amount": won_amount,
                    "final_stack": final_stack,
                    "hand_class": hand_class,
                }
            )

        unique_winners = list(set(all_winner_ids))

        cur = self._conn.cursor()
        cur.execute(
            """
            INSERT INTO hand_history (
                game_id, hand_number, timestamp, num_players, difficulty,
                dealer_pos, small_blind, big_blind,
                players_json, actions_json, board_json, results_json,
                pot_total, winner_ids, winning_hand
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                game_id,
                hand_number,
                time.time(),
                len(players_starting_state),
                difficulty,
                game_state.dealer_pos,
                game_state.small_blind,
                game_state.big_blind,
                json.dumps(players_starting_state),
                json.dumps(actions),
                json.dumps(list(game_state.board)),
                json.dumps(results),
                pot_total,
                json.dumps(unique_winners),
                winning_hand,
            ),
        )
        self._conn.commit()

    def get_recent_hands(self, limit: int = 100) -> list[dict]:
        """Return the most recent hands, newest first."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM hand_history ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            # Parse JSON fields back into Python objects
            for key in ("players_json", "actions_json", "board_json", "results_json", "winner_ids"):
                if key in d and isinstance(d[key], str):
                    d[key] = json.loads(d[key])
            result.append(d)
        return result

    def get_stats(self) -> dict:
        """Return aggregate statistics about stored hands."""
        cur = self._conn.cursor()

        cur.execute("SELECT COUNT(*) FROM hand_history")
        total = cur.fetchone()[0]

        cur.execute(
            "SELECT difficulty, COUNT(*) as cnt FROM hand_history GROUP BY difficulty"
        )
        by_difficulty = {row["difficulty"]: row["cnt"] for row in cur.fetchall()}

        cur.execute(
            "SELECT COUNT(DISTINCT game_id) FROM hand_history"
        )
        total_games = cur.fetchone()[0]

        cur.execute(
            "SELECT AVG(pot_total) FROM hand_history"
        )
        avg_pot = cur.fetchone()[0] or 0

        return {
            "total_hands": total,
            "total_games": total_games,
            "hands_by_difficulty": by_difficulty,
            "average_pot": round(avg_pot, 2),
        }
