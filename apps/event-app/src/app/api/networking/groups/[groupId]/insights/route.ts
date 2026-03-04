import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroups,
  networkingGroupMembers,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

/**
 * GET /api/networking/groups/[groupId]/insights - Get AI-generated insights for a group
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { groupId } = await params;

  try {
    // Verify membership
    const membership = await db.query.networkingGroupMembers.findFirst({
      where: and(
        eq(networkingGroupMembers.groupId, groupId),
        eq(networkingGroupMembers.userId, user.id)
      ),
    });
    if (!membership) return commonErrors.forbidden();

    const [group] = await db
      .select({ insights: networkingGroups.insights })
      .from(networkingGroups)
      .where(eq(networkingGroups.id, groupId))
      .limit(1);

    if (!group) return commonErrors.notFound();

    return NextResponse.json({ insights: group.insights ?? [] });
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/insights:GET");
  }
}
