"""Timeline editor router — list, get, update, and preview block timelines."""

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from config import DATA_DIR, MESSAGE_COOLDOWN_S, ADMIN_API_KEY
from engine.game_clock import DEFAULT_CLOCK_END_SECONDS
from engine.timeline import load_timeline
from engine.timeline_generator import generate_block_timeline
from engine.pm_tasks import BLOCK_TRIGGER_ORDER, BLOCK_TRIGGER_TIMES, BLOCK_GUESTS

logger = logging.getLogger(__name__)


async def _verify_admin(x_admin_key: str | None = Header(None, alias="X-Admin-Key")):
    """Verify admin API key if configured."""
    if not ADMIN_API_KEY:
        return
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(401, "Invalid or missing admin API key")


router = APIRouter(prefix="/api/admin/timelines", dependencies=[Depends(_verify_admin)])

TIMELINES_DIR = DATA_DIR / "timelines"

# Valid event types used in the system
VALID_EVENT_TYPES = [
    "block_start",
    "block_end",
    "ongoing_task_event",
    "robot_speak",
    "phone_message",
    "pm_trigger",
    "pm_watch_activity",
    "fake_trigger",
]


# ── Pydantic models ──

class TimelineEvent(BaseModel):
    t: int | float
    type: str
    data: dict = {}


class TimelineSaveRequest(BaseModel):
    duration_seconds: int = 600
    clock_end_seconds: int = DEFAULT_CLOCK_END_SECONDS
    events: list[TimelineEvent]


class TimelinePreviewRequest(BaseModel):
    block_number: int = 1
    condition: str = "CONTROL"
    unreminded_task_id: Optional[str] = None
    af_variant_index: int = 0


# ── Endpoints ──

@router.get("")
async def list_timelines():
    """List all available timeline files and generatable combos."""
    # Static JSON files
    files = []
    if TIMELINES_DIR.exists():
        for p in sorted(TIMELINES_DIR.glob("*.json")):
            try:
                with open(p) as f:
                    data = json.load(f)
                files.append({
                    "filename": p.name,
                    "source": "file",
                    "block_number": data.get("block_number"),
                    "condition": data.get("condition", "default"),
                    "event_count": len(data.get("events", [])),
                    "duration_seconds": data.get("duration_seconds", 600),
                    "clock_end_seconds": data.get("clock_end_seconds", DEFAULT_CLOCK_END_SECONDS),
                })
            except (json.JSONDecodeError, OSError):
                files.append({
                    "filename": p.name,
                    "source": "file",
                    "error": "Failed to parse",
                })

    # Generatable combinations
    generated = []
    for block_num in (1, 2, 3):
        for cond in ("CONTROL", "AF", "AFCB"):
            generated.append({
                "block_number": block_num,
                "condition": cond,
                "source": "generator",
                "guest": BLOCK_GUESTS.get(block_num, ""),
            })

    return {
        "files": files,
        "generated": generated,
        "event_types": VALID_EVENT_TYPES,
    }


@router.get("/file/{filename}")
async def get_timeline_file(filename: str):
    """Get a static timeline JSON file by filename."""
    # Reject filenames with path separators before constructing path
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(403, "Invalid filename")
    path = TIMELINES_DIR / filename
    if not path.exists() or not path.suffix == ".json":
        raise HTTPException(404, f"Timeline file not found: {filename}")
    if not path.resolve().is_relative_to(TIMELINES_DIR.resolve()):
        raise HTTPException(403, "Invalid path")
    try:
        with open(path) as f:
            data = json.load(f)
        return data
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(500, f"Failed to load timeline: {e}")


