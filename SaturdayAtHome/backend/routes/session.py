"""Session management & WebSocket stream endpoints."""

import json
import logging
import time
import uuid

import asyncio
from fastapi import APIRouter, HTTPException, WebSocket

from core.config import DB_PATH, assign_group
from core.config_loader import get_latin_square, get_task_pairs, get_reminder_texts
from core.database import get_db
from utils.helpers import log_action
from models.schemas import (
    SessionStartRequest, SessionStartResponse,
    TokenSessionStartRequest, SessionResumeResponse,
)
from core.ws import send_ws, register_ws_client, websocket_pump
from core.timeline import BlockTimeline
from services.hob_service import reset_session_hobs
from services.window_service import reset_session_windows
from core.session_lifecycle import SessionPhase, transition_phase, broadcast_admin

logger = logging.getLogger("saturday.routes.session")

router = APIRouter()

# Active block timelines: "sessionId_blockNum" → BlockTimeline
active_timelines: dict[str, BlockTimeline] = {}


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: TokenSessionStartRequest):
    """Start a session by presenting the 6-char token issued by the experimenter.

    Looks up the pre-registered session, validates it is in CREATED phase,
    and transitions it to ENCODING.
    """
    db = get_db(DB_PATH)
    row = db.execute(
        "SELECT * FROM sessions WHERE token = ?", (req.token.strip().upper(),)
    ).fetchone()

    if not row:
        db.close()
        raise HTTPException(404, "Token not found — ask the experimenter to register you first")

    if row["phase"] != SessionPhase.CREATED.value:
        logger.info(f"Session re-join via token: {row['session_id']} (phase={row['phase']})")
        
        # Reset interruption status on rejoin
        db.execute(
            "UPDATE sessions SET is_interrupted = 0, last_heartbeat = ? WHERE session_id = ?",
            (time.time(), row["session_id"])
        )
        db.commit()
        db.close()
        
        log_action(row["session_id"], 0, "session_rejoin_token", {"token": req.token, "phase": row["phase"]})
    else:
        try:
            transition_phase(db, row["session_id"], SessionPhase.ENCODING)
        finally:
            db.close()

        logger.info(f"Session started via token: {row['session_id']} (participant={row['participant_id']})")
        log_action(row["session_id"], 0, "session_start_token", {"token": req.token})

    condition_order = json.loads(row["condition_order"])
    return SessionStartResponse(
        session_id=row["session_id"],
        participant_id=row["participant_id"],
        group=row["latin_square_group"],
        condition_order=condition_order,
    )


@router.get("/session/{session_id}/block/{block_num}")
async def get_block_config(session_id: str, block_num: int):
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    db.close()

    if not row:
        raise HTTPException(404, "Session not found")

    condition_order = json.loads(row["condition_order"])
    if block_num < 1 or block_num > 4:
        raise HTTPException(400, "Block number must be 1-4")

    condition = condition_order[block_num - 1]
    task_pair = get_task_pairs()[block_num]
    cond_texts = get_reminder_texts().get(condition, {})
    if isinstance(cond_texts, dict):
        text_a = cond_texts.get("A", "")
        text_b = cond_texts.get("B", "")
    else:
        text_a = text_b = cond_texts or ""

    return {
        "block_number": block_num,
        "condition": condition,
        "task_pair_id": block_num,
        "task_a": task_pair[0],
        "task_b": task_pair[1],
        "reminder_text_a": text_a,
        "reminder_text_b": text_b,
    }


@router.websocket("/session/{session_id}/block/{block_num}/stream")
async def block_stream(websocket: WebSocket, session_id: str, block_num: int, auto_start: bool = True):
    """WebSocket endpoint — pushes block timeline events to the frontend."""
    await websocket.accept()
    logger.info(f"WS connect [{session_id}] block={block_num} auto_start={auto_start}")

    queue = register_ws_client(session_id)
    # Send an immediate heartbeat frame so the client transitions to OPEN quickly.
    try:
        queue.put_nowait({"event": "keepalive", "data": {}, "ts": time.time()})
    except asyncio.QueueFull:
        logger.warning(f"WS bootstrap keepalive dropped [{session_id}] queue full")

    if auto_start:
        timeline_key = f"{session_id}_{block_num}"
        existing = active_timelines.get(timeline_key)
        if existing and (existing._task is None or existing._task.done()):
            del active_timelines[timeline_key]
        if timeline_key not in active_timelines:
            db = get_db(DB_PATH)
            row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
            db.close()

            if row:
                condition_order = json.loads(row["condition_order"])
                condition = condition_order[block_num - 1] if block_num <= len(condition_order) else "HighAF_HighCB"

                reset_session_hobs(session_id)
                reset_session_windows(session_id)

                tl = BlockTimeline(session_id, block_num, condition, send_ws)
                active_timelines[timeline_key] = tl
                tl._task = asyncio.create_task(tl.run())

    await websocket_pump(session_id, queue, websocket)


@router.post("/session/{session_id}/heartbeat")
async def session_heartbeat(session_id: str):
    """Frontend sends this every 10s to signal the participant is still connected."""
    db = get_db(DB_PATH)
    row = db.execute(
        "UPDATE sessions SET last_heartbeat = ?, is_interrupted = 0 "
        "WHERE session_id = ? RETURNING session_id",
        (time.time(), session_id),
    ).fetchone()
    db.commit()
    db.close()
    if not row:
        raise HTTPException(404, "Session not found")
    return {"status": "ok"}


@router.get("/session/{session_id}/resume", response_model=SessionResumeResponse)
async def resume_session(session_id: str):
    """Return current phase/block state so the frontend can recover after a page refresh."""
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    db.close()

    if not row:
        raise HTTPException(404, "Session not found")

    phase = row["phase"]
    block_idx = row["current_block"] if row["current_block"] is not None else -1
    condition_order = json.loads(row["condition_order"])

    elapsed_t = 0.0
    condition = None
    if phase == SessionPhase.BLOCK.value and block_idx >= 0:
        db2 = get_db(DB_PATH)
        start_row = db2.execute(
            "SELECT ts FROM action_logs WHERE session_id = ? AND block_number = ? AND action_type = 'block_start' ORDER BY ts LIMIT 1",
            (session_id, block_idx),
        ).fetchone()
        db2.close()
        if start_row:
            elapsed_t = time.time() - start_row["ts"]
        if 0 < block_idx <= len(condition_order):
            condition = condition_order[block_idx - 1]

    return SessionResumeResponse(
        phase=phase,
        block_idx=block_idx,
        elapsed_t=elapsed_t,
        condition=condition,
    )
