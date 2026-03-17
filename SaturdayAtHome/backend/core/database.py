import sqlite3
from pathlib import Path

_db_initialized = False


def _raw_connect(db_path: Path) -> sqlite3.Connection:
    """Open a raw SQLite connection with standard pragmas."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_db(db_path: Path) -> sqlite3.Connection:
    global _db_initialized
    conn = _raw_connect(db_path)
    # Auto-initialize if tables are missing (e.g. DB file deleted while running)
    if not _db_initialized:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
        ).fetchone()
        if not tables:
            conn.close()
            init_db(db_path)
            conn = _raw_connect(db_path)
        _db_initialized = True
    return conn


def init_db(db_path: Path):
    global _db_initialized
    db = _raw_connect(db_path)

    db.executescript("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id       TEXT PRIMARY KEY,
        participant_id   TEXT NOT NULL,
        latin_square_group TEXT NOT NULL,
        condition_order  TEXT NOT NULL,   -- JSON array of 4 condition strings
        phase            TEXT NOT NULL DEFAULT 'created',
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
        task_id         TEXT,
        quiz_attempts   INTEGER NOT NULL DEFAULT 1,
        confirmed_at    REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pm_trials (
        id                          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id                  TEXT NOT NULL REFERENCES sessions(session_id),
        block_number                INTEGER NOT NULL,
        task_slot                   TEXT NOT NULL,  -- A or B
        task_id                     TEXT NOT NULL,
        condition                   TEXT NOT NULL,
        participant_group           TEXT,
        encoding_quiz_attempts      INTEGER DEFAULT 1,
        reminder_played_at          REAL,
        reminder_text               TEXT,
        reminder_activity_context   TEXT,
        trigger_fired_at            REAL,
        trigger_clicked_at          REAL,
        trigger_response_time_ms    INTEGER,
        mcq_option_selected         INTEGER,  -- 0, 1, 2 or NULL
        mcq_response_time_ms        INTEGER,
        pm_score                    INTEGER NOT NULL DEFAULT 0,
        pm_error_type               TEXT,  -- null, prospective_failure, retrospective_failure
        ongoing_task_accuracy_retention REAL
    );

    CREATE TABLE IF NOT EXISTS ongoing_responses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(session_id),
        block_number    INTEGER NOT NULL,
        game_type       TEXT NOT NULL,
        game_skin       TEXT NOT NULL,
        item_id         INTEGER,
        response        TEXT,
        correct         INTEGER,
        response_time_ms INTEGER,
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
    db.close()
    _db_initialized = True
