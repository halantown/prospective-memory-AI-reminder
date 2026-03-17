from core.block_scheduler import generate_block_schedule
from core.event_schedule import EventType


def test_schedule_contains_state_driven_core_events(tmp_config):
    events = generate_block_schedule(1, "LowAF_LowCB", seed=123)
    types = [e.event_type for e in events]

    assert EventType.BLOCK_START in types
    assert EventType.ROOM_TRANSITION in types
    assert EventType.ROBOT_SPEAK in types
    assert EventType.REMINDER in types
    assert EventType.TRIGGER_WINDOW_OPEN in types
    assert EventType.TRIGGER_WINDOW_CLOSE in types
    assert EventType.BLOCK_END in types

    times = [e.t for e in events]
    assert times == sorted(times)


def test_reminder_payload_contains_runtime_context(tmp_config):
    events = generate_block_schedule(1, "HighAF_HighCB", seed=1)
    reminder = next(e for e in events if e.event_type == EventType.REMINDER)

    assert reminder.payload["slot"] == "A"
    assert reminder.payload["task_id"] == "medicine"
    assert reminder.payload["room"] in {"kitchen", "living_room"}
    assert reminder.payload["activity"]
    assert reminder.payload["source"] in {"live", "cached"}
    assert reminder.payload["full_text"]
