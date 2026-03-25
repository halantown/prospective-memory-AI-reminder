"""Database abstraction layer — MySQL via PyMySQL with sqlite3-compatible API.

Provides a drop-in replacement for the previous sqlite3-based database module.
All existing code can keep calling get_db() / db.execute() / db.commit() / db.close()
with minimal changes.
"""

import os
import logging
from pathlib import Path

import pymysql
import pymysql.cursors

logger = logging.getLogger("saturday.database")

_db_initialized = False


# ── MySQL connection parameters (from env or defaults) ──────

def _mysql_params() -> dict:
    return {
        "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.environ.get("MYSQL_PORT", 3306)),
        "user": os.environ.get("MYSQL_USER", "saturday"),
        "password": os.environ.get("MYSQL_PASSWORD", "saturday_pass"),
        "database": os.environ.get("MYSQL_DATABASE", "experiment"),
        "charset": "utf8mb4",
        "autocommit": False,
    }


# ── Row wrapper (sqlite3.Row-compatible) ────────────────────

class Row:
    """sqlite3.Row-compatible row supporting both dict-key and integer-index access."""

    __slots__ = ("_data", "_keys", "_values")

    def __init__(self, data: dict):
        self._data = data
        self._keys = list(data.keys())
        self._values = list(data.values())

    def __getitem__(self, key):
        if isinstance(key, (int, slice)):
            return self._values[key]
        return self._data[key]

    def __contains__(self, key):
        return key in self._data

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()

    def __iter__(self):
        return iter(self._keys)

    def __len__(self):
        return len(self._data)

    def __repr__(self):
        return f"Row({self._data})"


# ── Cursor wrapper ──────────────────────────────────────────

class CursorWrapper:
    """Wraps pymysql DictCursor to return Row objects."""

    def __init__(self, cursor):
        self._cursor = cursor

    def fetchone(self):
        row = self._cursor.fetchone()
        return Row(row) if row else None

    def fetchall(self):
        return [Row(r) for r in self._cursor.fetchall()]

    @property
    def lastrowid(self):
        return self._cursor.lastrowid

    @property
    def rowcount(self):
        return self._cursor.rowcount


# ── Connection wrapper ──────────────────────────────────────

def _convert_placeholders(sql: str) -> str:
    """Convert sqlite3 '?' placeholders to pymysql '%s' placeholders."""
    return sql.replace("?", "%s")


class MySQLConnection:
    """Drop-in replacement for sqlite3.Connection with compatible API."""

    def __init__(self, **kwargs):
        self._conn = pymysql.connect(
            cursorclass=pymysql.cursors.DictCursor,
            **kwargs,
        )

    def execute(self, sql, params=None):
        sql = _convert_placeholders(sql)
        cursor = self._conn.cursor()
        cursor.execute(sql, params)
        return CursorWrapper(cursor)

    def executemany(self, sql, params_list):
        sql = _convert_placeholders(sql)
        cursor = self._conn.cursor()
        cursor.executemany(sql, params_list)
        return CursorWrapper(cursor)

    def executescript(self, sql):
        """Execute multiple SQL statements separated by semicolons."""
        cursor = self._conn.cursor()
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt:
                cursor.execute(stmt)
        self._conn.commit()

    def commit(self):
        self._conn.commit()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass


# ── Public API (unchanged signatures) ───────────────────────

def _raw_connect(db_path: Path | None = None) -> MySQLConnection:
    """Open a MySQL connection (db_path kept for backward compatibility)."""
    return MySQLConnection(**_mysql_params())


def get_db(db_path: Path | None = None) -> MySQLConnection:
    """Get a database connection, auto-initializing if needed."""
    global _db_initialized
    conn = _raw_connect(db_path)
    if not _db_initialized:
        try:
            cursor = conn._conn.cursor()
            cursor.execute("SHOW TABLES LIKE 'sessions'")
            if not cursor.fetchone():
                conn.close()
                init_db(db_path)
                conn = _raw_connect(db_path)
        except Exception:
            conn.close()
            init_db(db_path)
            conn = _raw_connect(db_path)
        _db_initialized = True
    return conn


