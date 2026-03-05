import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSessions, sessionSpeakers } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createSessionSchema = z.object({
  eventId: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  date: z.string().min(1),
  startTime: z.string().min(1).max(10),
  endTime: z.string().min(1).max(10),
  location: z.string().max(500).optional(),
  track: z.enum(["Leadership", "Technology", "Strategy", "Innovation", "Culture"]).optional(),
  tags: z.array(z.string()).optional(),
  speakerIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const allSessions = await db.query.eventSessions.findMany({
      where: eventId ? eq(eventSessions.eventId, eventId) : undefined,
      with: { sessionSpeakers: { with: { user: true } } },
      orderBy: [desc(eventSessions.date)],
    });

    return NextResponse.json(allSessions);
  } catch (error) {
    return handleApiError(error, "admin/sessions:GET");
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = createSessionSchema.parse(body);
    const { speakerIds, ...sessionData } = validated;

    const sessionId = createId();
    const [session] = await db
      .insert(eventSessions)
      .values({
        id: sessionId,
        eventId: sessionData.eventId ?? null,
        title: sessionData.title,
        description: sessionData.description ?? null,
        date: sessionData.date,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        location: sessionData.location ?? null,
        track: sessionData.track ?? null,
        tags: sessionData.tags ?? [],
      })
      .returning();

    if (speakerIds && speakerIds.length > 0) {
      await db.insert(sessionSpeakers).values(
        speakerIds.map((userId, i) => ({
          id: createId(),
          sessionId,
          userId,
          displayOrder: i,
        }))
      );
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/sessions:POST");
  }
}
