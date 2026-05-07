"""Session router — token login, encoding config, quiz, status, WebSocket."""

import uuid
import time
import logging
import collections
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, Request, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from models.experiment import Participant, ParticipantStatus
from models.block import Block, BlockStatus, PMTrial, EncodingQuizAttempt
from models.pm_module import PhaseEvent, CutsceneEvent, IntentionCheckEvent, PMTaskEvent, ExperimentResponse
from models.schemas import (
    TokenStartRequest, SessionStartResponse, BlockEncodingResponse,
    DebriefRequest, StatusResponse,
    QuizSubmitRequest, QuizSubmitResponse, QuizResultItem,
    EncodingQuizAttemptRequest,
    PhaseUpdateRequest, CutsceneEventRequest, IntentionCheckRequest, SessionStateResponse,
    MouseTrackingBatchRequest,
    PhaseAdvanceRequest, PhaseAdvanceResponse, ExperimentResponsesSubmitRequest,
    ManipulationCheckSubmitRequest,
)
from websocket.game_handler import handle_game_ws
from engine.timeline import run_timeline
from engine.game_time import unfreeze_game_time, get_current_game_time
from engine.phase_state import close_phase, enter_phase, next_phase_after, normalize_phase
from data.materials import evaluate_manipulation_check, get_experiment_config_for_phase
from data.cooking_recipes import serialize_cooking_definitions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# Simple in-memory rate limiter for token attempts
_token_attempts: dict[str, list[float]] = collections.defaultdict(list)
_RATE_LIMIT_WINDOW = 60  # seconds
_RATE_LIMIT_MAX = 10     # max attempts per window


@router.get("/experiment-config")
async def get_public_experiment_config(phase: str = Query(default="WELCOME")):
    """Return non-sensitive public material before token login.

    Only token input and welcome text are exposed without a participant session.
    Condition-specific and answer-bearing materials require the session-scoped
    endpoint.
    """
    normalized = phase.strip().upper()
    if normalized not in {"TOKEN_INPUT", "WELCOME"}:
        raise HTTPException(403, "This phase requires a participant session")
    return get_experiment_config_for_phase(
        phase=normalized,
        condition="EE1",
        task_order="A",
    )


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(req: TokenStartRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Start a session by presenting the 6-char token."""
    # Rate limit by client IP
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = _token_attempts[client_ip]
    # Prune old attempts outside the window
    _token_attempts[client_ip] = [t for t in attempts if now - t < _RATE_LIMIT_WINDOW]
    if len(_token_attempts[client_ip]) >= _RATE_LIMIT_MAX:
        raise HTTPException(429, "Too many attempts — please wait before trying again")
    _token_attempts[client_ip].append(now)

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
        participant.is_online = True
        participant.last_heartbeat = time.time()
        unfreeze_game_time(participant)
        await db.commit()
        logger.info(f"Session started: {participant.participant_id} (condition={participant.condition})")
    else:
        # Re-join
        participant.is_online = True
        participant.last_heartbeat = time.time()
        await db.commit()
        logger.info(f"Session re-joined: {participant.participant_id}")

    return SessionStartResponse(
        session_id=participant.id,
        participant_id=participant.participant_id,
        condition=participant.condition,
        task_order=participant.task_order,
        is_test=participant.is_test,
        current_phase=participant.current_phase or "welcome",
        cooking_definitions=serialize_cooking_definitions(),
    )


@router.get("/session/{session_id}/cooking-definitions")
async def get_cooking_definitions(session_id: str, db: AsyncSession = Depends(get_db)):
    """Return server-authoritative cooking definitions for session bootstrap."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Session not found")
    return serialize_cooking_definitions()


