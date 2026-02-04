import { NextResponse } from "next/server";
import { eq, and, gte, lte, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, extractedActivities } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

interface MonthlyStats {
  month: number;
  experiments: number;
  product_demos: number;
  mentoring: number;
  presentations: number;
  volunteering: number;
  general_task: number;
  research_learning: number;
  networking: number;
  total: number;
}

const ACTIVITY_TYPES = [
  "experiments",
  "product_demos",
  "mentoring",
  "presentations",
  "volunteering",
  "general_task",
  "research_learning",
  "networking",
] as const;

/**
 * GET /api/stats/personal - Get personal statistics for activities NOT assigned to a team
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

  try {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Get all activities for user where teamId IS NULL (personal/unassigned activities)
    const activities = await db
      .select({
        activityType: extractedActivities.activityType,
        quantity: extractedActivities.quantity,
        activityDate: extractedActivities.activityDate,
        summary: extractedActivities.summary,
      })
      .from(extractedActivities)
      .where(
        and(
          eq(extractedActivities.userId, user.id),
          isNull(extractedActivities.teamId),
          gte(extractedActivities.activityDate, startDateStr),
          lte(extractedActivities.activityDate, endDateStr)
        )
      );

    // Initialize monthly stats
    const monthlyStats: MonthlyStats[] = [];
    for (let month = 0; month < 12; month++) {
      monthlyStats.push({
        month: month + 1,
        experiments: 0,
        product_demos: 0,
        mentoring: 0,
        presentations: 0,
        volunteering: 0,
        general_task: 0,
        research_learning: 0,
        networking: 0,
        total: 0,
      });
    }

    // Initialize yearly totals
    const yearlyTotal = {
      experiments: 0,
      product_demos: 0,
      mentoring: 0,
      presentations: 0,
      volunteering: 0,
      general_task: 0,
      research_learning: 0,
      networking: 0,
      total: 0,
    };

    // Aggregate activities
    for (const activity of activities) {
      const month = new Date(activity.activityDate).getMonth();
      const quantity = Number(activity.quantity);

      const activityType = activity.activityType as (typeof ACTIVITY_TYPES)[number];
      if (ACTIVITY_TYPES.includes(activityType)) {
        monthlyStats[month][activityType] += quantity;
        monthlyStats[month].total += quantity;
        yearlyTotal[activityType] += quantity;
        yearlyTotal.total += quantity;
      }
    }

    // Get recent activities for detail view (last 50)
    const recentActivities = await db
      .select({
        id: extractedActivities.id,
        activityType: extractedActivities.activityType,
        quantity: extractedActivities.quantity,
        summary: extractedActivities.summary,
        activityDate: extractedActivities.activityDate,
      })
      .from(extractedActivities)
      .where(
        and(
          eq(extractedActivities.userId, user.id),
          isNull(extractedActivities.teamId),
          gte(extractedActivities.activityDate, startDateStr),
          lte(extractedActivities.activityDate, endDateStr)
        )
      )
      .orderBy(desc(extractedActivities.activityDate))
      .limit(50);

    // Get user info
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { name: true, activeTeamId: true },
    });

    return NextResponse.json({
      userId: user.id,
      userName: dbUser?.name || "User",
      hasActiveTeam: !!dbUser?.activeTeamId,
      year,
      monthlyStats,
      yearlyTotal,
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        activityType: a.activityType,
        quantity: Number(a.quantity),
        summary: a.summary,
        activityDate: a.activityDate,
      })),
      activityCount: activities.length,
    });
  } catch (error) {
    return handleApiError(error, "stats/personal:GET");
  }
}
