import { NextResponse } from "next/server";
import { eq, gte, lte, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  extractedActivities,
  goals,
  dailyUpdates,
  userGoalSets,
  userAchievements,
} from "@/db/schema";
import { requireAuth, Role } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/export/team - Export team data as JSON or CSV (admin only)
 */
export async function GET(request: Request) {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Get all users with counts
    const allUsers = await db.query.users.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        streakCurrent: true,
        streakLongest: true,
        totalPoints: true,
        createdAt: true,
      },
      orderBy: [desc(users.totalPoints)],
    });

    // Get counts for each user
    const usersWithCounts = await Promise.all(
      allUsers.map(async (user) => {
        const [goalSetsResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(userGoalSets)
          .where(eq(userGoalSets.userId, user.id));

        const [dailyUpdatesResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(dailyUpdates)
          .where(eq(dailyUpdates.userId, user.id));

        const [achievementsResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(userAchievements)
          .where(eq(userAchievements.userId, user.id));

        return {
          ...user,
          _count: {
            goalSets: Number(goalSetsResult?.count || 0),
            dailyUpdates: Number(dailyUpdatesResult?.count || 0),
            userAchievements: Number(achievementsResult?.count || 0),
          },
        };
      })
    );

    // Build date filter conditions for activities
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(gte(extractedActivities.createdAt, new Date(startDate)));
    }
    if (endDate) {
      dateConditions.push(lte(extractedActivities.createdAt, new Date(endDate)));
    }

    // Get activity summary
    const activitySummary = await db
      .select({
        activityType: extractedActivities.activityType,
        totalQuantity: sql<number>`sum(${extractedActivities.quantity})`,
        count: sql<number>`count(*)`,
      })
      .from(extractedActivities)
      .where(dateConditions.length > 0 ? and(...dateConditions) : undefined)
      .groupBy(extractedActivities.activityType);

    // Get goal completion stats
    const goalStats = await db
      .select({
        validationStatus: goals.validationStatus,
        count: sql<number>`count(*)`,
      })
      .from(goals)
      .groupBy(goals.validationStatus);

    // Get daily update stats by period
    const updateDateConditions = [];
    if (startDate) {
      updateDateConditions.push(gte(dailyUpdates.createdAt, new Date(startDate)));
    }
    if (endDate) {
      updateDateConditions.push(lte(dailyUpdates.createdAt, new Date(endDate)));
    }

    const updateStats = await db
      .select({
        updatePeriod: dailyUpdates.updatePeriod,
        count: sql<number>`count(*)`,
      })
      .from(dailyUpdates)
      .where(updateDateConditions.length > 0 ? and(...updateDateConditions) : undefined)
      .groupBy(dailyUpdates.updatePeriod);

    const exportData = {
      exportedAt: new Date().toISOString(),
      dateRange: { startDate, endDate },
      teamSummary: {
        totalUsers: usersWithCounts.length,
        totalPoints: usersWithCounts.reduce((acc, u) => acc + u.totalPoints, 0),
        avgStreak:
          usersWithCounts.reduce((acc, u) => acc + u.streakCurrent, 0) /
          usersWithCounts.length,
        totalGoalSets: usersWithCounts.reduce((acc, u) => acc + u._count.goalSets, 0),
        totalUpdates: usersWithCounts.reduce((acc, u) => acc + u._count.dailyUpdates, 0),
        totalAchievements: usersWithCounts.reduce(
          (acc, u) => acc + u._count.userAchievements,
          0
        ),
      },
      users: usersWithCounts,
      activitySummary: activitySummary.map((a) => ({
        activityType: a.activityType,
        _sum: { quantity: Number(a.totalQuantity) || 0 },
        _count: Number(a.count),
      })),
      goalStats: goalStats.map((g) => ({
        validationStatus: g.validationStatus,
        _count: Number(g.count),
      })),
      updateStats: updateStats.map((u) => ({
        updatePeriod: u.updatePeriod,
        _count: Number(u.count),
      })),
    };

    if (format === "csv") {
      // Generate CSV for users
      const csvRows = [
        [
          "Name",
          "Email",
          "Role",
          "Current Streak",
          "Longest Streak",
          "Total Points",
          "Goal Sets",
          "Daily Updates",
          "Achievements",
        ],
      ];

      for (const user of usersWithCounts) {
        csvRows.push([
          `"${user.name?.replace(/"/g, '""') || ""}"`,
          user.email,
          user.role,
          user.streakCurrent.toString(),
          user.streakLongest.toString(),
          user.totalPoints.toString(),
          user._count.goalSets.toString(),
          user._count.dailyUpdates.toString(),
          user._count.userAchievements.toString(),
        ]);
      }

      const csv = csvRows.map((row) => row.join(",")).join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="achievely-team-export-${
            new Date().toISOString().split("T")[0]
          }.csv"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    return handleApiError(error, "export/team:GET");
  }
}
