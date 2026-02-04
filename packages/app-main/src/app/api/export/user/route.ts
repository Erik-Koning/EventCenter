import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userGoalSets, dailyUpdates, userAchievements } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/export/user - Export user's own data as JSON
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    // Get all user data
    const userData = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        timezone: true,
        streakCurrent: true,
        streakLongest: true,
        totalPoints: true,
        createdAt: true,
      },
    });

    const goalSets = await db.query.userGoalSets.findMany({
      where: eq(userGoalSets.userId, user.id),
      with: {
        goals: {
          with: {
            progressEstimates: true,
            expertReviews: true,
          },
        },
      },
      orderBy: [desc(userGoalSets.createdAt)],
    });

    const dailyUpdatesData = await db.query.dailyUpdates.findMany({
      where: eq(dailyUpdates.userId, user.id),
      with: {
        extractedActivities: true,
      },
      orderBy: [desc(dailyUpdates.createdAt)],
    });

    const achievements = await db.query.userAchievements.findMany({
      where: eq(userAchievements.userId, user.id),
      with: {
        achievement: true,
      },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userData,
      goalSets,
      dailyUpdates: dailyUpdatesData,
      achievements,
      summary: {
        totalGoalSets: goalSets.length,
        totalGoals: goalSets.reduce((acc, gs) => acc + gs.goals.length, 0),
        totalUpdates: dailyUpdatesData.length,
        totalActivities: dailyUpdatesData.reduce(
          (acc, u) => acc + u.extractedActivities.length,
          0
        ),
        achievementsEarned: achievements.length,
      },
    };

    if (format === "csv") {
      // Generate CSV for goals
      const csvRows = [
        [
          "Goal Set ID",
          "Goal Order",
          "Goal Text",
          "Status",
          "Start Date",
          "Created At",
        ],
      ];

      for (const goalSet of goalSets) {
        for (const goal of goalSet.goals) {
          csvRows.push([
            goalSet.id,
            (goal.goalOrder ?? 0).toString(),
            `"${(goal.goalText ?? goal.description ?? "").replace(/"/g, '""')}"`,
            goal.validationStatus,
            goalSet.startDate,
            goalSet.createdAt.toISOString(),
          ]);
        }
      }

      const csv = csvRows.map((row) => row.join(",")).join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="achievely-export-${
            new Date().toISOString().split("T")[0]
          }.csv"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    return handleApiError(error, "export/user:GET");
  }
}
