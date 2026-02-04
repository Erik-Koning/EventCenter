/**
 * Chat schema - ChatSession, ChatMessage, UpdateFollowUp
 */
import {
  pgTable,
  varchar,
  text,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { teams } from "./teams";
import { dailyUpdates, extractedActivities } from "./activities";
import { teamEvents } from "./events";

// ============================================
// CHAT SESSION (for update wizard conversations)
// ============================================

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 255 })
      .references(() => teams.id, { onDelete: "set null" }),

    updatePeriod: varchar("update_period", { length: 50 }).notNull(),
    periodDate: date("period_date").notNull(),

    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active | completed | abandoned

    dailyUpdateId: varchar("daily_update_id", { length: 255 })
      .unique()
      .references(() => dailyUpdates.id),
  },
  (table) => [
    index("chat_sessions_user_id_idx").on(table.userId),
    index("chat_sessions_period_date_idx").on(table.periodDate),
    index("chat_sessions_team_id_idx").on(table.teamId),
  ]
);

// ============================================
// CHAT MESSAGE
// ============================================

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    chatSessionId: varchar("chat_session_id", { length: 255 })
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // user | assistant
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_messages_session_id_idx").on(table.chatSessionId)]
);

// ============================================
// UPDATE FOLLOW-UPS (reminders from activities)
// ============================================

export const updateFollowUps = pgTable(
  "update_follow_ups",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    chatSessionId: varchar("chat_session_id", { length: 255 })
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    extractedActivityId: varchar("extracted_activity_id", { length: 255 })
      .notNull()
      .references(() => extractedActivities.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 255 })
      .references(() => teams.id, { onDelete: "set null" }),

    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    activityType: varchar("activity_type", { length: 50 }),

    status: varchar("status", { length: 50 }).default("confirmed").notNull(), // "confirmed" | "completed" | "dismissed"
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at"),
    completedInSessionId: varchar("completed_in_session_id", { length: 255 }),

    linkedEventId: varchar("linked_event_id", { length: 255 })
      .references(() => teamEvents.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("update_follow_ups_user_status_idx").on(table.userId, table.status),
    index("update_follow_ups_session_id_idx").on(table.chatSessionId),
    index("update_follow_ups_team_status_idx").on(table.teamId, table.status),
    index("update_follow_ups_linked_event_idx").on(table.linkedEventId),
  ]
);
