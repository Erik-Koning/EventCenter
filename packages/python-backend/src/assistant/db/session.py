"""FastAPI dependency injection for database sessions."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from .engine import AsyncSessionFactory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an async database session.

    Usage:
        @router.post("/example")
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    if AsyncSessionFactory is None:
        raise RuntimeError("Database is not configured. Set DATABASE_URL or DB_* env vars.")

    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
