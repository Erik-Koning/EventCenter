/**
 * Audit log schema - tracks admin and sensitive operations
 */
import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ============================================
// AUDIT LOG (admin actions, sensitive operations)
// ============================================

export const auditLogs = pgTable(
  "audit_log",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_user_id_idx").on(table.userId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_resource_idx").on(table.resource, table.resourceId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
);
