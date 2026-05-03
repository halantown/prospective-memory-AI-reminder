"""Experiment material loader and phase-scoped presentation helpers."""

from __future__ import annotations

import copy
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


MATERIALS_DIR = Path(__file__).resolve().parent / "experiment_materials"

_ENCODING_VIDEO_RE = re.compile(r"^ENCODING_VIDEO_(\d+)$", re.IGNORECASE)
_MANIP_CHECK_RE = re.compile(r"^MANIP_CHECK_(\d+)$", re.IGNORECASE)
_ASSIGN_RE = re.compile(r"^ASSIGN_(\d+)$", re.IGNORECASE)


def _load_json(filename: str) -> dict[str, Any]:
    with (MATERIALS_DIR / filename).open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def get_counterbalancing() -> dict[str, Any]:
    return _load_json("counterbalancing.json")


@lru_cache(maxsize=1)
def get_static_text() -> dict[str, Any]:
    return _load_json("static_text.json")


@lru_cache(maxsize=1)
def get_questionnaires() -> dict[str, Any]:
    return _load_json("questionnaires.json")


@lru_cache(maxsize=1)
def get_pm_materials() -> dict[str, Any]:
    return _load_json("pm_tasks.json")


@lru_cache(maxsize=1)
def get_encoding_materials() -> dict[str, Any]:
    return _load_json("encoding_materials.json")


@lru_cache(maxsize=1)
def get_tutorial_materials() -> dict[str, Any]:
    return _load_json("tutorial_materials.json")


def get_conditions() -> list[str]:
    return list(get_counterbalancing()["conditions"])


def get_task_orders() -> dict[str, list[str]]:
    return copy.deepcopy(get_counterbalancing()["task_orders"])


def get_trigger_schedule() -> list[dict[str, Any]]:
    return copy.deepcopy(get_counterbalancing()["trigger_schedule"])


def get_session_end_delay_after_last_trigger_s() -> int:
    return int(get_counterbalancing()["session_end_delay_after_last_trigger_s"])


def ordered_task_ids(task_order: str) -> list[str]:
    task_orders = get_counterbalancing()["task_orders"]
    if task_order not in task_orders:
        raise KeyError(f"Unknown task_order: {task_order}")
    return list(task_orders[task_order])


def task_id_at_position(task_order: str, position: int) -> str:
    tasks = ordered_task_ids(task_order)
    if position < 1 or position > len(tasks):
        raise IndexError(f"Task position out of range: {position}")
    return tasks[position - 1]


def get_pm_task(task_id: str) -> dict[str, Any]:
    return copy.deepcopy(get_pm_materials()["tasks"][task_id])


def get_decoy_items(task_id: str) -> list[dict[str, Any]]:
    return copy.deepcopy(get_pm_materials()["tasks"][task_id]["decoy_items"])


def get_item_options(task_id: str) -> list[dict[str, Any]]:
    return [
        item for item in get_decoy_items(task_id)
        if item["id"] in {"target", "intra1", "intra2"}
    ]


def get_reminder_text(task_id: str, condition: str) -> str:
    reminders = get_pm_materials()["tasks"][task_id]["reminders"]
    if condition not in reminders:
        raise KeyError(f"Unknown reminder condition: {condition}")
    return str(reminders[condition])


def get_fake_trigger_lines(trigger_type: str) -> list[str]:
    return list(get_pm_materials()["fake_trigger_lines"].get(trigger_type, []))


def _public_task(task_id: str, condition: str, *, include_item_options: bool = False) -> dict[str, Any]:
    task = get_pm_task(task_id)
    public = {
        "task_id": task["task_id"],
        "person": task["person"],
        "trigger_type": task["trigger_type"],
        "target_room": task["target_room"],
        "action_type": task["action_type"],
        "target_item": task["target_item"],
        "assign_text": task["assign_text"],
        "recap_text": task["recap_text"],
        "greeting_lines": task["greeting_lines"],
        "reminder_text": get_reminder_text(task_id, condition),
    }
    if include_item_options:
        public["item_options"] = [
            {"id": item["id"], "label": item["label"], "isTarget": item["is_target"]}
            for item in get_item_options(task_id)
        ]
    return public


def _strip_correct_fields(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _strip_correct_fields(child)
            for key, child in value.items()
            if key not in {"correct_option_id", "correct_index", "correct_answer"}
        }
    if isinstance(value, list):
        return [_strip_correct_fields(child) for child in value]
    return copy.deepcopy(value)


def _encoding_payload(task_id: str) -> dict[str, Any]:
    material = copy.deepcopy(get_encoding_materials()["tasks"][task_id])
    material["task_id"] = task_id
    return _strip_correct_fields(material)


def _tutorial_payload(key: str) -> dict[str, Any]:
    return _strip_correct_fields(get_tutorial_materials()[key])


