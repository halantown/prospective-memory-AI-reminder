"""Admin router — participant management, monitoring, data export."""

import uuid
import json
import time
import random
import logging
from dataclasses import asdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from models.experiment import Experiment, ExperimentStatus, Participant, ParticipantStatus
from models.block import Block, BlockStatus, PMTrial, ReminderMessage
from models.logging import InteractionLog
from models.schemas import ParticipantCreateResponse
from engine.condition_assigner import assign_group, get_condition_order, generate_token, next_participant_id
from engine.pm_tasks import (
    get_tasks_for_block, get_task, BLOCK_TRIGGER_ORDER, BLOCK_GUESTS,
)
from websocket.connection_manager import manager
from config import LATIN_SQUARE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin")

# Day stories per block, using the real guest names
DAY_STORIES = {
    1: f"Day 1: Cooking steak dinner for {BLOCK_GUESTS[1]}",
    2: f"Day 2: Cooking steak dinner for {BLOCK_GUESTS[2]}",
    3: f"Day 3: Cooking steak dinner for {BLOCK_GUESTS[3]}",
}

# 24 unique counterbalancing assignments:
# 6 Latin Square sequences × 4 unreminded positions per block
_UNREMINDED_POSITIONS = list(range(4))  # 0, 1, 2, 3 → which trial in trigger order is unreminded


def _get_assignment_combo(participant_index: int) -> tuple[str, list[int]]:
    """Return (group, [unreminded_pos_b1, _b2, _b3]) using round-robin over 24 combos."""
    groups = list(LATIN_SQUARE.keys())
    combo_index = participant_index % 24
    group_index = combo_index // 4
    unreminded_offset = combo_index % 4
    group = groups[group_index]
    # Rotate unreminded position across blocks for variety
    positions = [
        (unreminded_offset + 0) % 4,
        (unreminded_offset + 1) % 4,
        (unreminded_offset + 2) % 4,
    ]
    return group, positions


