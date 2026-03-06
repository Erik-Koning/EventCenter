import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventSessions, sessionUpvotes } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const { eventId } = await params;
    const { user } = authResult;

    const sessions = await db.query.eventSessions.findMany({
      where: eq(eventSessions.eventId, eventId),
      with: {
        sessionSpeakers: {
          with: {
            user: true,
          },
          orderBy: (ss, { asc }) => [asc(ss.displayOrder)],
        },
      },
      orderBy: (s, { asc }) => [asc(s.date), asc(s.startTime)],
    });

    // Fetch upvote counts and user's upvotes in parallel
    const sessionIds = sessions.map((s) => s.id);

    let upvoteCounts: { sessionId: string; count: number }[] = [];
    let userUpvotedIds = new Set<string>();

    if (sessionIds.length > 0) {
      const [counts, userUpvotes] = await Promise.all([
        db
          .select({
            sessionId: sessionUpvotes.sessionId,
            count: sql<number>`count(*)::int`,
          })
          .from(sessionUpvotes)
          .where(sql`${sessionUpvotes.sessionId} IN ${sessionIds}`)
          .groupBy(sessionUpvotes.sessionId),
        db
          .select({ sessionId: sessionUpvotes.sessionId })
          .from(sessionUpvotes)
          .where(
            sql`${sessionUpvotes.sessionId} IN ${sessionIds} AND ${sessionUpvotes.userId} = ${user.id}`
          ),
      ]);
      upvoteCounts = counts;
      userUpvotedIds = new Set(userUpvotes.map((u) => u.sessionId));
    }

    const upvoteMap = new Map(
      upvoteCounts.map((u) => [u.sessionId, u.count])
    );

    // Flatten speakers into each session
    const result = sessions.map((s) => ({
      id: s.id,
      eventId: s.eventId,
      title: s.title,
      description: s.description,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      track: s.track,
      tags: s.tags,
      speakers: s.sessionSpeakers.map((ss) => ss.user),
      upvoteCount: upvoteMap.get(s.id) ?? 0,
      userUpvoted: userUpvotedIds.has(s.id),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "events/[eventId]/sessions:GET");
  }
}
