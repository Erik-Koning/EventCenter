import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSessions } from "@/db/schema";
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

    const sessions = await db.query.eventSessions.findMany({
      where: eq(eventSessions.eventId, eventId),
      with: {
        sessionSpeakers: {
          with: {
            user: true,
          },
          orderBy: (ss, { asc }) => [asc(ss.displayOrder)],
        },
      },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });

    // Flatten speakers into each session
    const result = sessions.map((s) => ({
      id: s.id,
      eventId: s.eventId,
      title: s.title,
      description: s.description,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      track: s.track,
      tags: s.tags,
      speakers: s.sessionSpeakers.map((ss) => ss.user),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "events/[eventId]/sessions:GET");
  }
}
