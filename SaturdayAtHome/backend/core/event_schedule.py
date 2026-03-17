"""Scheduled event data structures for the block timeline engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    # v2.0 state-driven events
    BLOCK_START = "block_start"
    ROOM_TRANSITION = "room_transition"
    ROBOT_SPEAK = "robot_speak"
    REMINDER = "reminder"
    TRIGGER_WINDOW_OPEN = "trigger_window_open"
    TRIGGER_WINDOW_CLOSE = "trigger_window_close"
    BLOCK_END = "block_end"

    # Legacy compatibility events (not used by v2 scheduler)
    FAKE_TRIGGER = "fake_trigger"
    FORCE_STEAK_READY = "force_steak_ready"
    STEAK_SPAWN = "steak_spawn"
    MESSAGE_BUBBLE = "message_bubble"
    PLANT_NEEDS_WATER = "plant_needs_water"
    NEUTRAL_COMMENT = "neutral_comment"


# Internal EventType -> pushed event name (WebSocket payload.event)
SSE_EVENT_MAP: dict[EventType, str] = {
    EventType.BLOCK_START: "block_start",
    EventType.ROOM_TRANSITION: "room_transition",
    EventType.ROBOT_SPEAK: "robot_speak",
    EventType.REMINDER: "reminder_fire",
    EventType.TRIGGER_WINDOW_OPEN: "trigger_appear",
    EventType.TRIGGER_WINDOW_CLOSE: "window_close",
    EventType.BLOCK_END: "block_end",

    # legacy aliases
    EventType.FAKE_TRIGGER: "fake_trigger_fire",
    EventType.FORCE_STEAK_READY: "force_yellow_steak",
    EventType.STEAK_SPAWN: "steak_spawn",
    EventType.MESSAGE_BUBBLE: "message_bubble",
    EventType.PLANT_NEEDS_WATER: "plant_needs_water",
    EventType.NEUTRAL_COMMENT: "robot_speak",
}


AUDITED_EVENT_TYPES: frozenset[EventType] = frozenset({
    EventType.BLOCK_START,
    EventType.ROOM_TRANSITION,
    EventType.ROBOT_SPEAK,
    EventType.REMINDER,
    EventType.TRIGGER_WINDOW_OPEN,
    EventType.TRIGGER_WINDOW_CLOSE,
    EventType.BLOCK_END,
    EventType.FAKE_TRIGGER,
})


@dataclass
class ScheduledEvent:
    event_type: EventType
    t: float
    payload: dict = field(default_factory=dict)
    is_fixed: bool = True
    dispatched: bool = False
    dispatched_at: Optional[float] = None
