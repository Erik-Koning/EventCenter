import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroups,
  networkingGroupMembers,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  eventId: z.string().max(255).optional(),
});

/**
 * GET /api/networking/groups - List groups (optionally filtered by eventId)
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const conditions = eventId
      ? and(eq(networkingGroups.eventId, eventId))
      : undefined;

    const groups = await db
      .select({
        id: networkingGroups.id,
        name: networkingGroups.name,
        description: networkingGroups.description,
        creatorId: networkingGroups.creatorId,
        creatorName: users.name,
        topWords: networkingGroups.topWords,
        insights: networkingGroups.insights,
        memberCount: networkingGroups.memberCount,
        createdAt: networkingGroups.createdAt,
      })
      .from(networkingGroups)
      .leftJoin(users, eq(networkingGroups.creatorId, users.id))
      .where(conditions)
      .orderBy(desc(networkingGroups.createdAt));

    return NextResponse.json(groups);
  } catch (error) {
    return handleApiError(error, "networking/groups:GET");
  }
}

/**
 * POST /api/networking/groups - Create group + auto-join creator
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createGroupSchema.parse(body);

    const groupId = createId();
    const memberId = createId();

    const [group] = await db
      .insert(networkingGroups)
      .values({
        id: groupId,
        name: validated.name,
        description: validated.description ?? null,
        creatorId: user.id,
        eventId: validated.eventId ?? null,
        memberCount: 1,
      })
      .returning();

    await db.insert(networkingGroupMembers).values({
      id: memberId,
      groupId: groupId,
      userId: user.id,
    });

    return NextResponse.json(
      { ...group, creatorName: user.name },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "networking/groups:POST");
  }
}
