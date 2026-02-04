/**
 * Database - Main export
 *
 * Primary entry point for database access.
 */

// Export the database client
export { db, pool, type Database } from "./client";

// Export all schema tables and relations
export * from "./schema";

// Export all types
export * from "./types";
