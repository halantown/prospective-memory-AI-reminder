"""Session router — token login, block config, status, WebSocket."""

import uuid
import time
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from models.experiment import Participant, ParticipantStatus
from models.block import Block, BlockStatus, PMTrial
from models.schemas import (
    TokenStartRequest, SessionStartResponse, BlockEncodingResponse,
    NasaTLXRequest, DebriefRequest, StatusResponse,
)
from websocket.game_handler import handle_game_ws
from engine.timeline import run_timeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: TokenStartRequest, db: AsyncSession = Depends(get_db)):
    """Start a session by presenting the 6-char token."""
    token = req.token.strip().upper()
    result = await db.execute(
        select(Participant).where(Participant.token == token)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(404, "Token not found — ask the experimenter to register you first")

    if participant.status == ParticipantStatus.COMPLETED:
        raise HTTPException(400, "This session has already been completed")

    # First-time start or re-join
    if participant.status == ParticipantStatus.REGISTERED:
        participant.status = ParticipantStatus.IN_PROGRESS
        participant.started_at = datetime.utcnow()
        participant.current_block = 1
        participant.is_online = True
        participant.last_heartbeat = time.time()
        await db.commit()
        logger.info(f"Session started: {participant.participant_id} (group={participant.latin_square_group})")
    else:
        # Re-join
        participant.is_online = True
        participant.last_heartbeat = time.time()
        await db.commit()
        logger.info(f"Session re-joined: {participant.participant_id}")

    return SessionStartResponse(
        session_id=participant.id,
        participant_id=participant.participant_id,
        group=participant.latin_square_group,
        condition_order=participant.condition_order,
        current_block=participant.current_block or 1,
    )


@router.get("/session/{session_id}/status", response_model=StatusResponse)
async def get_session_status(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get current session status for reconnection."""
    result = await db.execute(
        select(Participant).where(Participant.id == session_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Session not found")

    # Find current block phase
    phase = "welcome"
    if p.current_block:
        result = await db.execute(
            select(Block).where(
                Block.participant_id == session_id,
                Block.block_number == p.current_block,
            )
        )
        block = result.scalar_one_or_none()
        if block:
            phase = block.status.value if isinstance(block.status, BlockStatus) else block.status

    return StatusResponse(
        status=p.status.value if isinstance(p.status, ParticipantStatus) else p.status,
        current_block=p.current_block,
        phase=phase,
    )


@router.get("/session/{session_id}/block/{block_num}/encoding", response_model=BlockEncodingResponse)
async def get_encoding_data(session_id: str, block_num: int, db: AsyncSession = Depends(get_db)):
    """Get encoding card data for a block."""
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == block_num,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(404, "Block not found")

    # Update block status to encoding
    if block.status in (BlockStatus.PENDING, "pending"):
        block.status = BlockStatus.ENCODING
        block.started_at = datetime.utcnow()
        await db.commit()

    # Get PM trials for this block
    result = await db.execute(
        select(PMTrial).where(PMTrial.block_id == block.id).order_by(PMTrial.trial_number)
    )
    trials = result.scalars().all()

    pm_tasks = []
    for trial in trials:
        card = trial.encoding_card or {}
        # Include task info for encoding — but never reveal scoring or reminder status
        pm_tasks.append({
            "trial_number": trial.trial_number,
            "trigger_description": card.get("trigger_description", ""),
            "target_room": card.get("target_room", ""),
            "target_description": card.get("target_description", ""),
            "target_image": card.get("target_image", ""),
            "action_description": card.get("action_description", ""),
            "visual_cues": card.get("visual_cues", {}),
        })

    return BlockEncodingResponse(
        block_number=block.block_number,
        condition=block.condition,
        day_story=block.day_story,
        pm_tasks=pm_tasks,
    )


@router.post("/session/{session_id}/block/{block_num}/nasa-tlx")
async def submit_nasa_tlx(
    session_id: str, block_num: int, req: NasaTLXRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit NASA-TLX for a micro-break."""
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == block_num,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(404, "Block not found")

    block.nasa_tlx = req.model_dump()
    block.status = BlockStatus.COMPLETED
    block.ended_at = datetime.utcnow()
    await db.commit()

    # Advance to next block
    p_result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = p_result.scalar_one_or_none()
    if participant and participant.current_block and participant.current_block < 3:
        participant.current_block += 1
        await db.commit()

    return {"status": "ok", "next_block": block_num + 1 if block_num < 3 else None}


@router.post("/session/{session_id}/debrief")
async def submit_debrief(
    session_id: str, req: DebriefRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit debrief questionnaire."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Session not found")

    participant.demographic_data = req.demographic
    participant.debrief_data = {
        "preference": req.preference,
        "open_responses": req.open_responses,
        "manipulation_check": req.manipulation_check,
    }
    participant.status = ParticipantStatus.COMPLETED
    participant.completed_at = datetime.utcnow()
    await db.commit()

    return {"status": "completed"}


@router.websocket("/ws/game/{session_id}/{block_num}")
async def websocket_game(ws: WebSocket, session_id: str, block_num: int):
    """WebSocket endpoint for game communication."""
    await handle_game_ws(ws, session_id, block_num, async_session)
