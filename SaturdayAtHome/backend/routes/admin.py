"""Admin & dashboard endpoints."""

import logging
import time

from fastapi import APIRouter

from core.config import DB_PATH
from core.database import get_db
from utils.helpers import log_action
from models.entities import HobStatus
from services.hob_service import get_session_hobs, reconcile_hob, clear_session_hobs
from services.window_service import clear_session_windows
from models.schemas import FireEventRequest
from core.sse import send_sse, sse_queues, clear_session_queues

logger = logging.getLogger("saturday.routes.admin")

router = APIRouter(prefix="/admin")


@router.post("/fire-event")
async def admin_fire_event(req: FireEventRequest):
    """Manually fire an SSE event to a session (from dashboard)."""
    logger.info(f"Admin fire [{req.session_id}] → {req.event}: {req.data}")
    await send_sse(req.session_id, req.event, req.data)

    # Update backend hob state for force_yellow events
    if req.event == "force_yellow_steak":
        hobs = get_session_hobs(req.session_id)
        hob_id = req.data.get("hob_id", 0)
        if 0 <= hob_id < len(hobs):
            hobs[hob_id].status = HobStatus.READY_SIDE1
            hobs[hob_id].started_at = time.time()

    log_action(req.session_id, 0, f"admin_{req.event}", req.data)
    return {"status": "ok"}


@router.get("/sessions")
async def admin_list_sessions():
    """List all sessions."""
    db = get_db(DB_PATH)
    rows = db.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.get("/session/{session_id}/state")
async def admin_session_state(session_id: str):
    """Get live session state (hobs, SSE clients, timelines)."""
    from routes.session import active_timelines

    hobs = get_session_hobs(session_id)
    for h in hobs:
        reconcile_hob(h)

    return {
        "hobs": [
            {"id": h.id, "status": h.status.value, "started_at": h.started_at,
             "cooking_ms": h.cooking_ms, "ready_ms": h.ready_ms, "ash_ms": h.ash_ms,
             "peppered": h.peppered}
            for h in hobs
        ],
        "active_timelines": [k for k in active_timelines.keys() if k.startswith(session_id)],
        "sse_clients": len(sse_queues.get(session_id, [])),
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
    """Find the currently active session (has SSE clients connected)."""
    for sid, queues in sse_queues.items():
        if len(queues) > 0:
            db = get_db(DB_PATH)
            row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (sid,)).fetchone()
            db.close()
            if row:
                return dict(row)
    # Fallback: return most recent session
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1").fetchone()
    db.close()
    return dict(row) if row else None


@router.delete("/session/{session_id}")
async def admin_delete_session(session_id: str):
    """Delete a session and all its data."""
    from routes.session import active_timelines

    db = get_db(DB_PATH)
    db.execute("DELETE FROM action_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM pm_trials WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM encoding_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM ongoing_snapshots WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM fake_trigger_logs WHERE session_id = ?", (session_id,))
    db.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    db.commit()
    db.close()

    # Clean up in-memory state
    clear_session_hobs(session_id)
    clear_session_queues(session_id)
    clear_session_windows(session_id)

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
    db.close()
    return {
        "session": dict(session) if session else None,
        "actions": [dict(r) for r in actions],
        "pm_trials": [dict(r) for r in pm_trials],
    }
