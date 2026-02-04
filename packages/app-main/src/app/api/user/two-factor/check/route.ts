import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, twoFactors, twoFactorSettings } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * GET /api/user/two-factor/check - Check if 2FA is required for current session
 *
 * Returns whether 2FA verification is needed based on:
 * - Whether 2FA is enabled for the user
 * - The user's 2FA mode setting
 * - The user's lastTwoFactorAt timestamp vs session/time-based checks
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    // Get 2FA status
    const twoFactor = await db.query.twoFactors.findFirst({
      where: eq(twoFactors.userId, user.id),
    });

    // If 2FA is not enabled, no verification needed
    if (!twoFactor?.secret) {
      return NextResponse.json({
        requiresTwoFactor: false,
        reason: "2FA not enabled",
      });
    }

    // Get current session
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.session) {
      return NextResponse.json({
        requiresTwoFactor: false,
        reason: "No active session",
      });
    }

    // Get user record for lastTwoFactorAt
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { lastTwoFactorAt: true },
    });

    const lastVerified = dbUser?.lastTwoFactorAt;

    // Get user's 2FA settings
    const settings = await db.query.twoFactorSettings.findFirst({
      where: eq(twoFactorSettings.userId, user.id),
    });

    const mode = settings?.mode || "each_time";

    // Mode-specific checks
    if (mode === "each_time") {
      // Must have verified during or after this session's creation
      if (!lastVerified || lastVerified < session.session.createdAt) {
        return NextResponse.json({
          requiresTwoFactor: true,
          reason: "Always required",
          mode,
        });
      }
    }

    if (mode === "remember_30_days") {
      // Must have verified within the last 30 days
      if (!lastVerified) {
        return NextResponse.json({
          requiresTwoFactor: true,
          reason: "Verification needed (remember_30_days)",
          mode,
        });
      }
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (lastVerified < thirtyDaysAgo) {
        return NextResponse.json({
          requiresTwoFactor: true,
          reason: "Trust expired (remember_30_days)",
          mode,
        });
      }
    }

    if (mode === "new_ip_only") {
      const clientIP = getClientIP(request);
      const trustedIps: string[] = settings?.trustedIps ?? [];

      if (!trustedIps.includes(clientIP)) {
        // IP not trusted — check if verified this session
        if (!lastVerified || lastVerified < session.session.createdAt) {
          return NextResponse.json({
            requiresTwoFactor: true,
            reason: "Verification needed (new_ip_only)",
            mode,
          });
        }
      }
    }

    return NextResponse.json({
      requiresTwoFactor: false,
      reason: "Verification not required",
      mode,
    });
  } catch (error) {
    return handleApiError(error, "user/two-factor/check:GET");
  }
}

function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "unknown";
}
