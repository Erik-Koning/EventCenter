import { NextResponse } from "next/server";
import { eq, gte, and, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  updateFollowUps,
  extractedActivities,
  dailyUpdates,
  teamMembers,
  teams,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/dashboard/metrics - Get dashboard metrics for the current user
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    // Calculate date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Format dates for comparison
    const weekDateStr = startOfWeek.toISOString().split("T")[0];
    const monthDateStr = startOfMonth.toISOString().split("T")[0];

    // Fetch all metrics in parallel
    const [
      dbUser,
      pendingFollowUpsResult,
      weeklyActivitiesResult,
      monthlyActivitiesResult,
      monthlyByType,
      recentUpdates,
      userTeam,
    ] = await Promise.all([
      // Get user streak info
      db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: {
          streakCurrent: true,
          streakLongest: true,
          totalPoints: true,
        },
      }),

      // Count pending follow-ups
      db
        .select({ count: sql<number>`count(*)` })
        .from(updateFollowUps)
        .where(
          and(
            eq(updateFollowUps.userId, user.id),
            eq(updateFollowUps.status, "confirmed")
          )
        ),

      // Count activities this week
      db
        .select({ count: sql<number>`count(*)` })
        .from(extractedActivities)
        .where(
          and(
            eq(extractedActivities.userId, user.id),
            gte(extractedActivities.activityDate, weekDateStr)
          )
        ),

      // Count activities this month
      db
        .select({ count: sql<number>`count(*)` })
        .from(extractedActivities)
        .where(
          and(
            eq(extractedActivities.userId, user.id),
            gte(extractedActivities.activityDate, monthDateStr)
          )
        ),

      // Group activities by type this month
      db
        .select({
          activityType: extractedActivities.activityType,
          totalQuantity: sql<number>`sum(${extractedActivities.quantity})`,
          count: sql<number>`count(*)`,
        })
        .from(extractedActivities)
        .where(
          and(
            eq(extractedActivities.userId, user.id),
            gte(extractedActivities.activityDate, monthDateStr)
          )
        )
        .groupBy(extractedActivities.activityType),

      // Get recent daily updates with activity counts
      db.query.dailyUpdates.findMany({
        where: eq(dailyUpdates.userId, user.id),
        orderBy: [desc(dailyUpdates.createdAt)],
        limit: 5,
        with: {
          extractedActivities: true,
        },
      }),

      // Get user's active team
      db.query.teamMembers.findFirst({
        where: eq(teamMembers.userId, user.id),
        with: {
          team: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Get top pending follow-ups with due dates
    const topFollowUps = await db.query.updateFollowUps.findMany({
      where: and(
        eq(updateFollowUps.userId, user.id),
        eq(updateFollowUps.status, "confirmed")
      ),
      orderBy: [asc(updateFollowUps.dueDate), desc(updateFollowUps.createdAt)],
      limit: 5,
      with: {
        extractedActivity: {
          columns: { activityType: true },
        },
      },
    });

    // Get team member count and monthly activities if user has a team
    let teamMonthlyActivities = 0;
    let teamMemberCount = 0;
    if (userTeam?.team) {
      const [teamActivityResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(extractedActivities)
        .where(
          and(
            eq(extractedActivities.teamId, userTeam.team.id),
            gte(extractedActivities.activityDate, monthDateStr)
          )
        );
      teamMonthlyActivities = Number(teamActivityResult?.count || 0);

      const [memberCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, userTeam.team.id));
      teamMemberCount = Number(memberCountResult?.count || 0);
    }

    return NextResponse.json({
      streak: {
        current: dbUser?.streakCurrent || 0,
        longest: dbUser?.streakLongest || 0,
        points: dbUser?.totalPoints || 0,
      },
      pendingFollowUpsCount: Number(pendingFollowUpsResult[0]?.count || 0),
      activitiesThisWeek: Number(weeklyActivitiesResult[0]?.count || 0),
      activitiesThisMonth: Number(monthlyActivitiesResult[0]?.count || 0),
      activitiesByType: monthlyByType.map((item) => ({
        activityType: item.activityType,
        count: Number(item.count),
        totalQuantity: Number(item.totalQuantity) || 0,
      })),
      recentUpdates: recentUpdates.map((update) => ({
        id: update.id,
        periodDate: update.periodDate,
        updatePeriod: update.updatePeriod,
        createdAt: update.createdAt.toISOString(),
        activityCount: update.extractedActivities.length,
      })),
      topFollowUps: topFollowUps.map((fu) => ({
        id: fu.id,
        title: fu.title,
        dueDate: fu.dueDate || null,
        activityType: fu.extractedActivity.activityType,
      })),
      team: userTeam?.team
        ? {
            id: userTeam.team.id,
            name: userTeam.team.name,
            memberCount: teamMemberCount,
            monthlyActivities: teamMonthlyActivities,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error, "dashboard/metrics:GET");
  }
}
