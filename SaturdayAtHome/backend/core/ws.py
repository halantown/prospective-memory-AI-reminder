"""WebSocket event hub — queue management and event broadcasting."""

import asyncio
import logging
import time
from typing import Any

from starlette.websockets import WebSocket, WebSocketDisconnect

from core.config_loader import get_config
from models.entities import HobStatus
from services.hob_service import get_session_hobs, reconcile_hob

logger = logging.getLogger("saturday.ws")

# Active WebSocket subscriber queues: session_id → list[asyncio.Queue]
ws_queues: dict[str, list[asyncio.Queue]] = {}
_PUMP_IDLE_TIMEOUT_S = 5

# Sentinel value — pushed to queues on shutdown to unblock websocket pumps
_WS_SHUTDOWN = object()
_shutting_down = False


async def send_ws(session_id: str, event: str, data: dict):
    """Push an event to all connected WebSocket clients for one session.

    Special handling:
    - steak_spawn: reconciles hobs, reroutes to an empty hob when target is busy
    - trigger_appear: opens an execution window (GDD A1)
    - window_close: closes the execution window, records miss if not submitted
    """
    if _shutting_down:
        return

    if event == "steak_spawn":
        hobs = get_session_hobs(session_id)
        for hob in hobs:
            reconcile_hob(hob)

        requested_hob_id = data.get("hob_id", 0)
        target_hob_id = requested_hob_id if 0 <= requested_hob_id < len(hobs) else 0

        if hobs[target_hob_id].status != HobStatus.EMPTY:
            empty_hob_id = next(
                (idx for idx, hob in enumerate(hobs) if hob.status == HobStatus.EMPTY),
                None,
            )
            if empty_hob_id is None:
                logger.info(
                    f"WS [{session_id}] → steak_spawn hob={requested_hob_id} "
                    "SKIPPED (all hobs busy)"
                )
                return
            logger.info(
                f"WS [{session_id}] → steak_spawn rerouted {requested_hob_id} -> {empty_hob_id}"
            )
            target_hob_id = empty_hob_id

        dur = data.get("duration", {})
        steak_cfg = get_config().get("steak", {})
        base_times = steak_cfg.get("hob_base_cooking_ms", [11000, 13000, 15000])
        base_cooking = (
            base_times[target_hob_id]
            if target_hob_id < len(base_times)
            else 13000
        )

        hobs[target_hob_id].status = HobStatus.COOKING_SIDE1
        hobs[target_hob_id].started_at = time.time()
        hobs[target_hob_id].cooking_ms = dur.get("cooking", base_cooking)
        hobs[target_hob_id].ready_ms = dur.get("ready", steak_cfg.get("ready_ms", 4000))
        hobs[target_hob_id].ash_ms = steak_cfg.get("ash_countdown_ms", 9000)
        hobs[target_hob_id].peppered = False
        data = {**data, "hob_id": target_hob_id}

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

    logger.info(f"WS [{session_id}] → {event}: {data}")

    if session_id not in ws_queues:
        return

    payload = {"event": event, "data": data, "ts": time.time()}
    for q in list(ws_queues.get(session_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def register_ws_client(session_id: str) -> asyncio.Queue:
    """Register a new WS subscriber queue for this session."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    if session_id not in ws_queues:
        ws_queues[session_id] = []
    ws_queues[session_id].append(queue)
    return queue


def unregister_ws_client(session_id: str, queue: asyncio.Queue):
    """Remove a WS subscriber queue."""
    if session_id in ws_queues and queue in ws_queues[session_id]:
        ws_queues[session_id].remove(queue)
    logger.info(f"WS disconnect [{session_id}]")


async def websocket_pump(session_id: str, queue: asyncio.Queue, websocket: WebSocket):
    """Forward queued events to an accepted websocket connection.

    Sends a keepalive event every few seconds when idle.
    """
    try:
        while not _shutting_down:
            try:
                payload: Any = await asyncio.wait_for(queue.get(), timeout=_PUMP_IDLE_TIMEOUT_S)
                if payload is _WS_SHUTDOWN:
                    break
            except asyncio.TimeoutError:
                payload = {"event": "keepalive", "data": {}, "ts": time.time()}
            await websocket.send_json(payload)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except asyncio.CancelledError:
        pass
    finally:
        unregister_ws_client(session_id, queue)


def shutdown_all_ws_queues():
    """Signal every connected WS client pump to stop. Called during shutdown."""
    global _shutting_down
    _shutting_down = True
    for queues in ws_queues.values():
        for q in queues:
            try:
                q.put_nowait(_WS_SHUTDOWN)
            except asyncio.QueueFull:
                pass
    logger.info("WS: shutdown sentinel pushed to all queues")


def clear_session_ws_queues(session_id: str):
    """Remove all WS queues for a session (on delete)."""
    ws_queues.pop(session_id, None)
