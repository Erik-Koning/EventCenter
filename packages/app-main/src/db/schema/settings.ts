/**
 * Settings schema - NotificationSettings, AdminSettings
 */
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// NOTIFICATION SETTINGS (per-user preferences)
// ============================================

export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  progressReminderEnabled: boolean("progress_reminder_enabled").default(true).notNull(),
  progressThresholdPercent: integer("progress_threshold_percent").default(50).notNull(),
  dailyReminderEnabled: boolean("daily_reminder_enabled").default(true).notNull(),
  dailyReminderTime: varchar("daily_reminder_time", { length: 5 }).default("09:00").notNull(),
  weeklySummaryEnabled: boolean("weekly_summary_enabled").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// ADMIN SETTINGS (key-value store)
// ============================================

export const adminSettings = pgTable(
  "admin_settings",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    adminId: varchar("admin_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    settingKey: varchar("setting_key", { length: 100 }).notNull(),
    settingValue: jsonb("setting_value").$type<unknown>().notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("admin_settings_admin_key_unique").on(table.adminId, table.settingKey)]
);
