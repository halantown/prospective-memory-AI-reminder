"""Application configuration."""

from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = BASE_DIR / "experiment.db"

# Server
HOST = "0.0.0.0"
PORT = 5000

# Session tokens
TOKEN_LENGTH = 6
TOKEN_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No 0/O/1/I ambiguity

# Experiment
BLOCKS_PER_PARTICIPANT = 3
PM_TASKS_PER_BLOCK = 4
BLOCK_DURATION_S = 600  # 10 minutes
EXECUTION_WINDOW_S = 30
LATE_WINDOW_S = 60
REMINDER_LEAD_S = 120  # Reminder fires ~120s before trigger

# Phone
PHONE_LOCK_TIMEOUT_S = 30

# Mouse tracking
MOUSE_SAMPLE_INTERVAL_MS = 200
MOUSE_BATCH_INTERVAL_S = 5

# Snapshot
SNAPSHOT_INTERVAL_S = 15

# Heartbeat
HEARTBEAT_INTERVAL_S = 10
HEARTBEAT_TIMEOUT_S = 30

# Latin Square — 3 conditions, 6 possible orderings (3×3 Latin Square)
LATIN_SQUARE = {
    "A": ["CONTROL", "AF", "AFCB"],
    "B": ["AF", "AFCB", "CONTROL"],
    "C": ["AFCB", "CONTROL", "AF"],
    "D": ["CONTROL", "AFCB", "AF"],
    "E": ["AF", "CONTROL", "AFCB"],
    "F": ["AFCB", "AF", "CONTROL"],
}
GROUPS = list(LATIN_SQUARE.keys())
