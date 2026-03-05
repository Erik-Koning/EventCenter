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

    // Get all sessions for this event, with their speakers
    const sessions = await db.query.eventSessions.findMany({
      where: eq(eventSessions.eventId, eventId),
      with: {
        sessionSpeakers: {
          with: {
            user: true,
          },
        },
      },
    });

    // Deduplicate speakers
    const speakerMap = new Map<string, typeof sessions[0]["sessionSpeakers"][0]["user"]>();
    for (const session of sessions) {
      for (const ss of session.sessionSpeakers) {
        if (!speakerMap.has(ss.user.id)) {
          speakerMap.set(ss.user.id, ss.user);
        }
      }
    }

    return NextResponse.json(Array.from(speakerMap.values()));
  } catch (error) {
    return handleApiError(error, "events/[eventId]/speakers:GET");
  }
}
