"""Condition and order assignment — round-robin over 8 (EC+/EC-) × (A/B/C/D) combinations."""

import secrets
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.experiment import Participant
from config import CONDITIONS, TASK_ORDERS, TOKEN_LENGTH, TOKEN_CHARSET


async def assign_condition_and_order(db: AsyncSession) -> tuple[str, str]:
    """Round-robin assignment across 8 (condition, task_order) combinations.

    Counts only real participants (is_test=False) so test sessions never skew
    the balance grid. Returns (condition, task_order).
    """
    result = await db.execute(
        select(Participant.condition, Participant.task_order, func.count())
        .where(Participant.is_test.is_(False))
        .group_by(Participant.condition, Participant.task_order)
    )
    counts: dict[tuple[str, str], int] = {
        (c, o): 0 for c in CONDITIONS for o in TASK_ORDERS
    }
    for row in result:
        combo = (row[0], row[1])
        if combo in counts:
            counts[combo] = row[2]
    condition, order = min(counts, key=counts.get)
    return condition, order


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
