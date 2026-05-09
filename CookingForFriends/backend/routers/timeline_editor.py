"""Runtime plan admin router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException

from config import ADMIN_API_KEY, CONDITIONS, MESSAGE_COOLDOWN_S
from engine.runtime_plan_loader import (
    load_runtime_plan,
    save_runtime_plan,
    timeline_from_plan,
    validate_runtime_plan,
)
from engine.message_loader import load_message_pool

logger = logging.getLogger(__name__)


async def _verify_admin(x_admin_key: str | None = Header(None, alias="X-Admin-Key")):
    """Verify admin API key if configured."""
    if not ADMIN_API_KEY:
        return
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(401, "Invalid or missing admin API key")


router = APIRouter(prefix="/api/admin/timelines", dependencies=[Depends(_verify_admin)])


@router.get("")
async def get_timeline_admin_index():
    """Return runtime-plan editor metadata."""
    plan = _load_or_500()
    return {
        "source": "runtime_plan",
        "plan": "main_experiment",
        "duration_seconds": plan["duration_seconds"],
        "clock_end_seconds": plan["clock_end_seconds"],
        "lanes": {
            "pm_schedule": len(plan.get("pm_schedule", [])),
            "cooking_schedule": len(plan.get("cooking_schedule", [])),
            "robot_idle_comments": len(plan.get("robot_idle_comments", [])),
            "phone_messages": len(plan.get("phone_messages", [])),
        },
        "conditions": CONDITIONS,
    }


@router.get("/runtime-plan")
async def get_runtime_plan():
    """Return the active editable runtime plan."""
    return _load_or_500()


@router.put("/runtime-plan")
async def update_runtime_plan(body: dict[str, Any]):
    """Validate and save the active runtime plan."""
    try:
        saved = save_runtime_plan(body)
    except ValueError as e:
        raise HTTPException(422, {"errors": str(e).split("; ")})
    except OSError as e:
        logger.exception("Failed to save runtime plan")
        raise HTTPException(500, f"Failed to save runtime plan: {e}")
    return {
        "status": "saved",
        "duration_seconds": saved["duration_seconds"],
        "lane_counts": {
            "pm_schedule": len(saved.get("pm_schedule", [])),
            "cooking_schedule": len(saved.get("cooking_schedule", [])),
            "robot_idle_comments": len(saved.get("robot_idle_comments", [])),
            "phone_messages": len(saved.get("phone_messages", [])),
        },
    }


@router.post("/preview")
async def preview_runtime_plan(body: dict[str, Any] | None = None):
    """Preview the runtime plan as the concrete non-PM timeline events."""
    body = body or {}
    plan = body.get("plan") or _load_or_500()
    try:
        validate_runtime_plan(plan)
    except ValueError as e:
        raise HTTPException(422, {"errors": str(e).split("; ")})
    return timeline_from_plan(
        plan,
        block_number=int(body.get("block_number", 1)),
        condition=str(body.get("condition", CONDITIONS[0])),
    )


@router.get("/schema")
async def get_runtime_plan_schema():
    """Return lightweight editor metadata for runtime-plan lanes."""
    message_pool = load_message_pool(1)
    phone_message_catalog = [
        {
            "message_id": message_id,
            "default_t": message.get("t"),
            "channel": message.get("channel", "notification"),
            "sender": message.get("contact_id") or message.get("sender") or "",
            "text": message.get("text", ""),
        }
        for message_id, message in sorted(
            message_pool.items(),
            key=lambda item: (int(item[1].get("t", 0) or 0), item[0]),
        )
    ]
    return {
        "duration_default": 900,
        "message_cooldown_s": MESSAGE_COOLDOWN_S,
        "conditions": CONDITIONS,
        "phone_message_catalog": phone_message_catalog,
        "lanes": {
            "pm_schedule": {
                "description": "PM trigger schedule; delays are relative game-time seconds after the previous PM pipeline.",
                "entry_types": ["real", "fake"],
                "real_fields": ["delay_after_previous_s", "task_position"],
                "fake_fields": ["delay_after_previous_s", "trigger_type"],
            },
            "cooking_schedule": {
                "description": "Absolute game-time cooking step activations.",
                "fields": ["t", "dish_id", "step_index", "step_type"],
            },
            "robot_idle_comments": {
                "description": "Absolute game-time non-interactive robot comments.",
                "fields": ["t", "comment_id", "text"],
            },
            "phone_messages": {
                "description": "Absolute game-time phone message deliveries.",
                "fields": ["t", "message_id"],
            },
        },
    }


def _load_or_500() -> dict[str, Any]:
    try:
        return load_runtime_plan()
    except (OSError, ValueError) as e:
        logger.exception("Failed to load runtime plan")
        raise HTTPException(500, f"Failed to load runtime plan: {e}")
