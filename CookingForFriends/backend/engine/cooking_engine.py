"""CookingEngine — Per-session state machine driving the multi-dish cooking task.

Responsibilities:
- Track per-dish progress (current step, phase, results)
- Activate steps at timeline-driven times
- Handle participant actions (correct / wrong)
- Handle timeouts (missed steps)
- Emit WS events to the frontend
- Record scoring data to the database
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable, Literal

from config import COOKING_STEP_WINDOW_S, COOKING_DISHES
from data.cooking_recipes import ALL_RECIPES, CookingStepDef, DISH_LABELS, DISH_EMOJIS
from data.cooking_timeline import (
    COOKING_TIMELINE,
    ROBOT_IDLE_COMMENTS,
    RobotIdleComment,
    TimelineEntry,
)
from engine.game_clock import GameClock

logger = logging.getLogger(__name__)

SendFn = Callable[[str, dict[str, Any]], Awaitable[None]]


@dataclass
class StepResult:
    """Outcome of a single cooking step."""
    dish_id: str
    step_index: int
    step_id: str
    station: str
    result: Literal["correct", "wrong", "missed"]
    chosen_option: str | None
    correct_option: str
    activated_at: float
    completed_at: float
    response_time_ms: int | None


@dataclass
class DishProgress:
    """Runtime state of a single dish."""
    dish_id: str
    steps: list[CookingStepDef]
    current_step_index: int = 0
    phase: str = "idle"  # idle | active | waiting | done
    results: list[StepResult] = field(default_factory=list)
    started_at: float | None = None
    completed_at: float | None = None


class CookingEngine:
    """Drives the cooking task for one participant's block session.

    Instantiated when a block starts; lives until block ends.
    """

    def __init__(
        self,
        participant_id: str,
        block_id: int,
        send_fn: SendFn,
        db_factory: Any,
        clock: GameClock | None = None,
        cooking_timeline: list[TimelineEntry] | None = None,
        robot_idle_comments: list[RobotIdleComment] | None = None,
    ):
        self.participant_id = participant_id
        self.block_id = block_id
        self._send = send_fn
        self._db_factory = db_factory

        # Per-dish progress
        self.dishes: dict[str, DishProgress] = {}
        for dish_id in COOKING_DISHES:
            self.dishes[dish_id] = DishProgress(
                dish_id=dish_id,
                steps=list(ALL_RECIPES[dish_id]),
            )

        # Active step tracking
        self._active_step: dict[str, TimelineEntry | None] = {d: None for d in COOKING_DISHES}
        self._active_wait: dict[str, TimelineEntry | None] = {d: None for d in COOKING_DISHES}
        self._timeout_tasks: dict[str, asyncio.Task] = {}
        self._step_activated_at: dict[str, float] = {}
        self._step_activated_game_time: dict[str, float] = {}
        self._step_deadline_game_time: dict[str, float] = {}

        # Timeline scheduling
        self._timeline_task: asyncio.Task | None = None
        self._idle_comment_task: asyncio.Task | None = None
        self._running = False
        self._clock = clock or GameClock()
        self._cooking_timeline = cooking_timeline or COOKING_TIMELINE
        self._robot_idle_comments = robot_idle_comments or ROBOT_IDLE_COMMENTS
        self._next_timeline_index: int = 0

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self, block_start_time: float | None = None) -> asyncio.Task:
        """Start the cooking timeline. Returns the background task."""
        restored_clock = self._clock.is_started
        self._clock.start(block_start_time)
        self._running = True
        current_game_time = self._clock.now()
        self._next_timeline_index = self._first_pending_timeline_index(
            current_game_time,
            include_current=not restored_clock,
        )
        self._timeline_task = asyncio.create_task(self._run_timeline())
        self._idle_comment_task = asyncio.create_task(self._run_idle_comments())
        return self._timeline_task

    def _first_pending_timeline_index(
        self,
        game_time_s: float,
        *,
        include_current: bool,
    ) -> int:
        """Return first cooking entry that has not already passed."""
        for index, entry in enumerate(self._cooking_timeline):
            if entry.t > game_time_s or (include_current and entry.t >= game_time_s):
                return index
        return len(self._cooking_timeline)

    async def stop(self):
        """Stop the cooking engine and cancel pending timers."""
        self._running = False
        for task in self._timeout_tasks.values():
            task.cancel()
        self._timeout_tasks.clear()
        self._step_deadline_game_time.clear()
        self._step_activated_game_time.clear()
        for dish_id in self._active_wait:
            self._active_wait[dish_id] = None
        if self._timeline_task and not self._timeline_task.done():
            self._timeline_task.cancel()
        self._timeline_task = None
        if self._idle_comment_task and not self._idle_comment_task.done():
            self._idle_comment_task.cancel()
        self._idle_comment_task = None

    def pause(self):
        """Pause all cooking timers (called during PM pipeline freeze)."""
        self._clock.pause("pm")

    def resume(self):
        """Resume cooking timers (called when game time unfreezes)."""
        self._clock.resume("pm")

    # ── Timeline Runner ───────────────────────────────────────────────────────

    async def _run_timeline(self):
        """Fire timeline events at their scheduled times."""
        try:
            while self._next_timeline_index < len(self._cooking_timeline):
                if not self._running:
                    break
                entry = self._cooking_timeline[self._next_timeline_index]

                # Wait until the scheduled time
                await self._clock.sleep_until(entry.t)
                # If PM overlay fired at this exact game time, wait for resume
                # before activating — prevents cooking steps triggering mid-overlay.
                await self._clock.wait_until_running()

                if not self._running:
                    break

                await self._activate_entry(entry)
                self._next_timeline_index += 1

        except asyncio.CancelledError:
            logger.debug("CookingEngine timeline cancelled for block %d", self.block_id)
        except Exception:
            logger.exception("CookingEngine timeline error for block %d", self.block_id)

    async def _run_idle_comments(self):
        """Emit non-interactive robot comments during lighter cooking gaps."""
        try:
            for comment in self._robot_idle_comments:
                if comment.t < self._clock.now():
                    continue
                if not self._running:
                    break
                await self._clock.sleep_until(comment.t)
                await self._clock.wait_until_running()
                if not self._running:
                    break
                await self._send("robot_idle_comment", {
                    "comment_id": comment.comment_id,
                    "text": comment.text,
                    "scheduled_game_time": comment.t,
                    "game_time": self._clock.now(),
                })
        except asyncio.CancelledError:
            logger.debug("CookingEngine idle comments cancelled for block %d", self.block_id)
        except Exception:
            logger.exception("CookingEngine idle comment error for block %d", self.block_id)

    async def _activate_entry(self, entry: TimelineEntry):
        """Activate a single timeline entry (step)."""
        if not self._clock.is_started:
            self._clock.start()
        dish = self.dishes[entry.dish_id]
        step_def = dish.steps[entry.step_index]

        previous_active = self._active_step.get(entry.dish_id)
        if previous_active and previous_active.step_index != entry.step_index:
            timeout_task = self._timeout_tasks.pop(entry.dish_id, None)
            if timeout_task:
                timeout_task.cancel()
            await self._mark_step_missed(
                entry.dish_id,
                previous_active.step_index,
                reason="superseded",
            )

        previous_wait = self._active_wait.get(entry.dish_id)
        if previous_wait and previous_wait.step_index != entry.step_index:
            previous_step = dish.steps[previous_wait.step_index]
            await self._send("ongoing_task_event", {
                "task": "cooking",
                "event": "wait_end",
                "dish": entry.dish_id,
                "step_index": previous_wait.step_index,
                "step_id": previous_step.id,
            })
            self._active_wait[entry.dish_id] = None

        # Update dish phase
        if dish.phase == "idle":
            dish.phase = "active"
            dish.started_at = time.time()

        dish.current_step_index = entry.step_index

        if entry.step_type == "wait":
            # Wait steps: notify frontend, auto-progress after duration
            dish.phase = "waiting"
            self._active_wait[entry.dish_id] = entry
            await self._send("ongoing_task_event", {
                "task": "cooking",
                "event": "wait_start",
                "dish": entry.dish_id,
                "step_index": entry.step_index,
                "step_id": step_def.id,
                "label": step_def.label,
                "description": step_def.description,
                "station": step_def.station,
                "wait_duration_s": step_def.wait_duration_s,
                "started_at": time.time(),
                "started_game_time": self._clock.now(),
            })
        else:
            # Active steps: notify frontend with options, start timeout
            dish.phase = "active"
            self._active_step[entry.dish_id] = entry
            activated_at = time.time()
            activated_game_time = self._clock.now()
            deadline_game_time = activated_game_time + COOKING_STEP_WINDOW_S
            self._step_activated_at[entry.dish_id] = activated_at
            self._step_activated_game_time[entry.dish_id] = activated_game_time
            self._step_deadline_game_time[entry.dish_id] = deadline_game_time

            # Build option list from config (fixed order, no shuffle)
            options = [{"id": f"option_{i}", "text": t} for i, t in enumerate(step_def.options)]

            await self._send("ongoing_task_event", {
                "task": "cooking",
                "event": "step_activate",
                "dish": entry.dish_id,
                "dish_label": DISH_LABELS[entry.dish_id],
                "dish_emoji": DISH_EMOJIS[entry.dish_id],
                "step_index": entry.step_index,
                "step_id": step_def.id,
                "label": step_def.label,
                "description": step_def.description,
                "station": step_def.station,
                "options": options,
                "window_s": COOKING_STEP_WINDOW_S,
                "activated_at": activated_at,
                "activated_game_time": activated_game_time,
                "deadline_game_time": deadline_game_time,
            })

            # Start timeout timer
            self._timeout_tasks[entry.dish_id] = asyncio.create_task(
                self._step_timeout(entry.dish_id, entry.step_index, deadline_game_time)
            )

    # ── Timeout Handler ───────────────────────────────────────────────────────

    async def _step_timeout(
        self,
        dish_id: str,
        step_index: int,
        deadline_game_time: float,
    ):
        """Called after COOKING_STEP_WINDOW_S if participant hasn't acted."""
        try:
            await self._clock.sleep_until(deadline_game_time)
        except asyncio.CancelledError:
            return
        finally:
            self._timeout_tasks.pop(dish_id, None)

        # Check step is still active (not already handled)
        if self._active_step.get(dish_id) is None:
            return
        entry = self._active_step[dish_id]
        if entry.step_index != step_index:
            return

        await self._mark_step_missed(dish_id, step_index, reason="timeout")

    async def _mark_step_missed(
        self,
        dish_id: str,
        step_index: int,
        reason: str,
    ) -> None:
        """Record and emit a missed step for timeout or superseded activation."""
        entry = self._active_step.get(dish_id)
        if entry is None or entry.step_index != step_index:
            return

        # Mark as missed
        now = time.time()
        dish = self.dishes[dish_id]
        step_def = dish.steps[step_index]

        result = StepResult(
            dish_id=dish_id,
            step_index=step_index,
            step_id=step_def.id,
            station=step_def.station,
            result="missed",
            chosen_option=None,
            correct_option=step_def.options[step_def.correct_index] if step_def.options else "",
            activated_at=self._step_activated_at.get(dish_id, now),
            completed_at=now,
            response_time_ms=None,
        )
        dish.results.append(result)
        self._active_step[dish_id] = None
        self._step_deadline_game_time.pop(dish_id, None)
        self._step_activated_game_time.pop(dish_id, None)

        # Check if dish is complete
        dish_completed = self._check_dish_complete(dish_id)

        # Notify frontend
        await self._send("ongoing_task_event", {
            "task": "cooking",
            "event": "step_timeout",
            "dish": dish_id,
            "step_index": step_index,
            "step_id": step_def.id,
        })
        if dish_completed:
            await self._send("ongoing_task_event", {
                "task": "cooking",
                "event": "dish_complete",
                "dish": dish_id,
                "dish_label": DISH_LABELS[dish_id],
                "dish_emoji": DISH_EMOJIS[dish_id],
            })

        # Record to DB
        await self._record_step(result)

        logger.info(
            "Cooking step missed (%s): %s step %d (%s) for participant %s",
            reason, dish_id, step_index, step_def.id, self.participant_id,
        )

    # ── Action Handler ────────────────────────────────────────────────────────

    async def handle_action(
        self,
        dish_id: str,
        chosen_option_id: str,
        chosen_option_text: str,
        station: str,
        timestamp: float,
        client_step_index: int | None = None,
    ) -> dict[str, Any]:
        """Process a participant's cooking action.

        Returns a result dict to send back to frontend.
        """
        # Validate that this dish has an active step
        entry = self._active_step.get(dish_id)
        if entry is None:
            return {"result": "no_active_step", "dish": dish_id}

        dish = self.dishes[dish_id]
        step_def = dish.steps[entry.step_index]

        if client_step_index is not None and client_step_index != entry.step_index:
            logger.warning(
                "Rejected stale cooking action: %s client_step=%s active_step=%s participant=%s",
                dish_id,
                client_step_index,
                entry.step_index,
                self.participant_id,
            )
            return {
                "result": "stale_step",
                "dish": dish_id,
                "received_step_index": client_step_index,
                "expected_step_index": entry.step_index,
            }

        # Validate station matches
        if station != step_def.station:
            return {"result": "wrong_station", "dish": dish_id, "expected": step_def.station}

        # Cancel timeout timer
        timeout_task = self._timeout_tasks.pop(dish_id, None)
        if timeout_task:
            timeout_task.cancel()

        # Determine correctness
        activated_at = self._step_activated_at.get(dish_id, timestamp)
        activated_game_time = self._step_activated_game_time.get(dish_id, self._clock.now())
        is_correct = chosen_option_id == f"option_{step_def.correct_index}"
        now = time.time()
        response_time_ms = int(max(0.0, self._clock.now() - activated_game_time) * 1000)

        correct_option_text = step_def.options[step_def.correct_index] if step_def.options else ""
        result_str: Literal["correct", "wrong"] = "correct" if is_correct else "wrong"
        result = StepResult(
            dish_id=dish_id,
            step_index=entry.step_index,
            step_id=step_def.id,
            station=step_def.station,
            result=result_str,
            chosen_option=chosen_option_text,
            correct_option=correct_option_text,
            activated_at=activated_at,
            completed_at=now,
            response_time_ms=response_time_ms,
        )
        dish.results.append(result)
        self._active_step[dish_id] = None
        self._step_deadline_game_time.pop(dish_id, None)
        self._step_activated_game_time.pop(dish_id, None)

        # Check if dish is complete
        dish_completed = self._check_dish_complete(dish_id)

        # Notify frontend
        event_data = {
            "task": "cooking",
            "event": "step_result",
            "dish": dish_id,
            "step_index": entry.step_index,
            "step_id": step_def.id,
            "result": result_str,
            "chosen_option_id": chosen_option_id,
            "correct_option": correct_option_text,
            "response_time_ms": response_time_ms,
            "activated_game_time": activated_game_time,
            "completed_game_time": self._clock.now(),
        }
        await self._send("ongoing_task_event", event_data)
        if dish_completed:
            await self._send("ongoing_task_event", {
                "task": "cooking",
                "event": "dish_complete",
                "dish": dish_id,
                "dish_label": DISH_LABELS[dish_id],
                "dish_emoji": DISH_EMOJIS[dish_id],
            })

        # Record to DB
        await self._record_step(result)

        logger.info(
            "Cooking action: %s step %d (%s) → %s [%dms] for participant %s",
            dish_id, entry.step_index, step_def.id, result_str,
            response_time_ms, self.participant_id,
        )

        return event_data

    # ── Station Query ─────────────────────────────────────────────────────────

    def get_active_step_for_station(self, station: str) -> tuple[str, TimelineEntry] | None:
        """Check if any dish has an active step at the given station."""
        for dish_id, entry in self._active_step.items():
            if entry is None:
                continue
            step_def = self.dishes[dish_id].steps[entry.step_index]
            if step_def.station == station:
                return (dish_id, entry)
        return None

    # ── Dish Completion ───────────────────────────────────────────────────────

    def _check_dish_complete(self, dish_id: str) -> bool:
        """Mark dish as done if all active steps have been processed."""
        dish = self.dishes[dish_id]
        total_active = sum(1 for s in dish.steps if s.step_type == "active")
        completed = sum(1 for r in dish.results)
        if completed >= total_active and dish.phase != "done":
            dish.phase = "done"
            dish.completed_at = time.time()
            return True
        return False

    # ── State Snapshot ────────────────────────────────────────────────────────

    def get_state(self) -> dict[str, Any]:
        """Return current cooking state for snapshot/recipe display."""
        state = {}
        for dish_id, dish in self.dishes.items():
            active_entry = self._active_step.get(dish_id)
            state[dish_id] = {
                "phase": dish.phase,
                "current_step_index": dish.current_step_index,
                "total_steps": len(dish.steps),
                "active_step": active_entry.step_index if active_entry else None,
                "wait_step": self._active_wait[dish_id].step_index if self._active_wait[dish_id] else None,
                "results": [
                    {"step_index": r.step_index, "result": r.result}
                    for r in dish.results
                ],
                "started_at": dish.started_at,
                "completed_at": dish.completed_at,
            }
        return state

    # ── Scoring ───────────────────────────────────────────────────────────────

    def get_scores(self) -> dict[str, dict[str, int]]:
        """Return per-dish score summary."""
        scores = {}
        for dish_id, dish in self.dishes.items():
            correct = sum(1 for r in dish.results if r.result == "correct")
            wrong = sum(1 for r in dish.results if r.result == "wrong")
            missed = sum(1 for r in dish.results if r.result == "missed")
            total_active = sum(1 for s in dish.steps if s.step_type == "active")
            total_rt = sum(r.response_time_ms for r in dish.results if r.response_time_ms)
            scores[dish_id] = {
                "total_steps": total_active,
                "correct": correct,
                "wrong": wrong,
                "missed": missed,
                "accuracy_pct": round(correct / total_active * 100) if total_active else 0,
                "total_response_time_ms": total_rt,
            }
        return scores

    # ── DB Persistence ────────────────────────────────────────────────────────

    async def _record_step(self, result: StepResult):
        """Write a single step result to the database."""
        try:
            from models.cooking import CookingStepRecord
            async with self._db_factory() as db:
                record = CookingStepRecord(
                    participant_id=self.participant_id,
                    block_id=self.block_id,
                    dish_id=result.dish_id,
                    step_index=result.step_index,
                    step_id=result.step_id,
                    station=result.station,
                    result=result.result,
                    chosen_option=result.chosen_option,
                    correct_option=result.correct_option,
                    activated_at=result.activated_at,
                    completed_at=result.completed_at,
                    response_time_ms=result.response_time_ms,
                )
                db.add(record)
                await db.commit()
        except Exception:
            logger.exception("Failed to record cooking step for %s", self.participant_id)

    async def save_dish_scores(self):
        """Write per-dish aggregate scores to the database. Call at block end."""
        try:
            from models.cooking import CookingDishScore
            async with self._db_factory() as db:
                for dish_id, dish in self.dishes.items():
                    total_active = sum(1 for s in dish.steps if s.step_type == "active")
                    correct = sum(1 for r in dish.results if r.result == "correct")
                    wrong = sum(1 for r in dish.results if r.result == "wrong")
                    missed = sum(1 for r in dish.results if r.result == "missed")
                    total_rt = sum(r.response_time_ms for r in dish.results if r.response_time_ms)
                    score = CookingDishScore(
                        participant_id=self.participant_id,
                        block_id=self.block_id,
                        dish_id=dish_id,
                        total_steps=total_active,
                        steps_correct=correct,
                        steps_wrong=wrong,
                        steps_missed=missed,
                        started_at=dish.started_at,
                        completed_at=dish.completed_at,
                        total_response_time_ms=total_rt if total_rt else None,
                    )
                    db.add(score)
                await db.commit()
        except Exception:
            logger.exception("Failed to save cooking dish scores for %s", self.participant_id)
