"""Chat session repository for database operations."""

import logging
import uuid
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.chat import ChatSession, ChatMessage

logger = logging.getLogger(__name__)


class ChatSessionRepository:
    """Repository for ChatSession and ChatMessage CRUD operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_session_id(self, session_id: str) -> Optional[ChatSession]:
        """Get a chat session by its session_id, with messages loaded."""
        stmt = (
            select(ChatSession)
            .where(ChatSession.session_id == session_id)
            .options(selectinload(ChatSession.messages))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_chat_history(self, session_id: str) -> list[dict]:
        """Get chat history for a session as a list of dicts."""
        session = await self.get_by_session_id(session_id)
        if not session:
            return []

        return [
            {"role": msg.role, "content": msg.content}
            for msg in session.messages
        ]

    async def add_message(
        self, session_id: str, role: str, content: str
    ) -> Optional[ChatMessage]:
        """Add a message to an existing chat session."""
        session = await self.get_by_session_id(session_id)
        if not session:
            logger.warning(f"Chat session {session_id} not found for adding message")
            return None

        message = ChatMessage(
            id=str(uuid.uuid4()).replace("-", "")[:25],
            chat_session_id=session.id,
            role=role,
            content=content,
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def delete_session(self, session_id: str) -> bool:
        """Delete a chat session and its messages."""
        session = await self.get_by_session_id(session_id)
        if not session:
            return False

        stmt = delete(ChatSession).where(ChatSession.session_id == session_id)
        await self.db.execute(stmt)
        return True
