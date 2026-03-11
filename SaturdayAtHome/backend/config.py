"""Experiment configuration constants."""

from pathlib import Path

DB_PATH = Path(__file__).parent / "experiment.db"

# ── Difficulty presets ─────────────────────────────────────

DIFFICULTY_CONFIG = {
    "slow":   {"cooking_ms": 20000, "ready_ms": 5000, "max_steaks": 2},
    "medium": {"cooking_ms": 13000, "ready_ms": 4000, "max_steaks": 3},
    "fast":   {"cooking_ms": 9000,  "ready_ms": 3000, "max_steaks": 3},
}


# ── Latin Square counterbalancing ──────────────────────────

LATIN_SQUARE = {
    "A": ["LowAF_LowCB", "HighAF_LowCB", "LowAF_HighCB", "HighAF_HighCB"],
    "B": ["HighAF_LowCB", "LowAF_HighCB", "HighAF_HighCB", "LowAF_LowCB"],
    "C": ["LowAF_HighCB", "HighAF_HighCB", "LowAF_LowCB", "HighAF_LowCB"],
    "D": ["HighAF_HighCB", "LowAF_LowCB", "HighAF_LowCB", "LowAF_HighCB"],
}

TASK_PAIRS = {
    1: ("medicine_a", "medicine_b"),
    2: ("laundry_c", "laundry_d"),
    3: ("comm_e", "comm_f"),
    4: ("chores_g", "chores_h"),
}


# ── Reminder texts by condition ────────────────────────────

REMINDER_TEXTS = {
    "LowAF_LowCB":  "By the way, remember — after dinner today, take your medicine.",
    "HighAF_LowCB":  "By the way, remember — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
    "LowAF_HighCB":  "I can see you're keeping an eye on the stove. By the way — after dinner today, remember to take your medicine.",
    "HighAF_HighCB": "I can see you're keeping an eye on the stove. By the way — after dinner today, take your Doxycycline from the red round bottle, the one your cardiologist prescribed.",
}


# ── Group assignment ───────────────────────────────────────

_session_counter = 0


def assign_group() -> str:
    """Assign a Latin Square group in round-robin fashion."""
    global _session_counter
    groups = list(LATIN_SQUARE.keys())
    group = groups[_session_counter % len(groups)]
    _session_counter += 1
    return group
