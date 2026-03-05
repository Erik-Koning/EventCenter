import { db } from "@/lib/db";
import { and, eq, gte, lt, sql, count } from "drizzle-orm";
import {
  events,
  eventAttendees,
  eventSessions,
  sessionSpeakers,
  sessionComments,
  sessionUpvotes,
  networkingGroups,
  networkingGroupMembers,
  networkingMessages,
  users,
} from "@/db/schema";

export interface RawRecapData {
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  };
  daySessions: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    track: string | null;
    startTime: string;
    endTime: string;
    speakers: { name: string; title: string | null }[];
    commentCount: number;
    upvoteCount: number;
  }[];
  /** All non-AI networking messages for the day, with author name */
  networkingMsgs: { content: string; authorName: string; createdAt: Date }[];
  /** All non-AI session comments for the day, with author name */
  sessionCommentsList: {
    content: string;
    authorName: string;
    createdAt: Date;
    sessionTitle: string;
  }[];
  newConnectionsCount: number;
  attendeeCount: number;
  groupCount: number;
}

export async function gatherRecapData(
  eventId: string,
  targetDate: string
): Promise<RawRecapData> {
  const dayStart = new Date(`${targetDate}T00:00:00Z`);
  const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

  // 1. Event metadata
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      startDate: events.startDate,
      endDate: events.endDate,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new Error(`Event ${eventId} not found`);

  // 2. Sessions for the day with speakers
  const daySessions = await db.query.eventSessions.findMany({
    where: and(
      eq(eventSessions.eventId, eventId),
      eq(eventSessions.date, targetDate)
    ),
    with: {
      sessionSpeakers: {
        with: { user: true },
        orderBy: (sp, { asc }) => [asc(sp.displayOrder)],
      },
    },
  });

  // Get comment and upvote counts per session
  const sessionIds = daySessions.map((s) => s.id);

  const commentCounts =
    sessionIds.length > 0
      ? await db
          .select({
            sessionId: sessionComments.sessionId,
            count: count(),
          })
          .from(sessionComments)
          .where(
            sql`${sessionComments.sessionId} IN ${sessionIds}`
          )
          .groupBy(sessionComments.sessionId)
      : [];

  const upvoteCounts =
    sessionIds.length > 0
      ? await db
          .select({
            sessionId: sessionUpvotes.sessionId,
            count: count(),
          })
          .from(sessionUpvotes)
          .where(
            sql`${sessionUpvotes.sessionId} IN ${sessionIds}`
          )
          .groupBy(sessionUpvotes.sessionId)
      : [];

  const commentMap = new Map(
    commentCounts.map((c) => [c.sessionId, Number(c.count)])
  );
  const upvoteMap = new Map(
    upvoteCounts.map((u) => [u.sessionId, Number(u.count)])
  );

  const enrichedSessions = daySessions.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    location: s.location,
    track: s.track,
    startTime: s.startTime,
    endTime: s.endTime,
    speakers: s.sessionSpeakers.map((sp) => ({
      name: sp.user.name,
      title: sp.user.title,
    })),
    commentCount: commentMap.get(s.id) ?? 0,
    upvoteCount: upvoteMap.get(s.id) ?? 0,
  }));

  // 3. Networking messages for the day (non-AI)
  // Get groups belonging to this event first
  const eventGroups = await db
    .select({ id: networkingGroups.id })
    .from(networkingGroups)
    .where(eq(networkingGroups.eventId, eventId));

  const groupIds = eventGroups.map((g) => g.id);

  const networkingMsgs =
    groupIds.length > 0
      ? await db
          .select({
            content: networkingMessages.content,
            authorName: users.name,
            createdAt: networkingMessages.createdAt,
          })
          .from(networkingMessages)
          .innerJoin(users, eq(networkingMessages.userId, users.id))
          .where(
            and(
              sql`${networkingMessages.groupId} IN ${groupIds}`,
              eq(networkingMessages.isAiSummary, false),
              gte(networkingMessages.createdAt, dayStart),
              lt(networkingMessages.createdAt, dayEnd)
            )
          )
      : [];

  // 4. Session comments for the day (non-AI)
  const sessionCommentsList =
    sessionIds.length > 0
      ? await db
          .select({
            content: sessionComments.content,
            authorName: users.name,
            createdAt: sessionComments.createdAt,
            sessionTitle: eventSessions.title,
          })
          .from(sessionComments)
          .innerJoin(users, eq(sessionComments.userId, users.id))
          .innerJoin(
            eventSessions,
            eq(sessionComments.sessionId, eventSessions.id)
          )
          .where(
            and(
              sql`${sessionComments.sessionId} IN ${sessionIds}`,
              eq(sessionComments.isAiSummary, false)
            )
          )
      : [];

  // 5. New connections (group members who joined that day)
  const [connResult] =
    groupIds.length > 0
      ? await db
          .select({ count: count() })
          .from(networkingGroupMembers)
          .where(
            and(
              sql`${networkingGroupMembers.groupId} IN ${groupIds}`,
              gte(networkingGroupMembers.joinedAt, dayStart),
              lt(networkingGroupMembers.joinedAt, dayEnd)
            )
          )
      : [{ count: 0 }];

  // 6. Attendee count
  const [attResult] = await db
    .select({ count: count() })
    .from(eventAttendees)
    .where(eq(eventAttendees.eventId, eventId));

  // 7. Group count
  const [grpResult] = await db
    .select({ count: count() })
    .from(networkingGroups)
    .where(eq(networkingGroups.eventId, eventId));

  return {
    event,
    daySessions: enrichedSessions,
    networkingMsgs,
    sessionCommentsList,
    newConnectionsCount: Number(connResult?.count ?? 0),
    attendeeCount: Number(attResult?.count ?? 0),
    groupCount: Number(grpResult?.count ?? 0),
  };
}
