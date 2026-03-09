import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;

    const enrollments = await db.query.eventAttendees.findMany({
      where: eq(eventAttendees.eventId, eventId),
      with: {
        user: true,
      },
    });

    const attendeesList = enrollments
      .filter((e) => e.user)
      .map((e) => ({
        ...e.user,
        isSpeaker: e.isSpeaker,
        bio: e.bio,
      }));

    return NextResponse.json(attendeesList);
  } catch (error) {
    return handleApiError(error, "events/[eventId]/attendees:GET");
  }
}
