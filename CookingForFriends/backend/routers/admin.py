"""Admin router — participant management, monitoring, data export."""

import io
import csv
import uuid
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from models.experiment import Experiment, ExperimentStatus, Participant, ParticipantStatus
from models.block import Block, BlockStatus, PMTrial, PMAttemptRecord, ReminderMessage
from models.logging import InteractionLog, PhoneMessageLog, GameStateSnapshot
from models.pm_module import PMTaskEvent, FakeTriggerEvent, PhaseEvent, IntentionCheckEvent
from models.schemas import (
    ParticipantCreateResponse, ReminderImportItem,
    AdminParticipantCreateRequest,
)
from engine.condition_assigner import assign_condition_and_order, generate_token, next_participant_id
from engine.pm_tasks import get_task, BLOCK_TRIGGER_ORDER
from websocket.connection_manager import manager
from config import ADMIN_API_KEY, CONDITIONS, TASK_ORDERS

logger = logging.getLogger(__name__)


async def verify_admin(x_admin_key: str | None = Header(None, alias="X-Admin-Key")):
    """Verify admin API key if configured."""
    if not ADMIN_API_KEY:
        return  # No key configured — skip auth (development mode)
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(401, "Invalid or missing admin API key")


router = APIRouter(prefix="/api/admin", dependencies=[Depends(verify_admin)])

DAY_STORY = "Cooking dinner for a friend"


