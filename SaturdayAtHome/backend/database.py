import sqlite3
from pathlib import Path


def get_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: Path):
    db = get_db(db_path)

    db.executescript("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id       TEXT PRIMARY KEY,
        participant_id   TEXT NOT NULL,
        latin_square_group TEXT NOT NULL,
        condition_order  TEXT NOT NULL,   -- JSON array of 4 condition strings
        phase            TEXT NOT NULL DEFAULT 'welcome',
        difficulty       TEXT DEFAULT 'medium',
        created_at       REAL NOT NULL,
        completed_at     REAL,
        experimenter_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS encoding_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER NOT NULL,
        quiz_attempts   INTEGER NOT NULL DEFAULT 1,
        confirmed_at    REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pm_trials (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER NOT NULL,
        task_id         TEXT NOT NULL,
        condition       TEXT,
        action          TEXT,
        selected_target TEXT,
        selected_detail TEXT,
        pm_score        INTEGER NOT NULL DEFAULT 0,  -- 0=miss, 1=wrong, 2=correct
        reminder_played_at REAL,
        target_appeared_at REAL,
        acted_at        REAL,
        ongoing_score_baseline REAL,
        ongoing_score_window   REAL,
        attention_flag  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ongoing_snapshots (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER NOT NULL,
        ts              REAL NOT NULL,
        delta           INTEGER NOT NULL,
        cumulative      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fake_trigger_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER NOT NULL,
        trigger_type    TEXT NOT NULL,
        response        TEXT,
        false_alarm     INTEGER DEFAULT 0,
        ts              REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questionnaire_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER,
        intrusiveness   INTEGER,  -- 1-7
        helpfulness     INTEGER,  -- 1-7
        comment         TEXT,
        ts              REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_questionnaires (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        mse_pre         REAL,
        mse_post        REAL,
        strategy_use    INTEGER,  -- 1-5
        open_feedback   TEXT,
        ts              REAL NOT NULL
    );
    """)

    db.commit()
    db.close()
