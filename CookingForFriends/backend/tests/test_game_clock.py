"""Tests for the pause-aware gameplay clock."""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.game_clock import GameClock, format_game_clock


class FakeTime:
    def __init__(self, now: float = 1000.0):
        self.value = now

    def now(self) -> float:
        return self.value

    async def sleep(self, seconds: float) -> None:
        self.value += seconds
        await asyncio.sleep(0)


@pytest.mark.parametrize(
    ("game_time_s", "expected"),
    [
        (0, "17:00"),
        (9.9, "17:00"),
        (10, "17:01"),
        (590, "17:59"),
        (600, "18:00"),
        (900, "18:00"),
    ],
)
def test_format_game_clock_caps_at_18(game_time_s, expected):
    assert format_game_clock(game_time_s, clock_end_seconds=600) == expected


def test_now_excludes_paused_wall_time():
    fake = FakeTime()
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep)

    clock.start()
    fake.value += 5
    assert clock.now() == 5

    assert clock.pause("pm") is True
    fake.value += 20
    assert clock.now() == 5
    assert clock.pause("pm") is False

    assert clock.resume("pm") is True
    fake.value += 3
    assert clock.now() == 8
    assert clock.resume("pm") is False


@pytest.mark.asyncio
async def test_sleep_until_uses_game_time_not_paused_wall_time():
    fake = FakeTime()
    calls = 0
    clock_holder: dict[str, GameClock] = {}

    async def sleep_and_resume(seconds: float) -> None:
        nonlocal calls
        calls += 1
        fake.value += seconds
        if calls == 3:
            clock_holder["clock"].resume("pm")
        await asyncio.sleep(0)

    clock = GameClock(
        time_fn=fake.now,
        sleep_fn=sleep_and_resume,
        poll_interval_s=0.1,
    )
    clock_holder["clock"] = clock
    clock.start()

    fake.value += 0.2
    clock.pause("pm")

    await clock.sleep_until(0.5)

    assert clock.now() >= 0.5
    assert fake.value - 1000.0 > clock.now()


def test_snapshot_includes_display_clock_and_freeze_state():
    fake = FakeTime()
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep, clock_end_seconds=600)
    clock.start()
    fake.value += 180
    clock.pause("pm")

    snapshot = clock.snapshot()
    assert snapshot.game_time_s == 180
    assert snapshot.frozen is True
    assert snapshot.frozen_reason == "pm"
    assert snapshot.game_clock == "17:18"
