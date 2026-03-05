/**
 * Attendees Schema
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  index
} from "drizzle-orm/pg-core";
import { users } from "./auth";

//==================================================
// ATTENDEES TABLE
//==================================================
export const attendees = pgTable(
  "attendees",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }),
    imageUrl: text("image_url"),
    initials: varchar("initials", { length: 10 }),
    isSpeaker: boolean("is_speaker").default(false).notNull(),
    company: varchar("company", { length: 255 }),
    bio: text("bio"),
    interests: text("interests"),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("attendees_user_id_idx").on(table.userId)]
);