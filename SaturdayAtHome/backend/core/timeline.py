"""Block timeline engine — sequential async runner over a ScheduledEvent list.

The full schedule is produced by block_scheduler.generate_block_schedule()
before the block starts.  This module owns the async dispatch loop that fires
each event at its scheduled wall-clock time and writes audit rows to the DB.
"""

import asyncio
import json
import logging
import time
from typing import Callable, Coroutine, List

from core.block_scheduler import derive_seed, generate_block_schedule
from core.config import DB_PATH
from core.database import get_db
from core.event_schedule import AUDITED_EVENT_TYPES, SSE_EVENT_MAP, EventType, ScheduledEvent

logger = logging.getLogger("saturday.timeline")


# ── Busy-window check ────────────────────────────────────────────────────────

def _is_busy(session_id: str) -> bool:
    """Return True when the kitchen is in a high-urgency moment.

    Currently checks whether any hob is BURNING (steak about to be lost).
    This gate is consulted before opening a PM trigger window so the
    participant is not overwhelmed.  Max delay is capped in the run loop.

    TODO: also check active laundry jams and unread message bubbles.
    """
    try:
        from models.entities import HobStatus
        from services.hob_service import get_session_hobs
        hobs = get_session_hobs(session_id)
        return any(h.status == HobStatus.BURNING for h in hobs)
    except Exception:
        return False


async def _wait_for_not_busy(session_id: str, timeout: float = 10.0):
    """Poll until kitchen is no longer busy, or timeout expires."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not _is_busy(session_id):
            return
        await asyncio.sleep(0.5)


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
               SELECT id FROM block_events
               WHERE session_id = ? AND block_num = ? AND event_type = ?
                 AND actual_t IS NULL
               ORDER BY id
               LIMIT 1
           )""",
        (actual_t, session_id, block_num, event_type.value),
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
                 send_fn: Callable[..., Coroutine], difficulty: str = "medium"):
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

            # Busy-window gate: delay PM trigger opens if kitchen is hectic
            if event.event_type == EventType.TRIGGER_WINDOW_OPEN:
                if _is_busy(self.session_id):
                    logger.info(
                        f"Timeline [{self.session_id}] t={event.t:.1f}s "
                        f"TRIGGER_WINDOW_OPEN delayed (busy kitchen)"
                    )
                    await _wait_for_not_busy(self.session_id, timeout=10.0)

            # Translate to pushed event name
            sse_name = SSE_EVENT_MAP.get(event.event_type)
            if sse_name is None:
                continue  # internal marker, not dispatched

            actual_t = time.monotonic() - block_start
            event.dispatched = True
            event.dispatched_at = actual_t

            logger.info(
                f"Timeline [{self.session_id}] t={event.t:.1f}s "
                f"(actual={actual_t:.1f}s) → {sse_name}"
            )
            await self.send_fn(self.session_id, sse_name, event.payload)

            # Back-fill actual dispatch time for audited events
            if event.event_type in AUDITED_EVENT_TYPES:
                _update_actual_t(self.session_id, self.block_num, event.event_type, actual_t)

    def cancel(self):
        self._cancelled = True
        if self._task and not self._task.done():
            self._task.cancel()