@router.put("/file/{filename}")
async def save_timeline_file(filename: str, body: TimelineSaveRequest):
    """Save/update a static timeline JSON file."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(403, "Invalid filename")
    path = TIMELINES_DIR / filename
    if not path.suffix == ".json":
        raise HTTPException(400, "Filename must end with .json")
    if not path.resolve().is_relative_to(TIMELINES_DIR.resolve()):
        raise HTTPException(403, "Invalid path")

    # Sort events by time
    events = sorted(
        [e.model_dump() for e in body.events],
        key=lambda e: (e["t"], 0 if e["type"] == "block_start" else 99 if e["type"] == "block_end" else 50),
    )

    # Validate events
    errors = _validate_events(events, body.duration_seconds)
    if errors:
        raise HTTPException(422, {"errors": errors})

    timeline_data = {
        "block_number": _infer_block_number(filename),
        "condition": _infer_condition(filename),
        "duration_seconds": body.duration_seconds,
        "clock_end_seconds": body.clock_end_seconds,
        "events": events,
    }

    TIMELINES_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with open(path, "w") as f:
            json.dump(timeline_data, f, indent=2)
    except OSError as e:
        raise HTTPException(500, f"Failed to save: {e}")

    return {"status": "saved", "filename": filename, "event_count": len(events)}


@router.post("/preview")
async def preview_timeline(body: TimelinePreviewRequest):
    """Generate and return a preview timeline (does not save)."""
    try:
        timeline = generate_block_timeline(
            block_number=body.block_number,
            condition=body.condition,
            unreminded_task_id=body.unreminded_task_id,
            af_variant_index=body.af_variant_index,
        )
        return timeline
    except Exception as e:
        raise HTTPException(500, f"Generation failed: {e}")


@router.get("/schema")
async def get_event_schema():
    """Return the schema of valid event types and their expected data fields."""
    return {
        "event_types": {
            "block_start": {
                "description": "Marks the start of the block",
                "data_fields": {},
            },
            "block_end": {
                "description": "Marks the end of the block",
                "data_fields": {},
            },
            "ongoing_task_event": {
                "description": "Ongoing task action (e.g., place steak on pan)",
                "data_fields": {
                    "task": "string — task type (e.g., 'steak', 'dining')",
                    "event": "string — event name (e.g., 'place_steak', 'table_ready')",
                    "pan": "int — pan number (1-3, for steak tasks)",
                    "room": "string — room where event occurs",
                },
            },
            "robot_speak": {
                "description": "Robot Pepper speaks text",
                "data_fields": {
                    "text": "string — text to speak or {{reminder:task_id}} placeholder",
                    "log_tag": "string — 'neutral' or 'reminder'",
                    "task_id": "string (optional) — PM task ID for reminders",
                    "condition": "string (optional) — experiment condition for reminders",
                },
            },
            "phone_message": {
                "description": "Phone notification/message",
                "data_fields": {
                    "message_id": "string — references messages_dayN.json pool",
                },
            },
            "pm_trigger": {
                "description": "PM task trigger event",
                "data_fields": {
                    "trigger_id": "string — PM task ID",
                    "trigger_event": "string — human-readable trigger description",
                    "trigger_type": "string — visitor|communication|appliance|activity",
                    "task_id": "string — PM task ID",
                    "signal": {"audio": "string", "visual": "string"},
                },
            },
            "pm_watch_activity": {
                "description": "Register activity watcher for condition-based PM trigger",
                "data_fields": {
                    "task_id": "string — PM task ID",
                    "watch_condition": "string — game state condition to watch for",
                    "fallback_time": "int — seconds offset for fallback trigger",
                },
            },
            "fake_trigger": {
                "description": "Fake trigger to set expectations",
                "data_fields": {
                    "trigger_type": "string — visitor|appliance",
                    "content": "string — description of the fake event",
                    "duration": "int — seconds the event lasts",
                },
            },
        },
        "duration_default": 600,
        "message_cooldown_s": MESSAGE_COOLDOWN_S,
        "blocks": [1, 2, 3],
        "conditions": ["CONTROL", "AF", "AFCB"],
    }


# ── Helpers ──

def _validate_events(events: list[dict], duration: int) -> list[str]:
    """Validate timeline events and return list of error messages."""
    errors = []

    has_block_start = any(e["type"] == "block_start" for e in events)
    has_block_end = any(e["type"] == "block_end" for e in events)

    if not has_block_start:
        errors.append("Timeline must have a 'block_start' event")
    if not has_block_end:
        errors.append("Timeline must have a 'block_end' event")

    for i, e in enumerate(events):
        if e["type"] not in VALID_EVENT_TYPES:
            errors.append(f"Event {i}: unknown type '{e['type']}'")
        if e["t"] < 0:
            errors.append(f"Event {i}: time cannot be negative (t={e['t']})")
        if e["t"] > duration and e["type"] != "block_end":
            errors.append(f"Event {i}: time {e['t']}s exceeds duration {duration}s")

    # Check block_start is at t=0
    block_starts = [e for e in events if e["type"] == "block_start"]
    if block_starts and block_starts[0]["t"] != 0:
        errors.append(f"block_start should be at t=0 (found at t={block_starts[0]['t']})")

    # Warn about phone messages violating cooldown
    if MESSAGE_COOLDOWN_S > 0:
        msg_times = sorted(e["t"] for e in events if e["type"] == "phone_message")
        for i in range(1, len(msg_times)):
            gap = msg_times[i] - msg_times[i - 1]
            if gap < MESSAGE_COOLDOWN_S:
                errors.append(
                    f"Phone messages at t={msg_times[i-1]}s and t={msg_times[i]}s "
                    f"are {gap:.0f}s apart (min cooldown: {MESSAGE_COOLDOWN_S}s)"
                )

    return errors


def _infer_block_number(filename: str) -> int | None:
    """Infer block number from filename like 'block_1_control.json'."""
    name = filename.replace(".json", "")
    parts = name.split("_")
    for p in parts:
        if p.isdigit() and int(p) in (1, 2, 3):
            return int(p)
    return None


def _infer_condition(filename: str) -> str:
    """Infer condition from filename."""
    name = filename.replace(".json", "").lower()
    if "control" in name:
        return "CONTROL"
    if "afcb" in name:
        return "AFCB"
    if "af" in name:
        return "AF"
    return "default"
