/**
 * Experts schema - ExpertReview, GoalExpertSelection
 */
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { goals } from "./goals";

// ============================================
// EXPERT REVIEW (individual expert's feedback)
// ============================================

export const expertReviews = pgTable("expert_reviews", {
  id: varchar("id", { length: 255 }).primaryKey(),
  goalId: varchar("goal_id", { length: 255 })
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  expertId: varchar("expert_id", { length: 50 }).notNull(), // e.g., 'progress_tracker', 'strategist'
  expertName: varchar("expert_name", { length: 100 }).notNull(),
  reviewContent: text("review_content").notNull(),
  actionItems: text("action_items"), // JSON array of suggested actions

  // Expert scoring
  score: integer("score"), // 1-10 rating from this expert
  feedback: text("feedback"), // Detailed feedback text
  suggestions: text("suggestions"), // JSON array of actionable suggestions

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// GOAL EXPERT SELECTION (which experts user chose)
// ============================================

export const goalExpertSelections = pgTable(
  "goal_expert_selections",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    goalId: varchar("goal_id", { length: 255 })
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    expertId: varchar("expert_id", { length: 50 }).notNull(),
    isRequired: boolean("is_required").default(false).notNull(), // progress_tracker is always required

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("goal_expert_selections_goal_expert_unique").on(table.goalId, table.expertId)]
);
