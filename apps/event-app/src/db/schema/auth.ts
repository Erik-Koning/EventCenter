/**
 * Auth schema - Better Auth tables + 2FA extensions
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
import { events } from "./events";

// ============================================
// USER MODEL
// ============================================

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 255 }).unique(),
    name: varchar("name", { length: 255 }).notNull(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
    title: varchar("title", { length: 255 }),
    company: varchar("company", { length: 255 }),
    imageUrl: text("image_url"),
    initials: varchar("initials", { length: 10 }),
    interests: text("interests"),
    createdAt: timestamp("createdAt").notNull(),
    updatedAt: timestamp("updatedAt").notNull(),

    // Role: "user" | "admin"
    role: varchar("role", { length: 50 }).default("user").notNull(),
    timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),

    // Account status
    blocked: boolean("blocked").default(false).notNull(),

    // 2FA - required by Better Auth twoFactor plugin
    twoFactorEnabled: boolean("twoFactorEnabled").default(false),

    // 2FA - last time user verified 2FA (used for mode enforcement)
    lastTwoFactorAt: timestamp("last_two_factor_at"),

    // Session timeout preference (hours). Null = use server default (168h / 7 days)
    sessionTimeoutHours: integer("session_timeout_hours"),

    // 2FA lockout - track failed verification attempts
    twoFactorAttempts: integer("two_factor_attempts").default(0).notNull(),
    twoFactorLockedUntil: timestamp("two_factor_locked_until"),

    // Current event
    currentEventId: varchar("current_event_id", { length: 255 }).references(() => events.id, { onDelete: "set null" }),

    // Team relations
    activeTeamId: varchar("active_team_id", { length: 255 }),
  }
);

// ============================================
// BETTER-AUTH MODELS
// ============================================

export const accounts = pgTable("account", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("accountId", { length: 255 }).notNull(),
  providerId: varchar("providerId", { length: 255 }).notNull(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const sessions = pgTable("session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const verifications = pgTable("verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

// ============================================
// 2FA TABLES
// ============================================

export const twoFactors = pgTable("two_factor", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret"),
  backupCodes: text("backup_codes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const twoFactorSettings = pgTable("two_factor_settings", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Mode: "each_time" | "remember_30_days" | "new_ip_only"
  mode: varchar("mode", { length: 50 }).default("each_time").notNull(),
  trustedIps: jsonb("trusted_ips").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// LOGIN HISTORY (permanent IP audit log)
// ============================================

export const loginHistory = pgTable(
  "login_history",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    userAgent: text("user_agent"),
    // "login" | "two_factor_verified" | "session_created"
    event: varchar("event", { length: 50 }).default("login").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("login_history_user_id_idx").on(table.userId),
    index("login_history_created_at_idx").on(table.createdAt),
  ]
);
