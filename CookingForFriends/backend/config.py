"""Application configuration."""

import os
from pathlib import Path

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

# Experiment
PM_TASKS_PER_BLOCK = 4
CONDITIONS = ["CONTROL", "AF", "AFCB"]
BLOCK_DURATION_S = 900  # 15 minutes (matches COOKING_TOTAL_DURATION_S)
EXECUTION_WINDOW_S = 30
LATE_WINDOW_S = 60
REMINDER_LEAD_S = 120  # Reminder fires ~120s before trigger

# Phone
PHONE_LOCK_TIMEOUT_S = 15  # Must match frontend LOCK_TIMEOUT (15s)
MESSAGE_COOLDOWN_S = int(os.getenv("MESSAGE_COOLDOWN_S", "10"))  # Min gap between messages
PHONE_MESSAGE_EXPIRY_MS = 20_000  # Per-message expiry (20s), must match frontend constant

# Mouse tracking
MOUSE_SAMPLE_INTERVAL_MS = 200
MOUSE_BATCH_INTERVAL_S = 5

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
HEARTBEAT_INTERVAL_S = 10
HEARTBEAT_TIMEOUT_S = 30

# Development seed — set DEV_TOKEN env var to enable dev participant.
# When set, a dev participant is auto-created/reset on every startup.
# Only allowed in development mode.
DEV_TOKEN: str | None = os.getenv("DEV_TOKEN", None)
if DEV_TOKEN and ENVIRONMENT == "production":
    raise RuntimeError(
        "DEV_TOKEN must not be set in production! "
        "Unset the DEV_TOKEN environment variable."
    )
