import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSessions, sessionSpeakers } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const updateSessionSchema = z.object({
  eventId: z.string().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().max(10).optional(),
  endTime: z.string().max(10).optional(),
  location: z.string().max(500).optional(),
  track: z.enum(["Leadership", "Technology", "Strategy", "Innovation", "Culture"]).nullable().optional(),
  tags: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
});

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { sessionId } = await params;
    const body = await request.json();
    const validated = updateSessionSchema.parse(body);
    const { userIds, ...sessionData } = validated;

    const [updated] = await db
      .update(eventSessions)
      .set({ ...sessionData, updatedAt: new Date() })
      .where(eq(eventSessions.id, sessionId))
      .returning();

    if (!updated) return commonErrors.notFound("Session");

    if (userIds !== undefined) {
      // Replace all speakers
      await db.delete(sessionSpeakers).where(eq(sessionSpeakers.sessionId, sessionId));
      if (userIds.length > 0) {
        await db.insert(sessionSpeakers).values(
          userIds.map((userId, i) => ({
            id: createId(),
            sessionId,
            userId,
            displayOrder: i,
          }))
        );
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "admin/sessions/[sessionId]:PUT");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { sessionId } = await params;
    const [deleted] = await db
      .delete(eventSessions)
      .where(eq(eventSessions.id, sessionId))
      .returning();

    if (!deleted) return commonErrors.notFound("Session");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/sessions/[sessionId]:DELETE");
  }
}
