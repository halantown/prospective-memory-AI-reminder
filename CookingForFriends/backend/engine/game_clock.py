"""Gameplay clock utilities.

This module owns "game time": block/timeline/cooking seconds that pause during
PM overlays. Wall-clock timestamps are still appropriate for telemetry and
transport logs, but gameplay scheduling should go through GameClock.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Awaitable, Callable


GAME_SECONDS_PER_CLOCK_MINUTE = 10
CLOCK_START_HOUR = 17
DEFAULT_CLOCK_END_SECONDS = 600

TimeFn = Callable[[], float]
SleepFn = Callable[[float], Awaitable[None]]


def format_game_clock(
    game_time_s: float,
    clock_end_seconds: int = DEFAULT_CLOCK_END_SECONDS,
) -> str:
    """Format gameplay seconds as the displayed dinner clock.

    10 gameplay seconds = 1 displayed minute. The display is capped at
    `clock_end_seconds`, so the block may keep running after the visual clock
    reaches 18:00.
    """
    capped_seconds = max(0.0, min(game_time_s, float(clock_end_seconds)))
    game_minutes = int(capped_seconds) // GAME_SECONDS_PER_CLOCK_MINUTE
    hour = CLOCK_START_HOUR + game_minutes // 60
    minute = game_minutes % 60
    return f"{hour}:{minute:02d}"


@dataclass(frozen=True)
class GameClockSnapshot:
    """Serializable clock state useful for debugging and WS payloads."""

    game_time_s: float
    frozen: bool
    frozen_reason: str | None
    clock_end_seconds: int = DEFAULT_CLOCK_END_SECONDS

    @property
    def game_clock(self) -> str:
        return format_game_clock(self.game_time_s, self.clock_end_seconds)


class GameClock:
    """Pause-aware gameplay clock.

    The implementation is intentionally in-memory for this migration phase.
    DB-backed participant fields are still used by the PM scheduler until the
    later BlockRuntime phase moves all gameplay scheduling onto one owner.
    """

    def __init__(
        self,
        *,
        time_fn: TimeFn | None = None,
        sleep_fn: SleepFn | None = None,
        poll_interval_s: float = 0.2,
        clock_end_seconds: int = DEFAULT_CLOCK_END_SECONDS,
    ):
        self._time_fn = time_fn or time.time
        self._sleep_fn = sleep_fn or asyncio.sleep
        self._poll_interval_s = poll_interval_s
        self.clock_end_seconds = clock_end_seconds

        self._started_wall_time: float | None = None
        self._total_paused_s = 0.0
        self._paused_at: float | None = None
        self._pause_reason: str | None = None

    def start(self, started_at_wall_ts: float | None = None) -> None:
        """Start the clock.

        `started_at_wall_ts` supports the existing reconnect path where a block
        already has a persisted wall-clock start timestamp.
        """
        if self._started_wall_time is not None:
            return
        self._started_wall_time = (
            started_at_wall_ts if started_at_wall_ts is not None else self._time_fn()
        )

    @property
    def is_started(self) -> bool:
        return self._started_wall_time is not None

    @property
    def is_paused(self) -> bool:
        return self._paused_at is not None

    def now(self) -> float:
        """Return elapsed gameplay seconds, excluding paused intervals."""
        if self._started_wall_time is None:
            return 0.0
        wall_now = self._paused_at if self._paused_at is not None else self._time_fn()
        return max(0.0, wall_now - self._started_wall_time - self._total_paused_s)

    def pause(self, reason: str | None = None) -> bool:
        """Pause gameplay time. Returns False if already paused or not started."""
        if self._started_wall_time is None or self._paused_at is not None:
            return False
        self._paused_at = self._time_fn()
        self._pause_reason = reason
        return True

    def resume(self, reason: str | None = None) -> bool:
        """Resume gameplay time. Returns False if not paused."""
        if self._paused_at is None:
            return False
        self._total_paused_s += max(0.0, self._time_fn() - self._paused_at)
        self._paused_at = None
        self._pause_reason = None
        return True

    async def sleep_for(self, game_seconds: float) -> None:
        """Sleep for gameplay seconds; paused intervals do not count."""
        target = self.now() + max(0.0, game_seconds)
        await self.sleep_until(target)

    async def sleep_until(self, game_second: float) -> None:
        """Sleep until a target gameplay second."""
        if self._started_wall_time is None:
            self.start()

        while True:
            remaining = game_second - self.now()
            if remaining <= 0:
                return
            await self._sleep_fn(min(self._poll_interval_s, remaining))

    def snapshot(self) -> GameClockSnapshot:
        return GameClockSnapshot(
            game_time_s=self.now(),
            frozen=self.is_paused,
            frozen_reason=self._pause_reason,
            clock_end_seconds=self.clock_end_seconds,
        )
