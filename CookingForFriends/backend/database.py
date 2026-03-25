"""Database engine and session factory (async SQLAlchemy + aiosqlite)."""

import uuid
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
        from models.experiment import Experiment, ExperimentStatus

        # Ensure a dev experiment exists
        exp_result = await db.execute(select(Experiment).limit(1))
        experiment = exp_result.scalar_one_or_none()
        if experiment is None:
            experiment = Experiment(name="DEV Experiment", status=ExperimentStatus.ACTIVE)
            db.add(experiment)
            await db.flush()  # get experiment.id

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

            # Also reset all blocks back to PENDING and clear runtime data
            from sqlalchemy import update as sql_update
            from models.block import Block, BlockStatus, PMTrial
            await db.execute(
                sql_update(Block)
                .where(Block.participant_id == p.id)
                .values(
                    status=BlockStatus.PENDING,
                    started_at=None,
                    ended_at=None,
                    nasa_tlx=None,
                )
            )
            # Reset PM trial runtime fields (scores, timing)
            block_result = await db.execute(
                select(Block.id).where(Block.participant_id == p.id)
            )
            block_ids = [r[0] for r in block_result.all()]
            if block_ids:
                await db.execute(
                    sql_update(PMTrial)
                    .where(PMTrial.block_id.in_(block_ids))
                    .values(
                        trigger_fired_at=None,
                        exec_window_start=None,
                        exec_window_end=None,
                        user_actions=None,
                        score=None,
                        response_time_ms=None,
                        resumption_lag_ms=None,
                        reminder_played_at=None,
                    )
                )

            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' reset to REGISTERED (blocks reset to PENDING) — "
                "remove config.DEV_TOKEN before production!"
            )
        else:
            group = list(LATIN_SQUARE.keys())[0]
            pid = str(uuid.uuid4())[:8]
            p = Participant(
                id=pid,
                experiment_id=experiment.id,
                participant_id="DEV_TESTER",
                token=DEV_TOKEN,
                status=ParticipantStatus.REGISTERED,
                latin_square_group=group,
                condition_order=LATIN_SQUARE[group],
            )
            db.add(p)
            await db.flush()

            # Pre-create blocks and PM trials using real task registry
            from models.block import Block, BlockStatus, PMTrial
            from engine.pm_tasks import (
                get_task, BLOCK_TRIGGER_ORDER, BLOCK_GUESTS,
            )
            from engine.pm_tasks import task_def_to_config, task_def_to_encoding_card

            for i, condition in enumerate(LATIN_SQUARE[group], start=1):
                block = Block(
                    participant_id=pid,
                    block_number=i,
                    condition=condition,
                    day_story=f"Day {i}: Cooking steak dinner for {BLOCK_GUESTS[i]}",
                    status=BlockStatus.PENDING,
                )
                db.add(block)
                await db.flush()

                trigger_order = BLOCK_TRIGGER_ORDER[i]
                # For dev: trial 4 (last) is unreminded in AF/AFCB
                for trial_idx, task_id in enumerate(trigger_order):
                    task_def = get_task(task_id)
                    is_unreminded = (trial_idx == 3)  # last trial
                    has_reminder = (condition != "CONTROL") and (not is_unreminded)

                    trial = PMTrial(
                        block_id=block.id,
                        trial_number=trial_idx + 1,
                        has_reminder=has_reminder,
                        is_filler=(is_unreminded and condition != "CONTROL"),
                        task_config=task_def_to_config(task_def),
                        encoding_card=task_def_to_encoding_card(task_def),
                        reminder_text=(
                            task_def.baseline_reminder if has_reminder else None
                        ),
                        reminder_condition=condition if has_reminder else None,
                    )
                    db.add(trial)

            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' created (group={group}) — "
                "remove config.DEV_TOKEN before production!"
            )


async def get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session

