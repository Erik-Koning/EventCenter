/**
 * Speakers schema
 */
import { 
  pgTable, 
  varchar, 
  text, 
  timestamp,
  index 
} from "drizzle-orm/pg-core";
import { users } from "./auth";


//========================================
// SPEAKERS TABLE
//========================================
export const speakers = pgTable(
  "speakers", 
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }).default("Scotiabank"),
    bio: text("bio").notNull(),
    imageUrl: text("image_url").default(""),
    initials: varchar("initials", { length: 10 }).notNull(),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("speakers_user_id_idx").on(table.userId)]
);
