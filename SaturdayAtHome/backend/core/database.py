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
        phase            TEXT NOT NULL DEFAULT 'created',
        difficulty       TEXT DEFAULT 'medium',
        created_at       REAL NOT NULL,
        completed_at     REAL,
        experimenter_notes TEXT,
        token            TEXT UNIQUE,
        current_block    INTEGER DEFAULT -1,
        is_interrupted   BOOLEAN DEFAULT 0,
        last_heartbeat   REAL,
        timer_started_at REAL,
        timer_running_since REAL,
        timer_elapsed_s  REAL DEFAULT 0,
        is_online        BOOLEAN DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS action_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER,
        action_type     TEXT NOT NULL,
        payload         TEXT,
        ts              REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_room_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER NOT NULL,
        slot            TEXT NOT NULL,
        room            TEXT NOT NULL,
        client_ts       REAL,
        server_ts       REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS block_events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id   TEXT    NOT NULL REFERENCES sessions(session_id),
        block_num    INTEGER NOT NULL,
        event_type   TEXT    NOT NULL,
        scheduled_t  REAL    NOT NULL,   -- seconds relative to block start (planned)
        actual_t     REAL,               -- seconds relative to block start (actual fire time)
        is_fixed     INTEGER NOT NULL DEFAULT 1,
        payload      TEXT    NOT NULL DEFAULT '{}',  -- JSON
        seed         INTEGER NOT NULL,
        created_at   REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id   TEXT NOT NULL,
        event_type   TEXT NOT NULL,
        from_phase   TEXT,
        to_phase     TEXT,
        block_idx    INTEGER,
        payload      TEXT NOT NULL DEFAULT '{}',
        ts           REAL NOT NULL
    );
    """)

    db.commit()

    # Migrate existing DBs — add columns that may not exist yet
    for col_sql in [
        "ALTER TABLE sessions ADD COLUMN token TEXT UNIQUE",
        "ALTER TABLE sessions ADD COLUMN current_block INTEGER DEFAULT -1",
        "ALTER TABLE sessions ADD COLUMN is_interrupted BOOLEAN DEFAULT 0",
        "ALTER TABLE sessions ADD COLUMN last_heartbeat REAL",
        "ALTER TABLE sessions ADD COLUMN timer_started_at REAL",
        "ALTER TABLE sessions ADD COLUMN timer_running_since REAL",
        "ALTER TABLE sessions ADD COLUMN timer_elapsed_s REAL DEFAULT 0",
        "ALTER TABLE sessions ADD COLUMN is_online BOOLEAN DEFAULT 0",
    ]:
        try:
            db.execute(col_sql)
            db.commit()
        except Exception:
            pass  # Column already exists

    db.close()
