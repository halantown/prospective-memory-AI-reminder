"""SSE (Server-Sent Events) — queue management and event broadcasting."""

import asyncio
import json
import logging
import time

from core.config_loader import get_difficulty
from models.entities import HobStatus, Hob
from services.hob_service import get_session_hobs, reconcile_hob

logger = logging.getLogger("saturday.sse")

# Active SSE connections: session_id → list[asyncio.Queue]
sse_queues: dict[str, list[asyncio.Queue]] = {}


async def send_sse(session_id: str, event: str, data: dict):
    """Push an SSE event to all connected clients for this session.

    Special handling:
    - steak_spawn: reconciles hob state, only spawns on empty hobs
    - trigger_appear: opens an execution window (GDD A1)
    - window_close: closes the execution window, records miss if not submitted
    """
    if event == "steak_spawn":
        hobs = get_session_hobs(session_id)
        hob_id = data.get("hob_id", 0)
        if 0 <= hob_id < len(hobs):
            reconcile_hob(hobs[hob_id])
            if hobs[hob_id].status != HobStatus.EMPTY:
                logger.info(
                    f"SSE [{session_id}] → steak_spawn hob={hob_id} "
                    f"SKIPPED (status={hobs[hob_id].status.value})"
                )
                return
            dur = data.get("duration", {})
            hobs[hob_id].status = HobStatus.COOKING
            hobs[hob_id].started_at = time.time()
            hobs[hob_id].cooking_ms = dur.get("cooking", get_difficulty()["cooking_ms"])
            hobs[hob_id].ready_ms = dur.get("ready", get_difficulty()["ready_ms"])

    elif event == "trigger_appear":
        from services.window_service import open_window
        task_id = data.get("task_id")
        window_ms = data.get("window_ms", 30000)
        if task_id:
            open_window(session_id, task_id, window_ms)

    elif event == "window_close":
        from services.window_service import close_window
        task_id = data.get("task_id")
        if task_id:
            close_window(session_id, task_id, reason="missed")

    logger.info(f"SSE [{session_id}] → {event}: {data}")

    if session_id not in sse_queues:
        return

    payload = {"event": event, "data": data, "ts": time.time()}
    for q in sse_queues[session_id]:
        await q.put(payload)


def register_client(session_id: str) -> asyncio.Queue:
    """Register a new SSE client and return its queue."""
    queue: asyncio.Queue = asyncio.Queue()
    if session_id not in sse_queues:
        sse_queues[session_id] = []
    sse_queues[session_id].append(queue)
    return queue


def unregister_client(session_id: str, queue: asyncio.Queue):
    """Remove an SSE client queue."""
    if session_id in sse_queues and queue in sse_queues[session_id]:
        sse_queues[session_id].remove(queue)
    logger.info(f"SSE disconnect [{session_id}]")


async def event_generator(session_id: str, queue: asyncio.Queue):
    """Async generator that yields SSE-formatted strings from a queue.

    Sends a keepalive every 30s to prevent connection timeout.
    """
    try:
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"event: {payload['event']}\ndata: {json.dumps(payload['data'])}\n\n"
            except asyncio.TimeoutError:
                yield "event: keepalive\ndata: {}\n\n"
    except asyncio.CancelledError:
        pass
    except GeneratorExit:
        pass
    finally:
        unregister_client(session_id, queue)


def clear_session_queues(session_id: str):
    """Remove all SSE queues for a session (on delete)."""
    sse_queues.pop(session_id, None)
