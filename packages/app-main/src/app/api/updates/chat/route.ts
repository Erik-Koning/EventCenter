import { NextResponse } from "next/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  goals,
  userGoalSets,
  dailyUpdates,
  extractedActivities,
  chatSessions,
  chatMessages,
  updateFollowUps,
  teamMembers,
  teamEvents,
  teamEventAttendees,
} from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const chatRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1, "Message cannot be empty"),
  updatePeriod: z
    .enum(["morning", "afternoon", "evening", "full_day", "event_chat"])
    .default("full_day"),
  periodDate: z.string().optional(),
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExtractedActivityFromPython {
  activity_type: string;
  quantity: number;
  summary: string;
  activity_date: string;
}

interface ProposedFollowUp {
  activity_index: number;
  activity_type: string;
  title: string;
  summary: string;
  suggested_days: number | null;
}

interface FollowUpConfirmationResult {
  approved_indices: number[];
  dismissed_indices: number[];
  session_id: string;
}

interface CreatedEventFromPython {
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

interface EventModificationFromPython {
  event_id: string;
  updates: Record<string, string>;
}

interface PythonChatResponse {
  session_id: string;
  assistant_message: string;
  needs_clarification: boolean;
  activities: ExtractedActivityFromPython[];
  raw_summary: string;
  chat_history: ChatMessage[];
  // Follow-up fields
  proposed_follow_ups: ProposedFollowUp[];
  follow_up_analysis_summary: string;
  awaiting_followup_confirmation: boolean;
  followup_confirmation_result: FollowUpConfirmationResult | null;
  // Calendar sub-agent fields
  event_action: string | null;
  created_events: CreatedEventFromPython[];
  modifications: EventModificationFromPython[];
  cancelled_event_ids: string[];
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
 * Persist events from the calendar sub-agent to the database.
 */
async function persistCalendarEvents(
  chatResult: PythonChatResponse,
  teamId: string,
  userId: string
): Promise<string[]> {
  const savedEventIds: string[] = [];

  if (chatResult.event_action === "create" && chatResult.created_events?.length > 0) {
    await db.transaction(async (tx) => {
      for (const eventItem of chatResult.created_events) {
        const startDate = new Date(eventItem.start_date);
        const endDate = new Date(eventItem.end_date);

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
              teamId,
              createdById: userId,
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

            const attendeeIds = eventItem.attendee_ids.length > 0
              ? eventItem.attendee_ids
              : [userId];
            for (const attendeeId of attendeeIds) {
              await tx.insert(teamEventAttendees).values({
                id: createId(),
                eventId,
                userId: attendeeId,
                responseStatus: attendeeId === userId ? "accepted" : "pending",
              });
            }

            savedEventIds.push(eventId);
          }
        } else {
          const eventId = createId();
          await tx.insert(teamEvents).values({
            id: eventId,
            teamId,
            createdById: userId,
            title: eventItem.title,
            description: eventItem.description,
            location: eventItem.location,
            startDate,
            endDate,
            availability: eventItem.availability,
            isPrivate: eventItem.is_private,
            status: "active",
          });

          const attendeeIds = eventItem.attendee_ids.length > 0
            ? eventItem.attendee_ids
            : [userId];
          for (const attendeeId of attendeeIds) {
            await tx.insert(teamEventAttendees).values({
              id: createId(),
              eventId,
              userId: attendeeId,
              responseStatus: attendeeId === userId ? "accepted" : "pending",
            });
          }

          savedEventIds.push(eventId);
        }
      }
    });
  }

  // Handle modifications
  if (chatResult.event_action === "modify" && chatResult.modifications?.length > 0) {
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
  if (chatResult.event_action === "cancel" && chatResult.cancelled_event_ids?.length > 0) {
    await db.transaction(async (tx) => {
      for (const eventId of chatResult.cancelled_event_ids) {
        await tx
          .update(teamEvents)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(teamEvents.id, eventId));
      }
    });
  }

  return savedEventIds;
}

/**
 * Create calendar events for confirmed follow-ups that have due dates.
 * Returns mappings of followUpId → eventId so the caller can store linkedEventId.
 */
