import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
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
  password: z.string().min(8).optional(),
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
        isSpeaker: users.isSpeaker,
        company: users.company,
        bio: users.bio,
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
            isSpeaker: validated.isSpeaker ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
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
        isSpeaker: validated.isSpeaker ?? false,
        company: validated.company ?? null,
        bio: validated.bio ?? null,
        interests: validated.interests ?? null,
        createdAt: now,
        updatedAt: now,
      });

      if (validated.email && validated.password) {
        const { hashPassword } = await import("better-auth/crypto");
        const hashedPassword = await hashPassword(validated.password);

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

    // Add to admin's current event if they have one
    const { user: adminUser } = authResult;
    if (adminUser.currentEventId) {
      await db
        .insert(eventAttendees)
        .values({
          id: createId(),
          eventId: adminUser.currentEventId,
          userId,
        })
        .onConflictDoNothing();

      // Set as user's current event if they don't have one
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, currentEventId: true },
      });
      if (targetUser && !targetUser.currentEventId) {
        await db
          .update(users)
          .set({ currentEventId: adminUser.currentEventId })
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
