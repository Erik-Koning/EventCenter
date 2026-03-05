import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, events, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    if (!user.currentEventId) {
      return NextResponse.json({ event: null });
    }

    const event = await db.query.events.findFirst({
      where: eq(events.id, user.currentEventId),
    });

    return NextResponse.json({ event: event ?? null });
  } catch (error) {
    return handleApiError(error, "events/current:GET");
  }
}

const updateSchema = z.object({
  eventId: z.string().min(1),
});

export async function PUT(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const { eventId } = updateSchema.parse(body);

    // Verify user is enrolled in the event
    const enrollment = await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, user.id)
      ),
    });

    if (!enrollment) {
      return commonErrors.forbidden();
    }

    // Update user's current event and role from guestlist atomically
    await db
      .update(users)
      .set({ currentEventId: eventId, role: enrollment.role })
      .where(eq(users.id, user.id));

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error, "events/current:PUT");
  }
}
