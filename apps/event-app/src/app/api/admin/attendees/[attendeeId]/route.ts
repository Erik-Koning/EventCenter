import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateAttendeeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  userId: z.string().nullable().optional(),
  isSpeaker: z.boolean().optional(),
  company: z.string().max(255).nullable().optional(),
  bio: z.string().nullable().optional(),
});

type RouteParams = { params: Promise<{ attendeeId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { attendeeId } = await params;
    const body = await request.json();
    const validated = updateAttendeeSchema.parse(body);

    const [updated] = await db
      .update(attendees)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(attendees.id, attendeeId))
      .returning();

    if (!updated) return commonErrors.notFound("Attendee");
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "admin/attendees/[attendeeId]:PUT");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { attendeeId } = await params;
    const [deleted] = await db
      .delete(attendees)
      .where(eq(attendees.id, attendeeId))
      .returning();

    if (!deleted) return commonErrors.notFound("Attendee");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/attendees/[attendeeId]:DELETE");
  }
}
