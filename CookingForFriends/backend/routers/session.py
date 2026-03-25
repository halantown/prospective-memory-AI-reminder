"""Session router — token login, block config, quiz, status, WebSocket."""

import uuid
import time
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from models.experiment import Participant, ParticipantStatus
from models.block import Block, BlockStatus, PMTrial, EncodingQuizAttempt
from models.schemas import (
    TokenStartRequest, SessionStartResponse, BlockEncodingResponse,
    NasaTLXRequest, DebriefRequest, StatusResponse,
    QuizSubmitRequest, QuizSubmitResponse, QuizResultItem,
)
from websocket.game_handler import handle_game_ws
from engine.timeline import run_timeline
from config import BLOCKS_PER_PARTICIPANT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def _validate_block_num(block_num: int):
    """Validate block number is within expected range."""
    if not (1 <= block_num <= BLOCKS_PER_PARTICIPANT):
        raise HTTPException(400, f"block_num must be 1-{BLOCKS_PER_PARTICIPANT}")


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
        participant.started_at = datetime.now(timezone.utc)
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
    _validate_block_num(block_num)
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == block_num,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(404, "Block not found")

    # Update block status to encoding (reset from any non-playing state)
    if block.status not in (BlockStatus.PLAYING,):
        block.status = BlockStatus.ENCODING
        block.started_at = block.started_at or datetime.now(timezone.utc)
        await db.commit()

    # Get PM trials for this block
    result = await db.execute(
        select(PMTrial).where(PMTrial.block_id == block.id).order_by(PMTrial.trial_number)
    )
    trials = result.scalars().all()

    pm_tasks = []
    for trial in trials:
        card = trial.encoding_card or {}
        task_cfg = trial.task_config or {}
        # Nest encoding_card fields to match frontend PMEncodingCard type
        pm_tasks.append({
            "trial_number": trial.trial_number,
            "encoding_card": {
                "trigger_description": card.get("trigger_description", ""),
                "target_room": card.get("target_room", ""),
                "target_description": card.get("target_description", ""),
                "target_image": card.get("target_image", ""),
                "action_description": card.get("action_description", ""),
                "encoding_text": card.get("encoding_text", ""),
                "visual_cues": card.get("visual_cues", {}),
                "quiz_question": card.get("quiz_question", ""),
                "quiz_options": card.get("quiz_options", []),
                "quiz_correct_index": card.get("quiz_correct_index", 0),
            },
            "task_config": {
                "task_id": task_cfg.get("task_id", ""),
                "trigger_type": task_cfg.get("trigger_type", ""),
                "target_room": task_cfg.get("target_room", ""),
                "action_destination": task_cfg.get("action_destination", ""),
            },
        })

    return BlockEncodingResponse(
        block_number=block.block_number,
        condition=block.condition,
        day_story=block.day_story,
        cards=pm_tasks,
    )


@router.post("/session/{session_id}/block/{block_num}/quiz", response_model=QuizSubmitResponse)
async def submit_quiz(
    session_id: str, block_num: int, req: QuizSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit encoding quiz answers — validates and records attempts."""
    _validate_block_num(block_num)
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == block_num,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(404, "Block not found")

    # Load trials for this block
    result = await db.execute(
        select(PMTrial).where(PMTrial.block_id == block.id).order_by(PMTrial.trial_number)
    )
    trials = result.scalars().all()
    trial_map = {t.trial_number: t for t in trials}

    results = []
    failed_trials = set()

    for answer in req.answers:
        trial = trial_map.get(answer.trial_number)
        if not trial:
            continue

        task_cfg = trial.task_config or {}
        encoding = trial.encoding_card or {}
        correct = _get_correct_answer(answer.question_type, task_cfg, encoding)

        is_correct = answer.selected_answer.strip().lower() == correct.strip().lower()

        # Count previous attempts for this question
        prev_result = await db.execute(
            select(EncodingQuizAttempt).where(
                EncodingQuizAttempt.trial_id == trial.id,
                EncodingQuizAttempt.participant_id == session_id,
                EncodingQuizAttempt.question_type == answer.question_type,
            )
        )
        prev_attempts = len(prev_result.scalars().all())
        attempt_num = prev_attempts + 1

        # Record attempt
        quiz_attempt = EncodingQuizAttempt(
            trial_id=trial.id,
            participant_id=session_id,
            question_type=answer.question_type,
            attempt_number=attempt_num,
            selected_answer=answer.selected_answer,
            correct_answer=correct,
            is_correct=is_correct,
            response_time_ms=answer.response_time_ms,
        )
        db.add(quiz_attempt)

        results.append(QuizResultItem(
            trial_number=answer.trial_number,
            question_type=answer.question_type,
            is_correct=is_correct,
            correct_answer=correct,
            attempt_number=attempt_num,
        ))

        if not is_correct:
            failed_trials.add(answer.trial_number)

    await db.commit()

    return QuizSubmitResponse(
        results=results,
        all_correct=len(failed_trials) == 0,
        failed_trials=sorted(failed_trials),
    )


def _get_correct_answer(question_type: str, task_config: dict, encoding_card: dict) -> str:
    """Get the correct answer for a quiz question type."""
    if question_type == "trigger":
        # Correct answer is the trigger_description from encoding card
        return encoding_card.get("trigger_description", task_config.get("trigger_event", ""))
    elif question_type == "target":
        # For the new multi-question quiz, "target" uses the card's quiz system
        quiz_options = encoding_card.get("quiz_options", [])
        quiz_correct_index = encoding_card.get("quiz_correct_index", 0)
        if quiz_options and 0 <= quiz_correct_index < len(quiz_options):
            return quiz_options[quiz_correct_index]
        return task_config.get("target_object", "")
    elif question_type == "action":
        return encoding_card.get("action_description", task_config.get("target_action", ""))
    return ""


@router.post("/session/{session_id}/block/{block_num}/nasa-tlx")
async def submit_nasa_tlx(
    session_id: str, block_num: int, req: NasaTLXRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit NASA-TLX for a micro-break."""
    _validate_block_num(block_num)
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == block_num,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(404, "Block not found")

    # Idempotency: prevent double submission
    if block.nasa_tlx is not None:
        raise HTTPException(400, "NASA-TLX already submitted for this block")

    block.nasa_tlx = req.model_dump()
    block.status = BlockStatus.COMPLETED
    block.ended_at = datetime.now(timezone.utc)
    await db.commit()

    # Advance to next block
    p_result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = p_result.scalar_one_or_none()
    if participant and participant.current_block and participant.current_block < BLOCKS_PER_PARTICIPANT:
        participant.current_block += 1
        await db.commit()

    return {"status": "ok", "next_block": block_num + 1 if block_num < BLOCKS_PER_PARTICIPANT else None}


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

    # Idempotency: prevent double submission
    if participant.status == ParticipantStatus.COMPLETED:
        raise HTTPException(400, "Debrief already submitted")

    participant.demographic_data = req.demographic
    participant.debrief_data = {
        "preference": req.preference,
        "open_responses": req.open_responses,
        "manipulation_check": req.manipulation_check,
    }
    participant.status = ParticipantStatus.COMPLETED
    participant.completed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "completed"}


# WebSocket endpoint moved to main.py (no /api prefix needed)
