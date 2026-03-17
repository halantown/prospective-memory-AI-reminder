"""Block timeline engine — sequential async runner over a ScheduledEvent list.

PRD v2.1: Simplified — no hob busy-window gate. The full schedule is produced
by block_scheduler.generate_block_schedule() before the block starts.
This module owns the async dispatch loop that fires each event at its
scheduled wall-clock time and writes audit rows to the DB.
"""

import asyncio
import json
import logging
import time
from typing import Callable, Coroutine, List

from core.block_scheduler import derive_seed, generate_block_schedule
from core.config import DB_PATH
from core.database import get_db
from core.event_schedule import AUDITED_EVENT_TYPES, WS_EVENT_MAP, EventType, ScheduledEvent

logger = logging.getLogger("saturday.timeline")


# ── DB persistence ───────────────────────────────────────────────────────────

def _persist_schedule(session_id: str, block_num: int, seed: int,
                      events: List[ScheduledEvent]):
    """Write all audited events to block_events before the block runs."""
    now = time.time()
    rows = [
        (
            session_id, block_num, e.event_type.value,
            e.t, None, 1 if e.is_fixed else 0,
            json.dumps(e.payload), seed, now,
        )
        for e in events
        if e.event_type in AUDITED_EVENT_TYPES
    ]
    if not rows:
        return
    db = get_db(DB_PATH)
    db.executemany(
        """INSERT INTO block_events
           (session_id, block_num, event_type, scheduled_t, actual_t,
            is_fixed, payload, seed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    db.commit()
    db.close()
    logger.info(f"block_events: persisted {len(rows)} audited events for [{session_id}] block={block_num}")


def _update_actual_t(session_id: str, block_num: int,
                     event_type: EventType, actual_t: float):
    """Back-fill actual_t for a dispatched audited event."""
    db = get_db(DB_PATH)
    db.execute(
        """UPDATE block_events
           SET actual_t = ?
           WHERE id = (
               SELECT id FROM (
                   SELECT id FROM block_events
                   WHERE session_id = ? AND block_num = ? AND event_type = ?
                     AND actual_t IS NULL
                   ORDER BY id
                   LIMIT 1
               ) AS tmp
           )""",
        (actual_t, session_id, block_num, event_type.value),
    )
    db.commit()
    db.close()


def _precreate_pm_trial_rows(session_id: str, block_num: int, condition: str,
                              schedule: List[ScheduledEvent]):
    """Pre-create pm_trials rows when block starts so later WS handlers can UPDATE them."""
    db = get_db(DB_PATH)
    # Find group for this session
    row = db.execute(
        "SELECT latin_square_group FROM sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    group = row["latin_square_group"] if row else None

    for ev in schedule:
        if ev.event_type == EventType.REMINDER_FIRE:
            task_id = ev.payload.get("task_id", "")
            slot = ev.payload.get("slot", "?")
            text = ev.payload.get("text", "")
            activity = ev.payload.get("activity_context", "")

            # Check if already exists
            existing = db.execute(
                "SELECT id FROM pm_trials WHERE session_id = ? AND block_number = ? AND task_slot = ?",
                (session_id, block_num, slot),
            ).fetchone()
            if existing:
                continue

            db.execute(
                """INSERT INTO pm_trials
                   (session_id, block_number, task_slot, task_id, `condition`,
                    participant_group, reminder_text, reminder_activity_context)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (session_id, block_num, slot, task_id, condition,
                 group, text, activity),
            )

    db.commit()
    db.close()


# ── BlockTimeline ────────────────────────────────────────────────────────────

class BlockTimeline:
    """Manages the async execution of one block's event schedule.

    The schedule is generated once in __init__ and the seed is stored so
    it can be replayed.  run() iterates events sequentially, sleeping until
    each event's scheduled time then dispatching via send_fn.
    """

    def __init__(self, session_id: str, block_num: int, condition: str,
                 send_fn: Callable[..., Coroutine]):
        self.session_id = session_id
        self.block_num = block_num
        self.condition = condition
        self.send_fn = send_fn
        self.seed = derive_seed(session_id, block_num)
        self.schedule: List[ScheduledEvent] = generate_block_schedule(
            block_num, condition, self.seed
        )
        self._cancelled = False
        self._task: asyncio.Task | None = None

        # Persist the audited subset immediately (before run())
        _persist_schedule(session_id, block_num, self.seed, self.schedule)
        # Pre-create pm_trials rows
        _precreate_pm_trial_rows(session_id, block_num, condition, self.schedule)

    async def run(self):
        block_start = time.monotonic()

        for event in self.schedule:
            if self._cancelled:
                break

            # Sleep until this event's scheduled time
            wait = event.t - (time.monotonic() - block_start)
            if wait > 0:
                try:
                    await asyncio.sleep(wait)
                except asyncio.CancelledError:
                    break

            if self._cancelled:
                break

            # Translate to pushed event name
            ws_name = WS_EVENT_MAP.get(event.event_type)
            if ws_name is None:
                continue  # internal marker, not dispatched

            actual_t = time.monotonic() - block_start
            event.dispatched = True
            event.dispatched_at = actual_t

            logger.info(
                f"Timeline [{self.session_id}] t={event.t:.1f}s "
                f"(actual={actual_t:.1f}s) → {ws_name}"
            )
            await self.send_fn(self.session_id, ws_name, event.payload)

            # Update reminder_played_at in pm_trials
            if event.event_type == EventType.REMINDER_FIRE:
                self._update_reminder_time(event)
            elif event.event_type == EventType.TRIGGER_FIRE:
                self._update_trigger_time(event)

            # Back-fill actual dispatch time for audited events
            if event.event_type in AUDITED_EVENT_TYPES:
                _update_actual_t(self.session_id, self.block_num, event.event_type, actual_t)

    def _update_reminder_time(self, event: ScheduledEvent):
        """Update pm_trials with actual reminder fire time."""
        try:
            db = get_db(DB_PATH)
            task_id = event.payload.get("task_id", "")
            db.execute(
                "UPDATE pm_trials SET reminder_played_at = ? "
                "WHERE session_id = ? AND task_id = ? AND reminder_played_at IS NULL",
                (time.time(), self.session_id, task_id),
            )
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Failed to update reminder time: {e}")

    def _update_trigger_time(self, event: ScheduledEvent):
        """Update pm_trials with actual trigger fire time."""
        try:
            db = get_db(DB_PATH)
            task_id = event.payload.get("task_id", "")
            db.execute(
                "UPDATE pm_trials SET trigger_fired_at = ? "
                "WHERE session_id = ? AND task_id = ? AND trigger_fired_at IS NULL",
                (time.time(), self.session_id, task_id),
            )
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Failed to update trigger time: {e}")

    def cancel(self):
        self._cancelled = True
        if self._task and not self._task.done():
            self._task.cancel()
