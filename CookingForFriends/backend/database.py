"""Database engine and session factory (async SQLAlchemy + asyncpg)."""

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
        "pm_reminder_ack_timestamp FLOAT",
        "pm_item_options_shown_timestamp FLOAT",
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
    phone_msg_columns = [
        "correct_position_shown INTEGER",
    ]
    for column_sql in pm_task_columns:
        await conn.execute(text(f"ALTER TABLE pm_task_events ADD COLUMN IF NOT EXISTS {column_sql}"))
    for column_sql in fake_trigger_columns:
        await conn.execute(text(f"ALTER TABLE fake_trigger_events ADD COLUMN IF NOT EXISTS {column_sql}"))
    for column_sql in phone_msg_columns:
        await conn.execute(text(f"ALTER TABLE phone_message_logs ADD COLUMN IF NOT EXISTS {column_sql}"))


async def get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session
