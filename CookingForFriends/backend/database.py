"""Database engine and session factory (async SQLAlchemy + asyncpg)."""

import uuid
from sqlalchemy import text
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
        await _patch_pm_schema(conn)


async def _patch_pm_schema(conn):
    """Add PM columns required by newer code when using an existing dev DB."""
    pm_task_columns = [
        "trigger_responded_at FLOAT",
        "trigger_timed_out BOOLEAN NOT NULL DEFAULT FALSE",
        "pm_trigger_fired_timestamp FLOAT",
        "pm_freeze_started_timestamp FLOAT",
        "pm_navigation_started_timestamp FLOAT",
        "pm_reminder_shown_timestamp FLOAT",
        "pm_item_selected_timestamp FLOAT",
        "pm_confidence_rated_timestamp FLOAT",
        "pm_auto_execute_done_timestamp FLOAT",
        "pm_resume_timestamp FLOAT",
        "post_pm_first_action_timestamp FLOAT",
    ]
    fake_trigger_columns = [
        "trigger_responded_at FLOAT",
        "trigger_timed_out BOOLEAN NOT NULL DEFAULT FALSE",
        "resolved_at FLOAT",
        "pm_trigger_fired_timestamp FLOAT",
        "pm_freeze_started_timestamp FLOAT",
        "pm_navigation_started_timestamp FLOAT",
        "pm_resume_timestamp FLOAT",
        "post_pm_first_action_timestamp FLOAT",
    ]
    for column_sql in pm_task_columns:
        await conn.execute(text(f"ALTER TABLE pm_task_events ADD COLUMN IF NOT EXISTS {column_sql}"))
    for column_sql in fake_trigger_columns:
        await conn.execute(text(f"ALTER TABLE fake_trigger_events ADD COLUMN IF NOT EXISTS {column_sql}"))


async def seed_dev_participant():
    """Auto-create or reset the dev test participant defined in config.DEV_TOKEN.

    Creates a EE1 / Order A / is_test=True participant plus a bare Block shim
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
                condition="EE1",
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
                condition="EE1",
                day_story="DEV seed block",
                status=BlockStatus.PENDING,
            )
            db.add(block)
            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' created (EE1 / Order A / is_test=True) — "
                "remove DEV_TOKEN before production!"
            )


async def get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session
