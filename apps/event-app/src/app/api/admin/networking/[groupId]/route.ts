import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkingGroups } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  eventId: z.string().max(255).nullable().optional(),
});

type RouteParams = { params: Promise<{ groupId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { groupId } = await params;
    const body = await request.json();
    const validated = updateGroupSchema.parse(body);

    const [updated] = await db
      .update(networkingGroups)
      .set(validated)
      .where(eq(networkingGroups.id, groupId))
      .returning();

    if (!updated) return commonErrors.notFound("Group");
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "admin/networking/[groupId]:PUT");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { groupId } = await params;
    const [deleted] = await db
      .delete(networkingGroups)
      .where(eq(networkingGroups.id, groupId))
      .returning();

    if (!deleted) return commonErrors.notFound("Group");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/networking/[groupId]:DELETE");
  }
}
