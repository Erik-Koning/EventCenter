import { NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/updates/sessions - Get user's chat session history
 *
 * Query params:
 * - sessionId: fetch a single session by ID (returns single object, not array)
 * - limit: number of sessions to return (default 10)
 * - offset: number of sessions to skip (default 0)
 * - status: filter by status (optional, default returns all)
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    // If sessionId is provided, fetch single session
    if (sessionId) {
      const session = await db.query.chatSessions.findFirst({
        where: and(
          eq(chatSessions.sessionId, sessionId),
          eq(chatSessions.userId, user.id)
        ),
        with: {
          messages: {
            orderBy: [chatMessages.createdAt],
          },
          dailyUpdate: {
            with: {
              extractedActivities: true,
            },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ session: null });
      }

      return NextResponse.json({
        session: {
          id: session.id,
          sessionId: session.sessionId,
          updatePeriod: session.updatePeriod,
          periodDate: session.periodDate,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt?.toISOString() || null,
          status: session.status,
          messages: session.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
          })),
          extractedActivities:
            session.dailyUpdate?.extractedActivities.map((activity) => ({
              id: activity.id,
              activityType: activity.activityType,
              quantity: Number(activity.quantity),
              summary: activity.summary,
              activityDate: activity.activityDate,
            })) || [],
        },
      });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");

    // Build conditions
    const conditions = [eq(chatSessions.userId, user.id)];
    if (status) {
      conditions.push(eq(chatSessions.status, status));
    }

    const [sessions, totalResult] = await Promise.all([
      db.query.chatSessions.findMany({
        where: and(...conditions),
        with: {
          messages: {
            orderBy: [chatMessages.createdAt],
          },
          dailyUpdate: {
            with: {
              extractedActivities: true,
            },
          },
        },
        orderBy: [desc(chatSessions.startedAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(chatSessions)
        .where(and(...conditions)),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    // Transform the data for the frontend
    const transformedSessions = sessions.map((session) => ({
      id: session.id,
      sessionId: session.sessionId,
      updatePeriod: session.updatePeriod,
      periodDate: session.periodDate,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() || null,
      status: session.status,
      messages: session.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
      extractedActivities:
        session.dailyUpdate?.extractedActivities.map((activity) => ({
          id: activity.id,
          activityType: activity.activityType,
          quantity: Number(activity.quantity),
          summary: activity.summary,
          activityDate: activity.activityDate,
        })) || [],
    }));

    return NextResponse.json({
      sessions: transformedSessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    return handleApiError(error, "updates/sessions:GET");
  }
}
