"""Admin & dashboard endpoints."""

import asyncio
import json
import logging
import time

from fastapi import APIRouter, HTTPException, WebSocket
from starlette.websockets import WebSocketDisconnect

from core.config import DB_PATH, assign_group
from core.config_loader import get_latin_square
from core.database import get_db
from utils.helpers import log_action
from models.entities import HobStatus
from services.hob_service import get_session_hobs, reconcile_hob, clear_session_hobs, reset_session_hobs
from services.window_service import clear_session_windows, reset_session_windows
from models.schemas import FireEventRequest
from core.ws import send_ws, ws_queues, clear_session_ws_queues
from core.session_lifecycle import (
    broadcast_admin, register_admin_client, unregister_admin_client,
    _ADMIN_SHUTDOWN, next_participant_id, generate_token, SessionPhase,
    transition_phase, compute_session_timer_s,
)
import core.session_lifecycle as session_lifecycle

logger = logging.getLogger("saturday.routes.admin")
_ADMIN_STREAM_IDLE_TIMEOUT_S = 5

router = APIRouter(prefix="/admin")

ALLOWED_ADMIN_EVENTS = {
    "block_start",
    "trigger_appear",
    "window_close",
    "reminder_fire",
    "block_end",
    "force_steak_ready",
    "force_yellow_steak",
    "robot_neutral",
    "steak_spawn",
    "message_bubble",
    "fake_trigger_fire",
    "plant_needs_water",
}


@router.post("/participant/create")
async def create_participant():
    """Experimenter creates a pre-registered participant slot.

    Auto-assigns participant_id (P001, P002...), Latin Square group,
    and a random 6-char token. Returns token for distribution to participant.
    The session starts in CREATED phase and waits for the participant to enter the token.
    """
    import uuid

    db = get_db(DB_PATH)
    pid = next_participant_id(db)
    group = assign_group()
    token = generate_token(db)
    condition_order = get_latin_square()[group]
    session_id = str(uuid.uuid4())[:8]

    db.execute(
        """INSERT INTO sessions
           (session_id, participant_id, latin_square_group, condition_order, phase,
            token, current_block, is_interrupted, created_at)
           VALUES (?, ?, ?, ?, 'created', ?, -1, 0, ?)""",
        (session_id, pid, group, json.dumps(condition_order), token, time.time()),
    )
    db.execute(
        """INSERT INTO session_events
           (session_id, event_type, from_phase, to_phase, block_idx, payload, ts)
           VALUES (?, 'participant_created', NULL, 'created', NULL, '{}', ?)""",
        (session_id, time.time()),
    )
    db.commit()
    db.close()

    broadcast_admin({
        "session_id": session_id,
        "participant_id": pid,
        "group": group,
        "event_type": "participant_created",
        "token": token,
        "timestamp": time.time(),
    })

    logger.info(f"Participant created: {pid} (session={session_id}, group={group}, token={token})")
    return {"participant_id": pid, "group": group, "token": token, "session_id": session_id}


@router.websocket("/stream")
async def admin_stream(websocket: WebSocket):
    """WebSocket stream for Dashboard lifecycle/admin events."""
    await websocket.accept()
    q = register_admin_client()
    try:
        await websocket.send_json({"event_type": "keepalive", "ts": time.time()})
        while not session_lifecycle._admin_shutdown:
            try:
                event = await asyncio.wait_for(q.get(), timeout=_ADMIN_STREAM_IDLE_TIMEOUT_S)
                if event is _ADMIN_SHUTDOWN:
                    break
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                await websocket.send_json({"event_type": "keepalive", "ts": time.time()})
    except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
        pass
    finally:
        unregister_admin_client(q)


