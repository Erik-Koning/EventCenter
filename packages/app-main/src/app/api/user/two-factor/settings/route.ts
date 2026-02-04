import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { twoFactors, twoFactorSettings } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const updateSettingsSchema = z.object({
  mode: z.enum(["each_time", "remember_30_days", "new_ip_only"]).optional(),
  trustedIps: z.array(z.string().ip()).optional(),
});

/**
 * GET /api/user/two-factor/settings - Get 2FA status and settings
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    // Get 2FA status
    const twoFactor = await db.query.twoFactors.findFirst({
      where: eq(twoFactors.userId, user.id),
    });

    // Get 2FA settings
    const settings = await db.query.twoFactorSettings.findFirst({
      where: eq(twoFactorSettings.userId, user.id),
    });

    return NextResponse.json({
      enabled: !!twoFactor?.secret,
      hasBackupCodes: !!twoFactor?.backupCodes,
      settings: settings
        ? {
            mode: settings.mode,
            trustedIps: settings.trustedIps ?? [],
          }
        : {
            mode: "each_time",
            trustedIps: [],
          },
    });
  } catch (error) {
    return handleApiError(error, "user/two-factor/settings:GET");
  }
}

/**
 * PUT /api/user/two-factor/settings - Update 2FA settings (mode, trusted IPs)
 */
export async function PUT(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = updateSettingsSchema.parse(body);

    // Check if user has 2FA enabled
    const twoFactor = await db.query.twoFactors.findFirst({
      where: eq(twoFactors.userId, user.id),
    });

    if (!twoFactor?.secret) {
      return NextResponse.json(
        { message: "2FA is not enabled. Enable 2FA first." },
        { status: 400 }
      );
    }

    // Get existing settings
    const existingSettings = await db.query.twoFactorSettings.findFirst({
      where: eq(twoFactorSettings.userId, user.id),
    });

    const updateData = {
      ...(validated.mode && { mode: validated.mode }),
      ...(validated.trustedIps && {
        trustedIps: validated.trustedIps,
      }),
      updatedAt: new Date(),
    };

    if (existingSettings) {
      // Update existing settings
      await db
        .update(twoFactorSettings)
        .set(updateData)
        .where(eq(twoFactorSettings.userId, user.id));
    } else {
      // Create new settings
      await db.insert(twoFactorSettings).values({
        id: createId(),
        userId: user.id,
        mode: validated.mode || "each_time",
        trustedIps: validated.trustedIps ?? null,
      });
    }

    // Get updated settings
    const updatedSettings = await db.query.twoFactorSettings.findFirst({
      where: eq(twoFactorSettings.userId, user.id),
    });

    return NextResponse.json({
      settings: {
        mode: updatedSettings?.mode || "each_time",
        trustedIps: updatedSettings?.trustedIps ?? [],
      },
    });
  } catch (error) {
    return handleApiError(error, "user/two-factor/settings:PUT");
  }
}
