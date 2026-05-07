"""Condition and order assignment — round-robin over 8 (EE1/EE0) × (A/B/C/D) combinations."""

import secrets
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.experiment import Participant
from config import CONDITIONS, TASK_ORDERS, TOKEN_LENGTH, TOKEN_CHARSET


async def assign_condition_and_order(db: AsyncSession) -> tuple[str, str]:
    """Assign by real participant count modulo 8.

    The study design has 4 Latin-square orders × 2 EC conditions.  Test
    sessions never affect the counterbalance cell.
    """
    result = await db.execute(
        select(func.count(Participant.id))
        .where(Participant.is_test.is_(False))
    )
    participant_count = result.scalar() or 0
    cells = [(condition, order) for order in TASK_ORDERS for condition in CONDITIONS]
    return cells[participant_count % len(cells)]


async def generate_token(db: AsyncSession) -> str:
    """Generate a unique 6-character participant token."""
    for _ in range(50):
        token = "".join(secrets.choice(TOKEN_CHARSET) for _ in range(TOKEN_LENGTH))
        existing = await db.execute(
            select(Participant).where(Participant.token == token)
        )
        if existing.scalar_one_or_none() is None:
            return token
    raise RuntimeError("Could not generate unique token after 50 attempts")


async def next_participant_id(db: AsyncSession) -> str:
    """Auto-increment participant IDs: P001, P002, ..."""
    result = await db.execute(
        select(Participant.participant_id).where(Participant.participant_id.like("P%"))
    )
    rows = result.scalars().all()
    if not rows:
        return "P001"
    max_n = 0
    for row in rows:
        try:
            n = int(row[1:])
            if n > max_n:
                max_n = n
        except ValueError:
            pass
    return f"P{max_n + 1:03d}"
