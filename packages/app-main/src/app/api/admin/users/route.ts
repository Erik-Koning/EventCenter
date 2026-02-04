import { NextResponse } from "next/server";
import { eq, or, like, desc, sql, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userGoalSets, dailyUpdates, userAchievements } from "@/db/schema";
import { requireAuth, Role } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/admin/users - Get all users (admin only)
 */
export async function GET(request: Request) {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    // Build where condition for search
    const whereCondition = search
      ? or(
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      : undefined;

    // Get users with pagination
    const usersList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        image: users.image,
        streakCurrent: users.streakCurrent,
        streakLongest: users.streakLongest,
        totalPoints: users.totalPoints,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(desc(users.createdAt))
      .offset((page - 1) * limit)
      .limit(limit);

    // Get counts for each user
    const usersWithCounts = await Promise.all(
      usersList.map(async (user) => {
        const [goalSetsCount] = await db
          .select({ count: count() })
          .from(userGoalSets)
          .where(eq(userGoalSets.userId, user.id));

        const [dailyUpdatesCount] = await db
          .select({ count: count() })
          .from(dailyUpdates)
          .where(eq(dailyUpdates.userId, user.id));

        const [achievementsCount] = await db
          .select({ count: count() })
          .from(userAchievements)
          .where(eq(userAchievements.userId, user.id));

        return {
          ...user,
          _count: {
            goalSets: Number(goalSetsCount?.count || 0),
            dailyUpdates: Number(dailyUpdatesCount?.count || 0),
            userAchievements: Number(achievementsCount?.count || 0),
          },
        };
      })
    );

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereCondition);

    const total = Number(totalResult?.count || 0);

    return NextResponse.json({
      users: usersWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "admin/users:GET");
  }
}
