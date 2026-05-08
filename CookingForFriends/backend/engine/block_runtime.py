"""Runtime owner for one active gameplay block.

The WebSocket handler should not coordinate timeline, cooking, PM scheduler,
and pause/resume semantics separately.  BlockRuntime owns those tasks and the
single GameClock they share.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

from engine.cooking_engine import CookingEngine
from engine.game_clock import GameClock
from engine.pm_session import run_pm_session
from engine.timeline import cancel_timeline, run_timeline
from engine.runtime_plan_loader import (
    cooking_timeline_from_plan,
    load_runtime_plan,
    robot_idle_comments_from_plan,
)

logger = logging.getLogger(__name__)

SendFn = Callable[[str, dict[str, Any]], Awaitable[None]]
DbFactory = Callable[[], Any]


class BlockRuntime:
    """Owns all in-memory gameplay runtime for one participant block."""

    def __init__(
        self,
        *,
        participant_id: str,
        block_number: int,
        block_id: int,
        condition: str,
        task_order: str,
        send_fn: SendFn,
        db_factory: DbFactory,
        block_start_time: float | None = None,
    ):
        self.participant_id = participant_id
        self.block_number = block_number
        self.block_id = block_id
        self.condition = condition
        self.task_order = task_order
        self.send_fn = send_fn
        self.db_factory = db_factory
        self.block_start_time = block_start_time

        self.clock = GameClock()
        self.timeline_task: asyncio.Task | None = None
        self.cooking: CookingEngine | None = None
        self.pm_task: asyncio.Task | None = None
        self._supervisor_task: asyncio.Task | None = None
        self._stopped = False

    async def start(self, on_complete=None) -> None:
        """Start timeline, cooking, and PM scheduler on the shared clock."""
        if self._stopped:
            raise RuntimeError("Cannot start a stopped BlockRuntime")

        runtime_plan = load_runtime_plan()

        self.timeline_task = await run_timeline(
            participant_id=self.participant_id,
            block_number=self.block_number,
            condition=self.condition,
            send_fn=self.send_fn,
            on_complete=on_complete,
            db_factory=self.db_factory,
            block_start_time=self.block_start_time,
            clock=self.clock,
            runtime_plan=runtime_plan,
        )

        self.cooking = CookingEngine(
            participant_id=self.participant_id,
            block_id=self.block_id,
            send_fn=self.send_fn,
            db_factory=self.db_factory,
            clock=self.clock,
            cooking_timeline=cooking_timeline_from_plan(runtime_plan),
            robot_idle_comments=robot_idle_comments_from_plan(runtime_plan),
        )
        self.cooking.start(self.block_start_time)

        self.pm_task = asyncio.create_task(
            run_pm_session(
                self.participant_id,
                self.task_order,
                self.send_fn,
                self.db_factory,
                on_pipeline_start=lambda: self.pause("pm"),
                clock=self.clock,
                trigger_schedule=runtime_plan["pm_schedule"],
                session_end_delay_after_last_trigger_s=runtime_plan[
                    "session_end_delay_after_last_trigger_s"
                ],
            )
        )

        self._supervisor_task = asyncio.create_task(self._supervise())

        logger.info(
            "[BLOCK_RUNTIME] Started participant=%s block=%s condition=%s order=%s",
            self.participant_id,
            self.block_number,
            self.condition,
            self.task_order,
        )

    async def _supervise(self) -> None:
        """Watch runtime tasks; if any crashes, log and notify."""
        tasks: dict[str, asyncio.Task] = {}
        if self.timeline_task:
            tasks["timeline"] = self.timeline_task
        if self.pm_task:
            tasks["pm_session"] = self.pm_task
        if self.cooking and self.cooking._timeline_task:
            tasks["cooking"] = self.cooking._timeline_task

        if not tasks:
            return

        try:
            done, _ = await asyncio.wait(
                tasks.values(), return_when=asyncio.FIRST_EXCEPTION,
            )
            for t in done:
                if t.cancelled():
                    continue
                exc = t.exception()
                if exc:
                    name = next(n for n, task in tasks.items() if task is t)
                    logger.error(
                        "[BLOCK_RUNTIME] Subsystem %s crashed for participant=%s block=%s: %s",
                        name, self.participant_id, self.block_number, exc,
                        exc_info=exc,
                    )
                    try:
                        await self.send_fn("block_error", {
                            "message": f"Internal error in {name}",
                            "participant_id": self.participant_id,
                        })
                    except Exception:
                        pass
                    await self.stop(save_scores=True)
                    return
        except asyncio.CancelledError:
            return

    def pause(self, reason: str = "pm") -> bool:
        """Pause shared gameplay time."""
        paused = self.clock.pause(reason)
        logger.info(
            "[BLOCK_RUNTIME] Pause requested participant=%s reason=%s changed=%s",
            self.participant_id,
            reason,
            paused,
        )
        return paused

    def resume(self, reason: str = "pm") -> bool:
        """Resume shared gameplay time."""
        resumed = self.clock.resume(reason)
        logger.info(
            "[BLOCK_RUNTIME] Resume requested participant=%s reason=%s changed=%s",
            self.participant_id,
            reason,
            resumed,
        )
        return resumed

    async def stop(self, *, save_scores: bool = True) -> None:
        """Stop all runtime tasks and optionally persist cooking scores."""
        if self._stopped:
            return
        self._stopped = True

        current = asyncio.current_task()
        if self.timeline_task and self.timeline_task is not current and not self.timeline_task.done():
            self.timeline_task.cancel()
        if self.timeline_task is not current:
            cancel_timeline(self.participant_id, self.block_number)

        if self.cooking:
            if save_scores:
                await self.cooking.save_dish_scores()
            await self.cooking.stop()
            self.cooking = None

        if self.pm_task and self.pm_task is not current and not self.pm_task.done():
            self.pm_task.cancel()
        self.pm_task = None

        if self._supervisor_task and self._supervisor_task is not current and not self._supervisor_task.done():
            self._supervisor_task.cancel()
        self._supervisor_task = None

        logger.info(
            "[BLOCK_RUNTIME] Stopped participant=%s block=%s save_scores=%s",
            self.participant_id,
            self.block_number,
            save_scores,
        )