def init_db(db_path: Path | None = None):
    """Create all tables in MySQL."""
    global _db_initialized
    db = _raw_connect(db_path)

    db.executescript("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id       VARCHAR(36) PRIMARY KEY,
        participant_id   VARCHAR(20) NOT NULL,
        latin_square_group VARCHAR(10) NOT NULL,
        condition_order  TEXT NOT NULL,
        phase            VARCHAR(30) NOT NULL DEFAULT 'created',
        created_at       DOUBLE NOT NULL,
        completed_at     DOUBLE,
        experimenter_notes TEXT,
        token            VARCHAR(10) UNIQUE,
        current_block    INT DEFAULT -1,
        is_interrupted   TINYINT(1) DEFAULT 0,
        last_heartbeat   DOUBLE,
        timer_started_at DOUBLE,
        timer_running_since DOUBLE,
        timer_elapsed_s  DOUBLE DEFAULT 0,
        is_online        TINYINT(1) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS encoding_logs (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        session_id      VARCHAR(36) NOT NULL,
        block_number    INT NOT NULL,
        task_id         VARCHAR(100),
        quiz_attempts   INT NOT NULL DEFAULT 1,
        confirmed_at    DOUBLE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS pm_trials (
        id                          INT AUTO_INCREMENT PRIMARY KEY,
        session_id                  VARCHAR(36) NOT NULL,
        block_number                INT NOT NULL,
        task_slot                   VARCHAR(5) NOT NULL,
        task_id                     VARCHAR(100) NOT NULL,
        `condition`                 VARCHAR(30) NOT NULL,
        participant_group           VARCHAR(10),
        encoding_quiz_attempts      INT DEFAULT 1,
        reminder_played_at          DOUBLE,
        reminder_text               TEXT,
        reminder_activity_context   TEXT,
        trigger_fired_at            DOUBLE,
        trigger_clicked_at          DOUBLE,
        trigger_response_time_ms    INT,
        mcq_option_selected         INT,
        mcq_response_time_ms        INT,
        pm_score                    INT NOT NULL DEFAULT 0,
        pm_error_type               VARCHAR(30),
        ongoing_task_accuracy_retention DOUBLE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS ongoing_responses (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        session_id      VARCHAR(36) NOT NULL,
        block_number    INT NOT NULL,
        game_type       VARCHAR(50) NOT NULL,
        game_skin       VARCHAR(50) NOT NULL,
        item_id         INT,
        response        TEXT,
        correct         INT,
        response_time_ms INT,
        ts              DOUBLE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS questionnaire_logs (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        session_id      VARCHAR(36) NOT NULL,
        block_number    VARCHAR(20),
        intrusiveness   INT,
        helpfulness     INT,
        comment         TEXT,
        ts              DOUBLE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS session_questionnaires (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        session_id      VARCHAR(36) NOT NULL,
        mse_pre         DOUBLE,
        mse_post        DOUBLE,
        strategy_use    INT,
        open_feedback   TEXT,
        ts              DOUBLE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS action_logs (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        session_id      VARCHAR(36) NOT NULL,
        block_number    INT,
        action_type     VARCHAR(100) NOT NULL,
        payload         TEXT,
        ts              DOUBLE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS block_events (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        session_id   VARCHAR(36) NOT NULL,
        block_num    INT NOT NULL,
        event_type   VARCHAR(50) NOT NULL,
        scheduled_t  DOUBLE NOT NULL,
        actual_t     DOUBLE,
        is_fixed     INT NOT NULL DEFAULT 1,
        payload      TEXT NOT NULL,
        seed         INT NOT NULL,
        created_at   DOUBLE NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS session_events (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        session_id   VARCHAR(36) NOT NULL,
        event_type   VARCHAR(50) NOT NULL,
        from_phase   VARCHAR(30),
        to_phase     VARCHAR(30),
        block_idx    INT,
        payload      TEXT NOT NULL,
        ts           DOUBLE NOT NULL
    )
    """)

    db.commit()
    db.close()
    _db_initialized = True
