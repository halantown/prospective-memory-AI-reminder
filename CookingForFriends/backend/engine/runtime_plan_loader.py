"""Runtime plan loader for the active Cooking for Friends experiment.

The runtime plan is the single editable schedule source for gameplay lanes:
PM triggers, cooking steps, robot idle comments, phone messages, and session
duration.  Content remains in the existing material/message files; this module
owns when those materials are used.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Literal

from config import DATA_DIR
from data.cooking_recipes import ALL_RECIPES
from data.cooking_timeline import RobotIdleComment, TimelineEntry
from engine.message_loader import get_message

PLAN_NAME = "main_experiment"
RUNTIME_PLANS_DIR = DATA_DIR / "runtime_plans"


def runtime_plan_path(plan_name: str = PLAN_NAME) -> Path:
    if "/" in plan_name or "\\" in plan_name or ".." in plan_name:
        raise ValueError(f"Invalid runtime plan name: {plan_name}")
    return RUNTIME_PLANS_DIR / f"{plan_name}.json"


def load_runtime_plan(plan_name: str = PLAN_NAME) -> dict[str, Any]:
    path = runtime_plan_path(plan_name)
    with path.open("r", encoding="utf-8") as f:
        plan = json.load(f)
    validate_runtime_plan(plan)
    return plan


def save_runtime_plan(plan: dict[str, Any], plan_name: str = PLAN_NAME) -> dict[str, Any]:
    validate_runtime_plan(plan)
    normalized = normalize_runtime_plan(plan)
    RUNTIME_PLANS_DIR.mkdir(parents=True, exist_ok=True)
    path = runtime_plan_path(plan_name)
    with path.open("w", encoding="utf-8") as f:
        json.dump(normalized, f, indent=2)
        f.write("\n")
    return normalized


def normalize_runtime_plan(plan: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(plan)
    for key in ("pm_schedule", "cooking_schedule", "robot_idle_comments", "phone_messages"):
        normalized[key] = sorted(normalized.get(key, []), key=lambda item: item["t"] if "t" in item else 0)
    return normalized


def validate_runtime_plan(plan: dict[str, Any]) -> None:
    errors: list[str] = []
    duration = _int(plan.get("duration_seconds"), "duration_seconds", errors)
    _int(plan.get("clock_end_seconds"), "clock_end_seconds", errors)

    pm_schedule = plan.get("pm_schedule")
    if not isinstance(pm_schedule, list) or not pm_schedule:
        errors.append("pm_schedule must be a non-empty list")
    else:
        for index, entry in enumerate(pm_schedule):
            entry_type = entry.get("type")
            _int(entry.get("delay_after_previous_s"), f"pm_schedule[{index}].delay_after_previous_s", errors)
            if entry_type == "real":
                position = _int(entry.get("task_position"), f"pm_schedule[{index}].task_position", errors)
                if position is not None and not 1 <= position <= 4:
                    errors.append(f"pm_schedule[{index}].task_position must be 1-4")
            elif entry_type == "fake":
                if entry.get("trigger_type") not in {"doorbell", "phone_call"}:
                    errors.append(f"pm_schedule[{index}].trigger_type must be doorbell or phone_call")
            else:
                errors.append(f"pm_schedule[{index}].type must be real or fake")

    for index, entry in enumerate(plan.get("cooking_schedule", [])):
        t = _time(entry.get("t"), f"cooking_schedule[{index}].t", errors)
        if duration is not None and t is not None and t > duration:
            errors.append(f"cooking_schedule[{index}].t exceeds duration_seconds")
        dish_id = entry.get("dish_id")
        step_index = _int(entry.get("step_index"), f"cooking_schedule[{index}].step_index", errors)
        if dish_id not in ALL_RECIPES:
            errors.append(f"cooking_schedule[{index}].dish_id is unknown: {dish_id}")
        elif step_index is not None and not 0 <= step_index < len(ALL_RECIPES[dish_id]):
            errors.append(f"cooking_schedule[{index}].step_index out of range for {dish_id}")
        if entry.get("step_type") not in {"active", "wait"}:
            errors.append(f"cooking_schedule[{index}].step_type must be active or wait")

    for index, entry in enumerate(plan.get("robot_idle_comments", [])):
        _time(entry.get("t"), f"robot_idle_comments[{index}].t", errors)
        if not entry.get("comment_id"):
            errors.append(f"robot_idle_comments[{index}].comment_id is required")
        if not entry.get("text"):
            errors.append(f"robot_idle_comments[{index}].text is required")

    seen_messages: set[str] = set()
    for index, entry in enumerate(plan.get("phone_messages", [])):
        t = _time(entry.get("t"), f"phone_messages[{index}].t", errors)
        if duration is not None and t is not None and t > duration:
            errors.append(f"phone_messages[{index}].t exceeds duration_seconds")
        message_id = entry.get("message_id")
        if not message_id:
            errors.append(f"phone_messages[{index}].message_id is required")
        elif message_id in seen_messages:
            errors.append(f"phone_messages[{index}].message_id duplicates {message_id}")
        else:
            seen_messages.add(message_id)
            if get_message(1, message_id) is None:
                errors.append(f"phone_messages[{index}].message_id not found: {message_id}")

    if errors:
        raise ValueError("; ".join(errors))


def cooking_timeline_from_plan(plan: dict[str, Any]) -> list[TimelineEntry]:
    return [
        TimelineEntry(
            t=int(entry["t"]),
            dish_id=str(entry["dish_id"]),
            step_index=int(entry["step_index"]),
            step_type=_step_type(entry["step_type"]),
        )
        for entry in sorted(plan.get("cooking_schedule", []), key=lambda item: item["t"])
    ]


def robot_idle_comments_from_plan(plan: dict[str, Any]) -> list[RobotIdleComment]:
    return [
        RobotIdleComment(
            t=int(entry["t"]),
            comment_id=str(entry["comment_id"]),
            text=str(entry["text"]),
        )
        for entry in sorted(plan.get("robot_idle_comments", []), key=lambda item: item["t"])
    ]


def timeline_events_from_plan(plan: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = [{"t": 0, "type": "block_start", "data": {}}]
    for entry in sorted(plan.get("phone_messages", []), key=lambda item: item["t"]):
        events.append({
            "t": int(entry["t"]),
            "type": "phone_message",
            "data": {"message_id": str(entry["message_id"])},
        })
    events.append({
        "t": int(plan["duration_seconds"]),
        "type": "block_end",
        "data": {},
    })
    return events


def timeline_from_plan(plan: dict[str, Any], *, block_number: int, condition: str) -> dict[str, Any]:
    return {
        "source": "runtime_plan",
        "block_number": block_number,
        "condition": condition,
        "duration_seconds": int(plan["duration_seconds"]),
        "clock_end_seconds": int(plan["clock_end_seconds"]),
        "events": timeline_events_from_plan(plan),
    }


def _step_type(value: Any) -> Literal["active", "wait"]:
    if value not in {"active", "wait"}:
        raise ValueError(f"Invalid cooking step_type: {value}")
    return value


def _int(value: Any, field: str, errors: list[str]) -> int | None:
    try:
        if isinstance(value, bool):
            raise TypeError
        return int(value)
    except (TypeError, ValueError):
        errors.append(f"{field} must be an integer")
        return None


def _time(value: Any, field: str, errors: list[str]) -> float | None:
    try:
        if isinstance(value, bool):
            raise TypeError
        parsed = float(value)
    except (TypeError, ValueError):
        errors.append(f"{field} must be a number")
        return None
    if parsed < 0:
        errors.append(f"{field} cannot be negative")
    return parsed
