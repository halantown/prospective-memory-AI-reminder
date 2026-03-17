"""Session management & bidirectional WebSocket stream (PRD v2.1).

The WebSocket endpoint handles BOTH server→client push (timeline events)
AND client→server messages (trigger_click, mcq_answer, encoding_result,
ongoing_batch, questionnaire, heartbeat).
"""

import json
import logging
import time
import uuid

import asyncio
from fastapi import APIRouter, HTTPException, WebSocket

from core.config import DB_PATH, assign_group
from core.config_loader import get_latin_square, get_block_skins, get_block_pm_tasks
from core.database import get_db
from utils.helpers import log_action
from models.schemas import TokenSessionStartRequest, SessionStartResponse, SessionResumeResponse
from core.ws import (
    send_ws, register_ws_client, websocket_pump, websocket_receiver,
)
from core.timeline import BlockTimeline
from services.window_service import reset_session_windows
from core.session_lifecycle import (
    SessionPhase, transition_phase, broadcast_admin,
    mark_session_online, mark_session_offline,
)

logger = logging.getLogger("saturday.routes.session")

router = APIRouter()

# Active block timelines: "sessionId_blockNum" → BlockTimeline
active_timelines: dict[str, BlockTimeline] = {}
# Active participant stream connections per session
participant_ws_counts: dict[str, int] = {}


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: TokenSessionStartRequest):
    """Start a session by presenting the 6-char token issued by the experimenter."""
    db = get_db(DB_PATH)
    row = db.execute(
        "SELECT * FROM sessions WHERE token = ?", (req.token.strip().upper(),)
    ).fetchone()

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
                "UPDATE sessions SET timer_started_at = COALESCE(timer_started_at, ?), "
                "timer_running_since = COALESCE(timer_running_since, ?), "
                "timer_elapsed_s = COALESCE(timer_elapsed_s, 0), is_online = 1 "
                "WHERE session_id = ?",
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
    """Return block metadata for the frontend (skins, tasks, etc.)."""
    db = get_db(DB_PATH)
    row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    db.close()

    if not row:
        raise HTTPException(404, "Session not found")

    condition_order = json.loads(row["condition_order"])
    if block_num < 1 or block_num > 4:
        raise HTTPException(400, "Block number must be 1-4")

    condition = condition_order[block_num - 1]
    skins = get_block_skins(block_num)
    pm_tasks = get_block_pm_tasks(block_num)
    task_a = pm_tasks[0] if len(pm_tasks) > 0 else {}
    task_b = pm_tasks[1] if len(pm_tasks) > 1 else {}

    # Strip MCQ correct answers before sending to frontend
    task_a_safe = _strip_correct(task_a)
    task_b_safe = _strip_correct(task_b)

    return {
        "block_number": block_num,
        "condition": condition,
        "skins": skins,
        "pm_tasks": [task_a_safe, task_b_safe],
    }


def _strip_correct(task: dict) -> dict:
    """Remove MCQ correct answer before sending to client.

    Quiz correct is intentionally kept — the frontend needs it
    for the encoding verification step.
    """
    import copy
    safe = copy.deepcopy(task)
    if "mcq" in safe:
        safe["mcq"].pop("correct", None)
    # Intentionally keep quiz.correct — needed for encoding quiz check
    return safe


@router.websocket("/session/{session_id}/block/{block_num}/stream")
async def block_stream(
    websocket: WebSocket,
    session_id: str,
    block_num: int,
    auto_start: bool = True,
    client: str = "participant",
):
    """Bidirectional WebSocket endpoint.

    Server→Client: timeline events pushed via queue
    Client→Server: trigger_click, mcq_answer, encoding_result, ongoing_batch,
                   questionnaire, heartbeat
    """
    await websocket.accept()
    client = (client or "participant").strip().lower()
    is_participant_client = client != "dashboard"
    logger.info(
        f"WS connect [{session_id}] block={block_num} auto_start={auto_start} client={client}"
    )

    queue = register_ws_client(session_id)
    if is_participant_client:
        prev = participant_ws_counts.get(session_id, 0)
        participant_ws_counts[session_id] = prev + 1
        if prev == 0:
            mark_session_online(session_id)

    # Send an immediate keepalive so the client transitions to OPEN quickly
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

                reset_session_windows(session_id)

                # Transition session phase to BLOCK
                try:
                    db2 = get_db(DB_PATH)
                    current_phase = db2.execute(
                        "SELECT phase FROM sessions WHERE session_id = ?",
                        (session_id,),
                    ).fetchone()
                    if current_phase and current_phase["phase"] != SessionPhase.BLOCK.value:
                        transition_phase(db2, session_id, SessionPhase.BLOCK, block_idx=block_num)
                    else:
                        db2.close()
                except Exception as phase_err:
                    logger.warning(f"Phase transition to BLOCK failed: {phase_err}")

                tl = BlockTimeline(session_id, block_num, condition, send_ws)
                active_timelines[timeline_key] = tl
                tl._task = asyncio.create_task(tl.run())

    # Run two concurrent tasks: server push pump + client receiver
    pump_task = asyncio.create_task(websocket_pump(session_id, queue, websocket))
    receiver_task = asyncio.create_task(websocket_receiver(session_id, block_num, websocket))

    try:
        # Wait for either task to complete (usually disconnection)
        done, pending = await asyncio.wait(
            {pump_task, receiver_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
    finally:
        if is_participant_client:
            count = participant_ws_counts.get(session_id, 0)
            if count <= 1:
                participant_ws_counts.pop(session_id, None)
                mark_session_offline(session_id)
            else:
                participant_ws_counts[session_id] = count - 1


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
