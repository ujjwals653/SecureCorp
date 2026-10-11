"""
Database initialisation and connection helpers.
SQLite is used for the demo. Only ciphertext, wrapped keys, signatures,
and metadata are ever stored — never plaintext, never unwrapped keys.
"""

import sqlite3
import os

def _db_path() -> str:
    """Read DB_PATH from env at call time so tests can override it per fixture."""
    return os.environ.get("DB_PATH", "securecorp.db")


def get_db():
    """Open (or reuse) a connection to the SQLite database."""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row          # rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL")  # safer concurrent access
    return conn


def init_db():
    """Create tables if they don't exist yet."""
    conn = get_db()
    with conn:
        conn.executescript("""
            -- Public keys registered by users (§7.3)
            CREATE TABLE IF NOT EXISTS public_keys (
                user_id     TEXT PRIMARY KEY,
                public_key  TEXT NOT NULL,          -- base64 SPKI
                algorithm   TEXT NOT NULL,
                cert        TEXT,                   -- base64/PEM X.509 cert (optional)
                registered_at TEXT NOT NULL
            );

            -- Encrypted file envelopes (§7.1)
            -- Stores ONLY ciphertext, iv, wrapped_key, signature, metadata.
            -- Plaintext and unwrapped keys MUST NEVER appear here.
            CREATE TABLE IF NOT EXISTS files (
                file_id      TEXT PRIMARY KEY,
                sender_id    TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                ciphertext   TEXT NOT NULL,   -- base64 AES-GCM ciphertext
                iv           TEXT NOT NULL,   -- base64 12-byte IV
                wrapped_key  TEXT NOT NULL,   -- base64 RSA-OAEP wrapped AES key
                signature    TEXT NOT NULL,   -- base64 RSA-PSS signature
                filename     TEXT NOT NULL,
                timestamp    TEXT NOT NULL
            );

            -- IDS alerts (§7.4) — optionally logged by Backend for /ids/alerts
            CREATE TABLE IF NOT EXISTS ids_alerts (
                alert_id    TEXT PRIMARY KEY,
                type        TEXT NOT NULL,
                source_ip   TEXT NOT NULL,
                severity    TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                action_taken TEXT NOT NULL
            );
        """)
    conn.close()
