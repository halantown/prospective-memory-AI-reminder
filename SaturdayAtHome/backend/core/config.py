"""Experiment configuration — thin wrapper around config_loader.

All actual values live in game_config.yaml.  Import from here for
backwards-compatibility; the loader reads the YAML at startup.
"""

from pathlib import Path
from core.config_loader import (
    get_config, get_difficulty, get_latin_square,
    get_task_pairs, get_reminder_texts,
    get_steak_config, get_laundry_config,
)

DB_PATH = Path(__file__).parent / "experiment.db"


# ── Convenience properties (read from YAML) ───────────────

def DIFFICULTY_CONFIG():
    cfg = get_config().get("difficulty", {})
    return {k: v for k, v in cfg.items() if k != "default"}


def LATIN_SQUARE():
    return get_latin_square()


def TASK_PAIRS():
    return get_task_pairs()


def REMINDER_TEXTS():
    return get_reminder_texts()


# ── Group assignment ───────────────────────────────────────

def assign_group() -> str:
    """Assign a Latin Square group in round-robin fashion.

    Uses the current session count from DB so assignment is stable across
    server restarts.  Called before INSERT, so count reflects completed sessions.
    """
    from core.database import get_db
    db = get_db(DB_PATH)
    count = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    db.close()
    ls = get_latin_square()
    groups = list(ls.keys())
    return groups[count % len(groups)]