async function createFollowUpCalendarEvents(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  followUps: Array<{ id: string; title: string; summary: string; dueDate: string | null }>,
  teamId: string,
  userId: string
): Promise<Array<{ followUpId: string; eventId: string }>> {
  const mappings: Array<{ followUpId: string; eventId: string }> = [];

  for (const followUp of followUps) {
    if (!followUp.dueDate) continue;

    const dueDate = new Date(followUp.dueDate);
    const startDate = new Date(dueDate);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(dueDate);
    endDate.setHours(17, 0, 0, 0);

    const eventId = createId();
    await tx.insert(teamEvents).values({
      id: eventId,
      teamId,
      createdById: userId,
      title: followUp.title,
      description: `[Follow-up] ${followUp.summary}`,
      startDate,
      endDate,
      availability: "tentative",
      status: "active",
    });

    await tx.insert(teamEventAttendees).values({
      id: createId(),
      eventId,
      userId,
      responseStatus: "accepted",
    });

    mappings.push({ followUpId: followUp.id, eventId });
  }

  return mappings;
}

/**
 * POST /api/updates/chat - Conversational update extraction
 */
export async function POST(request: Request) {
  const authResult = await requireAuth({ rateLimit: "standard_llm" });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = chatRequestSchema.parse(body);

    const pythonBackendUrl =
      process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { timezone: true, activeTeamId: true },
    });

    // Fetch team members if user has an active team (for calendar sub-agent)
    let teamMembersList: { user_id: string; name: string }[] = [];
    const activeTeamId = dbUser?.activeTeamId || null;

    if (activeTeamId) {
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, activeTeamId),
        with: {
          user: {
            columns: { id: true, name: true },
          },
        },
      });
      teamMembersList = members.map((m) => ({
        user_id: m.user.id,
        name: m.user.name,
      }));
    }

    const updatePeriod = validated.updatePeriod;
    const periodDate = validated.periodDate
      ? new Date(validated.periodDate)
      : new Date();

    // Check if chat session exists, create if not
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
          updatePeriod,
          periodDate: periodDate.toISOString().split("T")[0],
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

    // Call Python backend chat endpoint
    const chatResponse = await fetch(
      `${pythonBackendUrl}/api/v1/updates/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: validated.sessionId,
          user_message: validated.message,
          user_timezone: dbUser?.timezone || "UTC",
          team_id: activeTeamId,
          user_id: user.id,
          team_members: teamMembersList,
        }),
      }
    );

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("Python backend error:", errorText);
      return apiError(
        "Failed to process message",
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        502
      );
    }

    const chatResult: PythonChatResponse = await chatResponse.json();

    console.log("[FOLLOW-UP] Python response:", {
      awaiting_followup_confirmation: chatResult.awaiting_followup_confirmation,
      proposed_follow_ups_count: chatResult.proposed_follow_ups?.length || 0,
      followup_confirmation_result: chatResult.followup_confirmation_result,
      activities_count: chatResult.activities?.length || 0,
    });

    // Save assistant message
    await db.insert(chatMessages).values({
      id: createId(),
      chatSessionId: chatSession.id,
      role: "assistant",
      content: chatResult.assistant_message,
    });

    // If awaiting follow-up confirmation, return without saving yet
    if (chatResult.awaiting_followup_confirmation) {
      return NextResponse.json({
        ...chatResult,
        saved: false,
        awaitingFollowUpConfirmation: true,
      });
    }

    // Handle calendar sub-agent responses
    if (chatResult.event_action && activeTeamId) {
      const savedEventIds = await persistCalendarEvents(
        chatResult,
        activeTeamId,
        user.id
      );

      return NextResponse.json({
        ...chatResult,
        saved: savedEventIds.length > 0,
        savedEventIds,
        isEventResponse: true,
      });
    }

    // If extraction is complete (no more clarification needed), save to database
    if (!chatResult.needs_clarification && chatResult.activities.length > 0) {
      // Get user's active goal set (optional)
      const activeGoalSet = await db.query.userGoalSets.findFirst({
        where: and(
          eq(userGoalSets.userId, user.id),
          eq(userGoalSets.status, "active")
        ),
        orderBy: [desc(userGoalSets.createdAt)],
      });

      // Get user's active goals for linking
      const activeGoals = await db.query.goals.findMany({
        where: and(eq(goals.userId, user.id), eq(goals.status, "active")),
        columns: {
          id: true,
          title: true,
          description: true,
        },
      });

      // Check for existing update
      const existingUpdate = await db.query.dailyUpdates.findFirst({
        where: and(
          eq(dailyUpdates.userId, user.id),
          eq(dailyUpdates.updatePeriod, updatePeriod),
          eq(dailyUpdates.periodDate, periodDate.toISOString().split("T")[0])
        ),
        with: {
          extractedActivities: true,
        },
      });

      // Compile full update text from chat history
      const userMessages = chatResult.chat_history
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n\n");

      // If existing update, APPEND to it instead of blocking
      if (existingUpdate) {
        const result = await db.transaction(async (tx) => {
          // Append new text to existing update
          const [updatedDailyUpdate] = await tx
            .update(dailyUpdates)
            .set({
              updateText:
                existingUpdate.updateText + "\n\n---\n\n" + userMessages,
            })
            .where(eq(dailyUpdates.id, existingUpdate.id))
            .returning();

          // Create new activities linked to existing update
          const newActivities = await Promise.all(
            chatResult.activities.map(async (activity) => {
              const linkedGoalId = findMatchingGoal(activity, activeGoals);

              const [created] = await tx
                .insert(extractedActivities)
                .values({
                  id: createId(),
                  dailyUpdateId: existingUpdate.id,
                  userId: user.id,
                  activityType: activity.activity_type,
                  quantity: String(activity.quantity),
                  summary: activity.summary,
                  activityDate: activity.activity_date,
                  period: updatePeriod,
                  linkedGoalId,
                })
                .returning();

              return created;
            })
          );

          // Create follow-ups if user approved any
          const savedFollowUps: Array<{ id: string; title: string; summary: string; dueDate: string | null }> = [];
          console.log(
            "[FOLLOW-UP] Checking for approved follow-ups (appending):",
            {
              hasConfirmationResult: !!chatResult.followup_confirmation_result,
              approved_indices:
                chatResult.followup_confirmation_result?.approved_indices,
              proposed_follow_ups_count:
                chatResult.proposed_follow_ups?.length || 0,
            }
          );
          if (chatResult.followup_confirmation_result?.approved_indices?.length) {
            const { approved_indices } = chatResult.followup_confirmation_result;
            const proposedFollowUps = chatResult.proposed_follow_ups || [];
            console.log("[FOLLOW-UP] Saving approved follow-ups:", {
              approved_indices,
              proposedFollowUps,
            });

            for (const index of approved_indices) {
              const proposal = proposedFollowUps[index];
              console.log(`[FOLLOW-UP] Processing index ${index}:`, { proposal });
              if (!proposal) {
                console.log(
                  `[FOLLOW-UP] No proposal at index ${index}, skipping`
                );
                continue;
              }

              const activity = newActivities[proposal.activity_index];
              console.log(`[FOLLOW-UP] Activity for proposal:`, {
                activity_index: proposal.activity_index,
                activity: activity?.id,
              });
              if (!activity) {
                console.log(
                  `[FOLLOW-UP] No activity at index ${proposal.activity_index}, skipping`
                );
                continue;
              }

              // Calculate due date if suggested_days is provided
              const dueDate = proposal.suggested_days
                ? new Date(
                    Date.now() + proposal.suggested_days * 24 * 60 * 60 * 1000
                  )
                    .toISOString()
                    .split("T")[0]
                : null;

              console.log(`[FOLLOW-UP] Creating follow-up: ${proposal.title}`);
              const [followUp] = await tx
                .insert(updateFollowUps)
                .values({
                  id: createId(),
                  chatSessionId: chatSession.id,
                  extractedActivityId: activity.id,
                  userId: user.id,
                  title: proposal.title,
                  summary: proposal.summary,
                  activityType: proposal.activity_type || null,
                  status: "confirmed",
                  dueDate,
                })
                .returning();

              savedFollowUps.push({ id: followUp.id, title: followUp.title, summary: followUp.summary, dueDate });
              console.log(`[FOLLOW-UP] Saved follow-up: ${followUp.id}`);
            }
          }
          console.log(
            `[FOLLOW-UP] Total saved follow-ups: ${savedFollowUps.length}`
          );

          // Create calendar events for follow-ups with due dates
          if (savedFollowUps.length > 0 && activeTeamId) {
            const eventMappings = await createFollowUpCalendarEvents(tx, savedFollowUps, activeTeamId, user.id);
            // Store linkedEventId on each follow-up
            for (const { followUpId, eventId } of eventMappings) {
              await tx
                .update(updateFollowUps)
                .set({ linkedEventId: eventId })
                .where(eq(updateFollowUps.id, followUpId));
            }
          }

          // Mark chat session as completed
          await tx
            .update(chatSessions)
            .set({
              endedAt: new Date(),
              status: "completed",
            })
            .where(eq(chatSessions.id, chatSession.id));

          return {
            dailyUpdate: updatedDailyUpdate,
            extractedActivities: [
              ...existingUpdate.extractedActivities,
              ...newActivities,
            ],
            newActivities,
            savedFollowUps,
          };
        });

        return NextResponse.json({
          ...chatResult,
          saved: true,
          appended: true,
          update: result.dailyUpdate,
          extractedActivities: result.extractedActivities,
          newActivitiesCount: result.newActivities.length,
          savedFollowUps: result.savedFollowUps,
        });
      }

      // Save to database (new update)
      const result = await db.transaction(async (tx) => {
        const [dailyUpdate] = await tx
          .insert(dailyUpdates)
          .values({
            id: createId(),
            userId: user.id,
            userGoalSetId: activeGoalSet?.id || null,
            updateText: userMessages,
            updatePeriod,
            periodDate: periodDate.toISOString().split("T")[0],
          })
          .returning();

        const createdActivities = await Promise.all(
          chatResult.activities.map(async (activity) => {
            const linkedGoalId = findMatchingGoal(activity, activeGoals);

            const [created] = await tx
              .insert(extractedActivities)
              .values({
                id: createId(),
                dailyUpdateId: dailyUpdate.id,
                userId: user.id,
                activityType: activity.activity_type,
                quantity: String(activity.quantity),
                summary: activity.summary,
                activityDate: activity.activity_date,
                period: updatePeriod,
                linkedGoalId,
              })
              .returning();

            return created;
          })
        );

        // Create follow-ups if user approved any
        const savedFollowUps: Array<{ id: string; title: string; summary: string; dueDate: string | null }> = [];
        console.log(
          "[FOLLOW-UP] Checking for approved follow-ups (new update):",
          {
            hasConfirmationResult: !!chatResult.followup_confirmation_result,
            approved_indices:
              chatResult.followup_confirmation_result?.approved_indices,
            proposed_follow_ups_count:
              chatResult.proposed_follow_ups?.length || 0,
          }
        );
        if (chatResult.followup_confirmation_result?.approved_indices?.length) {
          const { approved_indices } = chatResult.followup_confirmation_result;
          const proposedFollowUps = chatResult.proposed_follow_ups || [];
          console.log("[FOLLOW-UP] Saving approved follow-ups (new):", {
            approved_indices,
            proposedFollowUps,
          });

          for (const index of approved_indices) {
            const proposal = proposedFollowUps[index];
            console.log(`[FOLLOW-UP] Processing index ${index}:`, { proposal });
            if (!proposal) {
              console.log(
                `[FOLLOW-UP] No proposal at index ${index}, skipping`
              );
              continue;
            }

            const activity = createdActivities[proposal.activity_index];
            console.log(`[FOLLOW-UP] Activity for proposal:`, {
              activity_index: proposal.activity_index,
              activity: activity?.id,
            });
            if (!activity) {
              console.log(
                `[FOLLOW-UP] No activity at index ${proposal.activity_index}, skipping`
              );
              continue;
            }

            // Calculate due date if suggested_days is provided
            const dueDate = proposal.suggested_days
              ? new Date(
                  Date.now() + proposal.suggested_days * 24 * 60 * 60 * 1000
                )
                  .toISOString()
                  .split("T")[0]
              : null;

            console.log(`[FOLLOW-UP] Creating follow-up: ${proposal.title}`);
            const [followUp] = await tx
              .insert(updateFollowUps)
              .values({
                id: createId(),
                chatSessionId: chatSession.id,
                extractedActivityId: activity.id,
                userId: user.id,
                title: proposal.title,
                summary: proposal.summary,
                activityType: proposal.activity_type || null,
                status: "confirmed",
                dueDate,
              })
              .returning();

            savedFollowUps.push({ id: followUp.id, title: followUp.title, summary: followUp.summary, dueDate });
            console.log(`[FOLLOW-UP] Saved follow-up: ${followUp.id}`);
          }
        }
        console.log(
          `[FOLLOW-UP] Total saved follow-ups (new): ${savedFollowUps.length}`
        );

        // Create calendar events for follow-ups with due dates
        if (savedFollowUps.length > 0 && activeTeamId) {
          const eventMappings = await createFollowUpCalendarEvents(tx, savedFollowUps, activeTeamId, user.id);
          // Store linkedEventId on each follow-up
          for (const { followUpId, eventId } of eventMappings) {
            await tx
              .update(updateFollowUps)
              .set({ linkedEventId: eventId })
              .where(eq(updateFollowUps.id, followUpId));
          }
        }

        await updateStreak(tx, user.id);

        // Link chat session to daily update and mark as completed
        await tx
          .update(chatSessions)
          .set({
            dailyUpdateId: dailyUpdate.id,
            endedAt: new Date(),
            status: "completed",
          })
          .where(eq(chatSessions.id, chatSession.id));

        return { dailyUpdate, extractedActivities: createdActivities, savedFollowUps };
      });

      return NextResponse.json({
        ...chatResult,
        saved: true,
        appended: false,
        update: result.dailyUpdate,
        extractedActivities: result.extractedActivities,
        savedFollowUps: result.savedFollowUps,
      });
    }

    // Still in clarification phase
    return NextResponse.json({
      ...chatResult,
      saved: false,
    });
  } catch (error) {
    return handleApiError(error, "updates/chat:POST");
  }
}

/**
 * DELETE /api/updates/chat - Clear chat session
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

    await fetch(`${pythonBackendUrl}/api/v1/updates/chat/${sessionId}`, {
      method: "DELETE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "updates/chat:DELETE");
  }
}

function findMatchingGoal(
  activity: ExtractedActivityFromPython,
  goals: Array<{ id: string; title: string; description: string }>
): string | null {
  if (goals.length === 0) return null;

  const activityText =
    `${activity.activity_type} ${activity.summary}`.toLowerCase();

  let bestMatch: { id: string; score: number } | null = null;

  for (const goal of goals) {
    const goalText = `${goal.title} ${goal.description}`.toLowerCase();
    const goalWords = goalText.split(/\s+/).filter((w) => w.length > 3);

    let score = 0;
    for (const word of goalWords) {
      if (activityText.includes(word)) {
        score++;
      }
    }

    const typeKeywords: Record<string, string[]> = {
      experiments: ["experiment", "test", "research", "prototype", "explore"],
      product_demos: ["demo", "demonstration", "showcase", "present", "product"],
      mentoring: ["mentor", "coach", "teach", "guide", "help", "train"],
      presentations: ["present", "talk", "workshop", "training", "speak"],
      volunteering: ["volunteer", "community", "charity", "help", "donate"],
      general_task: ["task", "work", "meeting", "plan", "coordinate"],
      research_learning: ["learn", "study", "course", "read", "research"],
    };

    const keywords = typeKeywords[activity.activity_type] || [];
    for (const keyword of keywords) {
      if (goalText.includes(keyword)) {
        score += 2;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: goal.id, score };
    }
  }

  return bestMatch && bestMatch.score >= 2 ? bestMatch.id : null;
}

async function updateStreak(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string
) {
  const dbUser = await tx.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      streakCurrent: true,
      streakLongest: true,
      streakLastUpdate: true,
    },
  });

  if (!dbUser) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastUpdate = dbUser.streakLastUpdate
    ? new Date(dbUser.streakLastUpdate)
    : null;

  if (lastUpdate) {
    lastUpdate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor(
      (today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      return;
    } else if (daysDiff === 1) {
      const newStreak = dbUser.streakCurrent + 1;
      await tx
        .update(users)
        .set({
          streakCurrent: newStreak,
          streakLongest: Math.max(newStreak, dbUser.streakLongest),
          streakLastUpdate: today,
          totalPoints: sql`${users.totalPoints} + 20`,
        })
        .where(eq(users.id, userId));
    } else {
      await tx
        .update(users)
        .set({
          streakCurrent: 1,
          streakLastUpdate: today,
          totalPoints: sql`${users.totalPoints} + 20`,
        })
        .where(eq(users.id, userId));
    }
  } else {
    await tx
      .update(users)
      .set({
        streakCurrent: 1,
        streakLastUpdate: today,
        totalPoints: sql`${users.totalPoints} + 20`,
      })
      .where(eq(users.id, userId));
  }
}
