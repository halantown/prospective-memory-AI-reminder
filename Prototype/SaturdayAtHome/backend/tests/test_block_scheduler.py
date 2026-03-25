from core.block_scheduler import generate_block_schedule
from core.event_schedule import EventType


def test_schedule_contains_core_events(tmp_config):
    events = generate_block_schedule(1, "LowAF_LowCB", seed=123)
    types = [e.event_type for e in events]
    assert EventType.BLOCK_START in types
    assert EventType.BLOCK_END in types
    assert EventType.TRIGGER_WINDOW_OPEN in types
    assert EventType.TRIGGER_WINDOW_CLOSE in types
    assert EventType.MESSAGE_BUBBLE in types
    assert EventType.PLANT_NEEDS_WATER in types

    # Ensure schedule is sorted by time
    times = [e.t for e in events]
    assert times == sorted(times)


def test_fake_trigger_conflict_resolved(tmp_config):
    events = generate_block_schedule(1, "LowAF_LowCB", seed=1)
    reminder_t = next(e.t for e in events if e.event_type == EventType.REMINDER)
    fake_t = next(e.t for e in events if e.event_type == EventType.FAKE_TRIGGER)
    # fake trigger should be pushed earlier than reminder - 10s guard - 2s buffer
    assert fake_t <= reminder_t - 12.0
