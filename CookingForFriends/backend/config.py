"""Application configuration."""

import os
from pathlib import Path
from data.materials import (
    get_conditions,
    get_session_end_delay_after_last_trigger_s,
    get_task_orders,
    get_trigger_schedule,
)

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Database — PostgreSQL via asyncpg
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://cff:cff_dev_pass@localhost:5432/cooking_for_friends",
)

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5000"))

# CORS — restrict in production
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Admin API key — required for admin endpoints
ADMIN_API_KEY: str | None = os.getenv("ADMIN_API_KEY", None)

# Session tokens
TOKEN_LENGTH = 6
TOKEN_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No 0/O/1/I ambiguity

# Experiment — EC+/EC- encoding-context design
# Condition levels
CONDITIONS = get_conditions()

# Task orders — fixed Latin square (4 orders × 4 tasks, balanced)
TASK_ORDERS: dict[str, list[str]] = get_task_orders()

# Event-driven trigger schedule (delays measured in game time seconds)
# "real" entries: task_position is the index (1-based) into the participant's task_order
# "fake" entries: trigger_type is the UI affordance ("doorbell" | "phone_call")
TRIGGER_SCHEDULE: list[dict] = get_trigger_schedule()

# Seconds of game time after last real trigger pipeline completes before → post_questionnaire
SESSION_END_DELAY_AFTER_LAST_TRIGGER_S = get_session_end_delay_after_last_trigger_s()

# Legacy execution-window constants (kept for timeline.py backward-compat)
EXECUTION_WINDOW_S = 120   # Primary window: participant has 2 min to act
LATE_WINDOW_S = 60         # Extended window after EXECUTION_WINDOW_S
REMINDER_LEAD_S = 30       # How early before trigger to show reminder
BLOCK_DURATION_S = 900     # Single-block game duration (seconds)

# Seconds of wall-clock disconnect before session is flagged incomplete
MAX_DISCONNECT_DURATION_S = 300

# Phone
PHONE_LOCK_TIMEOUT_S = 15  # Must match frontend LOCK_TIMEOUT (15s)
MESSAGE_COOLDOWN_S = int(os.getenv("MESSAGE_COOLDOWN_S", "10"))  # Min gap between messages
PHONE_MESSAGE_EXPIRY_MS = 20_000  # Per-message expiry (20s), must match frontend constant

# Mouse tracking
MOUSE_SAMPLE_INTERVAL_MS = 100
MOUSE_BATCH_INTERVAL_S = 60

# Cooking system
COOKING_STEP_WINDOW_S = 30        # Default window for participant to act on a cooking step
COOKING_TOTAL_DURATION_S = 900    # 15-minute cooking session per block
COOKING_DISHES = ["roasted_vegetables", "tomato_soup", "spaghetti", "steak"]
COOKING_STATIONS = [
    "fridge", "cutting_board", "spice_rack",
    "burner1", "burner2", "burner3",
    "oven", "plating_area",
]

# Snapshot
SNAPSHOT_INTERVAL_S = 15

# Heartbeat
HEARTBEAT_INTERVAL_S = 30   # Frontend sends ping every 30s
HEARTBEAT_TIMEOUT_S = 60    # Backend marks offline after 60s with no ping

# Development seed — set DEV_TOKEN env var to enable dev participant.
# When set, a dev participant is auto-created/reset on every startup.
# Only allowed in development mode.
DEV_TOKEN: str | None = os.getenv("DEV_TOKEN", None)
if DEV_TOKEN and ENVIRONMENT == "production":
    raise RuntimeError(
        "DEV_TOKEN must not be set in production! "
        "Unset the DEV_TOKEN environment variable."
    )

if ENVIRONMENT == "production" and ADMIN_API_KEY is None:
    raise RuntimeError(
        "ADMIN_API_KEY must be set in production! "
        "Set the ADMIN_API_KEY environment variable."
    )
