"""Experiment configuration — thin wrapper around config_loader.

All actual values live in game_config.yaml.  Import from here for
backwards-compatibility; the loader reads the YAML at startup.
"""

from pathlib import Path
from core.config_loader import get_config, get_latin_square

DB_PATH = Path(__file__).parent / "experiment.db"


# ── Group assignment ───────────────────────────────────────

def assign_group() -> str:
    """Assign a Latin Square group in round-robin fashion.

    Uses the current session count from DB so assignment is stable across
    server restarts.
    """
    from core.database import get_db
    db = get_db(DB_PATH)
    count = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    db.close()
    ls = get_latin_square()
    groups = list(ls.keys())
    return groups[count % len(groups)]
