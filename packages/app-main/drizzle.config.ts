import { defineConfig } from "drizzle-kit";
import { env } from "process";

// Toggle between PgBouncer (port 6432) and direct PostgreSQL (port 5432)
const usePgBouncer = env.USE_PGBOUNCER === "true";
const defaultPort = usePgBouncer ? "6432" : "5432";

// Build PostgreSQL connection string
const connectionString =
  env.DATABASE_URL ||
  `postgresql://${env.DB_USER}:${env.DB_KEY}@${env.DB_SERVER}:${env.DB_PORT || defaultPort}/${env.DB_NAME}`;

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  // Use SSL for Azure PostgreSQL
  ...(env.DB_SSL !== "false" && {
    ssl: { rejectUnauthorized: false },
  }),
});
