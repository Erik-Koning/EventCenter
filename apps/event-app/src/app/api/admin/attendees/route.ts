import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, accounts, eventAttendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createAttendeeSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().max(255).optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  isSpeaker: z.boolean().optional(),
  company: z.string().max(255).optional(),
  bio: z.string().optional(),
  interests: z.string().optional(),
  email: z.string().email().optional(),
  eventId: z.string().optional(),
});

export async function GET() {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        title: users.title,
        imageUrl: users.imageUrl,
        initials: users.initials,
        company: users.company,
        createdAt: users.createdAt,
        userEmail: users.email,
        userRole: users.role,
        userBlocked: users.blocked,
        userTwoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error, "admin/attendees:GET");
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = createAttendeeSchema.parse(body);

    // If email provided, check if user already exists
    let userId: string | null = null;
    if (validated.email) {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, validated.email),
        columns: { id: true, currentEventId: true },
      });
      if (existing) {
        userId = existing.id;

        // Update profile fields if provided
        await db
          .update(users)
          .set({
            title: validated.title ?? undefined,
            company: validated.company ?? undefined,
            initials: validated.initials ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));

        // Ensure credential account exists so password reset works
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
            password: null,
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
        email: validated.email ?? null,
        name: validated.name,
        emailVerified: !!validated.email,
        title: validated.title ?? null,
        imageUrl: validated.imageUrl ?? null,
        initials: validated.initials ?? null,
        company: validated.company ?? null,
        interests: validated.interests ?? null,
        createdAt: now,
        updatedAt: now,
      });

      // Always create a credential account so password reset works
      if (validated.email) {
        const rawPassword = process.env.CONVENE_PASSWORD || null;
        const hashedPassword = rawPassword
          ? await (await import("better-auth/crypto")).hashPassword(rawPassword)
          : null;

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

    // Add to the selected event (from body) or fallback to admin's current event
    const targetEventId = validated.eventId || authResult.user.currentEventId;
    if (targetEventId) {
      const enrollmentId = createId();
      await db
        .insert(eventAttendees)
        .values({
          id: enrollmentId,
          eventId: targetEventId,
          userId,
          isSpeaker: validated.isSpeaker ?? false,
          bio: validated.bio ?? null,
        })
        .onConflictDoNothing();

      // If user already enrolled, update isSpeaker/bio on existing row
      if (validated.isSpeaker !== undefined || validated.bio !== undefined) {
        await db
          .update(eventAttendees)
          .set({
            ...(validated.isSpeaker !== undefined ? { isSpeaker: validated.isSpeaker } : {}),
            ...(validated.bio !== undefined ? { bio: validated.bio } : {}),
          })
          .where(
            and(
              eq(eventAttendees.eventId, targetEventId),
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
          .set({ currentEventId: targetEventId })
          .where(eq(users.id, userId));
      }
    }

    // Return the user
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/attendees:POST");
  }
}
