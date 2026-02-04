import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationSettings } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const updateSettingsSchema = z.object({
  progressReminderEnabled: z.boolean().optional(),
  progressThresholdPercent: z.number().min(0).max(100).optional(),
  dailyReminderEnabled: z.boolean().optional(),
  dailyReminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  weeklySummaryEnabled: z.boolean().optional(),
});

/**
 * GET /api/notifications/settings - Get notification settings
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    let settings = await db.query.notificationSettings.findFirst({
      where: eq(notificationSettings.userId, user.id),
    });

    // Create default settings if none exist
    if (!settings) {
      const [newSettings] = await db
        .insert(notificationSettings)
        .values({
          id: createId(),
          userId: user.id,
        })
        .returning();
      settings = newSettings;
    }

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, "notifications/settings:GET");
  }
}

/**
 * PUT /api/notifications/settings - Update notification settings
 */
export async function PUT(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = updateSettingsSchema.parse(body);

    // Check if settings exist
    const existing = await db.query.notificationSettings.findFirst({
      where: eq(notificationSettings.userId, user.id),
    });

    let settings;
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(notificationSettings)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(notificationSettings.userId, user.id))
        .returning();
      settings = updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(notificationSettings)
        .values({
          id: createId(),
          userId: user.id,
          ...validated,
        })
        .returning();
      settings = created;
    }

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, "notifications/settings:PUT");
  }
}
