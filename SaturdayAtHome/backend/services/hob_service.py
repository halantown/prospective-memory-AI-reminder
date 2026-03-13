"""Hob (stove) state management — in-memory state for active cooking sessions."""

import asyncio
import logging
import random
import time

from core.config_loader import get_config
from models.entities import Hob, HobStatus

logger = logging.getLogger("saturday.services.hob")

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


def reset_session_hobs(session_id: str):
    """Reset all hobs to EMPTY for a new block (keeps the session entry)."""
    _session_hobs[session_id] = [Hob(id=i) for i in range(3)]
    logger.info(f"Hobs reset to EMPTY [{session_id}]")


def reconcile_hob(hob: Hob):
    """Update hob status based on elapsed time — multi-step steak state machine.

    States: EMPTY → COOKING_SIDE1 → READY_SIDE1 → COOKING_SIDE2 → READY_SIDE2 → (served)
    Missed flips lead to BURNING → ASH.
    """
    if hob.status == HobStatus.EMPTY or hob.status == HobStatus.ASH or hob.started_at <= 0:
        return

    elapsed_ms = (time.time() - hob.started_at) * 1000

    if hob.status == HobStatus.COOKING_SIDE1:
        if elapsed_ms >= hob.cooking_ms + hob.ready_ms:
            hob.status = HobStatus.BURNING
            hob.started_at = time.time()  # start ash countdown from now
        elif elapsed_ms >= hob.cooking_ms:
            hob.status = HobStatus.READY_SIDE1
            hob.started_at = hob.started_at + hob.cooking_ms / 1000.0
    elif hob.status == HobStatus.READY_SIDE1:
        if elapsed_ms >= hob.ready_ms:
            hob.status = HobStatus.BURNING
            hob.started_at = time.time()
    elif hob.status == HobStatus.COOKING_SIDE2:
        if elapsed_ms >= hob.cooking_ms + hob.ready_ms:
            hob.status = HobStatus.BURNING
            hob.started_at = time.time()
        elif elapsed_ms >= hob.cooking_ms:
            hob.status = HobStatus.READY_SIDE2
            hob.started_at = hob.started_at + hob.cooking_ms / 1000.0
    elif hob.status == HobStatus.READY_SIDE2:
        if elapsed_ms >= hob.ready_ms:
            hob.status = HobStatus.BURNING
            hob.started_at = time.time()
    elif hob.status == HobStatus.BURNING:
        if elapsed_ms >= hob.ash_ms:
            hob.status = HobStatus.ASH
            hob.started_at = time.time()


async def schedule_respawn(session_id: str, block_num: int, hob_id: int, send_sse_fn):
    """Wait then send steak_spawn SSE if the hob is still empty.

    Called after serve/clean actions to keep steaks flowing.
    The send_sse_fn parameter avoids circular imports with sse.py.
    """
    cfg = get_config().get("steak", {})
    min_delay = cfg.get("respawn_min_ms", 8000) / 1000
    max_delay = cfg.get("respawn_max_ms", 15000) / 1000
    delay = min_delay + random.random() * (max_delay - min_delay)
    logger.info(f"Respawn scheduled [{session_id}] hob={hob_id} in {delay:.1f}s")
    await asyncio.sleep(delay)

    hobs = get_session_hobs(session_id)
    if hob_id < len(hobs) and hobs[hob_id].status == HobStatus.EMPTY:
        base_times = cfg.get("hob_base_cooking_ms", [11000, 13000, 15000])
        jitter = cfg.get("cooking_jitter_ms", 1000)
        base_cooking = base_times[hob_id] if hob_id < len(base_times) else 13000
        cooking = base_cooking + random.randint(-jitter, jitter)
        ready = cfg.get("ready_ms", 4000)
        dur = {"cooking": cooking, "ready": ready}
        await send_sse_fn(session_id, "steak_spawn", {"hob_id": hob_id, "duration": dur})
        logger.info(f"Respawned steak [{session_id}] hob={hob_id}")
