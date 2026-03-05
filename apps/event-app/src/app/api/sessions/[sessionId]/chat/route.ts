import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, gt, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessionComments, users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { broadcastToGroup } from "@/lib/pubsub";
import { onSessionCommentCreated } from "@/lib/sessions/on-session-comment-hooks";

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

const editMessageSchema = z.object({
  messageId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/sessions/[sessionId]/chat - List comments, supports ?after=timestamp
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { sessionId } = await params;

  try {
    const url = new URL(request.url);
    const after = url.searchParams.get("after");

    const conditions = [eq(sessionComments.sessionId, sessionId)];
    if (after) {
      conditions.push(gt(sessionComments.createdAt, new Date(after)));
    }

    const messages = await db
      .select({
        id: sessionComments.id,
        sessionId: sessionComments.sessionId,
        userId: sessionComments.userId,
        userName: users.name,
        content: sessionComments.content,
        isAiSummary: sessionComments.isAiSummary,
        createdAt: sessionComments.createdAt,
        updatedAt: sessionComments.updatedAt,
      })
      .from(sessionComments)
      .leftJoin(users, eq(sessionComments.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(sessionComments.createdAt))
      .limit(200);

    return NextResponse.json(messages);
  } catch (error) {
    return handleApiError(error, "sessions/[sessionId]/chat:GET");
  }
}

/**
 * POST /api/sessions/[sessionId]/chat - Send comment + broadcast
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { sessionId } = await params;

  try {
    const body = await request.json();
    const validated = sendMessageSchema.parse(body);

    const commentId = createId();
    const [comment] = await db
      .insert(sessionComments)
      .values({
        id: commentId,
        sessionId,
        userId: user.id,
        content: validated.content,
      })
      .returning();

    await broadcastToGroup(`session:${sessionId}`, {
      type: "message:new",
      data: { ...comment, userName: user.name },
    });

    // Fire-and-forget Sia trigger on @sia mention
    onSessionCommentCreated(sessionId, validated.content, user.id, user.name);

    return NextResponse.json(
      { ...comment, userName: user.name },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "sessions/[sessionId]/chat:POST");
  }
}

/**
 * PUT /api/sessions/[sessionId]/chat - Edit own comment
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { sessionId } = await params;

  try {
    const body = await request.json();
    const validated = editMessageSchema.parse(body);

    // Verify message exists, belongs to user, and is not AI summary
    const existing = await db.query.sessionComments.findFirst({
      where: and(
        eq(sessionComments.id, validated.messageId),
        eq(sessionComments.sessionId, sessionId)
      ),
    });

    if (!existing) return commonErrors.notFound();
    if (existing.userId !== user.id) return commonErrors.forbidden();
    if (existing.isAiSummary) return commonErrors.forbidden();

    const now = new Date();
    const [updated] = await db
      .update(sessionComments)
      .set({ content: validated.content, updatedAt: now })
      .where(eq(sessionComments.id, validated.messageId))
      .returning();

    await broadcastToGroup(`session:${sessionId}`, {
      type: "message:edited",
      data: { id: updated.id, content: updated.content, updatedAt: updated.updatedAt },
    });

    return NextResponse.json({ ...updated, userName: user.name });
  } catch (error) {
    return handleApiError(error, "sessions/[sessionId]/chat:PUT");
  }
}
