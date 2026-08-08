"""SQLite database module for OllamaOptimizerGUI.

Stores users, conversations, and messages in a local SQLite file.
Uses aiosqlite for async access.
"""
import aiosqlite
import os
import time
from pathlib import Path

DB_PATH = os.environ.get("OOG_DB_PATH", str(Path(__file__).parent.parent / "data" / "oog.db"))


async def init_db():
    """Create tables if they don't exist."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_owner INTEGER NOT NULL DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)
        # Add is_admin column if it doesn't exist (migration for existing DBs)
        try:
            await db.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass
        # Add is_owner column if it doesn't exist (migration for existing DBs)
        try:
            await db.execute("ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'Nueva conversación',
                model TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timing_json TEXT,
                created_at REAL NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        await db.commit()


async def get_db():
    """Get a database connection."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


# ─── User operations ──────────────────────────────────────────────────────────

async def create_user(username: str, password_hash: str, is_admin: int = 0, is_owner: int = 0) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO users (username, password_hash, is_admin, is_owner, created_at) VALUES (?, ?, ?, ?, ?)",
            (username, password_hash, is_admin, is_owner, time.time())
        )
        await db.commit()
        return {"id": cursor.lastrowid, "username": username, "is_admin": is_admin, "is_owner": is_owner}


async def get_user_by_username(username: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_user_by_id(user_id: int) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT id, username, is_admin, is_owner, created_at FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_all_users() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT id, username, is_admin, is_owner, created_at FROM users ORDER BY created_at ASC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def delete_user(user_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        await db.commit()
        return cursor.rowcount > 0


async def count_users() -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM users")
        row = await cursor.fetchone()
        return row[0] if row else 0


# ─── Conversation operations ──────────────────────────────────────────────────

async def create_conversation(user_id: int, title: str = "Nueva conversación", model: str = "") -> dict:
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "INSERT INTO conversations (user_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, title, model, now, now)
        )
        await db.commit()
        cursor2 = await db.execute("SELECT * FROM conversations WHERE id = ?", (cursor.lastrowid,))
        row = await cursor2.fetchone()
        return dict(row)


async def get_conversations(user_id: int) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_conversation(user_id: int, conv_id: int) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            (conv_id, user_id)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_conversation(user_id: int, conv_id: int, title: str = None, model: str = None) -> dict | None:
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if title is not None:
            await db.execute("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?", (title, now, conv_id, user_id))
        if model is not None:
            await db.execute("UPDATE conversations SET model = ?, updated_at = ? WHERE id = ? AND user_id = ?", (model, now, conv_id, user_id))
        await db.execute("UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?", (now, conv_id, user_id))
        await db.commit()
        cursor = await db.execute("SELECT * FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def delete_conversation(user_id: int, conv_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id))
        await db.commit()
        return cursor.rowcount > 0


# ─── Message operations ───────────────────────────────────────────────────────

async def add_message(conversation_id: int, role: str, content: str, timing_json: str = None) -> dict:
    now = time.time()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "INSERT INTO messages (conversation_id, role, content, timing_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (conversation_id, role, content, timing_json, now)
        )
        await db.commit()
        await db.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
        await db.commit()
        cursor2 = await db.execute("SELECT * FROM messages WHERE id = ?", (cursor.lastrowid,))
        row = await cursor2.fetchone()
        return dict(row)


async def get_messages(conversation_id: int) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
