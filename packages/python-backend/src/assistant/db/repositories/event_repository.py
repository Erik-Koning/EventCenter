"""Event repository for database operations."""

import logging
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.events import TeamEvent, TeamEventAttendee

logger = logging.getLogger(__name__)


class EventRepository:
    """Repository for TeamEvent and TeamEventAttendee CRUD operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_id(self) -> str:
        return str(uuid.uuid4()).replace("-", "")[:25]

    async def create_event(
        self,
        team_id: str,
        created_by_id: str,
        title: str,
        start_date: datetime,
        end_date: datetime,
        attendee_ids: List[str] = [],
        description: Optional[str] = None,
        location: Optional[str] = None,
        availability: str = "busy",
        is_private: bool = False,
        series_id: Optional[str] = None,
        is_series: bool = False,
        repeat_every_days: Optional[int] = None,
        skip_weekends: bool = False,
    ) -> TeamEvent:
        """Create an event with attendees."""
        event = TeamEvent(
            id=self._generate_id(),
            team_id=team_id,
            created_by_id=created_by_id,
            title=title,
            description=description,
            location=location,
            start_date=start_date,
            end_date=end_date,
            availability=availability,
            is_private=is_private,
            series_id=series_id,
            is_series=is_series,
            repeat_every_days=repeat_every_days,
            skip_weekends=skip_weekends,
        )
        self.db.add(event)
        await self.db.flush()

        for user_id in attendee_ids:
            attendee = TeamEventAttendee(
                id=self._generate_id(),
                event_id=event.id,
                user_id=user_id,
                response_status="pending",
            )
            self.db.add(attendee)

        await self.db.flush()
        return event

    async def get_events_by_team(
        self,
        team_id: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[TeamEvent]:
        """Get events for a team within an optional date range."""
        stmt = (
            select(TeamEvent)
            .where(TeamEvent.team_id == team_id)
            .options(selectinload(TeamEvent.attendees))
            .order_by(TeamEvent.start_date)
        )

        if start:
            stmt = stmt.where(TeamEvent.end_date >= start)
        if end:
            stmt = stmt.where(TeamEvent.start_date <= end)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_event_by_id(self, event_id: str) -> Optional[TeamEvent]:
        """Get a single event with attendees."""
        stmt = (
            select(TeamEvent)
            .where(TeamEvent.id == event_id)
            .options(selectinload(TeamEvent.attendees))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_event(self, event_id: str, **fields) -> Optional[TeamEvent]:
        """Partially update an event."""
        fields["updated_at"] = datetime.utcnow()
        stmt = (
            update(TeamEvent)
            .where(TeamEvent.id == event_id)
            .values(**fields)
        )
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_event_by_id(event_id)

    async def cancel_event(self, event_id: str) -> Optional[TeamEvent]:
        """Cancel an event by setting status to cancelled."""
        return await self.update_event(event_id, status="cancelled")

    async def get_series_events(self, series_id: str) -> List[TeamEvent]:
        """Get all events in a series."""
        stmt = (
            select(TeamEvent)
            .where(TeamEvent.series_id == series_id)
            .options(selectinload(TeamEvent.attendees))
            .order_by(TeamEvent.start_date)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
