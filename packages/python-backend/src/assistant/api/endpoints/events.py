"""Events API routes for the calendar sub-agent."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...schemas.events import (
    EventChatRequest,
    EventChatResponse,
    CreatedEventItem,
    EventModification,
    ChatMessage,
)
from ...agent.llm import create_llm
from ...experts import parse_llm_json
from ...db.session import get_db
from ...db.repositories.chat_repository import ChatSessionRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])


def generate_series_dates(
    start: datetime,
    end: datetime,
    repeat_every_days: int,
    skip_weekends: bool = False,
    max_weeks: int = 12,
    max_events: int = 60,
) -> list[tuple[datetime, datetime]]:
    """Generate recurring event dates for a series.

    Args:
        start: First event start datetime.
        end: First event end datetime.
        repeat_every_days: Days between occurrences.
        skip_weekends: Whether to skip Saturday/Sunday.
        max_weeks: Maximum number of weeks to generate events for.
        max_events: Maximum number of events to generate.

    Returns:
        List of (start, end) datetime tuples.
    """
    duration = end - start
    dates = []
    current_start = start
    cutoff = start + timedelta(weeks=max_weeks)

    while len(dates) < max_events and current_start < cutoff:
        if skip_weekends and current_start.weekday() >= 5:
            current_start += timedelta(days=1)
            continue

        dates.append((current_start, current_start + duration))
        current_start += timedelta(days=repeat_every_days)

        # When skipping weekends, advance past them
        if skip_weekends:
            while current_start.weekday() >= 5:
                current_start += timedelta(days=1)

    return dates


def build_event_system_prompt(
    now: datetime,
    user_timezone: str,
    team_members: list[dict],
) -> str:
    """Build the system prompt for the calendar event sub-agent."""
    day_of_week = now.strftime("%A")
    members_text = "\n".join(
        [f"  - {m['name']} (id: {m['user_id']})" for m in team_members]
    ) if team_members else "  (no team members provided)"

    return f"""You are a calendar event assistant. You help users create, modify, and cancel team events through natural language.

CURRENT CONTEXT:
- Current date/time: {now.isoformat()}
- Day of week: {day_of_week}
- User timezone: {user_timezone}

TEAM MEMBERS (use these IDs for attendee matching):
{members_text}

EVENT FIELD DEFINITIONS:
- title: Event title (required)
- description: Optional description
- location: Optional location
- start_date: ISO datetime (required)
- end_date: ISO datetime (required)
- availability: busy (default) | free | working_elsewhere | tentative | out_of_office
- is_private: false (default) - only creator and attendees can see private events
- attendee_ids: list of user IDs to invite

DATETIME DEFAULTS:
- Single day event without time: 9:00 AM to 5:00 PM in user timezone
- Multi-day event: 9:00 AM on first day to 5:00 PM on last day
- "Tomorrow at 10am" → next day at 10:00 to 11:00 (1 hour default duration)
- "All day Friday" → Friday 9:00 AM to 5:00 PM
- Always use the user's timezone for interpreting times

AVAILABILITY MAPPING:
- "busy" → default for meetings, standups, syncs
- "out_of_office" → OOO, vacation, day off, sick day
- "working_elsewhere" → WFH, remote, working from...
- "tentative" → maybe, tentative, might attend
- "free" → free, available, open

SERIES/RECURRING EVENTS:
- ONLY create series when user explicitly says "recurring", "series", "every X days", "weekly", "daily", etc.
- For series: set is_series=true, repeat_every_days=N, skip_weekends as needed
- "weekly" → repeat_every_days=7
- "daily" → repeat_every_days=1
- "every other week" / "biweekly" → repeat_every_days=14
- The Next.js backend will generate individual events from the series definition

ATTENDEE MATCHING:
- Match team member names mentioned by the user to their IDs
- Case-insensitive, partial name matching is OK
- "with Erik" → find Erik's user_id in team members
- "the whole team" or "everyone" → include all team member IDs
- Always include the requesting user as an attendee

PRIVACY:
- Set is_private=true when user says "private", "1:1", "one-on-one", or "confidential"

AUTO-CREATE RULE:
When you have at least a title AND a start date, return the JSON immediately without asking for confirmation.
After creating, provide a friendly summary of what was created.

MODIFY RULES:
When user says reschedule/move/change/update → ask which event if ambiguous → apply changes.
Return modifications with the event_id and updated fields.

CANCEL RULES:
When user says cancel/delete/remove → ask which event if ambiguous → return cancelled event IDs.

