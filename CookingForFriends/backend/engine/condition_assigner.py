"""Condition assignment — round-robin over CONTROL / AF / AFCB."""

import secrets
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.experiment import Participant
from config import CONDITIONS, TOKEN_LENGTH, TOKEN_CHARSET


async def assign_condition(db: AsyncSession) -> str:
    """Round-robin condition assignment to keep groups balanced."""
    result = await db.execute(
        select(Participant.condition, func.count())
        .group_by(Participant.condition)
    )
    counts = {c: 0 for c in CONDITIONS}
    for row in result:
        if row[0] in counts:
            counts[row[0]] = row[1]
    return min(counts, key=counts.get)


async def generate_token(db: AsyncSession) -> str:
    """Generate a unique 6-character token."""
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
        select(Participant.participant_id)
        .where(Participant.participant_id.like("P%"))
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
