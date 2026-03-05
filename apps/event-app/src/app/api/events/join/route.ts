import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, events, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

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

    // Check if already enrolled, otherwise auto-enroll
    let enrollment = await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, user.id)
      ),
    });

    if (!enrollment) {
      // Auto-enroll the user as a regular attendee
      const [created] = await db
        .insert(eventAttendees)
        .values({
          id: createId(),
          eventId,
          userId: user.id,
          role: "user",
        })
        .onConflictDoNothing()
        .returning();

      enrollment = created ?? await db.query.eventAttendees.findFirst({
        where: and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.userId, user.id)
        ),
      });
    }

    const role = enrollment?.role ?? "user";

    // Set current event and role atomically
    await db
      .update(users)
      .set({
        currentEventId: eventId,
        role,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ event, role });
  } catch (error) {
    return handleApiError(error, "events/join:POST");
  }
}
