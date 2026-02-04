/**
 * Drizzle ORM Client
 *
 * Creates a PostgreSQL connection pool and Drizzle instance.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import { env } from "process";
import * as schema from "./schema";

// Toggle between PgBouncer (port 6432) and direct PostgreSQL (port 5432)
// Set USE_PGBOUNCER=true in .env to enable PgBouncer mode
const usePgBouncer = env.USE_PGBOUNCER === "true";
const defaultPort = usePgBouncer ? "6432" : "5432";

// SSL is required for Azure PostgreSQL (set DB_SSL=false to disable for local dev)
const useSSL = env.DB_SSL !== "false";

// Build PostgreSQL connection string
const connectionString =
  env.DATABASE_URL ||
  `postgresql://${env.DB_USER}:${env.DB_KEY}@${env.DB_SERVER}:${env.DB_PORT || defaultPort}/${env.DB_NAME}`;

// Configure pool based on connection mode
const poolConfig: PoolConfig = {
  connectionString,
  // Azure PostgreSQL requires SSL
  ...(useSSL && {
    ssl: { rejectUnauthorized: false },
  }),
  // PgBouncer in transaction mode requires max 1 connection per pool
  ...(usePgBouncer && {
    max: 1,
  }),
};

// Create the connection pool
const pool = new Pool(poolConfig);

// Create the Drizzle instance with schema for relational queries
export const db = drizzle(pool, { schema });

// Export pool for direct access if needed
export { pool };

// Export type for use in transactions
export type Database = typeof db;
