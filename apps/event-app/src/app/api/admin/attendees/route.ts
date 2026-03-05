import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendees, users, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createAttendeeSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().max(255).optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  userId: z.string().optional(),
  isSpeaker: z.boolean().optional(),
  company: z.string().max(255).optional(),
  bio: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export async function GET() {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const rows = await db
      .select({
        id: attendees.id,
        name: attendees.name,
        title: attendees.title,
        imageUrl: attendees.imageUrl,
        initials: attendees.initials,
        isSpeaker: attendees.isSpeaker,
        company: attendees.company,
        bio: attendees.bio,
        userId: attendees.userId,
        createdAt: attendees.createdAt,
        userEmail: users.email,
        userRole: users.role,
        userBlocked: users.blocked,
        userTwoFactorEnabled: users.twoFactorEnabled,
      })
      .from(attendees)
      .leftJoin(users, eq(attendees.userId, users.id))
      .orderBy(desc(attendees.createdAt));

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

    let linkedUserId = validated.userId ?? null;

    // If email provided, find or create a user
    if (validated.email) {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, validated.email),
        columns: { id: true },
      });

      if (existing) {
        // Link attendee to the existing user
        linkedUserId = existing.id;
      } else {
        // Create a new user + credential account
        const now = new Date();
        const newUserId = createId();

        await db.insert(users).values({
          id: newUserId,
          email: validated.email,
          name: validated.name,
          emailVerified: true,
          role: "user",
          createdAt: now,
          updatedAt: now,
        });

        if (validated.password) {
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

        linkedUserId = newUserId;
      }
    }

    const [attendee] = await db
      .insert(attendees)
      .values({
        id: createId(),
        name: validated.name,
        title: validated.title ?? null,
        imageUrl: validated.imageUrl ?? null,
        initials: validated.initials ?? null,
        isSpeaker: validated.isSpeaker ?? false,
        company: validated.company ?? null,
        bio: validated.bio ?? null,
        userId: linkedUserId,
      })
      .returning();

    return NextResponse.json(attendee, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/attendees:POST");
  }
}
