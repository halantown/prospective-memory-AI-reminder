"""Hob (stove) state tracking — in-memory state for active cooking sessions."""

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from enum import Enum

from config import DIFFICULTY_CONFIG

logger = logging.getLogger("saturday.hobs")


class HobStatus(str, Enum):
    EMPTY = "empty"
    COOKING = "cooking"
    READY = "ready"
    BURNING = "burning"


@dataclass
class Hob:
    id: int
    status: HobStatus = HobStatus.EMPTY
    started_at: float = 0.0
    cooking_ms: float = 18000
    ready_ms: float = 6000


# Per-session hob state (in-memory, not persisted)
_session_hobs: dict[str, list[Hob]] = {}


def get_session_hobs(session_id: str) -> list[Hob]:
    """Get or create the 3-hob array for a session."""
    if session_id not in _session_hobs:
        _session_hobs[session_id] = [Hob(id=i) for i in range(3)]
    return _session_hobs[session_id]


def clear_session_hobs(session_id: str):
    """Remove hob state for a session (on delete)."""
    _session_hobs.pop(session_id, None)


def reconcile_hob(hob: Hob):
    """Update hob status based on elapsed time — keeps backend in sync with frontend.

    Uses cascading check: if total elapsed > cooking + ready, go straight to BURNING.
    This prevents the bug where COOKING→READY and READY→BURNING both fire in the same tick.
    """
    if hob.status == HobStatus.EMPTY or hob.started_at <= 0:
        return

    elapsed_ms = (time.time() - hob.started_at) * 1000

    if hob.status == HobStatus.COOKING and elapsed_ms >= hob.cooking_ms:
        if elapsed_ms >= hob.cooking_ms + hob.ready_ms:
            hob.status = HobStatus.BURNING
            hob.started_at = 0.0
        else:
            hob.status = HobStatus.READY
            hob.started_at = hob.started_at + hob.cooking_ms / 1000.0
    elif hob.status == HobStatus.READY and elapsed_ms >= hob.ready_ms:
        hob.status = HobStatus.BURNING
        hob.started_at = 0.0


async def schedule_respawn(session_id: str, block_num: int, hob_id: int, send_sse_fn):
    """Wait 15-25s then send steak_spawn SSE if the hob is still empty.

    Called after serve/clean actions to keep steaks flowing.
    The send_sse_fn parameter avoids circular imports with sse.py.
    """
    delay = 15 + random.random() * 10
    logger.info(f"Respawn scheduled [{session_id}] hob={hob_id} in {delay:.1f}s")
    await asyncio.sleep(delay)

    hobs = get_session_hobs(session_id)
    if hob_id < len(hobs) and hobs[hob_id].status == HobStatus.EMPTY:
        cfg = DIFFICULTY_CONFIG.get("medium")
        dur = {"cooking": cfg["cooking_ms"], "ready": cfg["ready_ms"]}
        await send_sse_fn(session_id, "steak_spawn", {"hob_id": hob_id, "duration": dur})
        logger.info(f"Respawned steak [{session_id}] hob={hob_id}")
