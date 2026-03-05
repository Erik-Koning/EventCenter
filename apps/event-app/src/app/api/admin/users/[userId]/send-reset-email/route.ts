import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ userId: string }> };

/**
 * POST /api/admin/users/[userId]/send-reset-email
 * Triggers the better-auth forgot-password flow for the target user,
 * sending them a secure token email to reset their own password.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const { userId } = await params;

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true },
    });

    if (!dbUser || !dbUser.email) return commonErrors.notFound("User");

    // Use better-auth's internal API to generate token + send reset email
    await auth.api.requestPasswordReset({
      body: {
        email: dbUser.email,
        redirectTo: "/reset-password",
      },
    });

    return NextResponse.json({ success: true, email: dbUser.email });
  } catch (error) {
    return handleApiError(error, "admin/users/[userId]/send-reset-email:POST");
  }
}
