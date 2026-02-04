/**
 * Activities schema - DailyUpdate, ExtractedActivity
 */
import {
  pgTable,
  varchar,
  text,
  timestamp,
  decimal,
  date,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { goals, userGoalSets } from "./goals";
import { teams } from "./teams";

// ============================================
// DAILY UPDATE (user check-ins)
// ============================================

export const dailyUpdates = pgTable(
  "daily_updates",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
    userGoalSetId: varchar("user_goal_set_id", { length: 255 })
      .references(() => userGoalSets.id, { onDelete: "no action", onUpdate: "no action" }),
    updateText: text("update_text").notNull(),
    teamId: varchar("team_id", { length: 255 })
      .references(() => teams.id, { onDelete: "set null" }),

    // UpdatePeriod: "morning" | "afternoon" | "evening" | "full_day"
    updatePeriod: varchar("update_period", { length: 50 }).notNull(),
    periodDate: date("period_date").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_updates_user_period_idx").on(table.userId, table.periodDate),
    index("daily_updates_team_id_idx").on(table.teamId),
  ]
);

// ============================================
// EXTRACTED ACTIVITY (LLM-parsed from daily updates)
// ============================================

export const extractedActivities = pgTable(
  "extracted_activities",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    dailyUpdateId: varchar("daily_update_id", { length: 255 })
      .notNull()
      .references(() => dailyUpdates.id, { onDelete: "no action", onUpdate: "no action" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
    teamId: varchar("team_id", { length: 255 })
      .references(() => teams.id, { onDelete: "set null" }),

    // ActivityType: "experiments" | "product_demos" | "mentoring" | "presentations" | "volunteering" | "general_task" | "research_learning"
    activityType: varchar("activity_type", { length: 50 }).notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
    summary: text("summary").notNull(),
    activityDate: date("activity_date").notNull(),

    // Period: "morning" | "afternoon" | "evening" | "full_day"
    period: varchar("period", { length: 50 }).notNull(),
    linkedGoalId: varchar("linked_goal_id", { length: 255 })
      .references(() => goals.id, { onDelete: "set null", onUpdate: "no action" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("extracted_activities_user_date_idx").on(table.userId, table.activityDate),
    index("extracted_activities_type_idx").on(table.activityType),
    index("extracted_activities_team_id_idx").on(table.teamId),
  ]
);
