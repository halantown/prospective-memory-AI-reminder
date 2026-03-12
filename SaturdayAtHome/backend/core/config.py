"""Experiment configuration — thin wrapper around config_loader.

All actual values live in game_config.yaml.  Import from here for
backwards-compatibility; the loader reads the YAML at startup.
"""

from pathlib import Path
from core.config_loader import (
    get_config, get_difficulty, get_latin_square,
    get_task_pairs, get_reminder_texts,
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

_session_counter = 0


def assign_group() -> str:
    """Assign a Latin Square group in round-robin fashion."""
    global _session_counter
    ls = get_latin_square()
    groups = list(ls.keys())
    group = groups[_session_counter % len(groups)]
    _session_counter += 1
    return group
