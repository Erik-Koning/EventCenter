import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventAttendees, users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const assignAttendeeSchema = z.object({
  userId: z.string().min(1),
});

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const rows = await db
      .select({
        id: eventAttendees.id,
        eventId: eventAttendees.eventId,
        userId: eventAttendees.userId,
        userName: users.name,
        userTitle: users.title,
        isSpeaker: eventAttendees.isSpeaker,
        bio: eventAttendees.bio,
        createdAt: eventAttendees.createdAt,
      })
      .from(eventAttendees)
      .leftJoin(users, eq(eventAttendees.userId, users.id))
      .where(eq(eventAttendees.eventId, eventId));

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, "admin/events/[eventId]/attendees:GET");
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const body = await request.json();
    const validated = assignAttendeeSchema.parse(body);

    const [row] = await db
      .insert(eventAttendees)
      .values({
        id: createId(),
        eventId,
        userId: validated.userId,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/events/[eventId]/attendees:POST");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { message: "userId query param required", error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    await db
      .delete(eventAttendees)
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.userId, userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/events/[eventId]/attendees:DELETE");
  }
}
