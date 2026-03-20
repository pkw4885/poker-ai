"""SQLite database setup and helpers."""

from __future__ import annotations

import os
import sqlite3
from typing import Optional

DATABASE_PATH = os.getenv("DATABASE_PATH", "poker.db")

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host_user_id INTEGER NOT NULL,
    max_players INTEGER NOT NULL DEFAULT 6,
    ai_count INTEGER NOT NULL DEFAULT 0,
    ai_difficulty TEXT NOT NULL DEFAULT 'medium',
    ai_muck BOOLEAN NOT NULL DEFAULT 0,
    ai_fold_reveal BOOLEAN NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS room_players (
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    seat_index INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""


def get_db() -> sqlite3.Connection:
    """Return a new database connection with row_factory set."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    conn = get_db()
    try:
        conn.executescript(_CREATE_TABLES)
        conn.commit()
    finally:
        conn.close()
