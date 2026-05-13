"""Regression tests for reconnect timeline resume behavior."""

import os
import sys
import asyncio
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.game_clock import GameClock
from engine.timeline import run_timeline


class FakeTime:
    def __init__(self, now: float = 1000.0):
        self.value = now

    def now(self) -> float:
        return self.value

    async def sleep(self, seconds: float) -> None:
        self.value += seconds
        await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_restored_clock_skips_past_timeline_events_without_block_start_time():
    """A restored GameClock is enough to prevent one-shot timeline replay."""
    fake = FakeTime()
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep)
    clock.restore(game_time_s=20.0, paused=False)
    sent: list[tuple[str, dict]] = []

    async def send(event_type: str, data: dict):
        sent.append((event_type, data))

    timeline = {
        "duration_seconds": 20,
        "clock_end_seconds": 600,
        "events": [
            {"t": 0, "type": "block_start", "data": {}},
            {"t": 10, "type": "phone_message", "data": {"message_id": "q_001"}},
            {"t": 20, "type": "custom_event", "data": {"value": "past"}},
        ],
    }

    with patch("engine.timeline.load_timeline", return_value=timeline):
        task = await run_timeline(
            participant_id="participant_reconnect",
            block_number=1,
            condition="EE1",
            send_fn=send,
            clock=clock,
        )
        await task

    event_types = [event_type for event_type, _ in sent]
    assert "phone_message" not in event_types
    assert "custom_event" not in event_types
    assert event_types[-1] == "block_end"
