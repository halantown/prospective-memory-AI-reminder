"""Block schedule generation for PRD v2.0 state-driven simulation."""

from __future__ import annotations

import hashlib
import logging
from typing import Any, List

from core.config_loader import (
    get_block_duration_s,
    get_block_room_schedule,
    get_block_task_pair,
    get_execution_window_ms,
    get_neutral_comments,
    get_timeline_events,
)
from core.event_schedule import EventType, ScheduledEvent
from services.reminder_service import generate_reminder

logger = logging.getLogger("saturday.block_scheduler")


def derive_seed(session_id: str, block_num: int) -> int:
    """Deterministic seed from session + block (for auditing/replay metadata)."""
    raw = hashlib.md5(f"{session_id}:{block_num}".encode()).hexdigest()[:8]
    return int(raw, 16)


def _normalize_room_schedule(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    schedule = [dict(item) for item in (raw or []) if isinstance(item, dict)]
    schedule.sort(key=lambda x: float(x.get("t", 0)))

    if not schedule:
        return [
            {
                "t": 0.0,
                "room": "kitchen",
                "activity": "recipe_following",
                "narrative": "Start in the kitchen.",
            }
        ]

    first_t = float(schedule[0].get("t", 0))
    if first_t > 0:
        # Ensure the block has a known room/activity at t=0.
        first = dict(schedule[0])
        first["t"] = 0.0
        schedule.insert(0, first)

    return schedule


def _state_at(room_schedule: list[dict[str, Any]], t: float) -> tuple[str, str]:
    room = "kitchen"
    activity = "recipe_following"
    for item in room_schedule:
        if float(item.get("t", 0)) <= t:
            room = str(item.get("room", room))
            activity = str(item.get("activity", activity))
        else:
            break
    return room, activity


def _build_reminder_event(
    block_num: int,
    slot: str,
    task_id: str,
    condition: str,
    t: float,
    room_schedule: list[dict[str, Any]],
) -> ScheduledEvent:
    room, activity = _state_at(room_schedule, t)
    reminder = generate_reminder(task_id, condition, room, activity)
    return ScheduledEvent(
        event_type=EventType.REMINDER,
        t=t,
        payload={
            "block_number": block_num,
            "slot": slot,
            "task_id": task_id,
            "condition": condition,
            "room": room,
            "activity": activity,
            "text": reminder["text"],
            "preamble": reminder["preamble"],
            "full_text": reminder["full_text"],
            "source": reminder["source"],
        },
    )


def _build_trigger_event(
    block_num: int,
    slot: str,
    task_id: str,
    t: float,
    window_ms: int,
    room_schedule: list[dict[str, Any]],
) -> ScheduledEvent:
    room, activity = _state_at(room_schedule, t)
    return ScheduledEvent(
        event_type=EventType.TRIGGER_WINDOW_OPEN,
        t=t,
        payload={
            "block_number": block_num,
            "slot": slot,
            "task_id": task_id,
            "window_ms": window_ms,
            "room": room,
            "activity": activity,
        },
    )


def _build_window_close_event(
    block_num: int,
    slot: str,
    task_id: str,
    t: float,
    room_schedule: list[dict[str, Any]],
) -> ScheduledEvent:
    room, activity = _state_at(room_schedule, t)
    return ScheduledEvent(
        event_type=EventType.TRIGGER_WINDOW_CLOSE,
        t=t,
        payload={
            "block_number": block_num,
            "slot": slot,
            "task_id": task_id,
            "room": room,
            "activity": activity,
        },
    )


def generate_block_schedule(block_num: int, condition: str, seed: int) -> List[ScheduledEvent]:
    """Return full sorted event list for one block."""
    _ = seed  # kept for deterministic audit metadata compatibility

    duration = get_block_duration_s()
    events_cfg = get_timeline_events()
    neutral_comments = get_neutral_comments()
    room_schedule = _normalize_room_schedule(get_block_room_schedule(block_num))
    task_a, task_b = get_block_task_pair(block_num)
    window_ms = get_execution_window_ms()

    events: List[ScheduledEvent] = [
        ScheduledEvent(
            event_type=EventType.BLOCK_START,
            t=0.0,
            payload={
                "block_number": block_num,
                "condition": condition,
                "task_a": task_a,
                "task_b": task_b,
            },
        )
    ]

    # Room transitions
    for item in room_schedule:
        events.append(
            ScheduledEvent(
                event_type=EventType.ROOM_TRANSITION,
                t=float(item.get("t", 0.0)),
                payload={
                    "block_number": block_num,
                    "room": str(item.get("room", "kitchen")),
                    "activity": str(item.get("activity", "recipe_following")),
                    "narrative": str(item.get("narrative", "")),
                },
            )
        )

    # Neutral comments (robot social presence)
    neutral_times = [
        float(events_cfg.get("neutral_comment_1_s", 30)),
        float(events_cfg.get("neutral_comment_2_s", 255)),
        float(events_cfg.get("neutral_comment_3_s", 450)),
    ]
    for idx, t in enumerate(neutral_times):
        text = neutral_comments[idx] if idx < len(neutral_comments) else ""
        if not text:
            continue
        room, activity = _state_at(room_schedule, t)
        events.append(
            ScheduledEvent(
                event_type=EventType.ROBOT_SPEAK,
                t=t,
                payload={
                    "block_number": block_num,
                    "utterance_type": "neutral",
                    "text": text,
                    "room": room,
                    "activity": activity,
                },
            )
        )

    reminder_a_t = float(events_cfg.get("reminder_a_s", 120))
    trigger_a_t = float(events_cfg.get("trigger_a_appear_s", 210))
    close_a_t = float(events_cfg.get("trigger_a_close_s", 240))
    reminder_b_t = float(events_cfg.get("reminder_b_s", 300))
    trigger_b_t = float(events_cfg.get("trigger_b_appear_s", 390))
    close_b_t = float(events_cfg.get("trigger_b_close_s", 420))

    events.append(_build_reminder_event(block_num, "A", task_a, condition, reminder_a_t, room_schedule))
    events.append(_build_trigger_event(block_num, "A", task_a, trigger_a_t, window_ms, room_schedule))
    events.append(_build_window_close_event(block_num, "A", task_a, close_a_t, room_schedule))

    events.append(_build_reminder_event(block_num, "B", task_b, condition, reminder_b_t, room_schedule))
    events.append(_build_trigger_event(block_num, "B", task_b, trigger_b_t, window_ms, room_schedule))
    events.append(_build_window_close_event(block_num, "B", task_b, close_b_t, room_schedule))

    events.append(
        ScheduledEvent(
            event_type=EventType.BLOCK_END,
            t=float(duration),
            payload={"block_number": block_num},
        )
    )

    events.sort(key=lambda e: e.t)

    logger.info(
        "Block %s schedule generated: %s events (condition=%s, seed=%s)",
        block_num,
        len(events),
        condition,
        seed,
    )
    return events
