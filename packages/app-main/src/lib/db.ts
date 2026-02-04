/**
 * Database client - replaces prisma.ts
 *
 * Re-exports the Drizzle database client for use throughout the application.
 */

export { db, pool, type Database } from "@/db/client";
export * as schema from "@/db/schema";
export * from "@/db/types";
