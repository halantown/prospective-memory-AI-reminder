"""Canonical experiment phase state machine helpers."""

from __future__ import annotations

import time
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.experiment import Participant
from models.pm_module import PhaseEvent


class ExperimentPhase(StrEnum):
    TOKEN_INPUT = "TOKEN_INPUT"
    WELCOME = "WELCOME"
    CONSENT = "CONSENT"
    DEMOGRAPHICS = "DEMOGRAPHICS"
    MSE_PRE = "MSE_PRE"
    STORY_INTRO = "STORY_INTRO"
    ENCODING_VIDEO_1 = "ENCODING_VIDEO_1"
    MANIP_CHECK_1 = "MANIP_CHECK_1"
    ASSIGN_1 = "ASSIGN_1"
    ENCODING_VIDEO_2 = "ENCODING_VIDEO_2"
    MANIP_CHECK_2 = "MANIP_CHECK_2"
    ASSIGN_2 = "ASSIGN_2"
    ENCODING_VIDEO_3 = "ENCODING_VIDEO_3"
    MANIP_CHECK_3 = "MANIP_CHECK_3"
    ASSIGN_3 = "ASSIGN_3"
    ENCODING_VIDEO_4 = "ENCODING_VIDEO_4"
    MANIP_CHECK_4 = "MANIP_CHECK_4"
    ASSIGN_4 = "ASSIGN_4"
    RECAP = "RECAP"
    TUTORIAL_PHONE = "TUTORIAL_PHONE"
    TUTORIAL_COOKING = "TUTORIAL_COOKING"
    TUTORIAL_TRIGGER = "TUTORIAL_TRIGGER"
    EVENING_TRANSITION = "EVENING_TRANSITION"
    MAIN_EXPERIMENT = "MAIN_EXPERIMENT"
    POST_MANIP_CHECK = "POST_MANIP_CHECK"
    POST_SUBJECTIVE_DV = "POST_SUBJECTIVE_DV"
    POST_NASA_TLX = "POST_NASA_TLX"
    POST_MSE = "POST_MSE"
    POST_RETRO_CHECK = "POST_RETRO_CHECK"
    DEBRIEF = "DEBRIEF"
    COMPLETED = "COMPLETED"


PHASE_SEQUENCE: tuple[ExperimentPhase, ...] = tuple(ExperimentPhase)

def normalize_phase(phase: str | ExperimentPhase | None) -> ExperimentPhase:
    if isinstance(phase, ExperimentPhase):
        return phase
    if not phase:
        return ExperimentPhase.WELCOME
    stripped = phase.strip()
    upper = stripped.upper()
    if upper in ExperimentPhase.__members__:
        return ExperimentPhase[upper]
    raise ValueError(f"Unknown experiment phase: {phase}")


def next_phase_after(phase: str | ExperimentPhase) -> ExperimentPhase | None:
    current = normalize_phase(phase)
    try:
        index = PHASE_SEQUENCE.index(current)
    except ValueError:
        return None
    if index >= len(PHASE_SEQUENCE) - 1:
        return None
    return PHASE_SEQUENCE[index + 1]


def phase_values() -> list[str]:
    return [phase.value for phase in PHASE_SEQUENCE]


def is_valid_phase(phase: str) -> bool:
    try:
        normalize_phase(phase)
        return True
    except ValueError:
        return False


async def enter_phase(
    db: AsyncSession,
    participant: Participant,
    next_phase: str | ExperimentPhase,
    *,
    now: float | None = None,
) -> tuple[str, str]:
    """Close the current open phase event and enter `next_phase`.

    Returns `(previous_phase, current_phase)`.  Calling this repeatedly with the
    already-open phase is idempotent for logging: it will not create duplicate
    open `PhaseEvent` rows.
    """
    entered_at = now if now is not None else time.time()
    previous = normalize_phase(participant.current_phase).value
    current = normalize_phase(next_phase).value

    open_result = await db.execute(
        select(PhaseEvent)
        .where(
            PhaseEvent.session_id == participant.id,
            PhaseEvent.end_time.is_(None),
        )
        .order_by(PhaseEvent.id.desc())
    )
    open_events = open_result.scalars().all()

    already_open = False
    for event in open_events:
        if normalize_phase(event.phase_name).value == current:
            already_open = True
            continue
        event.end_time = entered_at

    if not already_open:
        db.add(PhaseEvent(
            session_id=participant.id,
            phase_name=current,
            start_time=entered_at,
        ))

    participant.current_phase = current
    return previous, current


async def close_phase(
    db: AsyncSession,
    participant: Participant,
    phase: str | ExperimentPhase | None = None,
    *,
    now: float | None = None,
) -> str:
    closed_at = now if now is not None else time.time()
    phase_name = normalize_phase(phase or participant.current_phase).value
    event_result = await db.execute(
        select(PhaseEvent)
        .where(
            PhaseEvent.session_id == participant.id,
            PhaseEvent.phase_name == phase_name,
            PhaseEvent.end_time.is_(None),
        )
        .order_by(PhaseEvent.id.desc())
        .limit(1)
    )
    event = event_result.scalar_one_or_none()
    if event:
        event.end_time = closed_at
    return phase_name
