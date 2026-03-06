import { NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessionUpvotes } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * POST /api/sessions/[sessionId]/upvote
 * Toggle upvote for the current user. Returns { upvoted, count }.
 */
export async function POST(_request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { sessionId } = await context.params;

    // Check if the user already upvoted this session
    const existing = await db.query.sessionUpvotes.findFirst({
      where: and(
        eq(sessionUpvotes.userId, user.id),
        eq(sessionUpvotes.sessionId, sessionId)
      ),
    });

    if (existing) {
      // Remove upvote
      await db
        .delete(sessionUpvotes)
        .where(eq(sessionUpvotes.id, existing.id));
    } else {
      // Add upvote
      await db.insert(sessionUpvotes).values({
        id: createId(),
        userId: user.id,
        sessionId,
      });
    }

    // Return new count
    const [result] = await db
      .select({ count: count() })
      .from(sessionUpvotes)
      .where(eq(sessionUpvotes.sessionId, sessionId));

    return NextResponse.json({
      upvoted: !existing,
      count: result.count,
    });
  } catch (error) {
    return handleApiError(error, "sessions/[sessionId]/upvote:POST");
  }
}
