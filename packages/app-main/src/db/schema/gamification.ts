/**
 * Gamification schema - Achievement, UserAchievement
 */
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  index,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// ACHIEVEMENT (system-defined badges)
// ============================================

export interface AchievementCriteria {
  type: "streak" | "goals_completed" | "goal_sets_created" | "activity";
  days?: number;
  count?: number;
  activityType?: string;
}

export const achievements = pgTable("achievements", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 100 }).notNull(), // Icon identifier

  // AchievementCategory: "streak" | "goals" | "activities" | "special"
  category: varchar("category", { length: 50 }).notNull(),
  points: integer("points").default(0).notNull(),
  criteria: jsonb("criteria").$type<AchievementCriteria>().notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// USER ACHIEVEMENT (earned badges)
// ============================================

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: varchar("achievement_id", { length: 255 })
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_achievements_user_achievement_unique").on(table.userId, table.achievementId),
    index("user_achievements_user_id_idx").on(table.userId),
  ]
);
