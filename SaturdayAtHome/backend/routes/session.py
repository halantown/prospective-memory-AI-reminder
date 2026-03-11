"""Session management & SSE stream endpoints."""

import asyncio
import json
import logging
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import DB_PATH, LATIN_SQUARE, TASK_PAIRS, REMINDER_TEXTS, assign_group
from database import get_db
from helpers import log_action
from models import SessionStartRequest, SessionStartResponse
from sse import send_sse, register_client, event_generator
from timeline import BlockTimeline

logger = logging.getLogger("saturday.routes.session")

router = APIRouter()

# Active block timelines: "sessionId_blockNum" → BlockTimeline
active_timelines: dict[str, BlockTimeline] = {}


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: SessionStartRequest):
    session_id = str(uuid.uuid4())[:8]
    group = assign_group()
    condition_order = LATIN_SQUARE[group]

    db = get_db(DB_PATH)
    db.execute(
        """INSERT INTO sessions (session_id, participant_id, latin_square_group, condition_order, phase, created_at)
           VALUES (?, ?, ?, ?, 'welcome', ?)""",
        (session_id, req.participant_id, group, json.dumps(condition_order), time.time()),
    )
    db.commit()
    db.close()

    logger.info(f"Session started: {session_id} (participant={req.participant_id}, group={group})")
    log_action(session_id, 0, "session_start", {"participant_id": req.participant_id, "group": group})

    return SessionStartResponse(
        session_id=session_id,
        participant_id=req.participant_id,
        group=group,
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
    task_pair = TASK_PAIRS[block_num]

    return {
        "block_number": block_num,
        "condition": condition,
        "task_pair_id": block_num,
        "task_a": task_pair[0],
        "task_b": task_pair[1],
        "reminder_text_a": REMINDER_TEXTS.get(condition, ""),
        "reminder_text_b": REMINDER_TEXTS.get(condition, ""),
    }


@router.get("/session/{session_id}/block/{block_num}/stream")
async def block_stream(session_id: str, block_num: int, auto_start: bool = True):
    """SSE endpoint — pushes block timeline events to the frontend.

    Use auto_start=false from dashboard to observe without triggering timeline.
    """
    logger.info(f"SSE connect [{session_id}] block={block_num} auto_start={auto_start}")

    queue = register_client(session_id)

    # Start block timeline if not already running
    if auto_start:
        timeline_key = f"{session_id}_{block_num}"
        if timeline_key not in active_timelines:
            db = get_db(DB_PATH)
            row = db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
            db.close()

            if row:
                condition_order = json.loads(row["condition_order"])
                condition = condition_order[block_num - 1] if block_num <= len(condition_order) else "HighAF_HighCB"

                tl = BlockTimeline(session_id, block_num, condition, send_sse)
                active_timelines[timeline_key] = tl
                asyncio.create_task(tl.run())

    return StreamingResponse(
        event_generator(session_id, queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
