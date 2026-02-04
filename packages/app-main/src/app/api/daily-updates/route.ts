import { NextResponse } from "next/server";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userGoalSets, dailyUpdates, extractedActivities } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createUpdateSchema = z.object({
  goalSetId: z.string(),
  updateText: z.string().min(10, "Update must be at least 10 characters"),
  updatePeriod: z.enum(["morning", "afternoon", "evening", "full_day"]),
  periodDate: z.string().transform((s) => new Date(s)),
});

/**
 * GET /api/daily-updates - Get user's daily updates
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const goalSetId = searchParams.get("goalSetId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build conditions
    const conditions = [eq(dailyUpdates.userId, user.id)];
    if (goalSetId) {
      conditions.push(eq(dailyUpdates.userGoalSetId, goalSetId));
    }
    if (startDate && endDate) {
      conditions.push(gte(dailyUpdates.periodDate, startDate));
      conditions.push(lte(dailyUpdates.periodDate, endDate));
    }

    const updates = await db.query.dailyUpdates.findMany({
      where: and(...conditions),
      with: {
        extractedActivities: {
          with: {
            linkedGoal: true,
          },
        },
      },
      orderBy: [desc(dailyUpdates.createdAt)],
    });

    return NextResponse.json({ updates });
  } catch (error) {
    return handleApiError(error, "daily-updates:GET");
  }
}

/**
 * POST /api/daily-updates - Create a new daily update
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createUpdateSchema.parse(body);

    // Verify goal set ownership
    const goalSet = await db.query.userGoalSets.findFirst({
      where: and(
        eq(userGoalSets.id, validated.goalSetId),
        eq(userGoalSets.userId, user.id)
      ),
    });

    if (!goalSet) {
      return apiError("Goal set not found", ErrorCode.NOT_FOUND, 404);
    }

    // Check for existing update in same period
    const periodDateStr = validated.periodDate.toISOString().split("T")[0];
    const existingUpdate = await db.query.dailyUpdates.findFirst({
      where: and(
        eq(dailyUpdates.userId, user.id),
        eq(dailyUpdates.userGoalSetId, validated.goalSetId),
        eq(dailyUpdates.updatePeriod, validated.updatePeriod),
        eq(dailyUpdates.periodDate, periodDateStr)
      ),
    });

    if (existingUpdate) {
      return apiError(
        "Update already exists for this period",
        ErrorCode.VALIDATION_ERROR,
        409,
        { period: validated.updatePeriod, date: validated.periodDate }
      );
    }

    const [update] = await db
      .insert(dailyUpdates)
      .values({
        id: createId(),
        userId: user.id,
        userGoalSetId: validated.goalSetId,
        updateText: validated.updateText,
        updatePeriod: validated.updatePeriod,
        periodDate: periodDateStr,
      })
      .returning();

    // Update user streak
    await updateStreak(user.id);

    return NextResponse.json(update, { status: 201 });
  } catch (error) {
    return handleApiError(error, "daily-updates:POST");
  }
}

async function updateStreak(userId: string) {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      streakCurrent: true,
      streakLongest: true,
      streakLastUpdate: true,
    },
  });

  if (!dbUser) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastUpdate = dbUser.streakLastUpdate
    ? new Date(dbUser.streakLastUpdate)
    : null;

  if (lastUpdate) {
    lastUpdate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor(
      (today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      // Same day, no change
      return;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      const newStreak = dbUser.streakCurrent + 1;
      await db
        .update(users)
        .set({
          streakCurrent: newStreak,
          streakLongest: Math.max(newStreak, dbUser.streakLongest),
          streakLastUpdate: today,
          totalPoints: sql`${users.totalPoints} + 20`,
        })
        .where(eq(users.id, userId));
    } else {
      // Streak broken, reset to 1
      await db
        .update(users)
        .set({
          streakCurrent: 1,
          streakLastUpdate: today,
          totalPoints: sql`${users.totalPoints} + 20`,
        })
        .where(eq(users.id, userId));
    }
  } else {
    // First update ever
    await db
      .update(users)
      .set({
        streakCurrent: 1,
        streakLastUpdate: today,
        totalPoints: sql`${users.totalPoints} + 20`,
      })
      .where(eq(users.id, userId));
  }
}
