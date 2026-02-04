/**
 * Misc schema - UserTodo, GoalGuide
 */
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// GOAL GUIDES (admin-created guidelines)
// ============================================

export const goalGuides = pgTable("goal_guides", {
  id: varchar("id", { length: 255 }).primaryKey(),
  createdById: varchar("created_by", { length: 255 })
    .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),

  // GuideType: "role_guide" | "goal_guide"
  guideType: varchar("guide_type", { length: 50 }).notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),

  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  appliesToUserId: varchar("applies_to_user_id", { length: 255 }) // NULL = applies to all
    .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// USER TODOS (general notes/tasks)
// ============================================

export const userTodos = pgTable(
  "user_todos",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(), // "pending" | "completed"
    completedAt: timestamp("completed_at"),
    sortOrder: integer("sort_order").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_todos_user_status_idx").on(table.userId, table.status),
    index("user_todos_user_order_idx").on(table.userId, table.sortOrder),
  ]
);
