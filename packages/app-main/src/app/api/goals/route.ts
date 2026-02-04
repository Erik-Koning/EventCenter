import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, expertReviews, goalUpdates } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createGoalSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().min(10, "Description must be at least 10 characters"),
  targetDate: z.string().optional().transform((s) => (s ? new Date(s) : null)),
  status: z.enum(["active", "completed", "paused", "draft"]).optional().default("draft"),
});

/**
 * GET /api/goals - Get user's standalone goals
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const includeReviews = searchParams.get("includeReviews") === "true";

    // Build query with Drizzle
    const userGoals = await db.query.goals.findMany({
      where: and(
        eq(goals.userId, user.id),
        status ? eq(goals.status, status) : undefined
      ),
      with: {
        ...(includeReviews && { expertReviews: true }),
        goalUpdates: {
          orderBy: [desc(goalUpdates.createdAt)],
          limit: 5,
        },
      },
      orderBy: [desc(goals.createdAt)],
    });

    // Add counts
    const goalsWithCounts = await Promise.all(
      userGoals.map(async (goal) => {
        const reviewCount = await db
          .select({ count: expertReviews.id })
          .from(expertReviews)
          .where(eq(expertReviews.goalId, goal.id));
        const updateCount = await db
          .select({ count: goalUpdates.id })
          .from(goalUpdates)
          .where(eq(goalUpdates.goalId, goal.id));

        return {
          ...goal,
          _count: {
            expertReviews: reviewCount.length,
            goalUpdates: updateCount.length,
          },
        };
      })
    );

    return NextResponse.json({ goals: goalsWithCounts });
  } catch (error) {
    return handleApiError(error, "goals:GET");
  }
}

/**
 * POST /api/goals - Create a new standalone goal
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createGoalSchema.parse(body);

    const [goal] = await db
      .insert(goals)
      .values({
        id: createId(),
        userId: user.id,
        title: validated.title,
        description: validated.description,
        targetDate: validated.targetDate,
        status: validated.status,
        validationStatus: "pending",
      })
      .returning();

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    return handleApiError(error, "goals:POST");
  }
}
