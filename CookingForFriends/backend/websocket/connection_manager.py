"""WebSocket connection manager — handles game and admin connections."""

import asyncio
import json
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
from typing import Callable

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per participant."""

    def __init__(self):
        # participant_id -> list of (websocket, queue)
        self._connections: dict[str, list[tuple[WebSocket, asyncio.Queue]]] = {}
        # admin connections
        self._admin_connections: list[tuple[WebSocket, asyncio.Queue]] = []

    async def connect_participant(self, participant_id: str, ws: WebSocket):
        """Accept and register a participant WebSocket.

        Evicts any existing connections for this participant first so that
        only one active WS per participant exists at a time.  This prevents
        timeline events from being delivered multiple times when the frontend
        reconnects (race-condition accumulation).
        """
        await ws.accept()
        queue = asyncio.Queue(maxsize=256)

        # Evict stale connections for this participant
        old = self._connections.pop(participant_id, [])
        for old_ws, old_q in old:
            try:
                await old_ws.close(code=4001, reason="superseded")
            except Exception:
                pass
        if old:
            logger.info(f"Evicted {len(old)} old connection(s) for {participant_id}")

        self._connections[participant_id] = [(ws, queue)]
        logger.info(f"WS connected: participant {participant_id} (1 connection)")
        return queue

    def disconnect_participant(self, participant_id: str, ws: WebSocket):
        """Remove a participant connection."""
        if participant_id in self._connections:
            self._connections[participant_id] = [
                (w, q) for w, q in self._connections[participant_id] if w != ws
            ]
            if not self._connections[participant_id]:
                del self._connections[participant_id]
        logger.info(f"WS disconnected: participant {participant_id}")

    async def send_to_participant(self, participant_id: str, event_type: str, data: dict):
        """Push an event to all connections for a participant."""
        msg = json.dumps({"event": event_type, "data": data, "server_ts": time.time()})
        if participant_id not in self._connections:
            logger.warning(f"[CM] No connections for participant {participant_id}, dropping {event_type}")
            return
        # Critical events must not be silently dropped
        critical = event_type in ('pm_trigger', 'block_end', 'pm_received', 'ongoing_task_event')
        conn_count = len(self._connections[participant_id])
        logger.debug(f"[CM] Sending {event_type} to {participant_id} ({conn_count} connections)")
        for ws, queue in self._connections[participant_id]:
            try:
                if critical:
                    await queue.put(msg)
                else:
                    queue.put_nowait(msg)
            except asyncio.QueueFull:
                logger.warning(f"Queue full for {participant_id}, dropping non-critical event {event_type}")

    async def broadcast_admin(self, data: dict):
        """Broadcast to all admin connections."""
        msg = json.dumps({"event": "admin_update", "data": data, "server_ts": time.time()})
        for ws, queue in self._admin_connections:
            try:
                await queue.put(msg)
            except asyncio.QueueFull:
                pass

    async def connect_admin(self, ws: WebSocket):
        """Accept and register an admin WebSocket."""
        await ws.accept()
        queue = asyncio.Queue(maxsize=256)
        self._admin_connections.append((ws, queue))
        logger.info(f"Admin WS connected (total: {len(self._admin_connections)})")
        return queue

    def disconnect_admin(self, ws: WebSocket):
        """Remove an admin connection."""
        self._admin_connections = [(w, q) for w, q in self._admin_connections if w != ws]
        logger.info("Admin WS disconnected")

    def get_participant_ids(self) -> list[str]:
        """Return list of currently connected participant IDs."""
        return list(self._connections.keys())


# Global singleton
manager = ConnectionManager()


async def ws_pump(queue: asyncio.Queue, ws: WebSocket):
    """Forward queued messages to a WebSocket. Sends keepalive every 5s."""
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=5.0)
                await ws.send_text(msg)
            except asyncio.TimeoutError:
                # Keepalive
                await ws.send_text(json.dumps({"event": "keepalive", "data": {}}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS pump ended: {type(e).__name__}: {e}")
