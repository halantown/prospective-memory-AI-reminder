"""Database engine and session factory (async SQLAlchemy + asyncpg)."""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False, future=True, pool_size=20, max_overflow=30)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables."""
    from models.base import Base
    # Import all models so relationships resolve
    import models.experiment  # noqa: F401
    import models.block       # noqa: F401
    import models.logging     # noqa: F401
    import models.cooking     # noqa: F401
    import models.pm_module   # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_dev_participant():
    """Auto-create or reset the dev test participant defined in config.DEV_TOKEN.

    Creates a EC+ / Order A / is_test=True participant plus a bare Block shim
    (block_number=1) required as an FK anchor for existing logging tables.
    Set config.DEV_TOKEN = None to disable.
    """
    import logging
    from config import DEV_TOKEN
    from models.experiment import Participant, ParticipantStatus

    if not DEV_TOKEN:
        return

    logger = logging.getLogger(__name__)

    async with async_session() as db:
        from sqlalchemy import select
        from models.experiment import Experiment, ExperimentStatus

        # Ensure a dev experiment exists
        exp_result = await db.execute(select(Experiment).limit(1))
        experiment = exp_result.scalar_one_or_none()
        if experiment is None:
            experiment = Experiment(name="DEV Experiment", status=ExperimentStatus.ACTIVE)
            db.add(experiment)
            await db.flush()

        result = await db.execute(
            select(Participant).where(Participant.token == DEV_TOKEN)
        )
        p = result.scalar_one_or_none()
        if p:
            # Reset to initial state so the token can be reused across dev restarts
            p.status = ParticipantStatus.REGISTERED
            p.started_at = None
            p.completed_at = None
            p.is_online = False
            p.current_phase = "welcome"
            p.game_time_elapsed_s = 0.0
            p.frozen_since = None
            p.last_unfreeze_at = None
            p.disconnected_at = None
            p.incomplete = False
            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' reset to REGISTERED — "
                "remove DEV_TOKEN before production!"
            )
        else:
            pid = str(uuid.uuid4())[:8]
            p = Participant(
                id=pid,
                experiment_id=experiment.id,
                participant_id="DEV_TESTER",
                token=DEV_TOKEN,
                status=ParticipantStatus.REGISTERED,
                condition="EC+",
                task_order="A",
                is_test=True,
                current_phase="welcome",
            )
            db.add(p)
            await db.flush()

            # Bare Block shim — no PMTrials; exists only as FK anchor for logging tables
            from models.block import Block, BlockStatus
            block = Block(
                participant_id=pid,
                block_number=1,
                condition="EC+",
                day_story="DEV seed block",
                status=BlockStatus.PENDING,
            )
            db.add(block)
            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' created (EC+ / Order A / is_test=True) — "
                "remove DEV_TOKEN before production!"
            )


async def get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session

