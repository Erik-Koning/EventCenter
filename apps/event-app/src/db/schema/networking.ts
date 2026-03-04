/**
 * Networking schema - Groups, members, messages, and mind map nodes
 */
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  real,
  index,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// NETWORKING GROUPS
// ============================================

export const networkingGroups = pgTable(
  "networking_groups",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    creatorId: varchar("creator_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topWords: jsonb("top_words").$type<string[]>().default([]),
    insights: jsonb("insights").$type<string[]>().default([]),
    memberCount: integer("member_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("networking_groups_creator_id_idx").on(table.creatorId),
    index("networking_groups_created_at_idx").on(table.createdAt),
  ]
);

// ============================================
// NETWORKING GROUP MEMBERS
// ============================================

export const networkingGroupMembers = pgTable(
  "networking_group_members",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    groupId: varchar("group_id", { length: 255 })
      .notNull()
      .references(() => networkingGroups.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    unique("networking_group_members_unique").on(table.groupId, table.userId),
    index("networking_group_members_group_id_idx").on(table.groupId),
    index("networking_group_members_user_id_idx").on(table.userId),
  ]
);

// ============================================
// NETWORKING MESSAGES
// ============================================

export const networkingMessages = pgTable(
  "networking_messages",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    groupId: varchar("group_id", { length: 255 })
      .notNull()
      .references(() => networkingGroups.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isAiSummary: boolean("is_ai_summary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("networking_messages_group_id_idx").on(table.groupId),
    index("networking_messages_created_at_idx").on(table.createdAt),
    index("networking_messages_group_created_idx").on(
      table.groupId,
      table.createdAt
    ),
  ]
);

// ============================================
// NETWORKING MIND MAP NODES
// ============================================

export const networkingMindMapNodes = pgTable(
  "networking_mind_map_nodes",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    groupId: varchar("group_id", { length: 255 })
      .notNull()
      .references(() => networkingGroups.id, { onDelete: "cascade" }),
    parentId: varchar("parent_id", { length: 255 }),
    label: varchar("label", { length: 200 }).notNull(),
    positionX: real("position_x").default(0).notNull(),
    positionY: real("position_y").default(0).notNull(),
    createdByUserId: varchar("created_by_user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("networking_mind_map_nodes_group_id_idx").on(table.groupId),
    index("networking_mind_map_nodes_parent_id_idx").on(table.parentId),
  ]
);
