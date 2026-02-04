/**
 * Goals schema - Goal, UserGoalSet, GoalUpdate, GoalProgressEstimate
 */
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// USER GOAL SET (container for 3-5 goals)
// ============================================

export const userGoalSets = pgTable(
  "user_goal_sets",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),

    // Status: "draft" | "pending_review" | "pending_approval" | "active" | "completed" | "abandoned"
    status: varchar("status", { length: 50 }).default("draft").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    requiresApproval: boolean("requires_approval").default(false).notNull(),
    approvedById: varchar("approved_by", { length: 255 })
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
    approvedAt: timestamp("approved_at"),
    adminComment: text("admin_comment"),
    editableUntil: date("editable_until"), // start_date + 14 days

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_goal_sets_user_id_idx").on(table.userId),
    index("user_goal_sets_status_idx").on(table.status),
  ]
);

// ============================================
// GOAL (individual goal within a set)
// ============================================

export const goals = pgTable(
  "goals",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userGoalSetId: varchar("user_goal_set_id", { length: 255 })
      .references(() => userGoalSets.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),

    // Core goal fields
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    goalText: text("goal_text"), // Legacy field
    goalOrder: integer("goal_order"), // 1-5, optional for standalone goals

    // Status: "active" | "completed" | "paused" | "draft"
    status: varchar("status", { length: 50 }).default("active").notNull(),
    targetDate: timestamp("target_date"),

    // ValidationStatus: "pending" | "valid" | "warning" | "rejected"
    validationStatus: varchar("validation_status", { length: 50 }).default("pending").notNull(),
    validationFeedback: text("validation_feedback"),
    expertSummary: text("expert_summary"), // Orchestrator's aggregated summary

    // Council review
    councilScore: decimal("council_score", { precision: 3, scale: 1 }), // Overall score 0-10
    councilReviewedAt: timestamp("council_reviewed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("goals_user_goal_set_id_idx").on(table.userGoalSetId),
    index("goals_user_id_idx").on(table.userId),
    index("goals_status_idx").on(table.status),
  ]
);

// ============================================
// GOAL PROGRESS ESTIMATE (from Progress Tracker expert)
// ============================================

export const goalProgressEstimates = pgTable("goal_progress_estimates", {
  id: varchar("id", { length: 255 }).primaryKey(),
  goalId: varchar("goal_id", { length: 255 })
    .notNull()
    .references(() => goals.id, { onDelete: "no action", onUpdate: "no action" }),
  unit: varchar("unit", { length: 100 }).notNull(), // e.g., 'experiments', 'hours', 'demos'
  estimatedPerDay: decimal("estimated_per_day", { precision: 10, scale: 2 }).notNull(),
  estimatedPerWeek: decimal("estimated_per_week", { precision: 10, scale: 2 }).notNull(),

  // SetBy: "expert" | "user" | "admin"
  setBy: varchar("set_by", { length: 50 }).default("expert").notNull(),
  modifiedById: varchar("modified_by", { length: 255 })
    .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
  modifiedAt: timestamp("modified_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// GOAL UPDATE (user progress updates with LLM parsing)
// ============================================

export interface GoalUpdateParsedData {
  activities?: Array<Record<string, unknown>>;
  summary?: string;
  [key: string]: unknown;
}

export const goalUpdates = pgTable(
  "goal_updates",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    goalId: varchar("goal_id", { length: 255 })
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
    rawText: text("raw_text").notNull(), // Free-form user input
    parsedData: jsonb("parsed_data").$type<GoalUpdateParsedData>(),

    // Parsed metadata
    sentiment: varchar("sentiment", { length: 50 }), // positive, neutral, negative
    momentumScore: integer("momentum_score"), // 1-10

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("goal_updates_goal_id_idx").on(table.goalId),
    index("goal_updates_user_id_idx").on(table.userId),
  ]
);
