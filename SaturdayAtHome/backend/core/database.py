import sqlite3
from pathlib import Path


def get_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _safe_exec(db: sqlite3.Connection, sql: str):
    try:
        db.execute(sql)
        db.commit()
    except Exception:
        pass


def init_db(db_path: Path):
    db = get_db(db_path)

    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id           TEXT PRIMARY KEY,
            participant_id       TEXT NOT NULL,
            latin_square_group   TEXT NOT NULL,
            condition_order      TEXT NOT NULL,
            phase                TEXT NOT NULL DEFAULT 'created',
            difficulty           TEXT DEFAULT 'medium',
            created_at           REAL NOT NULL,
            completed_at         REAL,
            experimenter_notes   TEXT,
            token                TEXT UNIQUE,
            current_block        INTEGER DEFAULT -1,
            is_interrupted       BOOLEAN DEFAULT 0,
            last_heartbeat       REAL,
            timer_started_at     REAL,
            timer_running_since  REAL,
            timer_elapsed_s      REAL DEFAULT 0,
            is_online            BOOLEAN DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS encoding_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      TEXT NOT NULL REFERENCES sessions(session_id),
            block_number    INTEGER NOT NULL,
            quiz_attempts   INTEGER NOT NULL DEFAULT 1,
            confirmed_at    REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pm_trials (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id          TEXT,
            session_id              TEXT NOT NULL REFERENCES sessions(session_id),
            block_number            INTEGER NOT NULL,
            task_slot               TEXT,
            task_id                 TEXT NOT NULL,
            condition               TEXT,
            participant_group       TEXT,
            encoding_confirmed_at   REAL,
            encoding_quiz_attempts  INTEGER DEFAULT 0,
            reminder_played_at      REAL,
            reminder_text           TEXT,
            reminder_source         TEXT,
            reminder_room           TEXT,
            reminder_activity       TEXT,
            trigger_appeared_at     REAL,
            first_pm_interaction_at REAL,
            pm_action_taken         TEXT,
            pm_score                INTEGER NOT NULL DEFAULT 0,
            pm_error_type           TEXT,
            acted_at                REAL,
            UNIQUE(session_id, block_number, task_slot)
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
            id                        INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id                TEXT NOT NULL REFERENCES sessions(session_id),
            block_number              INTEGER,
            perceived_intrusiveness   INTEGER,
            perceived_helpfulness     INTEGER,
            ongoing_interaction_count INTEGER DEFAULT 0,
            open_comment              TEXT,
            ts                        REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS session_questionnaires (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id         TEXT NOT NULL REFERENCES sessions(session_id),
            mse_pre            REAL,
            mse_post           REAL,
            strategy_use       INTEGER,
            open_feedback      TEXT,
            completion_flag    BOOLEAN DEFAULT 0,
            session_date       TEXT,
            ts                 REAL NOT NULL
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
            activity        TEXT,
            client_ts       REAL,
            server_ts       REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reminder_cache (
            task_id         TEXT NOT NULL,
            condition       TEXT NOT NULL,
            room            TEXT NOT NULL,
            activity        TEXT NOT NULL,
            text            TEXT NOT NULL,
            preamble        TEXT,
            full_text       TEXT NOT NULL,
            created_at      REAL NOT NULL,
            PRIMARY KEY (task_id, condition, room, activity)
        );

        CREATE TABLE IF NOT EXISTS block_events (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id   TEXT    NOT NULL REFERENCES sessions(session_id),
            block_num    INTEGER NOT NULL,
            event_type   TEXT    NOT NULL,
            scheduled_t  REAL    NOT NULL,
            actual_t     REAL,
            is_fixed     INTEGER NOT NULL DEFAULT 1,
            payload      TEXT    NOT NULL DEFAULT '{}',
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
        """
    )

    db.commit()

    # Backward-compatible migrations for existing local DBs.
    for col_sql in [
        "ALTER TABLE sessions ADD COLUMN token TEXT UNIQUE",
        "ALTER TABLE sessions ADD COLUMN current_block INTEGER DEFAULT -1",
        "ALTER TABLE sessions ADD COLUMN is_interrupted BOOLEAN DEFAULT 0",
        "ALTER TABLE sessions ADD COLUMN last_heartbeat REAL",
        "ALTER TABLE sessions ADD COLUMN timer_started_at REAL",
        "ALTER TABLE sessions ADD COLUMN timer_running_since REAL",
        "ALTER TABLE sessions ADD COLUMN timer_elapsed_s REAL DEFAULT 0",
        "ALTER TABLE sessions ADD COLUMN is_online BOOLEAN DEFAULT 0",

        "ALTER TABLE pm_trials ADD COLUMN participant_id TEXT",
        "ALTER TABLE pm_trials ADD COLUMN task_slot TEXT",
        "ALTER TABLE pm_trials ADD COLUMN participant_group TEXT",
        "ALTER TABLE pm_trials ADD COLUMN encoding_confirmed_at REAL",
        "ALTER TABLE pm_trials ADD COLUMN encoding_quiz_attempts INTEGER DEFAULT 0",
        "ALTER TABLE pm_trials ADD COLUMN reminder_text TEXT",
        "ALTER TABLE pm_trials ADD COLUMN reminder_source TEXT",
        "ALTER TABLE pm_trials ADD COLUMN reminder_room TEXT",
        "ALTER TABLE pm_trials ADD COLUMN reminder_activity TEXT",
        "ALTER TABLE pm_trials ADD COLUMN trigger_appeared_at REAL",
        "ALTER TABLE pm_trials ADD COLUMN first_pm_interaction_at REAL",
        "ALTER TABLE pm_trials ADD COLUMN pm_action_taken TEXT",
        "ALTER TABLE pm_trials ADD COLUMN pm_error_type TEXT",

        "ALTER TABLE questionnaire_logs ADD COLUMN perceived_intrusiveness INTEGER",
        "ALTER TABLE questionnaire_logs ADD COLUMN perceived_helpfulness INTEGER",
        "ALTER TABLE questionnaire_logs ADD COLUMN ongoing_interaction_count INTEGER DEFAULT 0",
        "ALTER TABLE questionnaire_logs ADD COLUMN open_comment TEXT",

        "ALTER TABLE reminder_room_logs ADD COLUMN activity TEXT",

        "ALTER TABLE session_questionnaires ADD COLUMN completion_flag BOOLEAN DEFAULT 0",
        "ALTER TABLE session_questionnaires ADD COLUMN session_date TEXT",
    ]:
        _safe_exec(db, col_sql)

    _safe_exec(
        db,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_trials_slot ON pm_trials(session_id, block_number, task_slot)",
    )

    db.close()
