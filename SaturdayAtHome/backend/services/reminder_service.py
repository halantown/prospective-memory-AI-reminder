"""Condition-rule reminder generation with local cache.

The PRD asks for runtime context-aware reminder generation. This service uses
PRD rules (AF/CB gates + room/activity context) to build deterministic
reminders and caches each (task, condition, room, activity) variant.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from core.config import DB_PATH
from core.config_loader import get_condition_rules, get_pm_task
from core.database import get_db

logger = logging.getLogger("saturday.reminder")


def _limit_words(text: str, max_words: int) -> str:
    if not max_words or max_words <= 0:
        return text.strip()
    words = text.strip().split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]).rstrip(" ,;:-") + "."


def _activity_phrase(activity: str) -> str:
    activity = (activity or "current task").replace("_", " ").strip()
    return activity or "current task"


def _build_preamble(activity: str, max_words: int) -> str:
    phrase = _activity_phrase(activity)
    base = f"Quick pause from {phrase}"
    return _limit_words(base, max_words)


def _read_cache(task_id: str, condition: str, room: str, activity: str, db_path=DB_PATH) -> dict[str, Any] | None:
    db = get_db(db_path)
    try:
        row = db.execute(
            """SELECT text, preamble, full_text
               FROM reminder_cache
               WHERE task_id = ? AND condition = ? AND room = ? AND activity = ?""",
            (task_id, condition, room, activity),
        ).fetchone()
    except Exception:
        db.close()
        return None
    db.close()
    if not row:
        return None
    return {
        "text": row["text"],
        "preamble": row["preamble"] or "",
        "full_text": row["full_text"],
        "source": "cached",
    }


def _write_cache(task_id: str, condition: str, room: str, activity: str,
                 text: str, preamble: str, full_text: str, db_path=DB_PATH) -> None:
    db = get_db(db_path)
    try:
        db.execute(
            """INSERT INTO reminder_cache
               (task_id, condition, room, activity, text, preamble, full_text, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(task_id, condition, room, activity)
               DO UPDATE SET
                 text = excluded.text,
                 preamble = excluded.preamble,
                 full_text = excluded.full_text,
                 created_at = excluded.created_at""",
            (task_id, condition, room, activity, text, preamble, full_text, time.time()),
        )
        db.commit()
    except Exception:
        # Cache is best-effort; generation should continue even if cache table
        # is not initialized in this execution context.
        pass
    finally:
        db.close()


def generate_reminder(task_id: str, condition: str, room: str, activity: str,
                      db_path=DB_PATH) -> dict[str, Any]:
    """Generate (or fetch cached) reminder text for a PM slot."""
    cached = _read_cache(task_id, condition, room, activity, db_path=db_path)
    if cached:
        return cached

    task = get_pm_task(task_id)
    if not task:
        fallback = "Remember your planned task later today."
        logger.warning(f"Missing task config for task_id={task_id}, using fallback reminder")
        _write_cache(task_id, condition, room, activity, fallback, "", fallback, db_path=db_path)
        return {"text": fallback, "preamble": "", "full_text": fallback, "source": "live"}

    rules = get_condition_rules().get(condition, {})
    af_level = str(rules.get("af_level", "low")).lower()
    include_context_preamble = bool(rules.get("include_context_preamble", False))
    reminder_word_limit = int(rules.get("reminder_word_limit", 35) or 35)
    preamble_word_limit = int(rules.get("preamble_word_limit", 12) or 12)

    if af_level == "high":
        reminder_text = str(task.get("high_af_text") or task.get("low_af_text") or "")
    else:
        reminder_text = str(task.get("low_af_text") or task.get("high_af_text") or "")

    reminder_text = _limit_words(reminder_text, reminder_word_limit)

    preamble = ""
    if include_context_preamble:
        preamble = _build_preamble(activity, preamble_word_limit)

    full_text = f"{preamble} — {reminder_text}" if preamble else reminder_text

    _write_cache(task_id, condition, room, activity, reminder_text, preamble, full_text, db_path=db_path)

    return {
        "text": reminder_text,
        "preamble": preamble,
        "full_text": full_text,
        "source": "live",
    }
