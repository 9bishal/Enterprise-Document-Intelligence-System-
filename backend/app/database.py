import sqlite3
import os
import json
from datetime import datetime

DB_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"
)
DB_PATH = os.path.join(DB_DIR, "app.db")


def get_db_connection():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Documents table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            chunk_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ingesting',
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Sessions table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Messages table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            sources TEXT, -- JSON array of source chunk metadata
            steps TEXT,   -- JSON array of LangGraph steps executed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
        )
    """
    )

    conn.commit()
    conn.close()


# Document operations
def add_document(doc_id, filename, path, file_size):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (id, filename, path, file_size, status) VALUES (?, ?, ?, ?, 'ingesting')",
        (doc_id, filename, path, file_size),
    )
    conn.commit()
    conn.close()


def update_document_status(doc_id, status, chunk_count=0, error_message=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE documents SET status = ?, chunk_count = ?, error_message = ? WHERE id = ?",
        (status, chunk_count, error_message, doc_id),
    )
    conn.commit()
    conn.close()


def get_all_documents():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_document(doc_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_document_record(doc_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()


# Session operations
def create_session(session_id, name):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (id, name) VALUES (?, ?)", (session_id, name))
    conn.commit()
    conn.close()


def get_all_sessions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_session_record(session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


# Message operations
def add_message(message_id, session_id, role, content, sources=None, steps=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    sources_str = json.dumps(sources) if sources else None
    steps_str = json.dumps(steps) if steps else None
    cursor.execute(
        "INSERT INTO messages (id, session_id, role, content, sources, steps) VALUES (?, ?, ?, ?, ?, ?)",
        (message_id, session_id, role, content, sources_str, steps_str),
    )
    conn.commit()
    conn.close()


def get_session_messages(session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    messages = []
    for r in rows:
        m = dict(r)
        m["sources"] = json.loads(m["sources"]) if m["sources"] else []
        m["steps"] = json.loads(m["steps"]) if m["steps"] else []
        messages.append(m)
    return messages
