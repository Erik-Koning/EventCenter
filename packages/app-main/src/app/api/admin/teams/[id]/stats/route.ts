import { NextResponse } from "next/server";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers, extractedActivities } from "@/db/schema";
import { requireAuth, Role } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

interface MemberStats {
  userId: string;
  userName: string;
  monthlyStats: MonthlyStats[];
  yearlyTotal: {
    experiments: number;
    product_demos: number;
    mentoring: number;
    presentations: number;
    volunteering: number;
    general_task: number;
    research_learning: number;
    networking: number;
    total: number;
  };
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
 * GET /api/admin/teams/[id]/stats - Get team statistics
 */
export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const { id: teamId } = await params;
  const { searchParams } = new URL(request.url);
  const year = parseInt(
    searchParams.get("year") || new Date().getFullYear().toString()
  );

  try {
    // Verify team exists and get members
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: {
        members: {
          with: {
            user: {
              columns: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!team) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    const validUser = authResult.user;

    console.log("[Team Stats] team", team);
    console.log("[Team Stats] user", validUser);

    //verify user in team
    const isMember = team.members.some(
      (member) => member.user.id === authResult.user.id
    );

    if (!isMember) {
      return apiError("User not in team", ErrorCode.UNAUTHORIZED, 403);
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const memberIds = team.members.map((m) => m.user.id);

    if (memberIds.length === 0) {
      // No members, return empty stats
      return NextResponse.json({
        teamId,
        teamName: team.name,
        year,
        members: [],
        teamTotals: createEmptyTotals(),
        monthlyTeamTotals: createEmptyMonthlyStats(),
      });
    }

    // Get all activities for team members in the year
    const activities = await db
      .select({
        userId: extractedActivities.userId,
        activityType: extractedActivities.activityType,
        quantity: extractedActivities.quantity,
        activityDate: extractedActivities.activityDate,
      })
      .from(extractedActivities)
      .where(
        and(
          inArray(extractedActivities.userId, memberIds),
          gte(extractedActivities.activityDate, startDate),
          lte(extractedActivities.activityDate, endDate)
        )
      );

    // Build stats per member
    const memberStatsMap = new Map<string, MemberStats>();

    // Initialize all members with zero stats
    for (const member of team.members) {
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

      memberStatsMap.set(member.user.id, {
        userId: member.user.id,
        userName: member.user.name,
        monthlyStats,
        yearlyTotal: {
          experiments: 0,
          product_demos: 0,
          mentoring: 0,
          presentations: 0,
          volunteering: 0,
          general_task: 0,
          research_learning: 0,
          networking: 0,
          total: 0,
        },
      });
    }

    // Aggregate activities
    for (const activity of activities) {
      const memberStats = memberStatsMap.get(activity.userId);
      if (!memberStats) continue;

      const month = new Date(activity.activityDate).getMonth();
      const monthStats = memberStats.monthlyStats[month];
      const quantity = Number(activity.quantity);

      const activityType = activity.activityType as (typeof ACTIVITY_TYPES)[number];
      if (ACTIVITY_TYPES.includes(activityType)) {
        monthStats[activityType] += quantity;
        monthStats.total += quantity;
        memberStats.yearlyTotal[activityType] += quantity;
        memberStats.yearlyTotal.total += quantity;
      }
    }

    // Calculate team totals
    const teamTotals = {
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

    const monthlyTeamTotals: MonthlyStats[] = [];
    for (let month = 0; month < 12; month++) {
      monthlyTeamTotals.push({
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

    for (const member of memberStatsMap.values()) {
      for (const type of ACTIVITY_TYPES) {
        teamTotals[type] += member.yearlyTotal[type];
      }
      teamTotals.total += member.yearlyTotal.total;

      for (let month = 0; month < 12; month++) {
        for (const type of ACTIVITY_TYPES) {
          monthlyTeamTotals[month][type] += member.monthlyStats[month][type];
        }
        monthlyTeamTotals[month].total += member.monthlyStats[month].total;
      }
    }

    return NextResponse.json({
      teamId,
      teamName: team.name,
      year,
      members: Array.from(memberStatsMap.values()),
      teamTotals,
      monthlyTeamTotals,
    });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]/stats:GET");
  }
}

function createEmptyTotals() {
  return {
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
}

function createEmptyMonthlyStats(): MonthlyStats[] {
  const stats: MonthlyStats[] = [];
  for (let month = 0; month < 12; month++) {
    stats.push({
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
  return stats;
}
