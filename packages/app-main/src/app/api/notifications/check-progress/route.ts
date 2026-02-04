import { NextResponse } from "next/server";
import { eq, and, gte, sql, isNull, not } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  userGoalSets,
  goals,
  goalProgressEstimates,
  extractedActivities,
  dailyUpdates,
  notificationSettings,
} from "@/db/schema";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";

/**
 * POST /api/notifications/check-progress - Cron job to check progress and send notifications
 * This should be called by a cron job (e.g., Azure Functions, Vercel Cron)
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return apiError("Invalid cron authorization", ErrorCode.UNAUTHORIZED, 401);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get users with daily reminders enabled
    const usersWithSettings = await db
      .select({
        userId: users.id,
        email: users.email,
        streakCurrent: users.streakCurrent,
      })
      .from(users)
      .innerJoin(notificationSettings, eq(notificationSettings.userId, users.id))
      .where(eq(notificationSettings.dailyReminderEnabled, true));

    // Check which users have not updated today
    const usersToNotify: Array<{
      userId: string;
      email: string;
      type: string;
      message: string;
    }> = [];

    for (const userRow of usersWithSettings) {
      // Check if user has daily update today
      const [todayUpdate] = await db
        .select({ id: dailyUpdates.id })
        .from(dailyUpdates)
        .where(
          and(
            eq(dailyUpdates.userId, userRow.userId),
            gte(dailyUpdates.periodDate, today.toISOString().split("T")[0])
          )
        )
        .limit(1);

      if (!todayUpdate) {
        // Check if user has active goal sets
        const [activeGoalSet] = await db
          .select({ id: userGoalSets.id })
          .from(userGoalSets)
          .where(
            and(
              eq(userGoalSets.userId, userRow.userId),
              eq(userGoalSets.status, "active")
            )
          )
          .limit(1);

        if (activeGoalSet) {
          usersToNotify.push({
            userId: userRow.userId,
            email: userRow.email,
            type: "daily_reminder",
            message: `Don't forget to log your progress today! Your ${userRow.streakCurrent}-day streak is at stake.`,
          });
        }
      }
    }

    // Check for users below progress threshold
    const activeGoalSets = await db.query.userGoalSets.findMany({
      where: eq(userGoalSets.status, "active"),
      with: {
        user: {
          with: {
            notificationSettings: true,
          },
        },
        goals: {
          with: {
            progressEstimates: true,
            linkedActivities: true,
          },
        },
      },
    });

    for (const goalSet of activeGoalSets) {
      if (!goalSet.user.notificationSettings?.progressReminderEnabled) continue;

      const threshold = goalSet.user.notificationSettings.progressThresholdPercent;

      for (const goal of goalSet.goals) {
        const estimate = goal.progressEstimates[0];
        if (!estimate) continue;

        // Calculate expected vs actual progress
        const startDate = new Date(goalSet.startDate);
        const daysSinceStart = Math.floor(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const expectedProgress = daysSinceStart * Number(estimate.estimatedPerDay);

        const actualProgress = goal.linkedActivities.reduce(
          (acc, a) => acc + Number(a.quantity),
          0
        );

        const progressPercent =
          expectedProgress > 0 ? (actualProgress / expectedProgress) * 100 : 100;

        if (progressPercent < threshold) {
          usersToNotify.push({
            userId: goalSet.user.id,
            email: goalSet.user.email,
            type: "progress_warning",
            message: `You're at ${Math.round(progressPercent)}% of expected progress for "${(goal.goalText ?? goal.title ?? "your goal").slice(0, 50)}..."`,
          });
        }
      }
    }

    // In a real implementation, this would send emails via Azure Communication Services
    // For now, just return the notifications that would be sent
    console.log(`Would send ${usersToNotify.length} notifications`);

    return NextResponse.json({
      success: true,
      notificationsQueued: usersToNotify.length,
      notifications: process.env.NODE_ENV === "development" ? usersToNotify : undefined,
    });
  } catch (error) {
    return handleApiError(error, "notifications/check-progress:POST");
  }
}
