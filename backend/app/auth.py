"""Authentication module for OllamaOptimizerGUI.

Handles user registration, login, JWT token generation and verification.
Uses bcrypt directly for password hashing and python-jose for JWT.
"""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError

from .database import create_user, get_user_by_username, get_user_by_id, count_users

SECRET_KEY = os.environ.get("OOG_JWT_SECRET", "oog-secret-change-in-production-please")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("OOG_JWT_EXPIRE_HOURS", "168"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def register_user(username: str, password: str) -> dict:
    existing = await get_user_by_username(username)
    if existing:
        raise ValueError("Username already exists")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters")
    if len(username) < 2:
        raise ValueError("Username must be at least 2 characters")
    # First user becomes admin + owner automatically
    user_count = await count_users()
    is_admin = 1 if user_count == 0 else 0
    is_owner = 1 if user_count == 0 else 0
    hashed = hash_password(password)
    user = await create_user(username, hashed, is_admin, is_owner)
    token = create_token(user["id"], username)
    return {"user": user, "token": token}


async def login_user(username: str, password: str) -> dict:
    user = await get_user_by_username(username)
    if not user:
        raise ValueError("Invalid username or password")
    if not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid username or password")
    token = create_token(user["id"], username)
    return {"user": {"id": user["id"], "username": user["username"], "is_admin": user.get("is_admin", 0), "is_owner": user.get("is_owner", 0)}, "token": token}


async def get_user_from_token(token: str) -> dict | None:
    payload = decode_token(token)
    if not payload:
        return None
    user_id = int(payload.get("sub", 0))
    return await get_user_by_id(user_id)
