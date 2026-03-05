import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroups,
  networkingGroupMembers,
  networkingMessages,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

/**
 * GET /api/networking/groups/[groupId]/summary - AI summary of recent chat
 * v1: Returns key message excerpts and top words
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

    const group = await db.query.networkingGroups.findFirst({
      where: eq(networkingGroups.id, groupId),
    });
    if (!group) return commonErrors.notFound("Group");

    // Get recent messages for summary
    const recentMessages = await db
      .select({
        content: networkingMessages.content,
        userName: users.name,
        createdAt: networkingMessages.createdAt,
      })
      .from(networkingMessages)
      .leftJoin(users, eq(networkingMessages.userId, users.id))
      .where(eq(networkingMessages.groupId, groupId))
      .orderBy(desc(networkingMessages.createdAt))
      .limit(20);

    // v1: Simple key topics from top words + recent message excerpts
    const topWords = (group.topWords as string[]) || [];
    const excerpts = recentMessages
      .slice(0, 5)
      .map((m) => ({
        author: m.userName,
        preview: m.content.length > 100 ? m.content.slice(0, 100) + "..." : m.content,
      }));

    const summary =
      topWords.length > 0
        ? `Key topics being discussed: ${topWords.join(", ")}`
        : "";

    return NextResponse.json({
      summary,
      topWords,
      recentExcerpts: excerpts,
      messageCount: recentMessages.length,
    });
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/summary:GET");
  }
}
