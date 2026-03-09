import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, accounts, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const attendeeRowSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal("")),
  title: z.string().max(255).optional().or(z.literal("")),
  company: z.string().max(255).optional().or(z.literal("")),
  initials: z.string().max(10).optional().or(z.literal("")),
  isSpeaker: z.preprocess(
    (v) => v === true || v === "true" || v === "TRUE" || v === "yes" || v === "YES" || v === "1",
    z.boolean()
  ).optional(),
  bio: z.string().optional().or(z.literal("")),
});

const importSchema = z.object({
  eventId: z.string().min(1),
  attendees: z.array(attendeeRowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = importSchema.parse(body);

    // Hash the default password from env once for all new accounts
    const defaultPassword = process.env.CONVENE_PASSWORD;
    let hashedPassword: string | null = null;
    if (defaultPassword) {
      const { hashPassword } = await import("better-auth/crypto");
      hashedPassword = await hashPassword(defaultPassword);
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < validated.attendees.length; i++) {
      const row = validated.attendees[i];
      const rowNum = i + 1;

      try {
        const email = row.email || null;
        let userId: string | null = null;

        // Check for existing user by email
        if (email) {
          const existing = await db.query.users.findFirst({
            where: eq(users.email, email),
            columns: { id: true, currentEventId: true },
          });

          if (existing) {
            userId = existing.id;

            // Update profile fields (not isSpeaker/bio — those go on enrollment)
            // Only overwrite title/company/initials when the import row has a value
            await db
              .update(users)
              .set({
                name: row.name,
                ...(row.title?.trim() ? { title: row.title.trim() } : {}),
                ...(row.company?.trim() ? { company: row.company.trim() } : {}),
                ...(row.initials?.trim() ? { initials: row.initials.trim() } : {}),
                updatedAt: new Date(),
              })
              .where(eq(users.id, existing.id));

            // Ensure credential account exists
            const existingAccount = await db.query.accounts.findFirst({
              where: and(
                eq(accounts.userId, existing.id),
                eq(accounts.providerId, "credential")
              ),
            });
            if (!existingAccount) {
              const now = new Date();
              await db.insert(accounts).values({
                id: createId(),
                accountId: existing.id,
                providerId: "credential",
                userId: existing.id,
                password: hashedPassword,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }

        // Create new user if not found
        if (!userId) {
          const now = new Date();
          const newUserId = createId();

          await db.insert(users).values({
            id: newUserId,
            email: email,
            name: row.name,
            emailVerified: !!email,
            title: row.title || null,
            initials: row.initials || null,
            company: row.company || null,
            createdAt: now,
            updatedAt: now,
          });

          // Create credential account for email users
          if (email) {
            await db.insert(accounts).values({
              id: createId(),
              accountId: newUserId,
              providerId: "credential",
              userId: newUserId,
              password: hashedPassword,
              createdAt: now,
              updatedAt: now,
            });
          }

          userId = newUserId;
        }

        // Enroll in event with isSpeaker/bio on the enrollment row
        const enrollmentId = createId();
        await db
          .insert(eventAttendees)
          .values({
            id: enrollmentId,
            eventId: validated.eventId,
            userId,
            isSpeaker: row.isSpeaker ?? false,
            bio: row.bio || null,
          })
          .onConflictDoNothing();

        // If already enrolled, update isSpeaker/bio on existing row
        if (row.isSpeaker || row.bio) {
          await db
            .update(eventAttendees)
            .set({
              ...(row.isSpeaker !== undefined ? { isSpeaker: row.isSpeaker } : {}),
              ...(row.bio ? { bio: row.bio } : {}),
            })
            .where(
              and(
                eq(eventAttendees.eventId, validated.eventId),
                eq(eventAttendees.userId, userId)
              )
            );
        }

        // Set as user's current event if they don't have one
        const targetUser = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { id: true, currentEventId: true },
        });
        if (targetUser && !targetUser.currentEventId) {
          await db
            .update(users)
            .set({ currentEventId: validated.eventId })
            .where(eq(users.id, userId));
        }

        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Row ${rowNum} (${row.name}): ${msg}`);
        skipped++;
      }
    }

    return NextResponse.json({ imported, skipped, errors });
  } catch (error) {
    return handleApiError(error, "admin/attendees/import:POST");
  }
}
