import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createSpeakerSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  bio: z.string().min(1),
  imageUrl: z.string().optional(),
  initials: z.string().min(1).max(10),
  eventId: z.string().min(1),
});

export async function GET(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId") || authResult.user.currentEventId;

    if (!eventId) {
      return NextResponse.json([]);
    }

    // Get speakers for this event from eventAttendees
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        title: users.title,
        company: users.company,
        imageUrl: users.imageUrl,
        initials: users.initials,
        bio: eventAttendees.bio,
        isSpeaker: eventAttendees.isSpeaker,
        createdAt: users.createdAt,
      })
      .from(eventAttendees)
      .innerJoin(users, eq(eventAttendees.userId, users.id))
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.isSpeaker, true)
        )
      )
      .orderBy(desc(users.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, "admin/speakers:GET");
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = createSpeakerSchema.parse(body);

    const now = new Date();
    const userId = createId();

    // Create user (without isSpeaker/bio — those go on enrollment)
    const [speaker] = await db
      .insert(users)
      .values({
        id: userId,
        name: validated.name,
        title: validated.title,
        company: validated.company ?? "Scotiabank",
        imageUrl: validated.imageUrl ?? "",
        initials: validated.initials,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Enroll as speaker in the event
    await db.insert(eventAttendees).values({
      id: createId(),
      eventId: validated.eventId,
      userId,
      isSpeaker: true,
      bio: validated.bio,
    });

    return NextResponse.json({ ...speaker, isSpeaker: true, bio: validated.bio }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/speakers:POST");
  }
}
