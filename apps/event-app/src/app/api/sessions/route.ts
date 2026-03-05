import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSessions, sessionSpeakers, speakers } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

// ── Validation ──

const trackValues = ["Leadership", "Technology", "Strategy", "Innovation", "Culture"] as const;

const createSessionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  location: z.string().max(500).optional(),
  track: z.enum(trackValues).optional(),
  tags: z.array(z.string()).optional(),
  speakerIds: z.array(z.string()).optional(),
});

// ── GET /api/sessions ──

export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const url = new URL(request.url);
    const dateFilter = url.searchParams.get("date");
    const trackFilter = url.searchParams.get("track");

    // Build conditions
    const conditions = [];
    if (dateFilter) {
      conditions.push(eq(eventSessions.date, dateFilter));
    }
    if (trackFilter && trackValues.includes(trackFilter as typeof trackValues[number])) {
      conditions.push(eq(eventSessions.track, trackFilter as typeof trackValues[number]));
    }

    // Fetch sessions
    const rows = await db
      .select({
        id: eventSessions.id,
        title: eventSessions.title,
        description: eventSessions.description,
        date: eventSessions.date,
        startTime: eventSessions.startTime,
        endTime: eventSessions.endTime,
        location: eventSessions.location,
        track: eventSessions.track,
        tags: eventSessions.tags,
        createdAt: eventSessions.createdAt,
        updatedAt: eventSessions.updatedAt,
      })
      .from(eventSessions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(eventSessions.date), asc(eventSessions.startTime));

    // Fetch speakers for all sessions in one query
    const sessionIds = rows.map((r) => r.id);
    let speakerRows: { sessionId: string; speakerId: string; speakerName: string; speakerTitle: string; speakerInitials: string; displayOrder: number | null }[] = [];

    if (sessionIds.length > 0) {
      speakerRows = await db
        .select({
          sessionId: sessionSpeakers.sessionId,
          speakerId: sessionSpeakers.speakerId,
          speakerName: speakers.name,
          speakerTitle: speakers.title,
          speakerInitials: speakers.initials,
          displayOrder: sessionSpeakers.displayOrder,
        })
        .from(sessionSpeakers)
        .innerJoin(speakers, eq(sessionSpeakers.speakerId, speakers.id))
        .orderBy(asc(sessionSpeakers.displayOrder));
    }

    // Group speakers by session
    const speakersBySession = new Map<string, typeof speakerRows>();
    for (const row of speakerRows) {
      const list = speakersBySession.get(row.sessionId) ?? [];
      list.push(row);
      speakersBySession.set(row.sessionId, list);
    }

    const sessions = rows.map((session) => ({
      ...session,
      speakers: (speakersBySession.get(session.id) ?? []).map((s) => ({
        id: s.speakerId,
        name: s.speakerName,
        title: s.speakerTitle,
        initials: s.speakerInitials,
      })),
    }));

    return NextResponse.json(sessions);
  } catch (error) {
    return handleApiError(error, "sessions:GET");
  }
}

// ── POST /api/sessions ──

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = createSessionSchema.parse(body);

    const sessionId = createId();

    const [session] = await db
      .insert(eventSessions)
      .values({
        id: sessionId,
        title: validated.title,
        description: validated.description ?? null,
        date: validated.date,
        startTime: validated.startTime,
        endTime: validated.endTime,
        location: validated.location ?? null,
        track: validated.track ?? null,
        tags: validated.tags ?? [],
      })
      .returning();

    // Insert speaker associations
    if (validated.speakerIds && validated.speakerIds.length > 0) {
      await db.insert(sessionSpeakers).values(
        validated.speakerIds.map((speakerId, i) => ({
          id: createId(),
          sessionId,
          speakerId,
          displayOrder: i,
        }))
      );
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return handleApiError(error, "sessions:POST");
  }
}
