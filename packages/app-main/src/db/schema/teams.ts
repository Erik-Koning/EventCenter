/**
 * Teams schema - Team, TeamMember, TeamInvitation
 */
import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// TEAM MANAGEMENT
// ============================================

export const teams = pgTable("teams", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdById: varchar("created_by", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("member").notNull(), // member | admin | owner
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    unique("team_members_team_user_unique").on(table.teamId, table.userId),
    index("team_members_team_id_idx").on(table.teamId),
    index("team_members_user_id_idx").on(table.userId),
  ]
);

export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | accepted | expired
    invitedById: varchar("invited_by", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "no action", onUpdate: "no action" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("team_invitations_email_idx").on(table.email),
    index("team_invitations_team_id_idx").on(table.teamId),
  ]
);
