import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamEvents, teamEventAttendees, updateFollowUps } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { isTeamMember } from "@/lib/team-authorization";

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  availability: z.enum(["busy", "free", "working_elsewhere", "tentative", "out_of_office"]).optional(),
  isPrivate: z.boolean().optional(),
  syncFollowUp: z.boolean().default(true).optional(),
});

/**
 * GET /api/events/[id] - Get single event with attendees
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    const event = await db.query.teamEvents.findFirst({
      where: eq(teamEvents.id, id),
      with: {
        attendees: {
          with: {
            user: {
              columns: { id: true, name: true, email: true },
            },
          },
        },
        createdBy: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!event) {
      return apiError("Event not found", ErrorCode.NOT_FOUND, 404);
    }

    // Verify team membership
    const isMember = await isTeamMember(event.teamId, user.id);
    if (!isMember) {
      return apiError("Not a member of this team", ErrorCode.FORBIDDEN, 403);
    }

    // Private event check
    if (event.isPrivate && event.createdById !== user.id) {
      const isAttendee = event.attendees.some((a) => a.userId === user.id);
      if (!isAttendee) {
        return apiError("Event not found", ErrorCode.NOT_FOUND, 404);
      }
    }

    // Look up linked follow-up
    const linkedFollowUp = await db.query.updateFollowUps.findFirst({
      where: eq(updateFollowUps.linkedEventId, id),
      columns: { id: true, title: true, status: true },
    });

    return NextResponse.json({
      event,
      linkedFollowUp: linkedFollowUp || null,
    });
  } catch (error) {
    return handleApiError(error, "events/[id]:GET");
  }
}

/**
 * PATCH /api/events/[id] - Update event fields
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateEventSchema.parse(body);

    // Verify event exists
    const event = await db.query.teamEvents.findFirst({
      where: eq(teamEvents.id, id),
    });

    if (!event) {
      return apiError("Event not found", ErrorCode.NOT_FOUND, 404);
    }

    // Verify team membership
    const isMember = await isTeamMember(event.teamId, user.id);
    if (!isMember) {
      return apiError("Not a member of this team", ErrorCode.FORBIDDEN, 403);
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.title !== undefined) updateFields.title = validated.title;
    if (validated.description !== undefined) updateFields.description = validated.description;
    if (validated.location !== undefined) updateFields.location = validated.location;
    if (validated.startDate !== undefined) updateFields.startDate = new Date(validated.startDate);
    if (validated.endDate !== undefined) updateFields.endDate = new Date(validated.endDate);
    if (validated.availability !== undefined) updateFields.availability = validated.availability;
    if (validated.isPrivate !== undefined) updateFields.isPrivate = validated.isPrivate;

    const [updated] = await db
      .update(teamEvents)
      .set(updateFields)
      .where(eq(teamEvents.id, id))
      .returning();

    // Sync changes to linked follow-up if requested
    if (validated.syncFollowUp !== false) {
      const linkedFollowUp = await db.query.updateFollowUps.findFirst({
        where: eq(updateFollowUps.linkedEventId, id),
      });

      if (linkedFollowUp && linkedFollowUp.userId === user.id) {
        const followUpUpdate: Record<string, unknown> = { updatedAt: new Date() };
        let shouldUpdate = false;

        if (validated.title !== undefined) {
          followUpUpdate.title = validated.title;
          shouldUpdate = true;
        }

        if (validated.description !== undefined) {
          // Strip [Follow-up] prefix if present
          const desc = validated.description || "";
          followUpUpdate.summary = desc.startsWith("[Follow-up] ")
            ? desc.slice("[Follow-up] ".length)
            : desc;
          shouldUpdate = true;
        }

        if (validated.startDate !== undefined) {
          // Extract date portion from startDate for the follow-up dueDate
          const startDateObj = new Date(validated.startDate);
          followUpUpdate.dueDate = startDateObj.toISOString().split("T")[0];
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await db
            .update(updateFollowUps)
            .set(followUpUpdate)
            .where(eq(updateFollowUps.id, linkedFollowUp.id));
        }
      }
    }

    return NextResponse.json({ event: updated });
  } catch (error) {
    return handleApiError(error, "events/[id]:PATCH");
  }
}

/**
 * DELETE /api/events/[id] - Cancel event or delete series
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deleteSeries = searchParams.get("series") === "true";

    const event = await db.query.teamEvents.findFirst({
      where: eq(teamEvents.id, id),
    });

    if (!event) {
      return apiError("Event not found", ErrorCode.NOT_FOUND, 404);
    }

    const isMember = await isTeamMember(event.teamId, user.id);
    if (!isMember) {
      return apiError("Not a member of this team", ErrorCode.FORBIDDEN, 403);
    }

    if (deleteSeries && event.seriesId) {
      // Cancel all events in the series
      await db
        .update(teamEvents)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(teamEvents.seriesId, event.seriesId));

      return NextResponse.json({ success: true, cancelledSeries: true });
    }

    // Cancel single event
    await db
      .update(teamEvents)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(teamEvents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "events/[id]:DELETE");
  }
}
