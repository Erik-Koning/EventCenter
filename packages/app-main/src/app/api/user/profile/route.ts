import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

const SESSION_TIMEOUT_OPTIONS = [1, 4, 8, 12, 24, 48, 72, 168] as const;

/**
 * GET /api/user/profile - Get current user's profile fields
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        timezone: true,
        sessionTimeoutHours: true,
      },
    });

    return NextResponse.json(dbUser ?? { timezone: "UTC", sessionTimeoutHours: null });
  } catch (error) {
    return handleApiError(error, "user/profile:GET");
  }
}

const updateProfileSchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  sessionTimeoutHours: z
    .union([z.literal(null), z.number().refine((v) => SESSION_TIMEOUT_OPTIONS.includes(v as typeof SESSION_TIMEOUT_OPTIONS[number]))])
    .optional(),
});

/**
 * PATCH /api/user/profile - Update current user's profile fields
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    const [updated] = await db
      .update(users)
      .set(validated)
      .where(eq(users.id, user.id))
      .returning({
        timezone: users.timezone,
        sessionTimeoutHours: users.sessionTimeoutHours,
      });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "user/profile:PATCH");
  }
}
