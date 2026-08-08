"""Authentication module for OllamaOptimizerGUI.

Handles user registration, login, JWT token generation and verification.
Uses passlib for password hashing and python-jose for JWT.
"""
import os
import time
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from jose import jwt, JWTError

from .database import create_user, get_user_by_username, get_user_by_id, count_users

SECRET_KEY = os.environ.get("OOG_JWT_SECRET", "oog-secret-change-in-production-please")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.environ.get("OOG_JWT_EXPIRE_HOURS", "168"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


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
    # First user becomes admin automatically
    user_count = await count_users()
    is_admin = 1 if user_count == 0 else 0
    hashed = hash_password(password)
    user = await create_user(username, hashed, is_admin)
    token = create_token(user["id"], username)
    return {"user": user, "token": token}


async def login_user(username: str, password: str) -> dict:
    user = await get_user_by_username(username)
    if not user:
        raise ValueError("Invalid username or password")
    if not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid username or password")
    token = create_token(user["id"], username)
    return {"user": {"id": user["id"], "username": user["username"], "is_admin": user.get("is_admin", 0)}, "token": token}


async def get_user_from_token(token: str) -> dict | None:
    payload = decode_token(token)
    if not payload:
        return None
    user_id = int(payload.get("sub", 0))
    return await get_user_by_id(user_id)
