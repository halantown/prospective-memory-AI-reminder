"""Admin router — participant management, monitoring, data export."""

import uuid
import json
import time
import logging
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
from websocket.connection_manager import manager
from config import LATIN_SQUARE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin")

DAY_STORIES = [
    "Day 1: Cooking steak dinner for Alice",
    "Day 2: Preparing pasta for Bob and Carol",
    "Day 3: Making soup for David and Emma",
]


@router.post("/participant/create", response_model=ParticipantCreateResponse)
async def create_participant(db: AsyncSession = Depends(get_db)):
    """Create a new participant with a unique token."""
    # Ensure an active experiment exists
    result = await db.execute(
        select(Experiment).where(Experiment.status == ExperimentStatus.ACTIVE).limit(1)
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        # Auto-create default experiment
        experiment = Experiment(name="Cooking for Friends v3", status=ExperimentStatus.ACTIVE)
        db.add(experiment)
        await db.flush()

    # Generate IDs
    pid = str(uuid.uuid4())[:8]
    participant_id = await next_participant_id(db)
    group = await assign_group(db)
    token = await generate_token(db)
    condition_order = get_condition_order(group)

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

    # Pre-create blocks
    for i, condition in enumerate(condition_order, start=1):
        block = Block(
            participant_id=pid,
            block_number=i,
            condition=condition,
            day_story=DAY_STORIES[i - 1],
            status=BlockStatus.PENDING,
        )
        db.add(block)
        await db.flush()

        # Pre-create PM trials (4 per block)
        has_reminder_flags = _get_reminder_flags(condition)
        for trial_num in range(1, 5):
            trial = PMTrial(
                block_id=block.id,
                trial_number=trial_num,
                has_reminder=has_reminder_flags[trial_num - 1],
                is_filler=(not has_reminder_flags[trial_num - 1] and condition != "CONTROL"),
                task_config=_get_placeholder_task(i, trial_num),
                encoding_card=_get_placeholder_encoding_card(i, trial_num),
                reminder_text=_get_placeholder_reminder(condition) if has_reminder_flags[trial_num - 1] else None,
                reminder_condition=condition if has_reminder_flags[trial_num - 1] else None,
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


def _get_reminder_flags(condition: str) -> list[bool]:
    """Return has_reminder flags for 4 trials in a block."""
    if condition == "CONTROL":
        return [False, False, False, False]
    # AF or AFCB: 3 reminded + 1 filler (no reminder)
    return [True, True, True, False]


def _get_placeholder_task(block_num: int, trial_num: int) -> dict:
    """Placeholder PM task configuration."""
    tasks = [
        {
            "task_id": f"pm_b{block_num}_t{trial_num}",
            "trigger_event": "doorbell",
            "target_room": "living_room",
            "target_object": "red_book",
            "target_action": "give_to_friend",
            "distractor_object": "blue_book",
        },
        {
            "task_id": f"pm_b{block_num}_t{trial_num}",
            "trigger_event": "email_dentist",
            "target_room": "study",
            "target_object": "calendar",
            "target_action": "mark_appointment",
            "distractor_object": "notebook",
        },
        {
            "task_id": f"pm_b{block_num}_t{trial_num}",
            "trigger_event": "washing_done",
            "target_room": "balcony",
            "target_object": "black_sweater",
            "target_action": "hang_to_dry",
            "distractor_object": "gray_sweater",
        },
        {
            "task_id": f"pm_b{block_num}_t{trial_num}",
            "trigger_event": "clock_6pm",
            "target_room": "kitchen",
            "target_object": "red_medicine_bottle",
            "target_action": "take_medicine",
            "distractor_object": "orange_vitamin_bottle",
        },
    ]
    return tasks[(trial_num - 1) % len(tasks)]


def _get_placeholder_encoding_card(block_num: int, trial_num: int) -> dict:
    """Placeholder encoding card for PM task."""
    cards = [
        {
            "trigger_description": "When the doorbell rings (a friend arrives)",
            "target_room": "Living Room",
            "target_description": "A book with a red cover and mountain illustration",
            "target_image": "/assets/pm/red_book.png",
            "action_description": "Pick up the book and give it to the friend",
            "visual_cues": {"color": "red", "pattern": "mountain illustration", "size": "medium"},
        },
        {
            "trigger_description": "When you receive a dentist confirmation email",
            "target_room": "Study",
            "target_description": "The wall calendar with a blue label",
            "target_image": "/assets/pm/calendar.png",
            "action_description": "Mark the appointment on Wednesday at 3 PM",
            "visual_cues": {"label_color": "blue", "day": "Wednesday", "time": "3 PM"},
        },
        {
            "trigger_description": "When the washing machine beeps (laundry done)",
            "target_room": "Balcony",
            "target_description": "A black wool sweater",
            "target_image": "/assets/pm/black_sweater.png",
            "action_description": "Take it out and lay it flat to dry",
            "visual_cues": {"color": "black", "material": "wool", "drying": "lay flat"},
        },
        {
            "trigger_description": "When the game clock reaches 6:00 PM",
            "target_room": "Kitchen",
            "target_description": "A red medicine bottle on the shelf",
            "target_image": "/assets/pm/medicine.png",
            "action_description": "Take one Doxycycline tablet",
            "visual_cues": {"container": "red bottle", "form": "round tablet", "quantity": 1},
        },
    ]
    return cards[(trial_num - 1) % len(cards)]


def _get_placeholder_reminder(condition: str) -> str:
    """Placeholder reminder text."""
    return f"[Placeholder] This is a {condition} reminder (agent-generated text pending)"


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


# WebSocket endpoint moved to main.py (no /api prefix needed)