async def _create_participant_row(
    db: AsyncSession, is_test: bool = False, req: Optional[AdminParticipantCreateRequest] = None
) -> Participant:
    """Shared logic for creating a participant + bare block."""
    result = await db.execute(
        select(Experiment).where(Experiment.status == ExperimentStatus.ACTIVE).limit(1)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        experiment = Experiment(name="Cooking for Friends", status=ExperimentStatus.ACTIVE)
        db.add(experiment)
        await db.flush()

    pid = str(uuid.uuid4())[:8]
    participant_id = await next_participant_id(db)
    token = await generate_token(db)

    if is_test:
        condition = (req.condition if req and req.condition else CONDITIONS[0])
        task_order = (req.task_order if req and req.task_order else list(TASK_ORDERS.keys())[0])
    else:
        condition, task_order = await assign_condition_and_order(db)

    participant = Participant(
        id=pid,
        experiment_id=experiment.id,
        participant_id=participant_id,
        token=token,
        condition=condition,
        task_order=task_order,
        status=ParticipantStatus.REGISTERED,
        is_test=is_test,
    )
    db.add(participant)

    block = Block(
        participant_id=pid,
        block_number=1,
        condition=condition,
        day_story=DAY_STORY,
        status=BlockStatus.PENDING,
    )
    db.add(block)
    await db.flush()
    return participant


@router.post("/participant/create", response_model=ParticipantCreateResponse)
async def create_participant(
    req: Optional[AdminParticipantCreateRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a new real participant with round-robin condition assignment."""
    participant = await _create_participant_row(db, is_test=False, req=req)
    await db.commit()

    await manager.broadcast_admin({
        "event_type": "participant_created",
        "participant_id": participant.participant_id,
        "condition": participant.condition,
        "task_order": participant.task_order,
        "token": participant.token,
    })

    return ParticipantCreateResponse(
        participant_id=participant.participant_id,
        condition=participant.condition,
        task_order=participant.task_order,
        token=participant.token,
        session_id=participant.id,
        entry_url=f"/?token={participant.token}",
        is_test=False,
    )


@router.post("/test-session", response_model=ParticipantCreateResponse)
async def create_test_session(
    req: Optional[AdminParticipantCreateRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a test participant (excluded from analysis by default)."""
    participant = await _create_participant_row(db, is_test=True, req=req)
    await db.commit()
    return ParticipantCreateResponse(
        participant_id=participant.participant_id,
        condition=participant.condition,
        task_order=participant.task_order,
        token=participant.token,
        session_id=participant.id,
        entry_url=f"/?token={participant.token}",
        is_test=True,
    )


@router.get("/assignment-counts")
async def get_assignment_counts(db: AsyncSession = Depends(get_db)):
    """Return participant counts grouped by condition × task_order (real participants only)."""
    result = await db.execute(
        select(
            Participant.condition,
            Participant.task_order,
            func.count(Participant.id).label("count"),
        )
        .where(Participant.is_test == False)  # noqa: E712
        .group_by(Participant.condition, Participant.task_order)
    )
    rows = result.all()
    return [
        {"condition": r.condition, "task_order": r.task_order, "count": r.count}
        for r in rows
    ]


@router.get("/live-sessions")
async def get_live_sessions(db: AsyncSession = Depends(get_db)):
    """Return participants currently in progress."""
    result = await db.execute(
        select(Participant).where(Participant.status == ParticipantStatus.IN_PROGRESS)
        .order_by(Participant.started_at.desc())
    )
    participants = result.scalars().all()
    return [
        {
            "session_id": p.id,
            "participant_id": p.participant_id,
            "condition": p.condition,
            "task_order": p.task_order,
            "is_online": p.is_online,
            "is_test": p.is_test,
            "started_at": p.started_at.isoformat() if p.started_at else None,
            "last_heartbeat": p.last_heartbeat,
        }
        for p in participants
    ]


@router.get("/participants")
async def list_participants(db: AsyncSession = Depends(get_db)):
    """List all participants with status."""
    result = await db.execute(
        select(Participant).order_by(Participant.created_at.desc())
    )
    participants = result.scalars().all()
    return [
        {
            "session_id": p.id,
            "participant_id": p.participant_id,
            "condition": p.condition,
            "task_order": p.task_order,
            "is_test": p.is_test,
            "current_phase": p.current_phase,
            "status": p.status.value if isinstance(p.status, ParticipantStatus) else p.status,
            "token": p.token,
            "is_online": p.is_online,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in participants
    ]


@router.get("/participant/{session_id}/logs")
async def get_participant_logs(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get interaction logs for a participant."""
    result = await db.execute(
        select(InteractionLog)
        .where(InteractionLog.participant_id == session_id)
        .order_by(InteractionLog.timestamp)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "block_id": log.block_id,
            "timestamp": log.timestamp,
            "event_type": log.event_type,
            "event_data": log.event_data,
            "room": log.room,
        }
        for log in logs
    ]


@router.get("/experiment/overview")
async def experiment_overview(db: AsyncSession = Depends(get_db)):
    """Get experiment overview statistics."""
    total = await db.execute(select(func.count(Participant.id)))
    completed = await db.execute(
        select(func.count(Participant.id)).where(Participant.status == ParticipantStatus.COMPLETED)
    )
    in_progress = await db.execute(
        select(func.count(Participant.id)).where(Participant.status == ParticipantStatus.IN_PROGRESS)
    )

    return {
        "total_participants": total.scalar() or 0,
        "completed": completed.scalar() or 0,
        "in_progress": in_progress.scalar() or 0,
    }


@router.post("/reminders/import")
async def import_reminders(reminders: list[ReminderImportItem], db: AsyncSession = Depends(get_db)):
    """Batch import agent-generated reminders."""
    count = 0
    for r in reminders:
        msg = ReminderMessage(
            task_type=r.task_type,
            condition=r.condition,
            context_activity=r.context_activity,
            text=r.text,
            audio_url=r.audio_url,
            extra_metadata=r.metadata,
            is_placeholder=False,
        )
        db.add(msg)
        count += 1
    await db.commit()
    return {"imported": count}


@router.get("/reminders")
async def list_reminders(db: AsyncSession = Depends(get_db)):
    """List all reminder messages."""
    result = await db.execute(
        select(ReminderMessage).order_by(ReminderMessage.task_type)
    )
    reminders = result.scalars().all()
    return [
        {
            "id": r.id,
            "task_type": r.task_type,
            "condition": r.condition,
            "context_activity": r.context_activity,
            "text": r.text,
            "is_placeholder": r.is_placeholder,
        }
        for r in reminders
    ]


@router.get("/assignments")
async def list_assignments(db: AsyncSession = Depends(get_db)):
    """List all participant assignments."""
    result = await db.execute(
        select(Participant).order_by(Participant.created_at)
    )
    participants = result.scalars().all()
    assignments = []
    for p in participants:
        block_result = await db.execute(
            select(Block).where(Block.participant_id == p.id).limit(1)
        )
        block = block_result.scalar_one_or_none()
        unreminded = None
        if block:
            trials_result = await db.execute(
                select(PMTrial).where(PMTrial.block_id == block.id).order_by(PMTrial.trial_number)
            )
            trials = trials_result.scalars().all()
            filler = next((t for t in trials if not t.has_reminder and t.is_filler), None)
            unreminded = filler.task_config.get("task_id") if filler else None
        assignments.append({
            "participant_id": p.participant_id,
            "condition": p.condition,
            "unreminded_task": unreminded,
        })
    return assignments


@router.get("/participant/{session_id}/detail")
async def get_participant_detail(session_id: str, db: AsyncSession = Depends(get_db)):
    """Full detail for one participant: blocks → trials → attempts."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Participant not found")

    blocks_result = await db.execute(
        select(Block).where(Block.participant_id == session_id).order_by(Block.block_number)
    )
    blocks = blocks_result.scalars().all()

    block_list = []
    for b in blocks:
        trials_result = await db.execute(
            select(PMTrial).where(PMTrial.block_id == b.id).order_by(PMTrial.trial_number)
        )
        trials = trials_result.scalars().all()
        trial_list = []
        for t in trials:
            cfg = t.task_config or {}
            trial_list.append({
                "id": t.id,
                "trial_number": t.trial_number,
                "task_id": cfg.get("task_id", ""),
                "has_reminder": t.has_reminder,
                "is_filler": t.is_filler,
                "score": t.score,
                "trigger_fired_at": t.trigger_fired_at,
                "responded_at": t.exec_window_end,
                "task_config": cfg,
            })
        block_list.append({
            "block_number": b.block_number,
            "condition": b.condition,
            "status": b.status.value if hasattr(b.status, "value") else b.status,
            "day_story": b.day_story,
            "trials": trial_list,
        })

    return {
        "session_id": p.id,
        "participant_id": p.participant_id,
        "condition": p.condition,
        "status": p.status.value if isinstance(p.status, ParticipantStatus) else p.status,
        "token": p.token,
        "is_online": p.is_online,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "blocks": block_list,
    }


@router.post("/participant/{session_id}/reset")
async def reset_participant(session_id: str, db: AsyncSession = Depends(get_db)):
    """Reset participant back to REGISTERED, clear all block progress."""
    from sqlalchemy import update as sql_update

    result = await db.execute(select(Participant).where(Participant.id == session_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Participant not found")

    # Reset participant status
    p.status = ParticipantStatus.REGISTERED

    # Reset all blocks to PENDING and clear trial runtime data
    blocks_result = await db.execute(
        select(Block).where(Block.participant_id == session_id)
    )
    blocks = blocks_result.scalars().all()
    for b in blocks:
        b.status = BlockStatus.PENDING
        await db.execute(
            sql_update(PMTrial).where(PMTrial.block_id == b.id).values(
                score=None,
                trigger_fired_at=None,
                exec_window_start=None,
                exec_window_end=None,
                user_actions=None,
                response_time_ms=None,
                resumption_lag_ms=None,
                reminder_played_at=None,
            )
        )

    await db.commit()
    logger.info(f"[ADMIN] Reset participant {p.participant_id} ({session_id})")
    return {"status": "reset", "participant_id": p.participant_id}


@router.post("/participant/{session_id}/drop")
async def drop_participant(session_id: str, db: AsyncSession = Depends(get_db)):
    """Mark participant as dropped."""
    result = await db.execute(select(Participant).where(Participant.id == session_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Participant not found")

    p.status = ParticipantStatus.DROPPED
    await db.commit()
    logger.info(f"[ADMIN] Dropped participant {p.participant_id} ({session_id})")
    return {"status": "dropped", "participant_id": p.participant_id}


@router.get("/config")
async def get_config():
    """Return current experiment configuration."""
    from config import (
        CONDITIONS, BLOCK_DURATION_S,
        PHONE_LOCK_TIMEOUT_S, MESSAGE_COOLDOWN_S,
        MOUSE_SAMPLE_INTERVAL_MS, MOUSE_BATCH_INTERVAL_S,
        SNAPSHOT_INTERVAL_S, HEARTBEAT_INTERVAL_S, HEARTBEAT_TIMEOUT_S,
        TOKEN_LENGTH, TRIGGER_SCHEDULE, TASK_ORDERS,
    )
    return {
        "experiment": {
            "conditions": CONDITIONS,
            "task_orders": TASK_ORDERS,
            "block_duration_s": BLOCK_DURATION_S,
            "trigger_schedule": TRIGGER_SCHEDULE,
        },
        "phone": {
            "lock_timeout_s": PHONE_LOCK_TIMEOUT_S,
            "message_cooldown_s": MESSAGE_COOLDOWN_S,
        },
        "mouse_tracking": {
            "sample_interval_ms": MOUSE_SAMPLE_INTERVAL_MS,
            "batch_interval_s": MOUSE_BATCH_INTERVAL_S,
        },
        "system": {
            "snapshot_interval_s": SNAPSHOT_INTERVAL_S,
            "heartbeat_interval_s": HEARTBEAT_INTERVAL_S,
            "heartbeat_timeout_s": HEARTBEAT_TIMEOUT_S,
            "token_length": TOKEN_LENGTH,
        },
    }


@router.get("/tasks")
async def list_pm_tasks():
    """Return the full PM task definitions as a list."""
    from engine.pm_tasks import TASK_DEFINITIONS
    return [
        {
            "task_id": task_def.task_id,
            "guest_name": task_def.guest_name,
            "trigger_type": task_def.trigger_type,
            "target_room": task_def.target_room,
            "action_type": task_def.action_type,
        }
        for task_def in TASK_DEFINITIONS.values()
    ]


@router.get("/data/export")
async def export_data(db: AsyncSession = Depends(get_db)):
    """Export all experiment data as JSON."""
    participants_result = await db.execute(
        select(Participant).order_by(Participant.created_at)
    )
    participants = participants_result.scalars().all()

    export = []
    for p in participants:
        blocks_result = await db.execute(
            select(Block).where(Block.participant_id == p.id).order_by(Block.block_number)
        )
        blocks = blocks_result.scalars().all()

        block_data = []
        for b in blocks:
            trials_result = await db.execute(
                select(PMTrial).where(PMTrial.block_id == b.id).order_by(PMTrial.trial_number)
            )
            trials = trials_result.scalars().all()
            trial_data = []
            for t in trials:
                trial_data.append({
                    "trial_number": t.trial_number,
                    "task_config": t.task_config,
                    "has_reminder": t.has_reminder,
                    "is_filler": t.is_filler,
                    "score": t.score,
                    "trigger_fired_at": t.trigger_fired_at,
                    "responded_at": t.exec_window_end,
                })
            block_data.append({
                "block_number": b.block_number,
                "condition": b.condition,
                "status": b.status.value if hasattr(b.status, "value") else b.status,
                "trials": trial_data,
            })

        logs_result = await db.execute(
            select(InteractionLog)
            .where(InteractionLog.participant_id == p.id)
            .order_by(InteractionLog.timestamp)
        )
        logs = logs_result.scalars().all()

        export.append({
            "participant_id": p.participant_id,
            "session_id": p.id,
            "condition": p.condition,
            "status": p.status.value if isinstance(p.status, ParticipantStatus) else p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "blocks": block_data,
            "log_count": len(logs),
        })

    return {"participants": export, "count": len(export)}


# ── Participant Detail Endpoints (for control page) ──


@router.get("/participant/{session_id}/phone-logs")
async def get_phone_logs(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get phone message logs for a participant."""
    result = await db.execute(
        select(PhoneMessageLog)
        .where(PhoneMessageLog.participant_id == session_id)
        .order_by(PhoneMessageLog.sent_at)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "block_id": log.block_id,
            "message_id": log.message_id,
            "sender": log.sender,
            "message_type": log.message_type,
            "category": log.category,
            "sent_at": log.sent_at,
            "read_at": log.read_at,
            "replied_at": log.replied_at,
            "user_choice": log.user_choice,
            "correct_answer": log.correct_answer,
            "reply_correct": log.reply_correct,
            "response_time_ms": log.response_time_ms,
            "status": log.status,
        }
        for log in logs
    ]


@router.get("/participant/{session_id}/snapshots")
async def get_snapshots(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get game state snapshots (latest per block)."""
    result = await db.execute(
        select(GameStateSnapshot)
        .where(GameStateSnapshot.participant_id == session_id)
        .order_by(GameStateSnapshot.timestamp.desc())
    )
    snaps = result.scalars().all()
    # Return latest 20 snapshots (can be large)
    return [
        {
            "id": s.id,
            "block_id": s.block_id,
            "timestamp": s.timestamp,
            "state": s.state,
        }
        for s in snaps[:20]
    ]


@router.get("/participant/{session_id}/pm-attempts")
async def get_pm_attempts(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed PM attempt records for a participant."""
    result = await db.execute(
        select(PMAttemptRecord)
        .where(PMAttemptRecord.participant_id == session_id)
        .order_by(PMAttemptRecord.trigger_fired_at)
    )
    attempts = result.scalars().all()
    return [
        {
            "id": a.id,
            "trial_id": a.trial_id,
            "block_id": a.block_id,
            "trigger_fired_at": a.trigger_fired_at,
            "trigger_received_at": a.trigger_received_at,
            "first_action_time": a.first_action_time,
            "first_room_switch_at": a.first_room_switch_at,
            "first_pm_room_entered_at": a.first_pm_room_entered_at,
            "target_selected_at": a.target_selected_at,
            "action_completed_at": a.action_completed_at,
            "room_sequence": a.room_sequence,
            "room": a.room,
            "target_selected": a.target_selected,
            "action_performed": a.action_performed,
            "action_correct": a.action_correct,
            "total_elapsed_ms": a.total_elapsed_ms,
            "score": a.score,
        }
        for a in attempts
    ]


@router.post("/participant/{session_id}/force-trigger")
async def force_trigger(session_id: str, db: AsyncSession = Depends(get_db)):
    """Force-fire the next pending PM trigger for a participant."""
    from engine.execution_window import start_window
    from engine.timeline import _on_window_expire

    # Find the current playing block
    result = await db.execute(
        select(Block)
        .where(Block.participant_id == session_id, Block.status == BlockStatus.PLAYING)
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(400, "No active (playing) block found")

    # Find the next un-triggered trial
    trials_result = await db.execute(
        select(PMTrial)
        .where(PMTrial.block_id == block.id, PMTrial.trigger_fired_at.is_(None))
        .order_by(PMTrial.trial_number)
    )
    trial = trials_result.scalars().first()
    if not trial:
        raise HTTPException(400, "No pending PM trials to trigger")

    cfg = trial.task_config or {}
    now = time.time()

    # Record trigger fired
    trial.trigger_fired_at = now
    trial.exec_window_start = now
    await db.commit()

    # Start silent execution window so unanswered forced triggers auto-score as 0
    start_window(
        participant_id=session_id,
        trial_id=trial.id,
        block_id=block.id,
        trigger_time=now,
        task_config=cfg,
        on_expire=_on_window_expire,
    )

    # Send trigger event to participant via WS
    trigger_data = {
        "trigger_id": cfg.get("task_id", f"trial_{trial.id}"),
        "trigger_event": cfg.get("trigger_event", "Admin forced trigger"),
        "trigger_type": cfg.get("trigger_type", "visitor"),
        "task_id": cfg.get("task_id", ""),
        "signal": cfg.get("signal", {}),
        "server_trigger_ts": now,
        "task_config": cfg,
    }
    try:
        await manager.send_to_participant(session_id, "pm_trigger", trigger_data)
    except Exception as e:
        logger.warning(f"Failed to send forced trigger via WS: {e}")

    return {
        "status": "triggered",
        "trial_id": trial.id,
        "trial_number": trial.trial_number,
        "task_id": cfg.get("task_id", ""),
    }


@router.post("/participant/{session_id}/send-message")
async def admin_send_message(session_id: str, db: AsyncSession = Depends(get_db)):
    """Send a system message to the participant's phone."""
    now = time.time()
    msg_payload = {
        "id": f"admin_{int(now)}",
        "sender": "🔧 Experimenter",
        "text": "System check — please continue the experiment.",
        "type": "chat",
        "server_ts": now,
    }
    try:
        await manager.send_to_participant(session_id, "phone_message", msg_payload)
    except Exception as e:
        raise HTTPException(500, f"Failed to send message: {e}")
    return {"status": "sent", "message_id": msg_payload["id"]}


@router.post("/participant/{session_id}/advance-block")
async def advance_block(session_id: str, db: AsyncSession = Depends(get_db)):
    """Force-complete current block and advance to next."""
    from engine.timeline import cancel_timeline

    result = await db.execute(select(Participant).where(Participant.id == session_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Participant not found")

    # Find current playing block
    blocks_result = await db.execute(
        select(Block)
        .where(Block.participant_id == session_id, Block.status == BlockStatus.PLAYING)
    )
    block = blocks_result.scalar_one_or_none()
    if not block:
        raise HTTPException(400, "No active block to advance from")

    # Cancel running timeline
    cancel_timeline(session_id, block.block_number)

    # Mark block completed
    block.status = BlockStatus.COMPLETED
    block.ended_at = datetime.now(timezone.utc)

    # Single-session design: mark participant completed
    p.status = ParticipantStatus.COMPLETED
    p.completed_at = datetime.now(timezone.utc)

    await db.commit()

    # Notify client
    try:
        await manager.send_to_participant(session_id, "block_end", {
            "block_number": block.block_number,
            "forced": True,
        })
    except Exception:
        pass

    return {
        "status": "advanced",
        "completed_block": block.block_number,
    }


@router.get("/export/per-participant")
async def export_per_participant(
    include_test: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """CSV export — one row per PMTaskEvent, joined with participant for token/task_order."""
    query = (
        select(PMTaskEvent, Participant.token, Participant.task_order)
        .join(Participant, Participant.id == PMTaskEvent.session_id)
        .order_by(PMTaskEvent.id)
    )
    if not include_test:
        query = query.where(Participant.is_test == False)  # noqa: E712
    result = await db.execute(query)
    rows = result.all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "token", "session_id", "task_id", "position_in_order", "condition", "task_order",
        "trigger_type", "trigger_scheduled_game_time", "trigger_actual_game_time",
        "greeting_complete_time", "reminder_display_time", "reminder_acknowledge_time",
        "decoy_options_order", "decoy_selected_option", "decoy_correct", "decoy_response_time",
        "confidence_rating", "confidence_response_time",
        "action_animation_start_time", "action_animation_complete_time",
        "pipeline_was_interrupted",
    ])
    for e, token, p_task_order in rows:
        w.writerow([
            token, e.session_id, e.task_id, e.position_in_order, e.condition, p_task_order,
            e.trigger_type, e.trigger_scheduled_game_time, e.trigger_actual_game_time,
            e.greeting_complete_time, e.reminder_display_time, e.reminder_acknowledge_time,
            json.dumps(e.decoy_options_order) if e.decoy_options_order else "",
            e.decoy_selected_option, e.decoy_correct, e.decoy_response_time,
            e.confidence_rating, e.confidence_response_time,
            e.action_animation_start_time, e.action_animation_complete_time,
            e.pipeline_was_interrupted,
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pm_events.csv"},
    )


@router.get("/export/aggregated")
async def export_aggregated(
    include_test: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """CSV export — one row per participant with aggregated PM metrics."""
    p_query = select(Participant).order_by(Participant.created_at)
    if not include_test:
        p_query = p_query.where(Participant.is_test == False)  # noqa: E712
    p_result = await db.execute(p_query)
    participants = p_result.scalars().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "participant_id", "token", "session_id", "condition", "task_order", "status",
        "is_test", "created_at", "started_at", "completed_at",
        "pm_events_count", "pm_actions_completed",
    ])
    for p in participants:
        evt_result = await db.execute(
            select(func.count(PMTaskEvent.id)).where(PMTaskEvent.session_id == p.id)
        )
        total_events = evt_result.scalar() or 0
        done_result = await db.execute(
            select(func.count(PMTaskEvent.id)).where(
                PMTaskEvent.session_id == p.id,
                PMTaskEvent.action_animation_complete_time.isnot(None),
            )
        )
        done_events = done_result.scalar() or 0
        w.writerow([
            p.participant_id, p.token, p.id, p.condition, p.task_order,
            p.status.value if hasattr(p.status, "value") else p.status,
            p.is_test,
            p.created_at.isoformat() if p.created_at else "",
            p.started_at.isoformat() if p.started_at else "",
            p.completed_at.isoformat() if p.completed_at else "",
            total_events, done_events,
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=participants_aggregated.csv"},
    )
