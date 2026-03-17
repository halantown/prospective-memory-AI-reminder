"""Load and expose the game_config.yaml and data JSON files."""

import copy
import json
import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger("saturday.config_loader")

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "game_config.yaml"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_config: dict[str, Any] = {}
_pm_tasks: list[dict] | None = None
_neutral_comments: dict[str, list[str]] | None = None


# ── YAML config ────────────────────────────────────────────

def load_config(path: Path | None = None) -> dict[str, Any]:
    """Read the YAML config file and cache it globally."""
    global _config
    p = path or CONFIG_PATH
    if not p.exists():
        logger.warning(f"Config file not found at {p}, using empty config")
        _config = {}
        return _config
    with open(p, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f) or {}
    logger.info(f"Loaded config from {p} ({len(_config)} top-level keys)")
    return _config


def save_config(data: dict[str, Any], path: Path | None = None) -> None:
    """Write config dict back to the YAML file."""
    global _config
    p = path or CONFIG_PATH
    with open(p, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    _config = data
    logger.info(f"Saved config to {p}")


def get_config() -> dict[str, Any]:
    """Return the current config dict."""
    if not _config:
        load_config()
    return _config


def get_game_config() -> dict[str, Any]:
    """Return config stripped of sensitive data (correct answers) for the frontend."""
    cfg = copy.deepcopy(get_config())
    # Strip PM correct answers from any inline pm_tasks (legacy)
    for task_id, task in cfg.get("pm_tasks", {}).items():
        task.pop("correct", None)
    return cfg


# ── PM task data from JSON ─────────────────────────────────

def load_pm_tasks() -> list[dict]:
    """Load all PM tasks from data/pm_tasks.json."""
    global _pm_tasks
    if _pm_tasks is not None:
        return _pm_tasks
    p = DATA_DIR / "pm_tasks.json"
    if not p.exists():
        logger.warning(f"pm_tasks.json not found at {p}")
        _pm_tasks = []
        return _pm_tasks
    with open(p, "r", encoding="utf-8") as f:
        _pm_tasks = json.load(f)
    logger.info(f"Loaded {len(_pm_tasks)} PM tasks from {p}")
    return _pm_tasks


def get_pm_task(task_id: str) -> dict | None:
    """Get a single PM task by task_id."""
    tasks = load_pm_tasks()
    for t in tasks:
        if t["task_id"] == task_id:
            return t
    return None


def get_block_pm_tasks(block_num: int) -> list[dict]:
    """Get the two PM tasks for a specific block number (1-4)."""
    tasks = load_pm_tasks()
    return [t for t in tasks if t.get("block") == block_num]


# ── Neutral comments ───────────────────────────────────────

def load_neutral_comments() -> dict[str, list[str]]:
    """Load neutral comments from data/neutral_comments.json."""
    global _neutral_comments
    if _neutral_comments is not None:
        return _neutral_comments
    p = DATA_DIR / "neutral_comments.json"
    if not p.exists():
        logger.warning(f"neutral_comments.json not found at {p}")
        _neutral_comments = {}
        return _neutral_comments
    with open(p, "r", encoding="utf-8") as f:
        _neutral_comments = json.load(f)
    return _neutral_comments


def get_neutral_comments(skin: str) -> list[str]:
    """Get neutral comments for a specific game skin."""
    comments = load_neutral_comments()
    return comments.get(skin, ["Nice day today.", "Keep it up!"])


# ── Game items ─────────────────────────────────────────────

def load_game_items(skin: str) -> list[dict] | None:
    """Load game items from data/game_items/{skin}.json.

    The JSON files are wrapper objects with metadata + an 'items' (or 'questions')
    array. This returns just the item list.
    """
    p = DATA_DIR / "game_items" / f"{skin}.json"
    if not p.exists():
        logger.warning(f"Game items not found at {p}")
        return None
    with open(p, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if isinstance(raw, list):
        return raw
    # Unwrap: prefer 'items', then 'questions', then the whole dict
    return raw.get("items", raw.get("questions", []))


# ── Block skin and room helpers ────────────────────────────

def get_block_skins(block_num: int) -> dict:
    """Get skin assignments for a block: {game_a: ..., game_b: ..., game_c: ...}."""
    cfg = get_config()
    skins = cfg.get("block_skins", {})
    return skins.get(block_num, skins.get(str(block_num), {}))


def get_room_label(skin: str) -> dict:
    """Get room label (room, time, activity) for a skin."""
    cfg = get_config()
    labels = cfg.get("room_labels", {})
    return labels.get(skin, {"room": "home", "time": "", "activity": skin})


# ── Convenience accessors ──────────────────────────────────

def get_timeline_config() -> dict:
    return get_config().get("timeline", {})


def get_experiment() -> dict:
    return get_config().get("experiment", {})


def get_audio_config() -> dict:
    return get_config().get("audio", {})


def get_latin_square() -> dict:
    return get_experiment().get("latin_square", {})


def get_game_rates() -> dict:
    return get_config().get("game_rates", {})
