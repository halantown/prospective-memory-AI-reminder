"""Session management and participant stream endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
import time

from fastapi import APIRouter, HTTPException, WebSocket

from core.config import DB_PATH
from core.config_loader import get_block_task_pair, get_execution_window_ms, get_pm_task
from core.database import get_db
from core.timeline import BlockTimeline
from core.ws import register_ws_client, send_ws, websocket_pump
from models.schemas import SessionResumeResponse, SessionStartResponse, TokenSessionStartRequest
from utils.helpers import log_action
from core.session_lifecycle import (
    SessionPhase,
    mark_session_offline,
    mark_session_online,
    transition_phase,
)
from services.window_service import reset_session_windows

logger = logging.getLogger("saturday.routes.session")

router = APIRouter()

active_timelines: dict[str, BlockTimeline] = {}
participant_ws_counts: dict[str, int] = {}


def _public_task(task_id: str) -> dict:
    task = get_pm_task(task_id) or {}
    target = task.get("target") or {}
    distractor = task.get("distractor") or {}

    return {
        "task_id": task_id,
        "title": task.get("title"),
        "room": task.get("room"),
        "trigger": task.get("trigger"),
        "preparation_step": task.get("preparation_step"),
        "encoding_card": task.get("encoding_card") or {},
        "steps": task.get("steps") or [],
        "options": [
            {
                "id": target.get("id"),
                "label": target.get("label"),
                "cues": target.get("cues") or [],
            },
            {
                "id": distractor.get("id"),
                "label": distractor.get("label"),
                "cues": distractor.get("cues") or [],
            },
        ],
    }


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: TokenSessionStartRequest):
    """Start/rejoin a session with a 6-character token."""
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions WHERE token = ?", (req.token.strip().upper(),)).fetchone()

    if not row:
        db.close()
        raise HTTPException(404, "Token not found — ask the experimenter to register you first")

    if row["phase"] != SessionPhase.CREATED.value:
        logger.info(f"Session re-join via token: {row['session_id']} (phase={row['phase']})")
        db.execute(
            "UPDATE sessions SET is_interrupted = 0, last_heartbeat = ? WHERE session_id = ?",
            (time.time(), row["session_id"]),
        )
        db.commit()
        db.close()
        log_action(row["session_id"], 0, "session_rejoin_token", {"token": req.token, "phase": row["phase"]})
    else:
        try:
            transition_phase(db, row["session_id"], SessionPhase.ENCODING)
            now = time.time()
            db.execute(
                """UPDATE sessions
                   SET timer_started_at = COALESCE(timer_started_at, ?),
                       timer_running_since = COALESCE(timer_running_since, ?),
                       timer_elapsed_s = COALESCE(timer_elapsed_s, 0),
                       is_online = 1
                   WHERE session_id = ?""",
                (now, now, row["session_id"]),
            )
            db.commit()
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
    if block_num < 1 or block_num > 4:
        raise HTTPException(400, "Block number must be 1-4")

    condition_order = json.loads(row["condition_order"])
    condition = condition_order[block_num - 1]

    task_a, task_b = get_block_task_pair(block_num)

    return {
        "block_number": block_num,
        "condition": condition,
        "execution_window_ms": get_execution_window_ms(),
        "task_a": task_a,
        "task_b": task_b,
        "task_a_config": _public_task(task_a),
        "task_b_config": _public_task(task_b),
        "task_slots": {
            "A": {"task_id": task_a, "task": _public_task(task_a)},
            "B": {"task_id": task_b, "task": _public_task(task_b)},
        },
    }


@router.websocket("/session/{session_id}/block/{block_num}/stream")
async def block_stream(
    websocket: WebSocket,
    session_id: str,
    block_num: int,
    auto_start: bool = True,
    client: str = "participant",
):
    """WebSocket stream for block events."""
    await websocket.accept()
    client = (client or "participant").strip().lower()
    is_participant_client = client != "dashboard"

    logger.info(
        "WS connect [%s] block=%s auto_start=%s client=%s",
        session_id,
        block_num,
        auto_start,
        client,
    )

    queue = register_ws_client(session_id)
    if is_participant_client:
        prev = participant_ws_counts.get(session_id, 0)
        participant_ws_counts[session_id] = prev + 1
        if prev == 0:
            mark_session_online(session_id)

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
            row = db.execute("SELECT condition_order FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
            db.close()

            if row:
                condition_order = json.loads(row["condition_order"])
                condition = condition_order[block_num - 1] if block_num <= len(condition_order) else "HighAF_HighCB"

                reset_session_windows(session_id)

                tl = BlockTimeline(session_id, block_num, condition, send_ws)
                active_timelines[timeline_key] = tl
                tl._task = asyncio.create_task(tl.run())

    try:
        await websocket_pump(session_id, queue, websocket)
    finally:
        if is_participant_client:
            count = participant_ws_counts.get(session_id, 0)
            if count <= 1:
                participant_ws_counts.pop(session_id, None)
                mark_session_offline(session_id)
            else:
                participant_ws_counts[session_id] = count - 1


@router.post("/session/{session_id}/heartbeat")
async def session_heartbeat(session_id: str):
    db = get_db(DB_PATH)
    row = db.execute(
        "UPDATE sessions SET last_heartbeat = ?, is_interrupted = 0 WHERE session_id = ? RETURNING session_id",
        (time.time(), session_id),
    ).fetchone()
    db.commit()
    db.close()

    if not row:
        raise HTTPException(404, "Session not found")
    return {"status": "ok"}


@router.get("/session/{session_id}/resume", response_model=SessionResumeResponse)
async def resume_session(session_id: str):
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
            """SELECT actual_t
               FROM block_events
               WHERE session_id = ? AND block_num = ? AND event_type = 'block_start'
               ORDER BY id DESC LIMIT 1""",
            (session_id, block_idx),
        ).fetchone()
        db2.close()
        if start_row and start_row["actual_t"] is not None:
            elapsed_t = float(start_row["actual_t"])
        if 0 < block_idx <= len(condition_order):
            condition = condition_order[block_idx - 1]

    return SessionResumeResponse(
        phase=phase,
        block_idx=block_idx,
        elapsed_t=elapsed_t,
        condition=condition,
    )
