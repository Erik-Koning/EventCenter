import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, loginHistory } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * POST /api/user/two-factor/attempt
 *
 * Called after a FAILED 2FA verification attempt.
 * Increments the failure counter and locks the account after MAX_ATTEMPTS.
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    // Increment attempts
    const [updated] = await db
      .update(users)
      .set({
        twoFactorAttempts: sql`${users.twoFactorAttempts} + 1`,
      })
      .where(eq(users.id, user.id))
      .returning({
        twoFactorAttempts: users.twoFactorAttempts,
      });

    const attempts = updated.twoFactorAttempts;

    // Log the failed attempt
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    await db.insert(loginHistory).values({
      id: createId(),
      userId: user.id,
      ipAddress: clientIp,
      userAgent: request.headers.get("user-agent") || null,
      event: "two_factor_failed",
    });

    // Lock account if max attempts reached
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await db
        .update(users)
        .set({ twoFactorLockedUntil: lockedUntil })
        .where(eq(users.id, user.id));

      return NextResponse.json(
        {
          locked: true,
          lockedUntilISO: lockedUntil.toISOString(),
          message: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      locked: false,
      attemptsRemaining: MAX_ATTEMPTS - attempts,
    });
  } catch (error) {
    return handleApiError(error, "user/two-factor/attempt:POST");
  }
}

/**
 * GET /api/user/two-factor/attempt
 *
 * Check current lockout status.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        twoFactorAttempts: true,
        twoFactorLockedUntil: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ locked: false, attemptsRemaining: MAX_ATTEMPTS });
    }

    // Check if lockout has expired
    if (dbUser.twoFactorLockedUntil && dbUser.twoFactorLockedUntil > new Date()) {
      return NextResponse.json({
        locked: true,
        lockedUntilISO: dbUser.twoFactorLockedUntil.toISOString(),
        attemptsRemaining: 0,
      });
    }

    return NextResponse.json({
      locked: false,
      attemptsRemaining: MAX_ATTEMPTS - dbUser.twoFactorAttempts,
    });
  } catch (error) {
    return handleApiError(error, "user/two-factor/attempt:GET");
  }
}
