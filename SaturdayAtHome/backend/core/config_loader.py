"""Load and expose game_config.yaml as structured accessors."""

from __future__ import annotations

import copy
import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger("saturday.config_loader")

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "game_config.yaml"

_config: dict[str, Any] = {}


def load_config(path: Path | None = None) -> dict[str, Any]:
    """Read YAML config and cache it globally."""
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
    """Write config dict to YAML file and refresh cache."""
    global _config
    p = path or CONFIG_PATH
    with open(p, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    _config = data
    logger.info(f"Saved config to {p}")


def get_config() -> dict[str, Any]:
    if not _config:
        load_config()
    return _config


def get_game_config() -> dict[str, Any]:
    """Return config safe for participant-facing frontend."""
    cfg = copy.deepcopy(get_config())

    # Legacy stripping: remove explicit 'correct' fields if present.
    for task in cfg.get("pm_tasks", {}).values():
        if isinstance(task, dict):
            task.pop("correct", None)
    for msg in cfg.get("timeline", {}).get("messages", []):
        if isinstance(msg, dict):
            msg.pop("correct", None)

    # Normalize PM task choice presentation so frontend does not rely on
    # backend-only field names.
    for task in cfg.get("pm_tasks", {}).values():
        if not isinstance(task, dict):
            continue
        target = task.pop("target", None)
        distractor = task.pop("distractor", None)
        if target and distractor:
            task["options"] = [target, distractor]

    return cfg


# ── Convenience accessors ─────────────────────────────────────────────────────

def get_timeline_config() -> dict[str, Any]:
    return get_config().get("timeline", {})


def get_timeline_events() -> dict[str, Any]:
    return get_timeline_config().get("events", {})


def get_block_duration_s() -> float:
    duration = get_timeline_config().get("block_duration_s", 510)
    return float(duration)


def get_block_room_schedule(block_num: int) -> list[dict[str, Any]]:
    raw = get_timeline_config().get("block_room_schedule", {})
    slot = raw.get(block_num) if isinstance(raw, dict) else None
    if slot is None and isinstance(raw, dict):
        slot = raw.get(str(block_num))
    return list(slot or [])


def get_neutral_comments() -> list[str]:
    comments = get_timeline_config().get("neutral_comments", [])
    if not isinstance(comments, list):
        return []
    return [str(c) for c in comments]


def get_experiment() -> dict[str, Any]:
    return get_config().get("experiment", {})


def get_latin_square() -> dict[str, list[str]]:
    return get_experiment().get("latin_square", {})


def get_block_task_slots() -> dict[int, dict[str, str]]:
    exp = get_experiment()

    # v2.0 format
    raw = exp.get("block_task_slots", {})
    slots: dict[int, dict[str, str]] = {}
    for k, v in (raw or {}).items():
        try:
            block_n = int(k)
        except Exception:
            continue
        if isinstance(v, dict):
            a = v.get("A")
            b = v.get("B")
            if a and b:
                slots[block_n] = {"A": str(a), "B": str(b)}

    if slots:
        return slots

    # legacy format fallback: task_pairs: {1: [taskA, taskB], ...}
    legacy_pairs = exp.get("task_pairs", {})
    for k, v in (legacy_pairs or {}).items():
        try:
            block_n = int(k)
        except Exception:
            continue
        if isinstance(v, list) and len(v) >= 2:
            slots[block_n] = {"A": str(v[0]), "B": str(v[1])}
    return slots


def get_task_pairs() -> dict[int, list[str]]:
    """Compatibility accessor used by legacy callers/tests."""
    slots = get_block_task_slots()
    return {k: [v["A"], v["B"]] for k, v in slots.items()}


def get_block_task_pair(block_num: int) -> tuple[str, str]:
    slots = get_block_task_slots()
    pair = slots.get(block_num) or slots.get(int(block_num))
    if pair:
        return pair["A"], pair["B"]
    # Safe fallback for malformed configs
    return "medicine", "tea"


def get_condition_rules() -> dict[str, Any]:
    return get_experiment().get("condition_rules", {})


def get_execution_window_ms() -> int:
    value = get_experiment().get("execution_window_ms", 30000)
    try:
        return int(value)
    except Exception:
        return 30000


def get_reminder_texts() -> dict[str, Any]:
    """Legacy compatibility (v1.8 static reminders)."""
    return get_experiment().get("reminder_texts", {})


def get_pm_tasks() -> dict[str, Any]:
    return get_config().get("pm_tasks", {})


def get_pm_task(task_id: str) -> dict[str, Any] | None:
    task = get_pm_tasks().get(task_id)
    if isinstance(task, dict):
        return task
    return None


def get_rooms_config() -> dict[str, Any]:
    return get_config().get("rooms", {})


def get_room_label(room_id: str) -> str:
    room = get_rooms_config().get(room_id, {})
    return room.get("label", room_id)


def get_room_activity_template(room_id: str, activity_id: str) -> dict[str, Any]:
    room = get_rooms_config().get(room_id, {})
    templates = room.get("activity_templates", {}) if isinstance(room, dict) else {}
    tpl = templates.get(activity_id, {}) if isinstance(templates, dict) else {}
    return tpl if isinstance(tpl, dict) else {}


def get_audio_config() -> dict[str, Any]:
    return get_config().get("audio", {})


def get_correct_answer(task_id: str) -> dict[str, Any] | None:
    """Legacy compatibility helper (v1.8)."""
    task = get_pm_task(task_id) or {}
    value = task.get("correct")
    return value if isinstance(value, dict) else None


# ── Legacy compatibility accessors (v1.8 callers) ───────────────────────────

def get_difficulty(level: str | None = None) -> dict[str, Any]:
    diff = get_config().get("difficulty", {})
    if isinstance(diff, dict) and diff:
        if level and level in diff:
            return diff[level]
        default_level = diff.get("default", "medium")
        return diff.get(default_level, {}) if isinstance(default_level, str) else {}
    return {}


def get_scoring() -> dict[str, Any]:
    return get_config().get("scoring", {})


def get_timers() -> dict[str, Any]:
    return get_config().get("timers", {})


def get_steak_config() -> dict[str, Any]:
    return get_config().get("steak", {})


def get_laundry_config() -> dict[str, Any]:
    return get_config().get("laundry", {})
