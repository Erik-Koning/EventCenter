import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, events, eventAttendees, attendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

const joinSchema = z.object({
  eventId: z.string().min(1),
});

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const { eventId } = joinSchema.parse(body);

    // Verify event exists
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) {
      return NextResponse.json(
        { message: "Event not found", error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Find attendee record for this user
    const attendee = await db.query.attendees.findFirst({
      where: eq(attendees.userId, user.id),
    });
    if (!attendee) {
      return NextResponse.json(
        { message: "You are not on the guestlist for this event", error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Check if on the guestlist (eventAttendees)
    const enrollment = await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.attendeeId, attendee.id)
      ),
    });
    if (!enrollment) {
      return NextResponse.json(
        { message: "You are not on the guestlist for this event", error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Set current event and role atomically
    await db
      .update(users)
      .set({
        currentEventId: eventId,
        role: enrollment.role,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ event, role: enrollment.role });
  } catch (error) {
    return handleApiError(error, "events/join:POST");
  }
}
