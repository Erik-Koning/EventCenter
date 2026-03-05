import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateSpeakerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  bio: z.string().optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  isSpeaker: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ speakerId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { speakerId } = await params;
    const body = await request.json();
    const validated = updateSpeakerSchema.parse(body);

    const [updated] = await db
      .update(users)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(users.id, speakerId))
      .returning();

    if (!updated) return commonErrors.notFound("Speaker");
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "admin/speakers/[speakerId]:PUT");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { speakerId } = await params;
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, speakerId))
      .returning();

    if (!deleted) return commonErrors.notFound("Speaker");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/speakers/[speakerId]:DELETE");
  }
}
