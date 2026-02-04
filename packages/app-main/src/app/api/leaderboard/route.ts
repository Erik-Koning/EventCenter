import { NextResponse } from "next/server";
import { eq, gt, desc, sql, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userAchievements } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/leaderboard - Get leaderboard data
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "points"; // points, streak, achievements
    const limit = parseInt(searchParams.get("limit") || "10");

    let leaderboard: Array<Record<string, unknown>>;

    switch (type) {
      case "streak":
        leaderboard = await db
          .select({
            id: users.id,
            name: users.name,
            image: users.image,
            streakCurrent: users.streakCurrent,
            streakLongest: users.streakLongest,
          })
          .from(users)
          .orderBy(desc(users.streakCurrent))
          .limit(limit);
        break;

      case "achievements":
        // Get achievement counts grouped by user
        const achievementCounts = await db
          .select({
            userId: userAchievements.userId,
            achievementCount: count(userAchievements.achievementId),
          })
          .from(userAchievements)
          .groupBy(userAchievements.userId)
          .orderBy(desc(count(userAchievements.achievementId)))
          .limit(limit);

        const achievementUserIds = achievementCounts.map((ac) => ac.userId);

        if (achievementUserIds.length === 0) {
          leaderboard = [];
          break;
        }

        // Get user details for those with achievements
        const achievementUsers = await db.query.users.findMany({
          where: sql`${users.id} IN ${achievementUserIds}`,
          columns: { id: true, name: true, image: true },
        });

        const achievementUserMap = new Map(
          achievementUsers.map((u) => [u.id, u])
        );

        leaderboard = achievementCounts.map((ac) => ({
          ...achievementUserMap.get(ac.userId),
          achievementCount: Number(ac.achievementCount),
        }));
        break;

      case "points":
      default:
        leaderboard = await db
          .select({
            id: users.id,
            name: users.name,
            image: users.image,
            totalPoints: users.totalPoints,
            streakCurrent: users.streakCurrent,
          })
          .from(users)
          .orderBy(desc(users.totalPoints))
          .limit(limit);
        break;
    }

    // Get current user's rank
    const currentUserRank = await getUserRank(user.id, type);

    return NextResponse.json({
      leaderboard,
      currentUserRank,
      type,
    });
  } catch (error) {
    return handleApiError(error, "leaderboard:GET");
  }
}

async function getUserRank(userId: string, type: string): Promise<number> {
  switch (type) {
    case "streak": {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { streakCurrent: true },
      });
      if (!dbUser) return 0;

      const [result] = await db
        .select({ count: count() })
        .from(users)
        .where(gt(users.streakCurrent, dbUser.streakCurrent));

      return Number(result?.count || 0) + 1;
    }

    case "achievements": {
      const [userCountResult] = await db
        .select({ count: count() })
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId));

      const userCount = Number(userCountResult?.count || 0);

      // Count users with more achievements
      const higherCounts = await db
        .select({
          userId: userAchievements.userId,
          achievementCount: count(userAchievements.achievementId),
        })
        .from(userAchievements)
        .groupBy(userAchievements.userId)
        .having(sql`count(${userAchievements.achievementId}) > ${userCount}`);

      return higherCounts.length + 1;
    }

    case "points":
    default: {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { totalPoints: true },
      });
      if (!dbUser) return 0;

      const [result] = await db
        .select({ count: count() })
        .from(users)
        .where(gt(users.totalPoints, dbUser.totalPoints));

      return Number(result?.count || 0) + 1;
    }
  }
}
