"""sqlite3 数据库层：建库建表、密码哈希、用户与会话访问（仅标准库，无第三方 ORM）。"""

import hashlib
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

# 数据库文件固定在 backend/data/xingmeng.db（按文件位置解析，不依赖启动时的 cwd）
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "xingmeng.db"

PBKDF2_ITERATIONS = 100_000
SESSION_TTL_DAYS = 7
HISTORY_LIMIT = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    """每次操作独立连接、用完即关（同步接口跑线程池，避免共享连接）。"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """建表 + 建索引（幂等，可重复执行）。"""
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                analysis_type TEXT NOT NULL,
                input_hash TEXT NOT NULL,
                input_json TEXT NOT NULL,
                result_text TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_type_hash
                ON analyses(user_id, analysis_type, input_hash);

            CREATE INDEX IF NOT EXISTS idx_user_type_created
                ON analyses(user_id, analysis_type, created_at DESC);
            """
        )


# ---------- 密码安全 ----------


def hash_password(password: str) -> tuple[str, str]:
    """生成 (salt_hex, hash_hex)。库里只存这两项，绝不存明文。"""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    """用同样的 pbkdf2 参数重算后比对，防时序攻击用 compare_digest。"""
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return secrets.compare_digest(digest.hex(), hash_hex)


# ---------- users ----------


def create_user(username: str, password: str) -> dict:
    """创建用户并返回 {id, username}；用户名冲突抛 sqlite3.IntegrityError。"""
    salt_hex, hash_hex = hash_password(password)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
            (username, hash_hex, salt_hex, _now_iso()),
        )
        return {"id": cur.lastrowid, "username": username}


def get_user_by_username(username: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


# ---------- sessions ----------


def create_session(user_id: int) -> str:
    """新建会话并返回 token（secrets.token_urlsafe(32)，7 天有效）。"""
    token = secrets.token_urlsafe(32)
    now = _now()
    expires_at = now + timedelta(days=SESSION_TTL_DAYS)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token, user_id, expires_at.isoformat(), now.isoformat()),
        )
    return token


def get_session(token: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,)).fetchone()
        return dict(row) if row else None


def delete_session(token: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def is_expired(expires_at: str) -> bool:
    """比较会话过期时间（ISO 8601 文本）与当前 UTC 时间。"""
    return datetime.fromisoformat(expires_at) <= _now()


# ---------- analyses ----------


def find_analysis(user_id: int, analysis_type: str, input_hash: str) -> dict | None:
    """按 用户 + 业务类型 + 输入哈希 查缓存。"""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM analyses WHERE user_id = ? AND analysis_type = ? AND input_hash = ? LIMIT 1",
            (user_id, analysis_type, input_hash),
        ).fetchone()
        return dict(row) if row else None


def save_analysis(
    user_id: int,
    analysis_type: str,
    input_hash: str,
    input_json: str,
    result_text: str,
) -> dict:
    """写入分析记录（同 hash 不重复插入），随后清理只保留最新 HISTORY_LIMIT 条。"""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO analyses
                (user_id, analysis_type, input_hash, input_json, result_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, analysis_type, input_hash, input_json, result_text, _now_iso()),
        )
        conn.execute(
            """
            DELETE FROM analyses
            WHERE id IN (
                SELECT id FROM analyses
                WHERE user_id = ? AND analysis_type = ?
                ORDER BY created_at DESC, id DESC
                LIMIT -1 OFFSET ?
            )
            """,
            (user_id, analysis_type, HISTORY_LIMIT),
        )
        row = conn.execute(
            "SELECT * FROM analyses WHERE user_id = ? AND analysis_type = ? AND input_hash = ? LIMIT 1",
            (user_id, analysis_type, input_hash),
        ).fetchone()
        return dict(row)


def list_analyses(user_id: int, analysis_type: str) -> list[dict]:
    """当前用户该类型最近 HISTORY_LIMIT 条（最新在前）。"""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM analyses
            WHERE user_id = ? AND analysis_type = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (user_id, analysis_type, HISTORY_LIMIT),
        ).fetchall()
        return [dict(r) for r in rows]


def get_analysis_by_id(user_id: int, analysis_id: int) -> dict | None:
    """按 id 查记录；带 user_id 条件，天然隔离他人记录。"""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM analyses WHERE id = ? AND user_id = ?",
            (analysis_id, user_id),
        ).fetchone()
        return dict(row) if row else None
