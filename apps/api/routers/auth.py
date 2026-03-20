"""Auth API endpoints — register, login, me."""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import SECRET_KEY, ALGORITHM, get_current_user
from database import get_db

router = APIRouter()

TOKEN_EXPIRE_DAYS = 7


def _hash_password(password: str) -> str:
    """Hash a password using SHA-256 with a random salt."""
    salt = os.urandom(16).hex()
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}${h}"


def _verify_password(password: str, stored: str) -> bool:
    """Verify a password against its stored hash."""
    if "$" not in stored:
        return False
    salt, h = stored.split("$", 1)
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest() == h


def _create_token(user_id: int, username: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{2,20}$")


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest) -> dict[str, Any]:
    """Create a new user account and return a JWT."""
    if not _USERNAME_RE.match(req.username):
        raise HTTPException(
            400,
            "Username must be 2-20 characters, alphanumeric and underscore only",
        )
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    password_hash = _hash_password(req.password)

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ? OR username = ?",
            (req.email, req.username),
        ).fetchone()
        if existing:
            raise HTTPException(409, "Email or username already taken")

        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (req.username, req.email, password_hash),
        )
        conn.commit()
        user_id = cur.lastrowid
    finally:
        conn.close()

    token = _create_token(user_id, req.username, req.email)
    return {"token": token, "user": {"id": user_id, "username": req.username, "email": req.email}}


@router.post("/login")
async def login(req: LoginRequest) -> dict[str, Any]:
    """Verify credentials and return a JWT."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, username, email, password_hash FROM users WHERE email = ?",
            (req.email,),
        ).fetchone()
    finally:
        conn.close()

    if not row or not _verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = _create_token(row["id"], row["username"], row["email"])
    return {
        "token": token,
        "user": {"id": row["id"], "username": row["username"], "email": row["email"]},
    }


@router.get("/me")
async def me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Return the current authenticated user."""
    return user
