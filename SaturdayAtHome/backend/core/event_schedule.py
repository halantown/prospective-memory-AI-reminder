"""Scheduled event data structures for the block timeline engine."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    # ── Fixed PM events ──────────────────────────────────────────────────
    BLOCK_START          = "block_start"
    REMINDER             = "reminder"
    TRIGGER_WINDOW_OPEN  = "trigger_window_open"
    TRIGGER_WINDOW_CLOSE = "trigger_window_close"
    BLOCK_END            = "block_end"

    # ── Floating experiment events (jittered, seeded RNG) ────────────────
    FAKE_TRIGGER         = "fake_trigger"
    NEUTRAL_COMMENT      = "neutral_comment"
    FORCE_STEAK_READY    = "force_steak_ready"

    # ── Ongoing-task events (high-volume, not persisted to block_events) ─
    STEAK_SPAWN          = "steak_spawn"
    MESSAGE_BUBBLE       = "message_bubble"
    PLANT_NEEDS_WATER    = "plant_needs_water"

    # ── Internal state markers (not dispatched over SSE) ─────────────────
    BUSY_WINDOW_START    = "busy_window_start"
    BUSY_WINDOW_END      = "busy_window_end"


# Map internal EventType → SSE event name sent to the frontend.
# Must match what useSSE.js / the frontend expects.
SSE_EVENT_MAP: dict[EventType, str] = {
    EventType.BLOCK_START:          "block_start",
    EventType.REMINDER:             "reminder_fire",
    EventType.TRIGGER_WINDOW_OPEN:  "trigger_appear",
    EventType.TRIGGER_WINDOW_CLOSE: "window_close",
    EventType.BLOCK_END:            "block_end",
    EventType.FAKE_TRIGGER:         "fake_trigger_fire",
    EventType.NEUTRAL_COMMENT:      "robot_neutral",
    EventType.FORCE_STEAK_READY:    "force_yellow_steak",
    EventType.STEAK_SPAWN:          "steak_spawn",
    EventType.MESSAGE_BUBBLE:       "message_bubble",
    EventType.PLANT_NEEDS_WATER:    "plant_needs_water",
}

# Event types that are audit-logged to the block_events DB table.
AUDITED_EVENT_TYPES: frozenset[EventType] = frozenset({
    EventType.BLOCK_START,
    EventType.REMINDER,
    EventType.TRIGGER_WINDOW_OPEN,
    EventType.TRIGGER_WINDOW_CLOSE,
    EventType.BLOCK_END,
    EventType.FAKE_TRIGGER,
    EventType.NEUTRAL_COMMENT,
    EventType.FORCE_STEAK_READY,
})


@dataclass
class ScheduledEvent:
    event_type: EventType
    t: float                          # seconds relative to block start
    payload: dict = field(default_factory=dict)
    is_fixed: bool = True             # False → t was sampled from jitter range
    dispatched: bool = False
    dispatched_at: Optional[float] = None  # wall-clock time when actually fired
