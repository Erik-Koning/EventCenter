import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, gt, asc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroupMembers,
  networkingMessages,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { broadcastToGroup } from "@/lib/pubsub";
import { onMessageCreated } from "@/lib/networking/on-message-hooks";

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

const editMessageSchema = z.object({
  messageId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/networking/groups/[groupId]/messages - Get messages, supports ?after=timestamp
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { groupId } = await params;

  try {
    const url = new URL(request.url);
    const after = url.searchParams.get("after");

    const conditions = [eq(networkingMessages.groupId, groupId)];
    if (after) {
      conditions.push(gt(networkingMessages.createdAt, new Date(after)));
    }

    const messages = await db
      .select({
        id: networkingMessages.id,
        groupId: networkingMessages.groupId,
        userId: networkingMessages.userId,
        userName: users.name,
        content: networkingMessages.content,
        isAiSummary: networkingMessages.isAiSummary,
        createdAt: networkingMessages.createdAt,
        updatedAt: networkingMessages.updatedAt,
      })
      .from(networkingMessages)
      .leftJoin(users, eq(networkingMessages.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(networkingMessages.createdAt))
      .limit(200);

    return NextResponse.json(messages);
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/messages:GET");
  }
}

/**
 * POST /api/networking/groups/[groupId]/messages - Send message + trigger insights
 */
export async function POST(
  request: Request,
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

    const body = await request.json();
    const validated = sendMessageSchema.parse(body);

    const messageId = createId();
    const [message] = await db
      .insert(networkingMessages)
      .values({
        id: messageId,
        groupId,
        userId: user.id,
        content: validated.content,
      })
      .returning();

    await broadcastToGroup(groupId, {
      type: "message:new",
      data: { ...message, userName: user.name },
    });

    // Trigger hooks (Sia agent + insights) — fire-and-forget
    const [{ value: msgCount }] = await db
      .select({ value: count() })
      .from(networkingMessages)
      .where(
        and(
          eq(networkingMessages.groupId, groupId),
          eq(networkingMessages.isAiSummary, false)
        )
      );
    onMessageCreated(groupId, validated.content, msgCount, user.id, user.name);

    return NextResponse.json(
      { ...message, userName: user.name },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/messages:POST");
  }
}

/**
 * PUT /api/networking/groups/[groupId]/messages - Edit own message
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { groupId } = await params;

  try {
    const body = await request.json();
    const validated = editMessageSchema.parse(body);

    // Verify message exists, belongs to user, and is not AI summary
    const existing = await db.query.networkingMessages.findFirst({
      where: and(
        eq(networkingMessages.id, validated.messageId),
        eq(networkingMessages.groupId, groupId)
      ),
    });

    if (!existing) return commonErrors.notFound();
    if (existing.userId !== user.id) return commonErrors.forbidden();
    if (existing.isAiSummary) return commonErrors.forbidden();

    const now = new Date();
    const [updated] = await db
      .update(networkingMessages)
      .set({ content: validated.content, updatedAt: now })
      .where(eq(networkingMessages.id, validated.messageId))
      .returning();

    await broadcastToGroup(groupId, {
      type: "message:edited",
      data: { id: updated.id, content: updated.content, updatedAt: updated.updatedAt },
    });

    return NextResponse.json({ ...updated, userName: user.name });
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/messages:PUT");
  }
}
