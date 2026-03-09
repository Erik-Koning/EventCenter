import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSessions, sessionSpeakers, users, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const sessionRowSchema = z.object({
  title: z.string().min(1).max(500),
  date: z.string().min(1),
  startTime: z.string().min(1).max(10),
  endTime: z.string().min(1).max(10),
  description: z.string().optional().or(z.literal("")),
  location: z.string().max(500).optional().or(z.literal("")),
  track: z.string().optional(),
  speakers: z.string().optional().or(z.literal("")),
});

const importSchema = z.object({
  eventId: z.string().min(1),
  sessions: z.array(sessionRowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = importSchema.parse(body);

    // Pre-fetch all event attendees for speaker lookups
    const attendeeRows = await db
      .select({ userId: eventAttendees.userId })
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, validated.eventId));
    const attendeeIds = new Set(attendeeRows.map((a) => a.userId));

    // Fetch all users who are attendees of this event (for name matching)
    const attendeeUsers = attendeeIds.size > 0
      ? await db.query.users.findMany({
          columns: { id: true, name: true },
        })
      : [];
    const eventUsers = attendeeUsers.filter((u) => attendeeIds.has(u.id));

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < validated.sessions.length; i++) {
      const row = validated.sessions[i];
      const rowNum = i + 1;

      try {
        const sessionId = createId();
        const validTracks = ["Leadership", "Technology", "Strategy", "Innovation", "Culture"] as const;
        type Track = typeof validTracks[number];
        const trackValue = row.track?.trim();
        const track: Track | null = trackValue && validTracks.includes(trackValue as Track) ? trackValue as Track : null;

        await db.insert(eventSessions).values({
          id: sessionId,
          eventId: validated.eventId,
          title: row.title,
          description: row.description || null,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          location: row.location || null,
          track,
          tags: [],
        });

        // Link speakers by name
        if (row.speakers && row.speakers.trim()) {
          const speakerNames = row.speakers.split(",").map((s) => s.trim()).filter(Boolean);
          const speakerValues: { id: string; sessionId: string; userId: string; displayOrder: number }[] = [];

          for (const name of speakerNames) {
            const nameLower = name.toLowerCase();
            const match = eventUsers.find(
              (u) => u.name.toLowerCase() === nameLower
            );
            if (match) {
              speakerValues.push({
                id: createId(),
                sessionId,
                userId: match.id,
                displayOrder: speakerValues.length,
              });
            } else {
              errors.push(`Row ${rowNum}: Speaker "${name}" not found among event attendees`);
            }
          }

          if (speakerValues.length > 0) {
            await db.insert(sessionSpeakers).values(speakerValues);
          }
        }

        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Row ${rowNum} (${row.title}): ${msg}`);
      }
    }

    return NextResponse.json({ imported, errors });
  } catch (error) {
    return handleApiError(error, "admin/sessions/import:POST");
  }
}
