/**
 * Events schema - TeamEvent, TeamEventAttendee
 */
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { teams } from "./teams";

// ============================================
// TEAM EVENTS
// ============================================

export const teamEvents = pgTable(
  "team_events",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdById: varchar("created_by_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 500 }),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    availability: varchar("availability", { length: 50 }).default("busy").notNull(), // busy | free | working_elsewhere | tentative | out_of_office
    isPrivate: boolean("is_private").default(false).notNull(),
    seriesId: varchar("series_id", { length: 255 }),
    isSeries: boolean("is_series").default(false).notNull(),
    repeatEveryDays: integer("repeat_every_days"),
    skipWeekends: boolean("skip_weekends").default(false).notNull(),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active | cancelled
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_events_team_id_idx").on(table.teamId),
    index("team_events_start_date_idx").on(table.startDate),
    index("team_events_series_id_idx").on(table.seriesId),
    index("team_events_created_by_id_idx").on(table.createdById),
  ]
);

// ============================================
// TEAM EVENT ATTENDEES (junction table)
// ============================================

export const teamEventAttendees = pgTable(
  "team_event_attendees",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    eventId: varchar("event_id", { length: 255 })
      .notNull()
      .references(() => teamEvents.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    responseStatus: varchar("response_status", { length: 50 }).default("pending").notNull(), // pending | accepted | declined | tentative
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_event_attendees_event_id_idx").on(table.eventId),
    index("team_event_attendees_user_id_idx").on(table.userId),
  ]
);
