import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  userGoalSets,
  goals,
  goalProgressEstimates,
  dailyUpdates,
  extractedActivities,
  userAchievements,
  notificationSettings,
} from "@/db/schema";
import { z } from "zod";
import { requireAuth, Role } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateUserSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  streakCurrent: z.number().min(0).optional(),
  totalPoints: z.number().min(0).optional(),
  blocked: z.boolean().optional(),
});

/**
 * GET /api/admin/users/[id] - Get user details (admin only)
 */
export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;

  try {
    const { id } = await params;

    // Get user with all related data
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!dbUser) {
      return apiError("User not found", ErrorCode.NOT_FOUND, 404);
    }

    // Get goal sets with goals and progress estimates
    const goalSets = await db.query.userGoalSets.findMany({
      where: eq(userGoalSets.userId, id),
      orderBy: [desc(userGoalSets.createdAt)],
      with: {
        goals: {
          orderBy: [goals.goalOrder],
          with: {
            progressEstimates: true,
          },
        },
      },
    });

    // Get daily updates with extracted activities
    const updates = await db.query.dailyUpdates.findMany({
      where: eq(dailyUpdates.userId, id),
      orderBy: [desc(dailyUpdates.createdAt)],
      limit: 20,
      with: {
        extractedActivities: true,
      },
    });

    // Get user achievements with achievement details
    const achievements = await db.query.userAchievements.findMany({
      where: eq(userAchievements.userId, id),
      with: {
        achievement: true,
      },
    });

    // Get notification settings
    const settings = await db.query.notificationSettings.findFirst({
      where: eq(notificationSettings.userId, id),
    });

    return NextResponse.json({
      ...dbUser,
      goalSets,
      dailyUpdates: updates,
      userAchievements: achievements,
      notificationSettings: settings,
    });
  } catch (error) {
    return handleApiError(error, "admin/users/[id]:GET");
  }
}

/**
 * PUT /api/admin/users/[id] - Update user (admin only)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    const [updatedUser] = await db
      .update(users)
      .set(validated)
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      return apiError("User not found", ErrorCode.NOT_FOUND, 404);
    }

    await logAuditEvent({
      userId: authResult.user.id,
      action: "user_update",
      resource: "user",
      resourceId: id,
      details: validated,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return handleApiError(error, "admin/users/[id]:PUT");
  }
}
