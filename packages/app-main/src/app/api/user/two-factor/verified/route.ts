import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, twoFactorSettings, loginHistory } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

/**
 * POST /api/user/two-factor/verified
 *
 * Called after successful TOTP/backup code verification on the 2FA page.
 * Sets user.lastTwoFactorAt = now.
 * For new_ip_only mode, adds the current IP to trustedIps.
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const now = new Date();

    // Update lastTwoFactorAt and reset failed attempt counter
    await db
      .update(users)
      .set({
        lastTwoFactorAt: now,
        twoFactorAttempts: 0,
        twoFactorLockedUntil: null,
      })
      .where(eq(users.id, user.id));

    // For new_ip_only mode, save current IP to trusted list
    const settings = await db.query.twoFactorSettings.findFirst({
      where: eq(twoFactorSettings.userId, user.id),
    });

    if (settings?.mode === "new_ip_only") {
      const clientIp = getClientIP(request);
      const trustedIps: string[] = settings.trustedIps ?? [];

      if (clientIp !== "unknown" && !trustedIps.includes(clientIp)) {
        trustedIps.push(clientIp);
        await db
          .update(twoFactorSettings)
          .set({
            trustedIps,
            updatedAt: now,
          })
          .where(eq(twoFactorSettings.userId, user.id));
      }
    }

    // Record 2FA verification event in login history
    const clientIpForLog = getClientIP(request);
    await db.insert(loginHistory).values({
      id: createId(),
      userId: user.id,
      ipAddress: clientIpForLog,
      userAgent: request.headers.get("user-agent") || null,
      event: "two_factor_verified",
    });

    return NextResponse.json({ success: true, lastTwoFactorAt: now.toISOString() });
  } catch (error) {
    return handleApiError(error, "user/two-factor/verified:POST");
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
