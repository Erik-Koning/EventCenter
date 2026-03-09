/**
 * Migration: Copy isSpeaker and bio from users → event_attendees
 *
 * Run BEFORE `pnpm drizzle:push` so the data is migrated while both
 * the old columns (on users) and new columns (on event_attendees) exist.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-speaker-fields.ts
 *
 * Steps:
 *   1. Add the new columns to event_attendees (idempotent — skips if they exist)
 *   2. Copy isSpeaker/bio from users to matching event_attendees rows
 *   3. Print summary
 *
 * After verifying, run `pnpm drizzle:push` to drop the old columns from users.
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

const useSSL = process.env.DB_SSL !== "false";

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ...(useSSL && { ssl: { rejectUnauthorized: false } }),
  });

  const client = await pool.connect();

  try {
    // Step 1: Ensure the new columns exist on event_attendees (idempotent)
    console.log("Step 1: Ensuring is_speaker and bio columns exist on event_attendees...");

    await client.query(`
      ALTER TABLE event_attendees
        ADD COLUMN IF NOT EXISTS is_speaker BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS bio TEXT
    `);

    console.log("  Columns ready.");

    // Step 2: Check how many rows have data to migrate
    const { rows: preview } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE u.is_speaker = true) AS speakers,
        COUNT(*) FILTER (WHERE u.bio IS NOT NULL AND u.bio != '') AS with_bio,
        COUNT(*) AS total_enrollments
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.id
    `);

    const { speakers, with_bio, total_enrollments } = preview[0];
    console.log(`\nFound ${total_enrollments} enrollment rows.`);
    console.log(`  ${speakers} users with isSpeaker=true`);
    console.log(`  ${with_bio} users with a bio`);

    if (Number(speakers) === 0 && Number(with_bio) === 0) {
      console.log("\nNo data to migrate. Done.");
      return;
    }

    // Step 3: Copy isSpeaker from users to event_attendees
    console.log("\nStep 2: Copying isSpeaker from users → event_attendees...");
    const speakerResult = await client.query(`
      UPDATE event_attendees ea
      SET is_speaker = u.is_speaker
      FROM users u
      WHERE ea.user_id = u.id
        AND u.is_speaker = true
        AND ea.is_speaker = false
    `);
    console.log(`  Updated ${speakerResult.rowCount} rows with isSpeaker=true.`);

    // Step 4: Copy bio from users to event_attendees
    console.log("Step 3: Copying bio from users → event_attendees...");
    const bioResult = await client.query(`
      UPDATE event_attendees ea
      SET bio = u.bio
      FROM users u
      WHERE ea.user_id = u.id
        AND u.bio IS NOT NULL
        AND u.bio != ''
        AND (ea.bio IS NULL OR ea.bio = '')
    `);
    console.log(`  Updated ${bioResult.rowCount} rows with bio.`);

    // Step 5: Verify
    console.log("\nVerification:");
    const { rows: verify } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE ea.is_speaker = true) AS ea_speakers,
        COUNT(*) FILTER (WHERE ea.bio IS NOT NULL AND ea.bio != '') AS ea_with_bio
      FROM event_attendees ea
    `);
    console.log(`  event_attendees: ${verify[0].ea_speakers} speakers, ${verify[0].ea_with_bio} with bio`);

    console.log("\nMigration complete. You can now run `pnpm drizzle:push` to finalize the schema.");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
