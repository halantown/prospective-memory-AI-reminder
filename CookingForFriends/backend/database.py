"""Database engine and session factory (async SQLAlchemy + aiosqlite)."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from config import DB_PATH

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables."""
    from models.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """Yield a database session."""
    async with async_session() as session:
        yield session
