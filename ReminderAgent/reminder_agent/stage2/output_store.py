"""SQLite storage for generated reminder texts and generation logs."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


DB_PATH = Path(__file__).resolve().parent.parent / "output" / "reminders.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    variant_idx INTEGER NOT NULL,
    text TEXT NOT NULL,
    passed_quality_gate BOOLEAN,
    quality_gate_failures TEXT,
    review_status TEXT DEFAULT 'pending',
    reviewer_notes TEXT,
    model_used TEXT,
    generation_attempt INTEGER,
    generated_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    UNIQUE(task_id, condition, variant_idx)
);

CREATE TABLE IF NOT EXISTS generation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    variant_idx INTEGER NOT NULL,
    attempt INTEGER NOT NULL,
    raw_output TEXT,
    quality_gate_passed BOOLEAN,
    quality_gate_details TEXT,
    model_used TEXT,
    prompt_system TEXT,
    prompt_user TEXT,
    created_at TIMESTAMP
);
"""


class OutputStore:
    """Manages SQLite persistence for reminder generation output and logs."""

    def __init__(self, db_path: Path = DB_PATH):
        """Initialize DB connection, create tables if not exist."""
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        """Execute the schema DDL to ensure both tables exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(SCHEMA)

    def write_reminder(
        self,
        task_id: str,
        condition: str,
        variant_idx: int,
        text: str,
        passed_qg: bool,
        qg_failures: Optional[list[str]],
        model_used: Optional[str],
        attempt: int,
    ) -> int:
        """Insert or replace a reminder. Returns the row id."""
        now = datetime.now(timezone.utc).isoformat()
        failures_json = json.dumps(qg_failures) if qg_failures else None
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """INSERT OR REPLACE INTO reminders
                   (task_id, condition, variant_idx, text, passed_quality_gate,
                    quality_gate_failures, model_used, generation_attempt, generated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    task_id,
                    condition,
                    variant_idx,
                    text,
                    passed_qg,
                    failures_json,
                    model_used,
                    attempt,
                    now,
                ),
            )
            return cursor.lastrowid

    def write_generation_log(
        self,
        task_id: str,
        condition: str,
        variant_idx: int,
        attempt: int,
        raw_output: str,
        qg_passed: bool,
        qg_details: str,
        model_used: str,
        prompt_system: str,
        prompt_user: str,
    ) -> int:
        """Insert a generation log entry. Returns the row id."""
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """INSERT INTO generation_log
                   (task_id, condition, variant_idx, attempt, raw_output,
                    quality_gate_passed, quality_gate_details, model_used,
                    prompt_system, prompt_user, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    task_id,
                    condition,
                    variant_idx,
                    attempt,
                    raw_output,
                    qg_passed,
                    qg_details,
                    model_used,
                    prompt_system,
                    prompt_user,
                    now,
                ),
            )
            return cursor.lastrowid

    def get_all_reminders(
        self,
        task_id: Optional[str] = None,
        condition: Optional[str] = None,
        review_status: Optional[str] = None,
    ) -> list[dict]:
        """Query reminders with optional filters. Returns list of dicts."""
        query = "SELECT * FROM reminders WHERE 1=1"
        params: list = []
        if task_id:
            query += " AND task_id = ?"
            params.append(task_id)
        if condition:
            query += " AND condition = ?"
            params.append(condition)
        if review_status:
            query += " AND review_status = ?"
            params.append(review_status)
        query += " ORDER BY task_id, condition, variant_idx"

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_pending_review(self) -> list[dict]:
        """Get all reminders with review_status='pending'."""
        return self.get_all_reminders(review_status="pending")

    def update_review_status(
        self, reminder_id: int, status: str, notes: Optional[str] = None
    ) -> None:
        """Update review status for a specific reminder."""
        now = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """UPDATE reminders SET review_status = ?, reviewer_notes = ?,
                   reviewed_at = ? WHERE id = ?""",
                (status, notes, now, reminder_id),
            )

    def get_approved_for_export(self) -> list[dict]:
        """Get all approved reminders formatted for game platform export."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """SELECT task_id, condition, variant_idx, text, model_used
                   FROM reminders WHERE review_status = 'approved'
                   ORDER BY task_id, condition, variant_idx"""
            ).fetchall()
            return [dict(row) for row in rows]

    def get_stats(self) -> dict:
        """Return generation statistics: total, by condition, by review status."""
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM reminders").fetchone()[0]

            by_condition = {}
            for row in conn.execute(
                "SELECT condition, COUNT(*) FROM reminders GROUP BY condition"
            ).fetchall():
                by_condition[row[0]] = row[1]

            by_review = {}
            for row in conn.execute(
                "SELECT review_status, COUNT(*) FROM reminders GROUP BY review_status"
            ).fetchall():
                by_review[row[0]] = row[1]

            log_total = conn.execute(
                "SELECT COUNT(*) FROM generation_log"
            ).fetchone()[0]

            return {
                "total_reminders": total,
                "by_condition": by_condition,
                "by_review_status": by_review,
                "total_generation_attempts": log_total,
            }

    def clear(self) -> None:
        """Drop and recreate all tables. For development use only."""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(
                "DROP TABLE IF EXISTS reminders; DROP TABLE IF EXISTS generation_log;"
            )
            conn.executescript(SCHEMA)
