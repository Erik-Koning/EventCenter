import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { users, twoFactors, twoFactorSettings } from "@/db/schema";

/**
 * Server-side auth guard for the platform layout.
 * Validates session, checks blocked status, and enforces 2FA compliance.
 * Must be called from a server component (has DB access).
 */
export async function requireAuthGuard() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    redirect("/login");
  }

  // Get user with blocked, 2FA, and session timeout fields
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      blocked: true,
      lastTwoFactorAt: true,
      sessionTimeoutHours: true,
      twoFactorLockedUntil: true,
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  // Blocked users get their session revoked
  if (dbUser.blocked) {
    try {
      await auth.api.revokeSession({
        headers: headersList,
        body: { token: session.session.token },
      });
    } catch {
      // Best-effort revocation
    }
    redirect("/login?reason=blocked");
  }

  // Check user-configurable session timeout
  if (dbUser.sessionTimeoutHours) {
    const sessionAge =
      Date.now() - new Date(session.session.createdAt).getTime();
    const maxAge = dbUser.sessionTimeoutHours * 60 * 60 * 1000;

    if (sessionAge > maxAge) {
      try {
        await auth.api.revokeSession({
          headers: headersList,
          body: { token: session.session.token },
        });
      } catch {
        // Best-effort revocation
      }
      redirect("/login?reason=session_expired");
    }
  }

  // Check 2FA lockout — deny access if locked
  if (
    dbUser.twoFactorLockedUntil &&
    dbUser.twoFactorLockedUntil > new Date()
  ) {
    redirect("/auth/two-factor");
  }

  // Check 2FA compliance
  const twoFactor = await db.query.twoFactors.findFirst({
    where: eq(twoFactors.userId, dbUser.id),
  });

  // If 2FA is not enabled, no further check needed
  if (!twoFactor?.secret) {
    return;
  }

  // Get user's 2FA settings
  const settings = await db.query.twoFactorSettings.findFirst({
    where: eq(twoFactorSettings.userId, dbUser.id),
  });

  const mode = settings?.mode || "each_time";
  const lastVerified = dbUser.lastTwoFactorAt;

  if (mode === "each_time") {
    // Must have verified 2FA during or after session creation
    if (!lastVerified || lastVerified < session.session.createdAt) {
      redirect("/auth/two-factor");
    }
  } else if (mode === "remember_30_days") {
    // Must have verified within the last 30 days
    if (!lastVerified) {
      redirect("/auth/two-factor");
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (lastVerified < thirtyDaysAgo) {
      redirect("/auth/two-factor");
    }
  } else if (mode === "new_ip_only") {
    // Check if current IP is in the trusted list
    const clientIp =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
      headersList.get("x-real-ip") ||
      "unknown";

    const trustedIps: string[] = settings?.trustedIps ?? [];

    if (!trustedIps.includes(clientIp)) {
      // IP not trusted — must verify 2FA
      if (!lastVerified || lastVerified < session.session.createdAt) {
        redirect("/auth/two-factor");
      }
    }
  }
}
