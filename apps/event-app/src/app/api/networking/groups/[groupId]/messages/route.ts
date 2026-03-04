import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, gt, desc, asc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroups,
  networkingGroupMembers,
  networkingMessages,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { broadcastToGroup } from "@/lib/pubsub";
import { generateInsights } from "@/lib/networking/generate-insights";

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

// Common stop words to exclude from word cloud
const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there",
  "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no",
  "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then",
  "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first",
  "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "has", "had", "did", "am", "im", "dont", "very", "much", "more",
]);

function computeTopWords(messages: { content: string }[]): string[] {
  const freq: Record<string, number> = {};
  for (const msg of messages) {
    const words = msg.content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

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
 * POST /api/networking/groups/[groupId]/messages - Send message + update word cloud
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

    // Update word cloud from last 200 messages (async, non-blocking for response)
    const recentMessages = await db
      .select({ content: networkingMessages.content })
      .from(networkingMessages)
      .where(eq(networkingMessages.groupId, groupId))
      .orderBy(desc(networkingMessages.createdAt))
      .limit(200);

    const topWords = computeTopWords(recentMessages);
    await db
      .update(networkingGroups)
      .set({ topWords })
      .where(eq(networkingGroups.id, groupId));

    await broadcastToGroup(groupId, {
      type: "message:new",
      data: { ...message, userName: user.name, topWords },
    });

    // Trigger insight generation every 5 non-AI messages (fire-and-forget)
    const [{ value: msgCount }] = await db
      .select({ value: count() })
      .from(networkingMessages)
      .where(
        and(
          eq(networkingMessages.groupId, groupId),
          eq(networkingMessages.isAiSummary, false)
        )
      );
    if (msgCount % 5 === 0) {
      generateInsights(groupId).catch((err) =>
        console.error("[messages:POST] generateInsights error:", err)
      );
    }

    return NextResponse.json(
      { ...message, userName: user.name, topWords },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/messages:POST");
  }
}