RESPONSE FORMAT:
When ready to create/modify/cancel, respond ONLY with this JSON:
{{
    "ready": true,
    "action": "create" | "modify" | "cancel",
    "events": [
        {{
            "title": "...",
            "description": "..." or null,
            "location": "..." or null,
            "start_date": "ISO datetime",
            "end_date": "ISO datetime",
            "attendee_ids": ["id1", "id2"],
            "availability": "busy",
            "is_private": false,
            "is_series": false,
            "repeat_every_days": null,
            "skip_weekends": false
        }}
    ],
    "modifications": [
        {{
            "event_id": "...",
            "updates": {{"field": "new_value"}}
        }}
    ],
    "cancelled_event_ids": ["id1"],
    "summary": "Friendly summary of what was done"
}}

When you need more information, respond with plain text asking the user.

IMPORTANT:
- Be concise and friendly
- Don't ask for confirmation when you have enough info - just create
- Default to reasonable values (1 hour meetings, busy availability, etc.)
- For vague requests, ask ONE clarifying question"""


async def process_event_chat(
    session_id: str,
    user_message: str,
    user_timezone: str,
    team_members: list[dict],
    chat_history: list[dict],
) -> EventChatResponse:
    """Core event chat logic, reusable from both the /events/chat route and the /updates/chat route.

    Args:
        session_id: Chat session identifier.
        user_message: The user's message.
        user_timezone: User's timezone string.
        team_members: List of dicts with 'user_id' and 'name' keys.
        chat_history: Mutable list of chat history dicts (user message should already be appended).

    Returns:
        EventChatResponse with parsed event data or clarification.
    """
    llm = create_llm()
    now = datetime.now(timezone.utc)

    # Build system prompt
    system_prompt = build_event_system_prompt(now, user_timezone, team_members)

    # Build messages for LLM
    messages = [
        {"role": "system", "content": system_prompt},
    ]
    for msg in chat_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Get LLM response
    response = await llm.ainvoke(messages)
    assistant_content = response.content.strip()

    # Add assistant response to history
    chat_history.append({"role": "assistant", "content": assistant_content})

    # Try to parse as JSON action
    created_events: list[CreatedEventItem] = []
    modifications: list[EventModification] = []
    cancelled_event_ids: list[str] = []
    needs_clarification = True
    action_type = "none"

    try:
        result = parse_llm_json(assistant_content)
        if result.get("ready"):
            needs_clarification = False
            action_type = result.get("action", "none")
            summary = result.get("summary", "Done!")

            # Extract created events
            for evt in result.get("events", []):
                created_events.append(CreatedEventItem(
                    title=evt.get("title", "Untitled Event"),
                    description=evt.get("description"),
                    location=evt.get("location"),
                    start_date=evt["start_date"],
                    end_date=evt["end_date"],
                    attendee_ids=evt.get("attendee_ids", []),
                    availability=evt.get("availability", "busy"),
                    is_private=evt.get("is_private", False),
                    is_series=evt.get("is_series", False),
                    repeat_every_days=evt.get("repeat_every_days"),
                    skip_weekends=evt.get("skip_weekends", False),
                ))

            # Extract modifications
            for mod in result.get("modifications", []):
                modifications.append(EventModification(
                    event_id=mod["event_id"],
                    updates=mod.get("updates", {}),
                ))

            # Extract cancellations
            cancelled_event_ids = result.get("cancelled_event_ids", [])

            # Use the summary as the assistant message
            assistant_content = summary

    except (ValueError, KeyError):
        # Not JSON - it's a clarification question
        pass

    # Convert chat history to ChatMessage objects
    chat_messages = [
        ChatMessage(role=msg["role"], content=msg["content"])
        for msg in chat_history
    ]

    return EventChatResponse(
        session_id=session_id,
        assistant_message=assistant_content,
        needs_clarification=needs_clarification,
        created_events=created_events,
        modifications=modifications,
        cancelled_event_ids=cancelled_event_ids,
        chat_history=chat_messages,
        action_type=action_type,
    )


@router.post("/chat", response_model=EventChatResponse)
async def event_chat(
    request: EventChatRequest,
    db: AsyncSession = Depends(get_db),
) -> EventChatResponse:
    """Handle conversational event creation/modification/cancellation.

    This endpoint uses an LLM to interpret natural language event requests
    and returns structured event data for the Next.js backend to persist.
    """
    logger.info(f"Received event chat for session: {request.session_id}")

    try:
        # Load chat history from database
        chat_repo = ChatSessionRepository(db)
        chat_history = await chat_repo.get_chat_history(request.session_id)

        # Add user message to history
        chat_history.append({"role": "user", "content": request.user_message})

        # Build team members dicts
        team_members_dicts = [
            {"user_id": m.user_id, "name": m.name}
            for m in request.team_members
        ]

        return await process_event_chat(
            session_id=request.session_id,
            user_message=request.user_message,
            user_timezone=request.user_timezone,
            team_members=team_members_dicts,
            chat_history=chat_history,
        )

    except Exception as e:
        logger.error(f"Error in event chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process event request")


@router.delete("/chat/{session_id}")
async def clear_event_chat_session(session_id: str):
    """Clear an event chat session's transient state."""
    return {"success": True}
