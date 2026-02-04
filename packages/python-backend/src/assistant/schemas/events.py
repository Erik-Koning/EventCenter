"""Event-related Pydantic schemas for the calendar sub-agent."""

from typing import Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single chat message."""
    role: str = Field(..., description="Message role: user or assistant")
    content: str = Field(..., description="Message content")


class EventAttendeeInfo(BaseModel):
    """Team member info passed to the LLM for attendee matching."""
    user_id: str
    name: str


class EventChatRequest(BaseModel):
    """Request for the event chat endpoint."""
    session_id: str = Field(..., description="Chat session identifier")
    user_message: str = Field(..., min_length=1, description="User's message")
    team_id: str = Field(..., description="Team ID for the event")
    user_id: str = Field(..., description="User ID of the requester")
    user_timezone: str = Field(default="UTC", description="User's timezone")
    team_members: list[EventAttendeeInfo] = Field(
        default_factory=list, description="Team members for attendee matching"
    )


class CreatedEventItem(BaseModel):
    """A single event to be created."""
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: str = Field(..., description="ISO datetime string")
    end_date: str = Field(..., description="ISO datetime string")
    attendee_ids: list[str] = Field(default_factory=list)
    availability: str = Field(default="busy")
    is_private: bool = Field(default=False)
    is_series: bool = Field(default=False)
    repeat_every_days: Optional[int] = None
    skip_weekends: bool = Field(default=False)


class EventModification(BaseModel):
    """A modification to an existing event."""
    event_id: str
    updates: dict[str, str] = Field(..., description="Field name to new value mapping")


class EventChatResponse(BaseModel):
    """Response from the event chat endpoint."""
    session_id: str
    assistant_message: str
    needs_clarification: bool = False
    created_events: list[CreatedEventItem] = Field(default_factory=list)
    modifications: list[EventModification] = Field(default_factory=list)
    cancelled_event_ids: list[str] = Field(default_factory=list)
    chat_history: list[ChatMessage] = Field(default_factory=list)
    action_type: str = Field(default="none", description="create | modify | cancel | none")
