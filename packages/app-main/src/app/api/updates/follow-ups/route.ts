import { NextResponse } from "next/server";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { updateFollowUps, extractedActivities, chatSessions, teams, teamEvents } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";

/**
 * GET /api/updates/follow-ups - Get user's follow-ups with optional filters
 *
 * Query params:
 * - status: comma-separated list of statuses (confirmed, completed, dismissed)
 * - activityType: comma-separated list of activity types
 * - sortBy: dueDate | createdAt | title (default: dueDate)
 * - sortOrder: asc | desc (default: asc for dueDate, desc for createdAt)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const statusParam = searchParams.get("status");
    const activityTypeParam = searchParams.get("activityType");
    const sortBy = searchParams.get("sortBy") || "dueDate";
    const sortOrder = searchParams.get("sortOrder") || (sortBy === "createdAt" ? "desc" : "asc");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build conditions
    const conditions = [eq(updateFollowUps.userId, user.id)];

    // Filter by status (default to "confirmed" if no status filter)
    if (statusParam) {
      const statuses = statusParam.split(",").filter(Boolean);
      if (statuses.length > 0) {
        conditions.push(inArray(updateFollowUps.status, statuses));
      }
    } else {
      conditions.push(eq(updateFollowUps.status, "confirmed"));
    }

    // Build order by
    const orderByClause = sortBy === "dueDate"
      ? sortOrder === "desc" ? [desc(updateFollowUps.dueDate), desc(updateFollowUps.createdAt)] : [updateFollowUps.dueDate, desc(updateFollowUps.createdAt)]
      : sortBy === "createdAt"
        ? sortOrder === "desc" ? [desc(updateFollowUps.createdAt)] : [updateFollowUps.createdAt]
        : sortOrder === "desc" ? [desc(updateFollowUps.title)] : [updateFollowUps.title];

    // Get follow-ups - we'll filter by activityType in memory since Drizzle doesn't easily support
    // filtering on related fields in findMany
    let followUps = await db.query.updateFollowUps.findMany({
      where: and(...conditions),
      orderBy: orderByClause,
      with: {
        chatSession: {
          columns: {
            id: true,
            sessionId: true,
            periodDate: true,
          },
        },
        extractedActivity: {
          columns: {
            id: true,
            activityType: true,
            summary: true,
            quantity: true,
          },
        },
        team: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Filter by activity type in memory if specified
    if (activityTypeParam) {
      const activityTypes = activityTypeParam.split(",").filter(Boolean);
      if (activityTypes.length > 0) {
        followUps = followUps.filter(fu =>
          activityTypes.includes(fu.extractedActivity?.activityType || "")
        );
      }
    }

    const totalCount = followUps.length;

    // Apply pagination in memory
    const paginatedFollowUps = followUps.slice(offset, offset + limit);

    return NextResponse.json({
      followUps: paginatedFollowUps.map((fu) => ({
        id: fu.id,
        title: fu.title,
        summary: fu.summary,
        status: fu.status,
        activityType: fu.activityType,
        dueDate: fu.dueDate || null,
        completedAt: fu.completedAt?.toISOString() || null,
        createdAt: fu.createdAt.toISOString(),
        linkedEventId: fu.linkedEventId || null,
        chatSession: {
          id: fu.chatSession.id,
          sessionId: fu.chatSession.sessionId,
          periodDate: fu.chatSession.periodDate,
        },
        extractedActivity: {
          id: fu.extractedActivity.id,
          activityType: fu.extractedActivity.activityType,
          summary: fu.extractedActivity.summary,
          quantity: fu.extractedActivity.quantity,
        },
        team: fu.team ? { id: fu.team.id, name: fu.team.name } : null,
      })),
      count: paginatedFollowUps.length,
      totalCount,
      hasMore: offset + paginatedFollowUps.length < totalCount,
    });
  } catch (error) {
    return handleApiError(error, "updates/follow-ups:GET");
  }
}

const patchSchema = z.object({
  followUpId: z.string().optional(),
  followUpIds: z.array(z.string()).optional(),
  status: z.enum(["confirmed", "completed", "dismissed"]),
  completedInSessionId: z.string().optional(),
  dueDate: z.string().optional(), // ISO date string for updating due date
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  syncEvent: z.boolean().default(true), // whether to propagate changes to linked calendar event
}).refine(data => data.followUpId || (data.followUpIds && data.followUpIds.length > 0), {
  message: "Either followUpId or followUpIds is required",
});

/**
 * PATCH /api/updates/follow-ups - Update follow-up status (complete, dismiss, or reopen)
 * Supports single or bulk updates
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = patchSchema.parse(body);

    // Get list of IDs to update
    const ids = validated.followUpIds || (validated.followUpId ? [validated.followUpId] : []);

    // Verify all follow-ups belong to user
    const followUps = await db.query.updateFollowUps.findMany({
      where: inArray(updateFollowUps.id, ids),
    });

    if (followUps.length !== ids.length) {
      return apiError("One or more follow-ups not found", ErrorCode.NOT_FOUND, 404);
    }

    const unauthorized = followUps.find(fu => fu.userId !== user.id);
    if (unauthorized) {
      return apiError("Unauthorized", ErrorCode.FORBIDDEN, 403);
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: validated.status,
      updatedAt: new Date(),
    };

    if (validated.status === "completed") {
      updateData.completedAt = new Date();
      updateData.completedInSessionId = validated.completedInSessionId || null;
    } else if (validated.status === "confirmed") {
      // Reopening - clear completed fields
      updateData.completedAt = null;
      updateData.completedInSessionId = null;
    } else if (validated.status === "dismissed") {
      updateData.completedAt = null;
      updateData.completedInSessionId = null;
    }

    if (validated.dueDate !== undefined) {
      updateData.dueDate = validated.dueDate ? validated.dueDate : null;
    }

    if (validated.title !== undefined) {
      updateData.title = validated.title;
    }

    if (validated.summary !== undefined) {
      updateData.summary = validated.summary;
    }

    // Update all follow-ups
    await db
      .update(updateFollowUps)
      .set(updateData)
      .where(inArray(updateFollowUps.id, ids));

    // Sync changes to linked calendar events if requested (single follow-up only)
    if (validated.syncEvent && ids.length === 1) {
      const followUp = followUps[0];
      if (followUp.linkedEventId) {
        const eventUpdateFields: Record<string, unknown> = { updatedAt: new Date() };
        let shouldUpdateEvent = false;

        if (validated.title !== undefined) {
          eventUpdateFields.title = validated.title;
          shouldUpdateEvent = true;
        }

        if (validated.summary !== undefined) {
          eventUpdateFields.description = `[Follow-up] ${validated.summary}`;
          shouldUpdateEvent = true;
        }

        if (validated.dueDate) {
          const dueDate = new Date(validated.dueDate);
          const eventStart = new Date(dueDate);
          eventStart.setHours(9, 0, 0, 0);
          const eventEnd = new Date(dueDate);
          eventEnd.setHours(17, 0, 0, 0);
          eventUpdateFields.startDate = eventStart;
          eventUpdateFields.endDate = eventEnd;
          shouldUpdateEvent = true;
        }

        if (shouldUpdateEvent) {
          await db
            .update(teamEvents)
            .set(eventUpdateFields)
            .where(eq(teamEvents.id, followUp.linkedEventId));
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: ids.length,
    });
  } catch (error) {
    return handleApiError(error, "updates/follow-ups:PATCH");
  }
}
