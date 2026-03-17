"""Scheduled event data structures for the block timeline engine."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    # Fixed PM events
    BLOCK_START = "block_start"
    GAME_START = "game_start"
    GAME_END = "game_end"
    ROOM_TRANSITION = "room_transition"
    REMINDER_FIRE = "reminder_fire"
    TRIGGER_FIRE = "trigger_fire"
    WINDOW_CLOSE = "window_close"
    BLOCK_END = "block_end"

    # Floating events
    ROBOT_NEUTRAL = "robot_neutral"
    AMBIENT_PULSE = "ambient_pulse"


# Map EventType → WS event name pushed to frontend
WS_EVENT_MAP: dict[EventType, str] = {
    EventType.BLOCK_START: "block_start",
    EventType.GAME_START: "game_start",
    EventType.GAME_END: "game_end",
    EventType.ROOM_TRANSITION: "room_transition",
    EventType.REMINDER_FIRE: "reminder_fire",
    EventType.TRIGGER_FIRE: "trigger_fire",
    EventType.WINDOW_CLOSE: "window_close",
    EventType.BLOCK_END: "block_end",
    EventType.ROBOT_NEUTRAL: "robot_speak",
    EventType.AMBIENT_PULSE: "ambient_pulse",
}

AUDITED_EVENT_TYPES: frozenset[EventType] = frozenset({
    EventType.BLOCK_START,
    EventType.GAME_START,
    EventType.GAME_END,
    EventType.ROOM_TRANSITION,
    EventType.REMINDER_FIRE,
    EventType.TRIGGER_FIRE,
    EventType.WINDOW_CLOSE,
    EventType.BLOCK_END,
    EventType.ROBOT_NEUTRAL,
    EventType.AMBIENT_PULSE,
})


@dataclass
class ScheduledEvent:
    event_type: EventType
    t: float  # seconds relative to block start
    payload: dict = field(default_factory=dict)
    is_fixed: bool = True
    dispatched: bool = False
    dispatched_at: Optional[float] = None
