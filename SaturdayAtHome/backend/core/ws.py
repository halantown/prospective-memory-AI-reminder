"""WebSocket event hub — queue management and event broadcasting."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from starlette.websockets import WebSocket, WebSocketDisconnect

from services.window_service import close_window, open_window

logger = logging.getLogger("saturday.ws")

# Active WS subscriber queues: session_id -> list[Queue]
ws_queues: dict[str, list[asyncio.Queue]] = {}

# Runtime state snapshot for dashboard/monitoring
session_runtime_state: dict[str, dict[str, Any]] = {}

_PUMP_IDLE_TIMEOUT_S = 5
_WS_SHUTDOWN = object()
_shutting_down = False


def get_runtime_state(session_id: str) -> dict[str, Any]:
    return session_runtime_state.get(session_id, {})


async def send_ws(session_id: str, event: str, data: dict):
    """Push an event to all connected WebSocket clients for one session."""
    if _shutting_down:
        return

    payload_data = dict(data or {})

    if event == "room_transition":
        session_runtime_state[session_id] = {
            **session_runtime_state.get(session_id, {}),
            "current_room": payload_data.get("room"),
            "current_activity": payload_data.get("activity"),
            "last_transition_at": time.time(),
            "last_narrative": payload_data.get("narrative"),
        }

    elif event == "trigger_appear":
        task_id = payload_data.get("task_id")
        window_ms = int(payload_data.get("window_ms", 30000) or 30000)
        if task_id:
            open_window(session_id, task_id, window_ms)

    elif event == "window_close":
        task_id = payload_data.get("task_id")
        if task_id:
            close_window(session_id, task_id, reason="missed")

    elif event in {"reminder_fire", "robot_speak"}:
        session_runtime_state[session_id] = {
            **session_runtime_state.get(session_id, {}),
            "last_robot_event": {
                "event": event,
                "text": payload_data.get("full_text") or payload_data.get("text"),
                "room": payload_data.get("room"),
                "activity": payload_data.get("activity"),
                "at": time.time(),
            },
        }

    logger.info(f"WS [{session_id}] -> {event}: {payload_data}")

    if session_id not in ws_queues:
        return

    payload = {"event": event, "data": payload_data, "ts": time.time()}
    for q in list(ws_queues.get(session_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def register_ws_client(session_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)
    if session_id not in ws_queues:
        ws_queues[session_id] = []
    ws_queues[session_id].append(queue)
    return queue


def unregister_ws_client(session_id: str, queue: asyncio.Queue):
    if session_id in ws_queues and queue in ws_queues[session_id]:
        ws_queues[session_id].remove(queue)
    logger.info(f"WS disconnect [{session_id}]")


async def websocket_pump(session_id: str, queue: asyncio.Queue, websocket: WebSocket):
    """Forward queued events to an accepted websocket connection."""
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
    ws_queues.pop(session_id, None)
    session_runtime_state.pop(session_id, None)
