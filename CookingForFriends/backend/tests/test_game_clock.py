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


def test_restore_running_sets_correct_game_time():
    """restore() with paused=False puts the clock at the given game time."""
    fake = FakeTime(now=1000.0)
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep)

    clock.restore(game_time_s=300.0, paused=False)
    assert clock.is_started
    assert not clock.is_paused
    assert clock.now() == pytest.approx(300.0)

    # Clock advances from this point
    fake.value += 10
    assert clock.now() == pytest.approx(310.0)


def test_restore_paused_freezes_at_correct_game_time():
    """restore() with paused=True returns frozen game time and blocks."""
    fake = FakeTime(now=1000.0)
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep)

    clock.restore(game_time_s=250.0, paused=True, reason="pm")
    assert clock.is_started
    assert clock.is_paused
    assert clock.now() == pytest.approx(250.0)

    # Wall time passing doesn't change game time while paused
    fake.value += 60
    assert clock.now() == pytest.approx(250.0)

    # Resume picks up from correct position
    clock.resume("pm")
    fake.value += 5
    assert clock.now() == pytest.approx(255.0)


def test_restore_prevents_start_from_overwriting_state():
    """A subsequent start() call is a no-op after restore()."""
    fake = FakeTime(now=1000.0)
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep)

    clock.restore(game_time_s=400.0, paused=False)
    clock.start(started_at_wall_ts=0.0)  # would set game_time to 1000.0 if not guarded

    assert clock.now() == pytest.approx(400.0)


@pytest.mark.asyncio
async def test_wait_until_running_returns_immediately_when_not_paused():
    fake = FakeTime()
    clock = GameClock(time_fn=fake.now, sleep_fn=fake.sleep)
    clock.start()
    # Should return without any poll sleep
    await clock.wait_until_running()  # no assertion needed — must not hang


@pytest.mark.asyncio
async def test_wait_until_running_blocks_until_resumed():
    fake = FakeTime()
    poll_calls = 0

    async def counting_sleep(s: float):
        nonlocal poll_calls
        poll_calls += 1
        fake.value += s
        if poll_calls >= 3:
            clock.resume("pm")
        await asyncio.sleep(0)

    clock = GameClock(time_fn=fake.now, sleep_fn=counting_sleep)
    clock.start()
    clock.pause("pm")

    await clock.wait_until_running()
    assert not clock.is_paused
    assert poll_calls >= 3
