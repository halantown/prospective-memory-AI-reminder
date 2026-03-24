"""GameStateSnapshot helper."""

import time
import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from models.logging import GameStateSnapshot

logger = logging.getLogger(__name__)


async def save_snapshot(db: AsyncSession, participant_id: str, block_id: int, state: dict):
    """Save a game state snapshot."""
    snapshot = GameStateSnapshot(
        participant_id=participant_id,
        block_id=block_id,
        timestamp=time.time(),
        state=state,
    )
    db.add(snapshot)
    await db.commit()
