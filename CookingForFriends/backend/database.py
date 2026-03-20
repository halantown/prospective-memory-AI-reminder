"""Database engine and session factory (async SQLAlchemy + aiosqlite)."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from config import DB_PATH

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables."""
    from models.base import Base
    # Import all models so relationships resolve
    import models.experiment  # noqa: F401
    import models.block       # noqa: F401
    import models.logging     # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_dev_participant():
    """Auto-create or reset the dev test participant defined in config.DEV_TOKEN.

    This runs on every startup so the token always works even after DB resets.
    Set config.DEV_TOKEN = None to disable.
    """
    import logging
    from config import DEV_TOKEN, LATIN_SQUARE
    from models.experiment import Participant, ParticipantStatus

    if not DEV_TOKEN:
        return

    logger = logging.getLogger(__name__)

    async with async_session() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(Participant).where(Participant.token == DEV_TOKEN)
        )
        p = result.scalar_one_or_none()
        if p:
            # Reset to REGISTERED so it can be reused
            p.status = ParticipantStatus.REGISTERED
            p.current_block = None
            p.started_at = None
            p.completed_at = None
            p.is_online = False
            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' reset to REGISTERED — "
                "remove config.DEV_TOKEN before production!"
            )
        else:
            group = list(LATIN_SQUARE.keys())[0]
            p = Participant(
                participant_id="DEV_TESTER",
                token=DEV_TOKEN,
                status=ParticipantStatus.REGISTERED,
                latin_square_group=group,
                condition_order=LATIN_SQUARE[group],
            )
            db.add(p)
            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' created (group={group}) — "
                "remove config.DEV_TOKEN before production!"
            )


async def get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session
