import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroups,
  networkingGroupMembers,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { broadcastToGroup } from "@/lib/pubsub";

/**
 * GET /api/networking/groups/[groupId]/members - List group members
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { groupId } = await params;

  try {
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        initials: users.initials,
      })
      .from(networkingGroupMembers)
      .innerJoin(users, eq(networkingGroupMembers.userId, users.id))
      .where(eq(networkingGroupMembers.groupId, groupId));

    return NextResponse.json(members);
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/members:GET");
  }
}

/**
 * POST /api/networking/groups/[groupId]/members - Join group
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { groupId } = await params;

  try {
    const group = await db.query.networkingGroups.findFirst({
      where: eq(networkingGroups.id, groupId),
    });
    if (!group) return commonErrors.notFound("Group");

    // Check if already a member
    const existing = await db.query.networkingGroupMembers.findFirst({
      where: and(
        eq(networkingGroupMembers.groupId, groupId),
        eq(networkingGroupMembers.userId, user.id)
      ),
    });
    if (existing) {
      return commonErrors.badRequest("Already a member of this group");
    }

    await db.insert(networkingGroupMembers).values({
      id: createId(),
      groupId,
      userId: user.id,
    });

    // Increment member count
    await db
      .update(networkingGroups)
      .set({ memberCount: sql`${networkingGroups.memberCount} + 1` })
      .where(eq(networkingGroups.id, groupId));

    await broadcastToGroup(groupId, {
      type: "member:join",
      data: { userId: user.id, memberCount: group.memberCount + 1 },
    });

    return NextResponse.json({ success: true, memberCount: group.memberCount + 1 }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/members:POST");
  }
}

/**
 * DELETE /api/networking/groups/[groupId]/members - Leave group
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { groupId } = await params;

  try {
    const membership = await db.query.networkingGroupMembers.findFirst({
      where: and(
        eq(networkingGroupMembers.groupId, groupId),
        eq(networkingGroupMembers.userId, user.id)
      ),
    });
    if (!membership) {
      return commonErrors.badRequest("Not a member of this group");
    }

    await db
      .delete(networkingGroupMembers)
      .where(eq(networkingGroupMembers.id, membership.id));

    // Decrement member count
    await db
      .update(networkingGroups)
      .set({ memberCount: sql`GREATEST(${networkingGroups.memberCount} - 1, 0)` })
      .where(eq(networkingGroups.id, groupId));

    await broadcastToGroup(groupId, {
      type: "member:leave",
      data: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/members:DELETE");
  }
}
