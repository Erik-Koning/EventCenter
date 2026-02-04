"""Async SQLAlchemy engine with asyncpg driver."""

import ssl
import logging

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from ..config import settings

logger = logging.getLogger(__name__)


def _create_engine():
    """Create the async engine based on configuration."""
    url = settings.async_database_url
    if not url:
        logger.warning("No database URL configured - database operations will fail")
        return None

    # SSL configuration for Azure PostgreSQL
    connect_args = {}
    if settings.db_ssl != "false":
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_context

    engine = create_async_engine(
        url,
        echo=settings.debug,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    logger.info(f"Created async database engine (ssl={settings.db_ssl != 'false'})")
    return engine


async_engine = _create_engine()

AsyncSessionFactory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
) if async_engine else None
