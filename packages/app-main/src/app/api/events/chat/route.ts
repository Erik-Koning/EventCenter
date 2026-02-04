import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  teamMembers,
  teamEvents,
  teamEventAttendees,
  chatSessions,
  chatMessages,
} from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { isTeamMember } from "@/lib/team-authorization";
import { createId } from "@/lib/utils";

const eventChatRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1, "Message cannot be empty"),
  teamId: z.string(),
});

interface CreatedEventItem {
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  attendee_ids: string[];
  availability: string;
  is_private: boolean;
  is_series: boolean;
  repeat_every_days: number | null;
  skip_weekends: boolean;
}

interface EventModification {
  event_id: string;
  updates: Record<string, string>;
}

interface PythonEventChatResponse {
  session_id: string;
  assistant_message: string;
  needs_clarification: boolean;
  created_events: CreatedEventItem[];
  modifications: EventModification[];
  cancelled_event_ids: string[];
  chat_history: { role: string; content: string }[];
  action_type: string;
}

/**
 * Generate series dates for recurring events.
 */
function generateSeriesDates(
  start: Date,
  end: Date,
  repeatEveryDays: number,
  skipWeekends: boolean,
  maxWeeks = 12,
  maxEvents = 60
): { start: Date; end: Date }[] {
  const duration = end.getTime() - start.getTime();
  const dates: { start: Date; end: Date }[] = [];
  let currentStart = new Date(start);
  const cutoff = new Date(start.getTime() + maxWeeks * 7 * 24 * 60 * 60 * 1000);

  while (dates.length < maxEvents && currentStart < cutoff) {
    if (skipWeekends && (currentStart.getDay() === 0 || currentStart.getDay() === 6)) {
      currentStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }

    dates.push({
      start: new Date(currentStart),
      end: new Date(currentStart.getTime() + duration),
    });

    currentStart = new Date(currentStart.getTime() + repeatEveryDays * 24 * 60 * 60 * 1000);

    if (skipWeekends) {
      while (currentStart.getDay() === 0 || currentStart.getDay() === 6) {
        currentStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }

  return dates;
}

/**
 * POST /api/events/chat - Conversational event creation via LLM
 */
export async function POST(request: Request) {
  const authResult = await requireAuth({ rateLimit: "standard_llm" });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = eventChatRequestSchema.parse(body);

    // Verify team membership
    const isMember = await isTeamMember(validated.teamId, user.id);
    if (!isMember) {
      return apiError("Not a member of this team", ErrorCode.FORBIDDEN, 403);
    }

    // Get user timezone
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { timezone: true },
    });

    // Fetch team members for the LLM
    const members = await db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, validated.teamId),
      with: {
        user: {
          columns: { id: true, name: true },
        },
      },
    });

    const teamMembersList = members.map((m) => ({
      user_id: m.user.id,
      name: m.user.name,
    }));

    // Create/find chat session
    let chatSession = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.sessionId, validated.sessionId),
    });

    if (!chatSession) {
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          id: createId(),
          sessionId: validated.sessionId,
          userId: user.id,
          teamId: validated.teamId,
          updatePeriod: "event_chat",
          periodDate: new Date().toISOString().split("T")[0],
          status: "active",
        })
        .returning();
      chatSession = newSession;
    }

    // Save user message
    await db.insert(chatMessages).values({
      id: createId(),
      chatSessionId: chatSession.id,
      role: "user",
      content: validated.message,
    });

    // Call Python backend
    const pythonBackendUrl =
      process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

    const chatResponse = await fetch(
      `${pythonBackendUrl}/api/v1/events/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: validated.sessionId,
          user_message: validated.message,
          team_id: validated.teamId,
          user_id: user.id,
          user_timezone: dbUser?.timezone || "UTC",
          team_members: teamMembersList,
        }),
      }
    );

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("Python backend error:", errorText);
      return apiError(
        "Failed to process event request",
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        502
      );
    }

    const chatResult: PythonEventChatResponse = await chatResponse.json();

    // Save assistant message
    await db.insert(chatMessages).values({
      id: createId(),
      chatSessionId: chatSession.id,
      role: "assistant",
      content: chatResult.assistant_message,
    });

    // Handle event creation
    const savedEventIds: string[] = [];

    if (chatResult.action_type === "create" && chatResult.created_events.length > 0) {
      await db.transaction(async (tx) => {
        for (const eventItem of chatResult.created_events) {
          const startDate = new Date(eventItem.start_date);
          const endDate = new Date(eventItem.end_date);

          // Handle series events
          if (eventItem.is_series && eventItem.repeat_every_days) {
            const seriesId = createId();
            const seriesDates = generateSeriesDates(
              startDate,
              endDate,
              eventItem.repeat_every_days,
              eventItem.skip_weekends
            );

            for (const datePair of seriesDates) {
              const eventId = createId();
              await tx.insert(teamEvents).values({
                id: eventId,
                teamId: validated.teamId,
                createdById: user.id,
                title: eventItem.title,
                description: eventItem.description,
                location: eventItem.location,
                startDate: datePair.start,
                endDate: datePair.end,
                availability: eventItem.availability,
                isPrivate: eventItem.is_private,
                seriesId,
                isSeries: true,
                repeatEveryDays: eventItem.repeat_every_days,
                skipWeekends: eventItem.skip_weekends,
                status: "active",
              });

              // Add attendees
              const attendeeIds = eventItem.attendee_ids.length > 0
                ? eventItem.attendee_ids
                : [user.id];
              for (const attendeeId of attendeeIds) {
                await tx.insert(teamEventAttendees).values({
                  id: createId(),
                  eventId,
                  userId: attendeeId,
                  responseStatus: attendeeId === user.id ? "accepted" : "pending",
                });
              }

              savedEventIds.push(eventId);
            }
          } else {
            // Single event
            const eventId = createId();
            await tx.insert(teamEvents).values({
              id: eventId,
              teamId: validated.teamId,
              createdById: user.id,
              title: eventItem.title,
              description: eventItem.description,
              location: eventItem.location,
              startDate,
              endDate,
              availability: eventItem.availability,
              isPrivate: eventItem.is_private,
              status: "active",
            });

            // Add attendees
            const attendeeIds = eventItem.attendee_ids.length > 0
              ? eventItem.attendee_ids
              : [user.id];
            for (const attendeeId of attendeeIds) {
              await tx.insert(teamEventAttendees).values({
                id: createId(),
                eventId,
                userId: attendeeId,
                responseStatus: attendeeId === user.id ? "accepted" : "pending",
              });
            }

            savedEventIds.push(eventId);
          }
        }
      });
    }

    // Handle modifications
    if (chatResult.action_type === "modify" && chatResult.modifications.length > 0) {
      await db.transaction(async (tx) => {
        for (const mod of chatResult.modifications) {
          const updateFields: Record<string, unknown> = { updatedAt: new Date() };
          for (const [key, value] of Object.entries(mod.updates)) {
            if (key === "start_date") updateFields.startDate = new Date(value);
            else if (key === "end_date") updateFields.endDate = new Date(value);
            else if (key === "title") updateFields.title = value;
            else if (key === "description") updateFields.description = value;
            else if (key === "location") updateFields.location = value;
            else if (key === "availability") updateFields.availability = value;
          }
          await tx
            .update(teamEvents)
            .set(updateFields)
            .where(eq(teamEvents.id, mod.event_id));
        }
      });
    }

    // Handle cancellations
    if (chatResult.action_type === "cancel" && chatResult.cancelled_event_ids.length > 0) {
      await db.transaction(async (tx) => {
        for (const eventId of chatResult.cancelled_event_ids) {
          await tx
            .update(teamEvents)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(teamEvents.id, eventId));
        }
      });
    }

    return NextResponse.json({
      ...chatResult,
      saved: chatResult.action_type !== "none",
      savedEventIds,
    });
  } catch (error) {
    return handleApiError(error, "events/chat:POST");
  }
}

/**
 * DELETE /api/events/chat - Clear event chat session
 */
export async function DELETE(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return apiError("Session ID required", ErrorCode.BAD_REQUEST, 400);
    }

    const pythonBackendUrl =
      process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

    await fetch(`${pythonBackendUrl}/api/v1/events/chat/${sessionId}`, {
      method: "DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "events/chat:DELETE");
  }
}