@router.post("/participant/create", response_model=ParticipantCreateResponse)
async def create_participant(db: AsyncSession = Depends(get_db)):
    """Create a new participant with a unique token."""
    # Ensure an active experiment exists
    result = await db.execute(
        select(Experiment).where(Experiment.status == ExperimentStatus.ACTIVE).limit(1)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        experiment = Experiment(name="Cooking for Friends v3", status=ExperimentStatus.ACTIVE)
        db.add(experiment)
        await db.flush()

    # Count existing participants for round-robin
    count_result = await db.execute(select(func.count(Participant.id)))
    participant_count = count_result.scalar() or 0

    # Generate IDs
    pid = str(uuid.uuid4())[:8]
    participant_id = await next_participant_id(db)
    group, unreminded_positions = _get_assignment_combo(participant_count)
    token = await generate_token(db)
    condition_order = get_condition_order(group)
    af_variant_index = random.randint(0, 9)
    target_position_seed = random.randint(0, 99999)

    # Create participant
    participant = Participant(
        id=pid,
        experiment_id=experiment.id,
        participant_id=participant_id,
        token=token,
        latin_square_group=group,
        condition_order=condition_order,
        status=ParticipantStatus.REGISTERED,
    )
    db.add(participant)

    # Pre-create blocks with real PM task data
    for block_num, condition in enumerate(condition_order, start=1):
        block = Block(
            participant_id=pid,
            block_number=block_num,
            condition=condition,
            day_story=DAY_STORIES[block_num],
            status=BlockStatus.PENDING,
        )
        db.add(block)
        await db.flush()

        trigger_order = BLOCK_TRIGGER_ORDER[block_num]
        unreminded_pos = unreminded_positions[block_num - 1]

        for trial_idx, task_id in enumerate(trigger_order):
            task_def = get_task(task_id)
            is_unreminded = (trial_idx == unreminded_pos)
            # CONTROL: all unreminded. AF/AFCB: 3 reminded + 1 unreminded
            has_reminder = (condition != "CONTROL") and (not is_unreminded)

            trial = PMTrial(
                block_id=block.id,
                trial_number=trial_idx + 1,
                has_reminder=has_reminder,
                is_filler=is_unreminded and condition != "CONTROL",
                task_config=_task_def_to_config(task_def),
                encoding_card=_task_def_to_encoding_card(task_def),
                reminder_text=task_def.baseline_reminder if has_reminder else None,
                reminder_condition=condition if has_reminder else None,
            )
            db.add(trial)

    await db.commit()

    # Broadcast to admin dashboard
    await manager.broadcast_admin({
        "event_type": "participant_created",
        "participant_id": participant_id,
        "group": group,
        "token": token,
    })

    return ParticipantCreateResponse(
        participant_id=participant_id,
        group=group,
        token=token,
        session_id=pid,
    )


def _task_def_to_config(task_def) -> dict:
    """Convert PMTaskDef to the task_config JSON stored in PMTrial."""
    return {
        "task_id": task_def.task_id,
        "trigger_type": task_def.trigger_type,
        "trigger_event": task_def.trigger_visual,
        "target_room": task_def.target_room,
        "target_object": task_def.target_name,
        "target_action": task_def.action_description,
        "distractor_object": task_def.distractor_name,
        "action_destination": task_def.action_destination,
        "discriminating_cue": task_def.discriminating_cue,
    }


def _task_def_to_encoding_card(task_def) -> dict:
    """Convert PMTaskDef to encoding card JSON stored in PMTrial."""
    return {
        "trigger_description": task_def.trigger_event,
        "target_room": task_def.target_room,
        "target_description": task_def.target_name,
        "target_image": f"/assets/pm/{task_def.target_image}",
        "action_description": task_def.action_description,
        "encoding_text": task_def.encoding_text,
        "visual_cues": {
            "target": task_def.target_visual_desc,
            "distractor": task_def.distractor_visual_desc,
            "cue": task_def.discriminating_cue,
        },
        "quiz_question": task_def.quiz_question,
        "quiz_options": task_def.quiz_options,
        "quiz_correct_index": task_def.quiz_correct_index,
    }


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
            "group": p.latin_square_group,
            "condition_order": p.condition_order,
            "status": p.status.value if isinstance(p.status, ParticipantStatus) else p.status,
            "current_block": p.current_block,
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
        "latin_square": LATIN_SQUARE,
    }


@router.post("/reminders/import")
async def import_reminders(reminders: list[dict], db: AsyncSession = Depends(get_db)):
    """Batch import agent-generated reminders."""
    count = 0
    for r in reminders:
        msg = ReminderMessage(
            task_type=r["task_type"],
            condition=r["condition"],
            context_activity=r.get("context_activity"),
            text=r["text"],
            audio_url=r.get("audio_url"),
            extra_metadata=r.get("metadata"),
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
    """List all participant assignments for checking counterbalancing."""
    result = await db.execute(
        select(Participant).order_by(Participant.created_at)
    )
    participants = result.scalars().all()
    assignments = []
    for p in participants:
        # Fetch blocks to show unreminded info
        blocks_result = await db.execute(
            select(Block).where(Block.participant_id == p.id).order_by(Block.block_number)
        )
        blocks = blocks_result.scalars().all()
        block_info = []
        for b in blocks:
            trials_result = await db.execute(
                select(PMTrial).where(PMTrial.block_id == b.id).order_by(PMTrial.trial_number)
            )
            trials = trials_result.scalars().all()
            unreminded = [t for t in trials if not t.has_reminder and t.is_filler]
            block_info.append({
                "block_number": b.block_number,
                "condition": b.condition,
                "unreminded_task": (
                    unreminded[0].task_config.get("task_id") if unreminded else None
                ),
            })
        assignments.append({
            "participant_id": p.participant_id,
            "group": p.latin_square_group,
            "condition_order": p.condition_order,
            "blocks": block_info,
        })
    return assignments


# WebSocket endpoint moved to main.py (no /api prefix needed)