@router.get("/session/{session_id}/experiment-config")
async def get_session_experiment_config(
    session_id: str,
    phase: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return participant-safe experiment material for one phase.

    This endpoint intentionally scopes material by phase and strips correct
    answer fields.  The frontend should not receive future phase content,
    manipulation-check answers, retrospective answers, or the other EC
    condition's reminder text.
    """
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Session not found")

    phase_name = phase or participant.current_phase or "WELCOME"
    try:
        return get_experiment_config_for_phase(
            phase=phase_name,
            condition=participant.condition,
            task_order=participant.task_order,
        )
    except (KeyError, IndexError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/mouse-tracking")
async def post_mouse_tracking_batch(
    req: MouseTrackingBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Store batched mouse samples and embedded behavioral event markers."""
    MAX_MOUSE_BATCH = 10000
    if len(req.records) > MAX_MOUSE_BATCH:
        raise HTTPException(413, f"Mouse tracking batch exceeds {MAX_MOUSE_BATCH} records")

    result = await db.execute(
        select(Block.id).where(
            Block.participant_id == req.session_id,
            Block.block_number == 1,
        )
    )
    block_id = result.scalar_one_or_none()
    if block_id is None:
        raise HTTPException(404, "Block not found")

    from models.logging import MouseTrack
    db.add(MouseTrack(
        participant_id=req.session_id,
        block_id=block_id,
        data=req.records,
    ))
    await db.commit()
    return {"status": "ok", "count": len(req.records)}


@router.get("/session/{session_id}/status", response_model=StatusResponse)
async def get_session_status(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get current session status for reconnection."""
    result = await db.execute(
        select(Participant).where(Participant.id == session_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Session not found")

    # Find the single block's phase
    phase = "welcome"
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == 1,
        )
    )
    block = result.scalar_one_or_none()
    if block:
        phase = block.status.value if isinstance(block.status, BlockStatus) else block.status

    return StatusResponse(
        status=p.status.value if isinstance(p.status, ParticipantStatus) else p.status,
        phase=p.current_phase or "welcome",
    )


@router.post("/session/{session_id}/phase")
async def update_phase(
    session_id: str, req: PhaseUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible phase logging endpoint.

    New flow code should prefer `/phase/advance`.  This endpoint now uses the
    same phase service so old frontend calls still produce coherent history.
    """
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Session not found")

    try:
        if req.event_type == "start":
            await enter_phase(db, p, req.phase_name)
        elif req.event_type == "end":
            await close_phase(db, p, req.phase_name)
        else:
            raise HTTPException(400, "event_type must be 'start' or 'end'")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    await db.commit()
    return {"status": "ok"}


@router.post("/session/{session_id}/phase/advance", response_model=PhaseAdvanceResponse)
async def advance_phase(
    session_id: str,
    req: PhaseAdvanceRequest,
    db: AsyncSession = Depends(get_db),
):
    """Advance to the next canonical phase, or to an explicit phase."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Session not found")

    try:
        target = req.next_phase
        if target is None:
            target_phase = next_phase_after(participant.current_phase)
            if target_phase is None:
                raise HTTPException(400, "Participant is already at final phase")
            target = target_phase.value
        previous, current = await enter_phase(db, participant, target)
        if current == "COMPLETED":
            participant.status = ParticipantStatus.COMPLETED
            participant.completed_at = datetime.now(timezone.utc)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    await db.commit()
    return PhaseAdvanceResponse(previous_phase=previous, current_phase=current)


@router.post("/session/{session_id}/responses")
async def submit_experiment_responses(
    session_id: str,
    req: ExperimentResponsesSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Store normalized participant responses for questionnaires and phase tasks."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Session not found")

    now = time.time()
    rows = []
    try:
        for item in req.responses:
            phase_name = normalize_phase(item.phase or participant.current_phase).value
            row = ExperimentResponse(
                session_id=session_id,
                phase_name=phase_name,
                question_id=item.question_id,
                response_type=item.response_type,
                value=item.value,
                timestamp=item.timestamp if item.timestamp is not None else now,
                extra_metadata=item.metadata,
            )
            rows.append(row)
            db.add(row)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    await db.commit()
    return {"status": "recorded", "count": len(rows)}


@router.post("/session/{session_id}/responses/manip-check")
async def submit_manipulation_check_response(
    session_id: str,
    req: ManipulationCheckSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Store an encoding manipulation check and evaluate correctness server-side."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "Session not found")

    try:
        phase_name = normalize_phase(req.phase).value
        evaluation = evaluate_manipulation_check(req.task_id, req.selected_option_id)
    except (ValueError, KeyError) as exc:
        raise HTTPException(400, str(exc)) from exc

    db.add(ExperimentResponse(
        session_id=session_id,
        phase_name=phase_name,
        question_id=f"{req.task_id}_manipulation_check",
        response_type="choice",
        value=req.selected_option_id,
        timestamp=time.time(),
        extra_metadata={
            "task_id": req.task_id,
            "response_time_ms": req.response_time_ms,
            "correct": evaluation["correct"],
            "exclusion_flag": evaluation["exclusion_flag"],
        },
    ))
    await db.commit()
    return {"status": "recorded", **evaluation}


@router.post("/session/{session_id}/cutscene-event")
async def log_cutscene_event(
    session_id: str, req: CutsceneEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """Log a cutscene playback event (view + optional detail-check)."""
    import time as _time
    now = _time.time()
    display_t = req.viewed_at if req.viewed_at is not None else now
    dismiss_t = (display_t + req.duration_ms / 1000.0) if req.duration_ms is not None else None

    evt = CutsceneEvent(
        session_id=session_id,
        task_id=req.task_id,
        segment_number=req.segment_index + 1,   # store 1-based
        display_time=display_t,
        dismiss_time=dismiss_t,
        detailcheck_question=req.placeholder,
        detailcheck_answer=str(req.detail_check_selected) if req.detail_check_selected is not None else None,
        detailcheck_correct=req.detail_check_correct,
    )
    db.add(evt)
    await db.commit()
    return {"status": "ok"}


@router.post("/session/{session_id}/intention-check")
async def log_intention_check(
    session_id: str, req: IntentionCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Log a post-encoding intention check response."""
    evt = IntentionCheckEvent(
        session_id=session_id,
        task_id=req.task_id,
        position=req.task_position,
        selected_option_index=req.selected_index,
        correct_option_index=req.correct_index,
        response_time_ms=req.response_time_ms,
    )
    db.add(evt)
    await db.commit()
    return {"status": "ok"}


@router.get("/session/{token}/state", response_model=SessionStateResponse)
async def get_session_state(token: str, db: AsyncSession = Depends(get_db)):
    """Lightweight state endpoint — looks up by token, returns current pipeline step."""
    result = await db.execute(select(Participant).where(Participant.token == token))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Token not found")

    # Find the active PMTaskEvent (most recent with no action_animation_complete_time)
    evt_result = await db.execute(
        select(PMTaskEvent).where(
            PMTaskEvent.session_id == p.id,
            PMTaskEvent.action_animation_complete_time.is_(None),
        ).order_by(PMTaskEvent.id.desc()).limit(1)
    )
    evt = evt_result.scalar_one_or_none()

    pipeline_step: Optional[str] = None
    if evt:
        if evt.action_animation_start_time is not None:
            pipeline_step = "auto_execute"
        elif evt.confidence_rating is not None:
            pipeline_step = "auto_execute"
        elif evt.decoy_selected_option is not None:
            pipeline_step = "confidence_rating"
        elif evt.reminder_acknowledge_time is not None:
            pipeline_step = "item_selection"
        elif evt.greeting_complete_time is not None:
            pipeline_step = "reminder"
        else:
            pipeline_step = "trigger_event"

    return SessionStateResponse(
        session_id=p.id,
        phase=p.current_phase or "welcome",
        frozen=p.frozen_since is not None,
        game_time_elapsed_s=get_current_game_time(p),
        pipeline_step=pipeline_step,
        current_task_id=evt.task_id if evt else None,
        is_test=bool(p.is_test),
        incomplete=bool(p.incomplete),
    )


@router.get("/session/{session_id}/encoding", response_model=BlockEncodingResponse)
async def get_encoding_data(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get encoding card data for the session block."""
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == 1,
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
        condition=block.condition,
        day_story=block.day_story,
        cards=pm_tasks,
    )


@router.post("/session/{session_id}/encoding/quiz")
async def submit_encoding_quiz_attempt(
    session_id: str, req: EncodingQuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record a single encoding quiz attempt (fire-and-forget from frontend)."""
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == 1,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(404, "Block not found")

    # Find trial by number
    result = await db.execute(
        select(PMTrial).where(
            PMTrial.block_id == block.id,
            PMTrial.trial_number == req.trial_number,
        )
    )
    trial = result.scalar_one_or_none()
    if not trial:
        raise HTTPException(404, "Trial not found")

    quiz_attempt = EncodingQuizAttempt(
        trial_id=trial.id,
        participant_id=session_id,
        question_type=req.question_type,
        attempt_number=req.attempt_number,
        selected_answer=req.selected_answer,
        correct_answer=req.correct_answer,
        is_correct=req.is_correct,
        response_time_ms=req.response_time_ms,
    )
    db.add(quiz_attempt)
    await db.commit()
    return {"status": "recorded"}


@router.post("/session/{session_id}/quiz", response_model=QuizSubmitResponse)
async def submit_quiz(
    session_id: str, req: QuizSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit encoding quiz answers — validates and records attempts."""
    result = await db.execute(
        select(Block).where(
            Block.participant_id == session_id,
            Block.block_number == 1,
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
