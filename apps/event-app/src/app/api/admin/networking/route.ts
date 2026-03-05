import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkingGroups, users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  eventId: z.string().max(255).optional(),
});

export async function GET(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const conditions = eventId
      ? eq(networkingGroups.eventId, eventId)
      : undefined;

    const groups = await db
      .select({
        id: networkingGroups.id,
        name: networkingGroups.name,
        description: networkingGroups.description,
        creatorId: networkingGroups.creatorId,
        creatorName: users.name,
        eventId: networkingGroups.eventId,
        memberCount: networkingGroups.memberCount,
        topWords: networkingGroups.topWords,
        insights: networkingGroups.insights,
        createdAt: networkingGroups.createdAt,
      })
      .from(networkingGroups)
      .leftJoin(users, eq(networkingGroups.creatorId, users.id))
      .where(conditions)
      .orderBy(desc(networkingGroups.createdAt));

    return NextResponse.json(groups);
  } catch (error) {
    return handleApiError(error, "admin/networking:GET");
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createGroupSchema.parse(body);

    const [group] = await db
      .insert(networkingGroups)
      .values({
        id: createId(),
        name: validated.name,
        description: validated.description ?? null,
        creatorId: user.id,
        eventId: validated.eventId ?? null,
        memberCount: 0,
      })
      .returning();

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/networking:POST");
  }
}
