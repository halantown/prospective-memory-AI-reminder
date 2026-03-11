"""Shared utility helpers."""

import json
import logging
import time

from config import DB_PATH
from database import get_db

logger = logging.getLogger("saturday.helpers")


def log_action(session_id: str, block_num: int, action_type: str, payload: dict = None):
    """Persist an action log entry to the database."""
    try:
        db = get_db(DB_PATH)
        db.execute(
            "INSERT INTO action_logs (session_id, block_number, action_type, payload, ts) VALUES (?, ?, ?, ?, ?)",
            (session_id, block_num, action_type, json.dumps(payload) if payload else None, time.time()),
        )
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to log action: {e}")
