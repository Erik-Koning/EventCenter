import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateAttendeeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  isSpeaker: z.boolean().optional(),
  company: z.string().max(255).nullable().optional(),
  bio: z.string().nullable().optional(),
  interests: z.string().nullable().optional(),
  eventId: z.string().optional(),
});

type RouteParams = { params: Promise<{ attendeeId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { attendeeId } = await params;
    const body = await request.json();
    const validated = updateAttendeeSchema.parse(body);

    // Separate user fields from enrollment fields
    const { isSpeaker, bio, eventId, ...userFields } = validated;

    // Update user fields if any provided
    if (Object.keys(userFields).length > 0) {
      const [updated] = await db
        .update(users)
        .set({
          ...userFields,
          updatedAt: new Date(),
        })
        .where(eq(users.id, attendeeId))
        .returning();

      if (!updated) return commonErrors.notFound("User");
    }

    // Update enrollment fields (isSpeaker/bio) if provided
    if (isSpeaker !== undefined || bio !== undefined) {
      const resolvedEventId = eventId || authResult.user.currentEventId;
      if (resolvedEventId) {
        await db
          .update(eventAttendees)
          .set({
            ...(isSpeaker !== undefined ? { isSpeaker } : {}),
            ...(bio !== undefined ? { bio } : {}),
          })
          .where(
            and(
              eq(eventAttendees.eventId, resolvedEventId),
              eq(eventAttendees.userId, attendeeId)
            )
          );
      }
    }

    // Return the updated user
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.id, attendeeId));

    if (!result) return commonErrors.notFound("User");
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "admin/attendees/[attendeeId]:PUT");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { attendeeId } = await params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId") || authResult.user.currentEventId;

    if (!eventId) {
      return NextResponse.json(
        { message: "No current event selected", error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Only remove the enrollment for this event, not the user themselves
    const [deleted] = await db
      .delete(eventAttendees)
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.userId, attendeeId)
        )
      )
      .returning();

    if (!deleted) return commonErrors.notFound("Enrollment");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/attendees/[attendeeId]:DELETE");
  }
}
