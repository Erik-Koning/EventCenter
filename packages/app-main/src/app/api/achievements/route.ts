import { NextResponse } from "next/server";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  achievements,
  userAchievements,
  extractedActivities,
  goals,
  userGoalSets,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

/**
 * GET /api/achievements - Get all achievements and user's earned ones
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    // Get all active achievements
    const allAchievements = await db.query.achievements.findMany({
      where: eq(achievements.isActive, true),
      orderBy: [achievements.category, achievements.points],
    });

    // Get user's earned achievements
    const earnedAchievements = await db
      .select({
        achievementId: userAchievements.achievementId,
        earnedAt: userAchievements.earnedAt,
      })
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id));

    const earnedIds = new Set(earnedAchievements.map((ua) => ua.achievementId));
    const earnedMap = new Map(
      earnedAchievements.map((ua) => [ua.achievementId, ua.earnedAt])
    );

    // Combine with earned status
    const achievementsWithStatus = allAchievements.map((a) => ({
      ...a,
      earned: earnedIds.has(a.id),
      earnedAt: earnedMap.get(a.id) || null,
    }));

    // Get user stats
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        streakCurrent: true,
        streakLongest: true,
        totalPoints: true,
      },
    });

    return NextResponse.json({
      achievements: achievementsWithStatus,
      stats: {
        currentStreak: dbUser?.streakCurrent || 0,
        longestStreak: dbUser?.streakLongest || 0,
        totalPoints: dbUser?.totalPoints || 0,
        achievementsEarned: earnedAchievements.length,
        achievementsTotal: allAchievements.length,
      },
    });
  } catch (error) {
    return handleApiError(error, "achievements:GET");
  }
}

/**
 * POST /api/achievements/check - Check and award any earned achievements
 */
export async function POST() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const newlyEarned = await checkAndAwardAchievements(user.id);
    return NextResponse.json({ newlyEarned });
  } catch (error) {
    return handleApiError(error, "achievements:POST");
  }
}

async function checkAndAwardAchievements(userId: string) {
  const newlyEarned: Array<{ id: string; name: string; points: number }> = [];

  // Get user stats
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      streakCurrent: true,
      streakLongest: true,
      totalPoints: true,
    },
  });

  if (!dbUser) return newlyEarned;

  // Get activity counts by type
  const activityCounts = await db
    .select({
      activityType: extractedActivities.activityType,
      totalQuantity: sql<number>`sum(${extractedActivities.quantity})`.as(
        "totalQuantity"
      ),
    })
    .from(extractedActivities)
    .where(eq(extractedActivities.userId, userId))
    .groupBy(extractedActivities.activityType);

  const activityMap = new Map(
    activityCounts.map((ac) => [ac.activityType, Number(ac.totalQuantity) || 0])
  );

  // Get goal counts - completed goals through userGoalSet
  const [completedGoalsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(goals)
    .innerJoin(userGoalSets, eq(goals.userGoalSetId, userGoalSets.id))
    .where(
      and(eq(userGoalSets.userId, userId), eq(goals.validationStatus, "valid"))
    );
  const completedGoals = Number(completedGoalsResult?.count || 0);

  // Get goal sets created count
  const [goalSetsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGoalSets)
    .where(eq(userGoalSets.userId, userId));
  const goalSetsCreated = Number(goalSetsResult?.count || 0);

  // Get unearned achievements
  const earnedIds = await db
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const earnedIdList = earnedIds.map((e) => e.achievementId);

  let unearnedAchievements;
  if (earnedIdList.length > 0) {
    unearnedAchievements = await db.query.achievements.findMany({
      where: and(
        eq(achievements.isActive, true),
        notInArray(achievements.id, earnedIdList)
      ),
    });
  } else {
    unearnedAchievements = await db.query.achievements.findMany({
      where: eq(achievements.isActive, true),
    });
  }

  // Check each achievement
  for (const achievement of unearnedAchievements) {
    const criteria = achievement.criteria;
    let earned = false;

    switch (criteria.type) {
      case "streak":
        if (criteria.days) {
          earned =
            dbUser.streakCurrent >= criteria.days ||
            dbUser.streakLongest >= criteria.days;
        }
        break;
      case "goals_completed":
        if (criteria.count) {
          earned = completedGoals >= criteria.count;
        }
        break;
      case "goal_sets_created":
        if (criteria.count) {
          earned = goalSetsCreated >= criteria.count;
        }
        break;
      case "activity":
        if (criteria.count && criteria.activityType) {
          const count = activityMap.get(criteria.activityType) || 0;
          earned = count >= criteria.count;
        }
        break;
    }

    if (earned) {
      await db.insert(userAchievements).values({
        id: createId(),
        userId,
        achievementId: achievement.id,
      });

      // Award points
      await db
        .update(users)
        .set({
          totalPoints: sql`${users.totalPoints} + ${achievement.points}`,
        })
        .where(eq(users.id, userId));

      newlyEarned.push({
        id: achievement.id,
        name: achievement.name,
        points: achievement.points,
      });
    }
  }

  return newlyEarned;
}
