import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { auth } from "@/lib/auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * POST /api/account/change-password
 * Verify current password and set a new one.
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
      },
      headers: request.headers,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.status === 400 || error?.message?.toLowerCase().includes("password")) {
      return commonErrors.badRequest("Current password is incorrect");
    }
    return handleApiError(error, "account/change-password:POST");
  }
}
