import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginHistory } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/user/login-history - Get login history for current user
 *
 * Returns the last 50 login events with IP, user agent, event type, and timestamp.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const history = await db.query.loginHistory.findMany({
      where: eq(loginHistory.userId, user.id),
      orderBy: [desc(loginHistory.createdAt)],
      limit: 50,
      columns: {
        id: true,
        ipAddress: true,
        userAgent: true,
        event: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error, "user/login-history:GET");
  }
}
