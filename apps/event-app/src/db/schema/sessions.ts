/**
 * Sessions Schema - Sessions, Speaker join table, Upvotes, Comments
 */

import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  date,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { events } from "./events";

// Update THIS with the actual Session Types
export const trackEnum = pgEnum("track", ["Leadership", "Technology", "Strategy", "Innovation", "Culture"]);


//===================================================================================================
// SESSIONS TABLE (name "eventSessions" to avoid potential conflicts with the auth table "sessions")
//===================================================================================================
export const eventSessions = pgTable(
  "event_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    eventId: varchar("event_id", { length: 255 }).references(() => events.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    date: date("date").notNull(),
    startTime: varchar("start_time", { length: 10 }).notNull(),
    endTime: varchar("end_time", { length: 10 }).notNull(),
    location: varchar("location", { length: 500 }),
    track: trackEnum("track"),
    tags: jsonb("tags").$type<string[]>().default([]),
    viewerIds: jsonb("viewer_ids").$type<string[]>().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("event_sessions_date_idx").on(table.date),
    index("event_sessions_track_idx").on(table.track),
    index("event_sessions_event_id_idx").on(table.eventId),
  ]
);

//==================================================================
// SESSION ↔ SPEAKER JOIN TABLE (many-to-many)
//==================================================================
export const sessionSpeakers = pgTable(
  "session_speakers",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sessionId: varchar("session_id", { length: 255 })
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("session_speakers_session_user_idx").on(
      table.sessionId,
      table.userId
    ),
    index("session_speakers_session_id_idx").on(table.sessionId),
    index("session_speakers_user_id_idx").on(table.userId),
  ]
);

//==================================================================
// SESSION UPVOTES
//==================================================================
export const sessionUpvotes = pgTable(
  "session_upvotes",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 255 })
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("session_upvotes_user_session_idx").on(
      table.userId,
      table.sessionId
    ),
    index("session_upvotes_session_id_idx").on(table.sessionId),
    index("session_upvotes_user_id_idx").on(table.userId),
  ]
);

//=========================================================
// SESSION COMMENTS
//=========================================================
export const sessionComments = pgTable(
  "session_comments",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sessionId: varchar("session_id", { length: 255 })
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isAiSummary: boolean("is_ai_summary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("session_comments_session_id_idx").on(table.sessionId),
    index("session_comments_user_id_idx").on(table.userId),
  ]
);
