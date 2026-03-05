import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "@/lib/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import {
  networkingMessages,
  networkingGroups,
  sessionComments,
  eventSessions,
  sessionSpeakers,
  sessionUpvotes,
  users,
} from "@/db/schema";
import { searchDiscussions } from "@/lib/chat/search-discussions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tool = DynamicStructuredTool<any>;

export function createEventTools(eventId: string): Tool[] {
  const searchDiscussionsTool: Tool = new DynamicStructuredTool({
    name: "search_discussions",
    description:
      "Fetch all recent networking group messages and session comments. Use when the user asks about discussions, conversations, what people are saying, or community sentiment.",
    schema: z.object({}),
    func: async () => {
      return await searchDiscussions(eventId);
    },
  });

  const searchTopicTool: Tool = new DynamicStructuredTool({
    name: "search_topic",
    description:
      "Search all networking messages and session comments for a keyword. Reports which groups and sessions mention the topic with excerpts. Use when the user asks where a topic is being discussed.",
    schema: z.object({
      keyword: z
        .string()
        .describe("The keyword or phrase to search for in discussions"),
    }),
    func: async (input) => {
      const { keyword } = input as { keyword: string };
      const pattern = `%${keyword}%`;
      const parts: string[] = [];

      // Search networking messages
      const msgResults = await db
        .select({
          content: networkingMessages.content,
          groupName: networkingGroups.name,
        })
        .from(networkingMessages)
        .innerJoin(
          networkingGroups,
          eq(networkingMessages.groupId, networkingGroups.id),
        )
        .where(
          and(
            networkingGroups.eventId
              ? eq(networkingGroups.eventId, eventId)
              : undefined,
            ilike(networkingMessages.content, pattern),
          ),
        )
        .limit(25);

      if (msgResults.length > 0) {
        const byGroup = new Map<string, string[]>();
        for (const row of msgResults) {
          const list = byGroup.get(row.groupName) ?? [];
          list.push(row.content);
          byGroup.set(row.groupName, list);
        }
        parts.push("=== NETWORKING GROUP MENTIONS ===");
        for (const [group, messages] of byGroup) {
          parts.push(`\nGroup: ${group}`);
          for (const msg of messages.slice(0, 5)) {
            parts.push(`  - ${msg}`);
          }
        }
      }

      // Search session comments
      const commentResults = await db
        .select({
          content: sessionComments.content,
          sessionTitle: eventSessions.title,
        })
        .from(sessionComments)
        .innerJoin(
          eventSessions,
          eq(sessionComments.sessionId, eventSessions.id),
        )
        .where(
          and(
            eq(eventSessions.eventId, eventId),
            ilike(sessionComments.content, pattern),
          ),
        )
        .limit(25);

      if (commentResults.length > 0) {
        const bySession = new Map<string, string[]>();
        for (const row of commentResults) {
          const list = bySession.get(row.sessionTitle) ?? [];
          list.push(row.content);
          bySession.set(row.sessionTitle, list);
        }
        parts.push("\n=== SESSION COMMENT MENTIONS ===");
        for (const [session, comments] of bySession) {
          parts.push(`\nSession: ${session}`);
          for (const comment of comments.slice(0, 5)) {
            parts.push(`  - ${comment}`);
          }
        }
      }

      if (parts.length === 0) {
        return `No discussions found mentioning "${keyword}".`;
      }

      return parts.join("\n");
    },
  });

  const lookupSessionsTool: Tool = new DynamicStructuredTool({
    name: "lookup_sessions",
    description:
      "Filter event sessions by track, date, or keyword. Returns session details with speakers and upvote counts. Use when the user asks to find or browse sessions.",
    schema: z.object({
      track: z
        .string()
        .optional()
        .describe(
          "Filter by track name (e.g. Leadership, Technology, Strategy, Innovation, Culture)",
        ),
      date: z
        .string()
        .optional()
        .describe("Filter by date in YYYY-MM-DD format"),
      keyword: z
        .string()
        .optional()
        .describe(
          "Search keyword to match against session title or description",
        ),
    }),
    func: async (input) => {
      const { track, date, keyword } = input as { track?: string; date?: string; keyword?: string };
      const conditions = [eq(eventSessions.eventId, eventId)];

      if (track) {
        conditions.push(sql`${eventSessions.track} = ${track}`);
      }
      if (date) {
        conditions.push(eq(eventSessions.date, date));
      }
      if (keyword) {
        // Use full-text search for stemming (e.g. "operations" matches "operational")
        // with ILIKE fallback for partial/exact matches
        conditions.push(
          sql`(
            to_tsvector('english', coalesce(${eventSessions.title}, '') || ' ' || coalesce(${eventSessions.description}, ''))
            @@ plainto_tsquery('english', ${keyword})
            OR ${eventSessions.title} ILIKE ${`%${keyword}%`}
            OR ${eventSessions.description} ILIKE ${`%${keyword}%`}
          )`,
        );
      }

      const results = await db
        .select({
          id: eventSessions.id,
          title: eventSessions.title,
          description: eventSessions.description,
          date: eventSessions.date,
          startTime: eventSessions.startTime,
          endTime: eventSessions.endTime,
          location: eventSessions.location,
          track: eventSessions.track,
          tags: eventSessions.tags,
        })
        .from(eventSessions)
        .where(and(...conditions))
        .limit(20);

      if (results.length === 0) {
        return "No sessions found matching the criteria.";
      }

      const parts: string[] = [`Found ${results.length} session(s):\n`];

      for (const s of results) {
        const speakerRows = await db
          .select({
            name: users.name,
            title: users.title,
            company: users.company,
          })
          .from(sessionSpeakers)
          .innerJoin(users, eq(sessionSpeakers.userId, users.id))
          .where(eq(sessionSpeakers.sessionId, s.id));

        const [upvoteRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(sessionUpvotes)
          .where(eq(sessionUpvotes.sessionId, s.id));

        parts.push(`Session: ${s.title}`);
        if (s.description) parts.push(`Description: ${s.description}`);
        parts.push(`Date: ${s.date}, ${s.startTime} - ${s.endTime}`);
        if (s.location) parts.push(`Room: ${s.location}`);
        if (s.track) parts.push(`Track: ${s.track}`);
        const tags = (s.tags as string[]) ?? [];
        if (tags.length > 0) parts.push(`Tags: ${tags.join(", ")}`);
        if (speakerRows.length > 0) {
          parts.push(
            `Speakers: ${speakerRows.map((sp) => `${sp.name} (${sp.title}${sp.company ? `, ${sp.company}` : ""})`).join("; ")}`,
          );
        }
        parts.push(`Upvotes: ${upvoteRow?.count ?? 0}`);
        parts.push("");
      }

      return parts.join("\n");
    },
  });

  const lookupSpeakerTool: Tool = new DynamicStructuredTool({
    name: "lookup_speaker",
    description:
      "Look up a speaker by name. Returns their bio, title, company, and which sessions they present. Use when the user asks about a specific speaker.",
    schema: z.object({
      name: z.string().describe("Speaker name (or partial name) to search"),
    }),
    func: async (input) => {
      const { name } = input as { name: string };
      const results = await db
        .select({
          id: users.id,
          name: users.name,
          title: users.title,
          company: users.company,
          bio: users.bio,
        })
        .from(users)
        .where(and(eq(users.isSpeaker, true), ilike(users.name, `%${name}%`)))
        .limit(5);

      if (results.length === 0) {
        return `No speaker found matching "${name}".`;
      }

      const parts: string[] = [];

      for (const speaker of results) {
        parts.push(`Speaker: ${speaker.name}`);
        parts.push(`Title: ${speaker.title}`);
        if (speaker.company) parts.push(`Company: ${speaker.company}`);
        if (speaker.bio) parts.push(`Bio: ${speaker.bio}`);

        const speakerSessions = await db
          .select({
            title: eventSessions.title,
            date: eventSessions.date,
            startTime: eventSessions.startTime,
            endTime: eventSessions.endTime,
            track: eventSessions.track,
          })
          .from(sessionSpeakers)
          .innerJoin(
            eventSessions,
            eq(sessionSpeakers.sessionId, eventSessions.id),
          )
          .where(
            and(
              eq(sessionSpeakers.userId, speaker.id),
              eq(eventSessions.eventId, eventId),
            ),
          );

        if (speakerSessions.length > 0) {
          parts.push("Sessions:");
          for (const s of speakerSessions) {
            parts.push(
              `  - ${s.title} (${s.date}, ${s.startTime}-${s.endTime}${s.track ? `, ${s.track}` : ""})`,
            );
          }
        }
        parts.push("");
      }

      return parts.join("\n");
    },
  });

  return [
    searchDiscussionsTool,
    searchTopicTool,
    lookupSessionsTool,
    lookupSpeakerTool,
  ];
}
