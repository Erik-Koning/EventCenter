import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventAttendees, users } from "@/db/schema";
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

    // Get speakers from eventAttendees where isSpeaker=true
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        title: users.title,
        company: users.company,
        imageUrl: users.imageUrl,
        initials: users.initials,
        bio: eventAttendees.bio,
      })
      .from(eventAttendees)
      .innerJoin(users, eq(eventAttendees.userId, users.id))
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.isSpeaker, true)
        )
      );

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, "events/[eventId]/speakers:GET");
  }
}