@router.post("/fire-event")
async def admin_fire_event(req: FireEventRequest):
    """Manually fire an event to a session (from dashboard)."""
    if req.event not in ALLOWED_ADMIN_EVENTS:
        raise HTTPException(400, f"Event '{req.event}' not in allowed list: {sorted(ALLOWED_ADMIN_EVENTS)}")

    logger.info(f"Admin fire [{req.session_id}] → {req.event}: {req.data}")
    await send_ws(req.session_id, req.event, req.data)

    # Update backend hob state for force_yellow events
    if req.event == "force_yellow_steak":
        hobs = get_session_hobs(req.session_id)
        hob_id = req.data.get("hob_id", 0)
        if 0 <= hob_id < len(hobs):
            hobs[hob_id].status = HobStatus.READY_SIDE1
            hobs[hob_id].started_at = time.time()

    log_action(req.session_id, 0, f"admin_{req.event}", req.data)

    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO session_events
           (session_id, event_type, from_phase, to_phase, block_idx, payload, ts)
           VALUES (?, 'admin_fire', NULL, NULL, NULL, ?, ?)""",
        (req.session_id, json.dumps({"event": req.event, **req.data}), time.time()),
    )
    db.commit()
    db.close()

    broadcast_admin({
        "event_type": "admin_fire",
        "session_id": req.session_id,
        "fired": req.event,
        "timestamp": time.time(),
    })

    return {"status": "ok"}


@router.post("/force-block/{session_id}/{block_num}")
async def admin_force_block(session_id: str, block_num: int):
    """Force-start a specific block timeline for a session (admin override)."""
    from routes.session import active_timelines
    from core.timeline import BlockTimeline

    if block_num < 1 or block_num > 4:
        raise HTTPException(400, "block_num must be 1-4")

    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Session not found")

    condition_order = json.loads(row["condition_order"])
    condition = condition_order[block_num - 1]

    timeline_key = f"{session_id}_{block_num}"
    if timeline_key in active_timelines:
        active_timelines[timeline_key].cancel()
        del active_timelines[timeline_key]

    reset_session_hobs(session_id)
    reset_session_windows(session_id)

    tl = BlockTimeline(session_id, block_num, condition, send_ws)
    active_timelines[timeline_key] = tl
    tl._task = asyncio.create_task(tl.run())

    logger.info(f"Admin: force-started block {block_num} for session {session_id} (condition={condition})")
    log_action(session_id, block_num, "admin_force_block", {"block_num": block_num, "condition": condition})
    return {"status": "ok", "block_num": block_num, "condition": condition}


@router.get("/sessions")
async def admin_list_sessions():
    """List all sessions."""
    db = get_db(DB_PATH)
    rows = db.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.get("/session/{session_id}/state")
async def admin_session_state(session_id: str):
    """Get live session state (hobs, WS clients, timelines)."""
    from routes.session import active_timelines

    hobs = get_session_hobs(session_id)
    for h in hobs:
        reconcile_hob(h)
    db = get_db(DB_PATH)
    srow = db.execute(
        "SELECT is_online, timer_started_at, timer_running_since, timer_elapsed_s "
        "FROM sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    db.close()
    timer_s = compute_session_timer_s(srow, time.time()) if srow else 0.0

    return {
        "hobs": [
            {"id": h.id, "status": h.status.value, "started_at": h.started_at,
             "cooking_ms": h.cooking_ms, "ready_ms": h.ready_ms, "ash_ms": h.ash_ms,
             "peppered": h.peppered}
            for h in hobs
        ],
        "active_timelines": [k for k in active_timelines.keys() if k.startswith(session_id)],
        "ws_clients": len(ws_queues.get(session_id, [])),
        "is_online": bool(srow["is_online"]) if srow else False,
        "timer_started_at": srow["timer_started_at"] if srow else None,
        "session_timer_s": timer_s,
    }


@router.get("/logs/{session_id}")
async def admin_get_logs(session_id: str):
    """Get action logs for a session (most recent first)."""
    db = get_db(DB_PATH)
    rows = db.execute(
        "SELECT * FROM action_logs WHERE session_id = ? ORDER BY ts DESC LIMIT 100",
        (session_id,),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.get("/active-session")
async def admin_active_session():
    """Find the currently active session.

    Returns the session that has live WS clients connected, if any.
    Falls back to the most recent non-finished, non-interrupted session from the DB
    so the experimenter can see an in-progress session after a dashboard reload —
     but marks it as ``live: false`` so the frontend knows not to auto-connect WS.
    Returns null if no meaningful session exists.
    """
    db = get_db(DB_PATH)
    row = db.execute(
        "SELECT * FROM sessions WHERE is_online = 1 ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    if row:
        db.close()
        return {**dict(row), "live": True}
    row = db.execute(
        "SELECT * FROM sessions WHERE phase NOT IN ('finished') AND is_interrupted = 0"
        " ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    db.close()
    return {**dict(row), "live": False} if row else None


@router.delete("/session/{session_id}")
async def admin_delete_session(session_id: str):
    """Delete a session and all its data."""
    from routes.session import active_timelines, participant_ws_counts

    db = get_db(DB_PATH)
    db.execute("DELETE FROM action_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM pm_trials WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM encoding_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM ongoing_snapshots WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM fake_trigger_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM session_events WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    db.commit()
    db.close()

    clear_session_hobs(session_id)
    clear_session_ws_queues(session_id)
    clear_session_windows(session_id)
    participant_ws_counts.pop(session_id, None)

    for k in list(active_timelines.keys()):
        if k.startswith(session_id):
            active_timelines[k].cancel()
            del active_timelines[k]

    logger.info(f"Admin: deleted session {session_id}")
    return {"status": "ok"}


@router.get("/export/{session_id}")
async def admin_export_session(session_id: str):
    """Export session data as JSON."""
    db = get_db(DB_PATH)
    session = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    actions = db.execute("SELECT * FROM action_logs WHERE session_id = ? ORDER BY ts", (session_id,)).fetchall()
    pm_trials = db.execute("SELECT * FROM pm_trials WHERE session_id = ?", (session_id,)).fetchall()
    events = db.execute("SELECT * FROM session_events WHERE session_id = ? ORDER BY ts", (session_id,)).fetchall()
    db.close()
    return {
        "session": dict(session) if session else None,
        "actions": [dict(r) for r in actions],
        "pm_trials": [dict(r) for r in pm_trials],
        "session_events": [dict(r) for r in events],
    }
