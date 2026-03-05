import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendees, users, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const updateAttendeeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional(),
  imageUrl: z.string().optional(),
  initials: z.string().max(10).optional(),
  userId: z.string().nullable().optional(),
  isSpeaker: z.boolean().optional(),
  company: z.string().max(255).nullable().optional(),
  bio: z.string().nullable().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

type RouteParams = { params: Promise<{ attendeeId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { attendeeId } = await params;
    const body = await request.json();
    const validated = updateAttendeeSchema.parse(body);

    // Strip email/password from attendee update payload
    const { email, password, ...attendeeFields } = validated;

    // If email provided, find or create a user and link to this attendee
    let linkedUserId: string | undefined;
    if (email) {
      const existingAttendee = await db.query.attendees.findFirst({
        where: eq(attendees.id, attendeeId),
        columns: { userId: true, name: true },
      });
      if (!existingAttendee) return commonErrors.notFound("Attendee");

      // Only link if attendee doesn't already have an account
      if (!existingAttendee.userId) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email),
          columns: { id: true },
        });

        if (existingUser) {
          // Link attendee to existing user
          linkedUserId = existingUser.id;
        } else {
          // Create new user + optional credential account
          const now = new Date();
          const newUserId = createId();

          await db.insert(users).values({
            id: newUserId,
            email,
            name: attendeeFields.name ?? existingAttendee.name,
            emailVerified: true,
            role: "user",
            createdAt: now,
            updatedAt: now,
          });

          if (password) {
            const { hashPassword } = await import("better-auth/crypto");
            const hashedPassword = await hashPassword(password);

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
    }

    const [updated] = await db
      .update(attendees)
      .set({
        ...attendeeFields,
        ...(linkedUserId ? { userId: linkedUserId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(attendees.id, attendeeId))
      .returning();

    if (!updated) return commonErrors.notFound("Attendee");
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "admin/attendees/[attendeeId]:PUT");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { attendeeId } = await params;
    const [deleted] = await db
      .delete(attendees)
      .where(eq(attendees.id, attendeeId))
      .returning();

    if (!deleted) return commonErrors.notFound("Attendee");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/attendees/[attendeeId]:DELETE");
  }
}
