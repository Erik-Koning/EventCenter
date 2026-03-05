/**
 * Events Schema - Events and Event↔Attendee join table
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { attendees } from "./attendees";

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
    attendeeId: varchar("attendee_id", { length: 255 })
      .notNull()
      .references(() => attendees.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("user").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_attendees_event_attendee_idx").on(
      table.eventId,
      table.attendeeId
    ),
    index("event_attendees_event_id_idx").on(table.eventId),
    index("event_attendees_attendee_id_idx").on(table.attendeeId),
  ]
);