def evaluate_manipulation_check(task_id: str, selected_option_id: str) -> dict[str, Any]:
    check = get_encoding_materials()["tasks"][task_id]["manipulation_check"]
    correct_option_id = check["correct_option_id"]
    correct = selected_option_id == correct_option_id
    return {
        "task_id": task_id,
        "selected_option_id": selected_option_id,
        "correct": correct,
        "exclusion_flag": not correct,
    }


def get_experiment_config_for_phase(
    *,
    phase: str,
    condition: str,
    task_order: str,
    is_admin: bool = False,
) -> dict[str, Any]:
    """Return only the material required for one phase.

    Correct answers are stripped for participant-facing calls.  Admin/debug
    callers can request the same phase-scoped payload with answers intact later,
    but the initial implementation keeps all HTTP calls participant-safe.
    """
    normalized = phase.upper()
    task_ids = ordered_task_ids(task_order)
    base: dict[str, Any] = {
        "phase": normalized,
        "condition": condition,
        "task_order": task_order,
    }

    static_text = get_static_text()
    questionnaires = get_questionnaires()

    if normalized in {"TOKEN_INPUT", "WELCOME", "welcome".upper()}:
        return {**base, "welcome": static_text["welcome"]}

    if normalized == "CONSENT":
        return {**base, "consent": static_text["consent"]}

    if normalized == "DEMOGRAPHICS":
        return {**base, "questions": questionnaires["demographics"]}

    if normalized in {"MSE_PRE", "POST_MSE"}:
        return {**base, "questionnaire": questionnaires["mse"]}

    if normalized == "STORY_INTRO":
        return {**base, "script": static_text["story_intro"]}

    match = _ENCODING_VIDEO_RE.match(normalized)
    if match:
        position = int(match.group(1))
        task_id = task_id_at_position(task_order, position)
        payload = _encoding_payload(task_id)
        return {**base, "position": position, "task_id": task_id, "encoding": payload}

    match = _MANIP_CHECK_RE.match(normalized)
    if match:
        position = int(match.group(1))
        task_id = task_id_at_position(task_order, position)
        check = get_encoding_materials()["tasks"][task_id]["manipulation_check"]
        return {
            **base,
            "position": position,
            "task_id": task_id,
            "manipulation_check": _strip_correct_fields(check),
        }

    match = _ASSIGN_RE.match(normalized)
    if match:
        position = int(match.group(1))
        task_id = task_id_at_position(task_order, position)
        task = get_pm_task(task_id)
        transition_line = None
        if position <= len(static_text["encoding_transition_lines"]):
            transition_line = static_text["encoding_transition_lines"][position - 1]
        return {
            **base,
            "position": position,
            "task_id": task_id,
            "transition_line": transition_line,
            "assign": {"text": task["assign_text"]},
        }

    if normalized == "RECAP":
        recap_tasks = [
            {"task_id": task_id, "text": get_pm_task(task_id)["recap_text"]}
            for task_id in task_ids
        ]
        return {
            **base,
            "intro": static_text["recap_intro"],
            "tasks": recap_tasks,
            "outro": static_text["recap_outro"],
            "avatar_line": static_text["avatar_post_encoding_line"],
        }

    if normalized == "TUTORIAL_PHONE":
        return {**base, "phone_demo": _tutorial_payload("phone_demo")}

    if normalized == "TUTORIAL_COOKING":
        return {**base, "fried_egg": _tutorial_payload("fried_egg")}

    if normalized == "TUTORIAL_TRIGGER":
        return {**base, "trigger_demo": _tutorial_payload("trigger_demo")}

    if normalized == "EVENING_TRANSITION":
        return {**base, "transition": static_text["evening_transition"]}

    if normalized in {"MAIN_EXPERIMENT", "PLAYING"}:
        return {
            **base,
            "tasks": [
                _public_task(task_id, condition, include_item_options=True)
                for task_id in task_ids
            ],
            "trigger_schedule": get_trigger_schedule(),
            "fake_trigger_lines": copy.deepcopy(get_pm_materials()["fake_trigger_lines"]),
            "session_end_delay_after_last_trigger_s": get_session_end_delay_after_last_trigger_s(),
        }

    if normalized == "POST_MANIP_CHECK":
        return {**base, "questions": questionnaires["post_manip_check"]}

    if normalized == "POST_SUBJECTIVE_DV":
        return {**base, "questionnaire": questionnaires["subjective_dv"]}

    if normalized == "POST_NASA_TLX":
        return {**base, "questionnaire": questionnaires["nasa_tlx"]}

    if normalized == "POST_RETRO_CHECK":
        return {**base, "questionnaire": _strip_correct_fields(questionnaires["retrospective_memory_check"])}

    if normalized == "DEBRIEF":
        return {**base, "debrief": static_text["debrief"]}

    if normalized == "COMPLETED":
        return {**base, "completed": True}

    return {**base, "material": None}
