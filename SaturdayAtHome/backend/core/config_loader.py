"""Load and expose the game_config.yaml as a global dict."""

import copy
import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger("saturday.config_loader")

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "game_config.yaml"

_config: dict[str, Any] = {}


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
    """Return the current config dict (read-only copy)."""
    if not _config:
        load_config()
    return _config


def get_game_config() -> dict[str, Any]:
    """Return config stripped of sensitive data (correct answers) for the frontend."""
    cfg = copy.deepcopy(get_config())
    # Strip correct answers from pm_tasks
    for task_id, task in cfg.get("pm_tasks", {}).items():
        task.pop("correct", None)
    # Strip correct answers from messages
    for msg in cfg.get("timeline", {}).get("messages", []):
        msg.pop("correct", None)
    return cfg


# ── Convenience accessors ─────────────────────────────────────────

def get_difficulty(level: str | None = None) -> dict:
    cfg = get_config()
    # Legacy support: if old-format difficulty exists, use it
    diff = cfg.get("difficulty", {})
    if diff:
        level = level or diff.get("default", "medium")
        return diff.get(level, diff.get("medium", {"cooking_ms": 13000, "ready_ms": 4000}))
    # New format: read from steak config
    steak = cfg.get("steak", {})
    return {
        "cooking_ms": steak.get("hob_base_cooking_ms", [11000, 13000, 15000])[1],
        "ready_ms": steak.get("ready_ms", 4000),
    }


def get_scoring() -> dict:
    return get_config().get("scoring", {})


def get_timers() -> dict:
    return get_config().get("timers", {})


def get_timeline_config() -> dict:
    return get_config().get("timeline", {})


def get_experiment() -> dict:
    return get_config().get("experiment", {})


def get_pm_tasks() -> dict:
    return get_config().get("pm_tasks", {})


def get_audio_config() -> dict:
    return get_config().get("audio", {})


def get_steak_config() -> dict:
    return get_config().get("steak", {})


def get_laundry_config() -> dict:
    return get_config().get("laundry", {})


def get_latin_square() -> dict:
    return get_experiment().get("latin_square", {})


def get_task_pairs() -> dict:
    raw = get_experiment().get("task_pairs", {})
    # YAML keys may be int or str — normalize to int keys
    return {int(k): v for k, v in raw.items()}


def get_reminder_texts() -> dict:
    return get_experiment().get("reminder_texts", {})


def get_correct_answer(task_id: str) -> dict | None:
    tasks = get_pm_tasks()
    task = tasks.get(task_id, {})
    return task.get("correct")
