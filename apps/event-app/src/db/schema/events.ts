/**
 * Events Schema - Events and Event↔Attendee join table
 */

import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { DayRecapData } from "@/data/recap-types";
import { users } from "./auth";

//==================================================
// EVENTS TABLE
//==================================================
export const events = pgTable(
  "events",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    venue: varchar("venue", { length: 500 }),
    location: varchar("location", { length: 500 }),
    recaps: jsonb("recaps")
      .$type<Record<string, "loading" | DayRecapData>>()
      .default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("events_start_date_idx").on(table.startDate),
  ]
);

//==================================================
// EVENT ↔ ATTENDEE JOIN TABLE
//==================================================
export const eventAttendees = pgTable(
  "event_attendees",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    eventId: varchar("event_id", { length: 255 })
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isSpeaker: boolean("is_speaker").default(false).notNull(),
    bio: text("bio"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_attendees_event_user_idx").on(
      table.eventId,
      table.userId
    ),
    index("event_attendees_event_id_idx").on(table.eventId),
    index("event_attendees_user_id_idx").on(table.userId),
  ]
);
