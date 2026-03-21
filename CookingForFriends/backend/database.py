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
            await db.commit()
            logger.warning(
                f"⚠️  DEV_TOKEN '{DEV_TOKEN}' reset to REGISTERED — "
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

            # Pre-create blocks and PM trials (mirrors admin.py create_participant)
            from models.block import Block, BlockStatus, PMTrial
            day_stories = [
                "Day 1: Cooking steak dinner for Alice",
                "Day 2: Preparing pasta for Bob and Carol",
                "Day 3: Making soup for David and Emma",
            ]
            for i, condition in enumerate(LATIN_SQUARE[group], start=1):
                block = Block(
                    participant_id=pid,
                    block_number=i,
                    condition=condition,
                    day_story=day_stories[i - 1],
                    status=BlockStatus.PENDING,
                )
                db.add(block)
                await db.flush()

                reminder_flags = (
                    [False, False, False, False] if condition == "CONTROL"
                    else [True, True, True, False]
                )
                for trial_num in range(1, 5):
                    trial = PMTrial(
                        block_id=block.id,
                        trial_number=trial_num,
                        has_reminder=reminder_flags[trial_num - 1],
                        is_filler=(not reminder_flags[trial_num - 1] and condition != "CONTROL"),
                        task_config=_dev_task_config(i, trial_num),
                        encoding_card=_dev_encoding_card(i, trial_num),
                        reminder_text=(
                            f"[DEV] {condition} reminder placeholder"
                            if reminder_flags[trial_num - 1] else None
                        ),
                        reminder_condition=condition if reminder_flags[trial_num - 1] else None,
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


_DEV_ENCODING_CARDS = [
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


def _dev_encoding_card(block_num: int, trial_num: int) -> dict:
    return _DEV_ENCODING_CARDS[(trial_num - 1) % len(_DEV_ENCODING_CARDS)]


_DEV_TASK_CONFIGS = [
    {
        "task_id": "pm_t1",
        "trigger_event": "doorbell",
        "target_room": "living_room",
        "target_object": "red_book",
        "target_action": "give_to_friend",
        "distractor_object": "blue_book",
    },
    {
        "task_id": "pm_t2",
        "trigger_event": "email_dentist",
        "target_room": "study",
        "target_object": "calendar",
        "target_action": "mark_appointment",
        "distractor_object": "notebook",
    },
    {
        "task_id": "pm_t3",
        "trigger_event": "washing_done",
        "target_room": "balcony",
        "target_object": "black_sweater",
        "target_action": "hang_to_dry",
        "distractor_object": "gray_sweater",
    },
    {
        "task_id": "pm_t4",
        "trigger_event": "clock_6pm",
        "target_room": "kitchen",
        "target_object": "red_medicine_bottle",
        "target_action": "take_medicine",
        "distractor_object": "orange_vitamin_bottle",
    },
]


def _dev_task_config(block_num: int, trial_num: int) -> dict:
    cfg = dict(_DEV_TASK_CONFIGS[(trial_num - 1) % len(_DEV_TASK_CONFIGS)])
    cfg["task_id"] = f"pm_b{block_num}_t{trial_num}"
    return cfg
