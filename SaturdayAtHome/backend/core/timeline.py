"""Block timeline runtime for PRD v2.0 state-driven simulation."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Callable, Coroutine, List

from core.block_scheduler import derive_seed, generate_block_schedule
from core.config import DB_PATH
from core.database import get_db
from core.event_schedule import AUDITED_EVENT_TYPES, SSE_EVENT_MAP, EventType, ScheduledEvent
from core.session_lifecycle import SessionPhase, transition_phase

logger = logging.getLogger("saturday.timeline")


def _persist_schedule(session_id: str, block_num: int, seed: int, events: List[ScheduledEvent]):
    """Write audited events to block_events before block execution."""
    now = time.time()
    rows = [
        (
            session_id,
            block_num,
            e.event_type.value,
            e.t,
            None,
            1 if e.is_fixed else 0,
            json.dumps(e.payload),
            seed,
            now,
        )
        for e in events
        if e.event_type in AUDITED_EVENT_TYPES
    ]

    if not rows:
        return

    db = get_db(DB_PATH)
    db.executemany(
        """INSERT INTO block_events
           (session_id, block_num, event_type, scheduled_t, actual_t, is_fixed, payload, seed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    db.commit()
    db.close()


def _update_actual_t(session_id: str, block_num: int, event_type: EventType, actual_t: float):
    """Back-fill actual dispatch time for the first pending audited event row."""
    db = get_db(DB_PATH)
    db.execute(
        """UPDATE block_events
           SET actual_t = ?
           WHERE id = (
               SELECT id FROM block_events
               WHERE session_id = ? AND block_num = ? AND event_type = ? AND actual_t IS NULL
               ORDER BY id
               LIMIT 1
           )""",
        (actual_t, session_id, block_num, event_type.value),
    )
    db.commit()
    db.close()


def _session_meta(session_id: str) -> dict:
    db = get_db(DB_PATH)
    row = db.execute(
        "SELECT participant_id, latin_square_group FROM sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    db.close()
    return dict(row) if row else {"participant_id": None, "latin_square_group": None}


def _ensure_trial_row(session_id: str, block_num: int, slot: str, task_id: str, condition: str):
    db = get_db(DB_PATH)
    row = db.execute(
        "SELECT id FROM pm_trials WHERE session_id = ? AND block_number = ? AND task_slot = ?",
        (session_id, block_num, slot),
    ).fetchone()

    if not row:
        meta = _session_meta(session_id)
        db.execute(
            """INSERT INTO pm_trials
               (participant_id, session_id, block_number, task_slot, task_id, condition, participant_group, pm_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                meta.get("participant_id"),
                session_id,
                block_num,
                slot,
                task_id,
                condition,
                meta.get("latin_square_group"),
            ),
        )
    else:
        db.execute(
            """UPDATE pm_trials
               SET task_id = COALESCE(task_id, ?), condition = COALESCE(condition, ?)
               WHERE session_id = ? AND block_number = ? AND task_slot = ?""",
            (task_id, condition, session_id, block_num, slot),
        )

    db.commit()
    db.close()


def _record_trial_event(session_id: str, block_num: int, condition: str, event: ScheduledEvent, wall_ts: float):
    payload = event.payload or {}
    slot = payload.get("slot")
    task_id = payload.get("task_id")

    if not slot or not task_id:
        return

    _ensure_trial_row(session_id, block_num, str(slot), str(task_id), condition)

    db = get_db(DB_PATH)
    if event.event_type == EventType.REMINDER:
        db.execute(
            """UPDATE pm_trials
               SET reminder_played_at = ?,
                   reminder_text = ?,
                   reminder_source = ?,
                   reminder_room = ?,
                   reminder_activity = ?
               WHERE session_id = ? AND block_number = ? AND task_slot = ?""",
            (
                wall_ts,
                payload.get("full_text") or payload.get("text") or "",
                payload.get("source") or "live",
                payload.get("room"),
                payload.get("activity"),
                session_id,
                block_num,
                slot,
            ),
        )
    elif event.event_type == EventType.TRIGGER_WINDOW_OPEN:
        db.execute(
            """UPDATE pm_trials
               SET trigger_appeared_at = ?
               WHERE session_id = ? AND block_number = ? AND task_slot = ?""",
            (wall_ts, session_id, block_num, slot),
        )

    db.commit()
    db.close()


class BlockTimeline:
    """Manages one block's event dispatch loop."""

    def __init__(self, session_id: str, block_num: int, condition: str,
                 send_fn: Callable[..., Coroutine]):
        self.session_id = session_id
        self.block_num = block_num
        self.condition = condition
        self.send_fn = send_fn
        self.seed = derive_seed(session_id, block_num)
        self.schedule: List[ScheduledEvent] = generate_block_schedule(block_num, condition, self.seed)
        self._cancelled = False
        self._task: asyncio.Task | None = None

        self.current_room = "kitchen"
        self.current_activity = "recipe_following"

        _persist_schedule(session_id, block_num, self.seed, self.schedule)

    def _mark_block_started(self):
        db = get_db(DB_PATH)
        try:
            try:
                transition_phase(db, self.session_id, SessionPhase.BLOCK, block_idx=self.block_num)
            except Exception:
                db.execute(
                    "UPDATE sessions SET phase = ?, current_block = ?, is_interrupted = 0 WHERE session_id = ?",
                    (SessionPhase.BLOCK.value, self.block_num, self.session_id),
                )
                db.commit()
        finally:
            db.close()

    def _mark_block_finished(self):
        db = get_db(DB_PATH)
        try:
            target_phase = SessionPhase.FINISHED if self.block_num >= 4 else SessionPhase.INTER_BLOCK
            try:
                transition_phase(db, self.session_id, target_phase, block_idx=self.block_num)
            except Exception:
                updates = ["phase = ?", "current_block = ?"]
                values = [target_phase.value, self.block_num]
                if target_phase == SessionPhase.FINISHED:
                    updates.append("completed_at = ?")
                    values.append(time.time())
                values.append(self.session_id)
                db.execute(
                    f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ?",
                    tuple(values),
                )
                db.commit()
        finally:
            db.close()

    async def run(self):
        self._mark_block_started()
        block_start = time.monotonic()

        for event in self.schedule:
            if self._cancelled:
                break

            wait_s = event.t - (time.monotonic() - block_start)
            if wait_s > 0:
                try:
                    await asyncio.sleep(wait_s)
                except asyncio.CancelledError:
                    break

            if self._cancelled:
                break

            if event.event_type == EventType.ROOM_TRANSITION:
                self.current_room = str(event.payload.get("room", self.current_room))
                self.current_activity = str(event.payload.get("activity", self.current_activity))

            sse_name = SSE_EVENT_MAP.get(event.event_type)
            if sse_name is None:
                continue

            actual_t = time.monotonic() - block_start
            event.dispatched = True
            event.dispatched_at = actual_t

            logger.info(
                "Timeline [%s] t=%.1fs (actual=%.1fs) -> %s",
                self.session_id,
                event.t,
                actual_t,
                sse_name,
            )
            await self.send_fn(self.session_id, sse_name, event.payload)

            if event.event_type in AUDITED_EVENT_TYPES:
                _update_actual_t(self.session_id, self.block_num, event.event_type, actual_t)

            if event.event_type in {EventType.REMINDER, EventType.TRIGGER_WINDOW_OPEN}:
                _record_trial_event(self.session_id, self.block_num, self.condition, event, time.time())

        if not self._cancelled:
            self._mark_block_finished()

    def cancel(self):
        self._cancelled = True
        if self._task and not self._task.done():
            self._task.cancel()
