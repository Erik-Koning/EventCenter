import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    // Find all events this user is enrolled in
    const enrollments = await db.query.eventAttendees.findMany({
      where: eq(eventAttendees.userId, user.id),
      with: {
        event: true,
      },
    });

    const userEvents = enrollments
      .map((e) => e.event)
      .filter(Boolean)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return NextResponse.json({
      events: userEvents,
      currentEventId: user.currentEventId,
    });
  } catch (error) {
    return handleApiError(error, "events/mine:GET");
  }
}
