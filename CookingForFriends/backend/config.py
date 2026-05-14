"""Application configuration."""

import os
import sys
from pathlib import Path


def _cli_value(flag: str) -> str | None:
    """Return a simple CLI flag value from `--flag value` or `--flag=value`."""
    prefix = f"{flag}="
    for index, arg in enumerate(sys.argv[1:], start=1):
        if arg == flag and index + 1 < len(sys.argv):
            return sys.argv[index + 1]
        if arg.startswith(prefix):
            return arg[len(prefix):]
    return None


def _load_env_file(path: Path) -> None:
    """Load KEY=VALUE lines into os.environ without overriding real env vars."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _bootstrap_environment(project_dir: Path) -> tuple[str, Path | None]:
    """Load the environment-specific config file before constants are read.

    Selection order:
    1. `--env-file path` or `ENV_FILE`
    2. `--env name` or `ENVIRONMENT`, loading `.env.<name>`
    3. legacy `.env` fallback for non-production environments

    Example files are templates only; they are never loaded as runtime config.
    A legacy `.env` file is used only when the selected environment file does
    not exist. Real environment variables keep highest priority.
    """
    cli_env = _cli_value("--env")
    cli_env_file = _cli_value("--env-file")

    selected_env = (cli_env or os.getenv("ENVIRONMENT") or "development").strip().lower()
    if cli_env:
        os.environ["ENVIRONMENT"] = selected_env

    env_file_value = cli_env_file or os.getenv("ENV_FILE")
    selected_file = Path(env_file_value).expanduser() if env_file_value else project_dir / f".env.{selected_env}"
    if not selected_file.is_absolute():
        selected_file = project_dir / selected_file

    loaded_file: Path | None = None
    if selected_file.exists():
        _load_env_file(selected_file)
        loaded_file = selected_file
    else:
        legacy_file = project_dir / ".env"
        if selected_env != "production" and legacy_file.exists():
            _load_env_file(legacy_file)
            loaded_file = legacy_file

    if cli_env:
        os.environ["ENVIRONMENT"] = selected_env
    return selected_env, loaded_file


# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
REQUESTED_ENVIRONMENT, LOADED_ENV_FILE = _bootstrap_environment(PROJECT_DIR)

from data.materials import (
    get_conditions,
    get_session_end_delay_after_last_trigger_s,
    get_task_orders,
    get_trigger_schedule,
)

DATA_DIR = Path(os.getenv("DATA_DIR") or str(BASE_DIR / "data"))

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
if ENVIRONMENT not in {"development", "test", "production"}:
    raise RuntimeError("ENVIRONMENT must be one of: development, test, production.")
IS_PRODUCTION = ENVIRONMENT == "production"
IS_RELAXED_ENV = ENVIRONMENT in {"development", "test"}

# Database — PostgreSQL via asyncpg
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://cff:cff_dev_pass@localhost:5432/cooking_for_friends",
)

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5000"))

# CORS — restrict in production
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]

# Admin API key — required for admin endpoints
ADMIN_API_KEY: str | None = os.getenv("ADMIN_API_KEY") or None

# Session tokens
TOKEN_LENGTH = 6
TOKEN_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No 0/O/1/I ambiguity

# Experiment — EE1/EE0 encoding-context design
# Condition levels
CONDITIONS = get_conditions()

# Task orders — fixed Latin square (4 orders × 4 tasks, balanced)
TASK_ORDERS: dict[str, list[str]] = get_task_orders()

# Event-driven trigger schedule (delays measured in game time seconds)
# "real" entries: task_position is the index (1-based) into the participant's task_order
# "fake" entries: trigger_type is the UI affordance ("doorbell" | "phone_call")
TRIGGER_SCHEDULE: list[dict] = get_trigger_schedule()

# Seconds of game time after last real trigger pipeline completes before post-test
SESSION_END_DELAY_AFTER_LAST_TRIGGER_S = get_session_end_delay_after_last_trigger_s()

# PM scoring window constants
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

if IS_PRODUCTION:
    placeholder_vars = []
    for key in ("DATABASE_URL", "POSTGRES_PASSWORD", "CORS_ORIGINS", "ADMIN_API_KEY"):
        value = os.getenv(key, "")
        if "<" in value or ">" in value or "replace-with" in value:
            placeholder_vars.append(key)
    if placeholder_vars:
        raise RuntimeError(
            "Production config contains placeholder values: "
            + ", ".join(sorted(placeholder_vars))
            + ". Replace them in .env.production before startup."
        )

if IS_PRODUCTION and ADMIN_API_KEY is None:
    raise RuntimeError(
        "ADMIN_API_KEY must be set in production! "
        "Set the ADMIN_API_KEY environment variable."
    )

if IS_PRODUCTION and "*" in CORS_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS must not include '*' in production! "
        "Set explicit frontend/admin origins."
    )
