"""Goal-related Pydantic schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GoalReviewRequest(BaseModel):
    """Request schema for goal review."""

    goal_id: str = Field(..., description="Unique identifier for the goal")
    title: str = Field(..., description="Goal title")
    description: str = Field(..., description="Detailed goal description")
    target_date: Optional[str] = Field(None, description="Target completion date")


class ExpertFeedback(BaseModel):
    """Feedback from a single expert."""

    expert_type: str = Field(..., description="Type/ID of the expert")
    expert_name: str = Field(..., description="Display name of the expert")
    score: int = Field(..., ge=1, le=10, description="Score from 1-10")
    feedback: str = Field(..., description="Detailed feedback text")
    suggestions: list[str] = Field(default_factory=list, description="Actionable suggestions")


class GoalReviewResponse(BaseModel):
    """Response schema for goal review."""

    goal_id: str
    overall_score: float = Field(..., ge=0, le=10, description="Average score across all experts")
    summary: str = Field(..., description="Synthesized summary from all experts")
    experts: list[ExpertFeedback] = Field(default_factory=list)
    reviewed_at: datetime = Field(default_factory=datetime.utcnow)


class GoalRevisionRequest(BaseModel):
    """Request schema for AI-powered goal revision."""

    title: str = Field(..., description="Goal title")
    description: str = Field(..., description="Goal description to revise")


class GoalRevisionResponse(BaseModel):
    """Response schema for goal revision."""

    original_title: str
    original_description: str
    revised_title: str
    revised_description: str
    improvements: list[str] = Field(default_factory=list, description="List of improvements made")
    specificity_score: int = Field(..., ge=1, le=10, description="How specific/measurable the goal is")


class UpdateParseRequest(BaseModel):
    """Request schema for parsing user updates."""

    goal_id: str
    raw_text: str = Field(..., description="Free-form update text from user")


class ParsedActivity(BaseModel):
    """A single parsed activity from user update."""

    activity_type: str = Field(..., description="Type: progress, obstacle, milestone, reflection")
    description: str
    metric: Optional[dict] = Field(None, description="Quantified metric if applicable")


class UpdateParseResponse(BaseModel):
    """Response schema for parsed update."""

    goal_id: str
    activities: list[ParsedActivity] = Field(default_factory=list)
    sentiment: str = Field(..., description="positive, neutral, or negative")
    momentum_score: int = Field(..., ge=1, le=10, description="Overall momentum/progress score")
    summary: str = Field(..., description="Brief summary of the update")


# ============================================
# ACTIVITY EXTRACTION SCHEMAS (for /update page)
# ============================================

# Valid activity types
VALID_ACTIVITY_TYPES = [
    "experiments",
    "product_demos",
    "mentoring",
    "presentations",
    "volunteering",
    "general_task",
    "research_learning",
    "networking",
]


class ExtractActivityRequest(BaseModel):
    """Request schema for extracting activities from daily update text."""

    raw_text: str = Field(..., description="Free-form update text from user")
    user_timezone: str = Field(default="UTC", description="User's timezone for date inference")


class ExtractedActivityItem(BaseModel):
    """A single extracted activity with category and quantity."""

    activity_type: str = Field(
        ...,
        description="Category: experiments, product_demos, mentoring, presentations, volunteering, general_task, research_learning, or networking"
    )
    quantity: float = Field(default=1.0, description="Number of activities (default 1)")
    summary: str = Field(..., description="Brief description of the activity")
    activity_date: str = Field(..., description="ISO date string (YYYY-MM-DD)")


class ExtractActivitiesResponse(BaseModel):
    """Response schema for extracted activities."""

    activities: list[ExtractedActivityItem] = Field(default_factory=list)
    raw_summary: str = Field(..., description="Summary of the raw text input")


# ============================================
# FOLLOW-UP SCHEMAS
# ============================================

class ProposedFollowUp(BaseModel):
    """A proposed follow-up for an extracted activity."""

    activity_index: int = Field(..., description="0-based index of activity in the activities list")
    activity_type: str = Field(default="", description="Activity type from the linked activity")
    title: str = Field(..., max_length=255, description="Short title for the follow-up reminder")
    summary: str = Field(..., description="Why this follow-up is valuable")
    suggested_days: Optional[int] = Field(None, description="Suggested days until follow-up")


class FollowUpConfirmationResult(BaseModel):
    """Result of user confirming/dismissing follow-up proposals."""

    approved_indices: list[int] = Field(default_factory=list, description="Indices of approved follow-ups")
    dismissed_indices: list[int] = Field(default_factory=list, description="Indices of dismissed follow-ups")
    session_id: str = Field(..., description="Chat session ID")


# ============================================
# CONVERSATIONAL UPDATE SCHEMAS
# ============================================

class ChatMessage(BaseModel):
    """A single chat message in the conversation."""

    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class TeamMemberInfo(BaseModel):
    """Team member info for event attendee matching."""

    user_id: str
    name: str


class ConversationalUpdateRequest(BaseModel):
    """Request schema for conversational update extraction."""

    session_id: str = Field(..., description="Unique session ID for chat history")
    user_message: str = Field(..., description="User's message in the conversation")
    user_timezone: str = Field(default="UTC", description="User's timezone for date inference")
    # Optional team context for calendar sub-agent routing
    team_id: Optional[str] = Field(default=None, description="Team ID (needed for event creation)")
    user_id: Optional[str] = Field(default=None, description="User ID (needed for event creation)")
    team_members: list[TeamMemberInfo] = Field(
        default_factory=list, description="Team members for attendee matching"
    )


class ConversationalUpdateResponse(BaseModel):
    """Response schema for conversational update."""

    session_id: str
    assistant_message: str = Field(..., description="Assistant's response message")
    needs_clarification: bool = Field(
        default=False,
        description="True if the assistant needs more info from user"
    )
    activities: list[ExtractedActivityItem] = Field(
        default_factory=list,
        description="Extracted activities (only populated when extraction is complete)"
    )
    raw_summary: str = Field(default="", description="Summary of extracted activities")
    chat_history: list[ChatMessage] = Field(
        default_factory=list,
        description="Full chat history for this session"
    )
    # Follow-up proposal fields
    proposed_follow_ups: list[ProposedFollowUp] = Field(
        default_factory=list,
        description="Proposed follow-ups for extracted activities"
    )
    follow_up_analysis_summary: str = Field(
        default="",
        description="Summary of why follow-ups are proposed"
    )
    awaiting_followup_confirmation: bool = Field(
        default=False,
        description="True if waiting for user to confirm/dismiss follow-ups"
    )
    followup_confirmation_result: Optional[FollowUpConfirmationResult] = Field(
        default=None,
        description="Result when user confirms/dismisses follow-ups"
    )
    # Calendar sub-agent fields (populated when event intent detected)
    event_action: Optional[str] = Field(
        default=None,
        description="Event action type: create | modify | cancel | None"
    )
    created_events: list[dict] = Field(
        default_factory=list,
        description="Events created by the calendar sub-agent"
    )
    modifications: list[dict] = Field(
        default_factory=list,
        description="Event modifications from the calendar sub-agent"
    )
    cancelled_event_ids: list[str] = Field(
        default_factory=list,
        description="Event IDs cancelled by the calendar sub-agent"
    )
