"""SQLAlchemy declarative base for all models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models.

    Note: Python does NOT manage schema migrations.
    Drizzle (TypeScript) is the source of truth for schema.
    Python models are read/write but never alter the schema.
    """
    pass
