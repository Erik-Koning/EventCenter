import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  venue: z.string().max(500).optional(),
  location: z.string().max(500).optional(),
});

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: { sessions: true, eventAttendees: { with: { user: true } } },
    });

    if (!event) return commonErrors.notFound("Event");
    return NextResponse.json(event);
  } catch (error) {
    return handleApiError(error, "admin/events/[eventId]:GET");
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const body = await request.json();
    const validated = updateEventSchema.parse(body);

    const [updated] = await db
      .update(events)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning();

    if (!updated) return commonErrors.notFound("Event");
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "admin/events/[eventId]:PUT");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const [deleted] = await db
      .delete(events)
      .where(eq(events.id, eventId))
      .returning();

    if (!deleted) return commonErrors.notFound("Event");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/events/[eventId]:DELETE");
  }
}
