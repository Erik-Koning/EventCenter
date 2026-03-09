import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateSpeakerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  bio: z.string().optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  isSpeaker: z.boolean().optional(),
  eventId: z.string().optional(),
});

type RouteParams = { params: Promise<{ speakerId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { speakerId } = await params;
    const body = await request.json();
    const validated = updateSpeakerSchema.parse(body);

    const { isSpeaker, bio, eventId, ...userFields } = validated;

    // Update user fields if any provided
    if (Object.keys(userFields).length > 0) {
      const [updated] = await db
        .update(users)
        .set({ ...userFields, updatedAt: new Date() })
        .where(eq(users.id, speakerId))
        .returning();

      if (!updated) return commonErrors.notFound("Speaker");
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
              eq(eventAttendees.userId, speakerId)
            )
          );
      }
    }

    // Return updated user
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.id, speakerId));

    if (!result) return commonErrors.notFound("Speaker");
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "admin/speakers/[speakerId]:PUT");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { speakerId } = await params;
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
          eq(eventAttendees.userId, speakerId)
        )
      )
      .returning();

    if (!deleted) return commonErrors.notFound("Enrollment");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/speakers/[speakerId]:DELETE");
  }
}
