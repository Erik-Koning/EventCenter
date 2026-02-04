import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userGoalSets, goals } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createGoalSetSchema = z.object({
  goals: z
    .array(
      z.object({
        goalText: z.string().min(10, "Goal must be at least 10 characters"),
        goalOrder: z.number().min(1).max(5),
      })
    )
    .min(3, "Must have at least 3 goals")
    .max(5, "Cannot have more than 5 goals"),
  startDate: z.string().transform((s) => new Date(s)),
});

/**
 * GET /api/goal-sets - Get user's goal sets
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build conditions
    const conditions = [eq(userGoalSets.userId, user.id)];
    if (status) {
      conditions.push(eq(userGoalSets.status, status));
    }

    const goalSets = await db.query.userGoalSets.findMany({
      where: and(...conditions),
      with: {
        goals: {
          orderBy: [goals.goalOrder],
          with: {
            progressEstimates: true,
            expertReviews: true,
          },
        },
      },
      orderBy: [desc(userGoalSets.createdAt)],
    });

    return NextResponse.json({ goalSets });
  } catch (error) {
    return handleApiError(error, "goal-sets:GET");
  }
}

/**
 * POST /api/goal-sets - Create a new goal set
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createGoalSetSchema.parse(body);

    // Calculate editable window (14 days from start)
    const editableUntil = new Date(validated.startDate);
    editableUntil.setDate(editableUntil.getDate() + 14);

    const startDateStr = validated.startDate.toISOString().split("T")[0];
    const editableUntilStr = editableUntil.toISOString().split("T")[0];

    // Create goal set and goals in a transaction
    const result = await db.transaction(async (tx) => {
      const goalSetId = createId();

      const [goalSet] = await tx
        .insert(userGoalSets)
        .values({
          id: goalSetId,
          userId: user.id,
          status: "draft",
          startDate: startDateStr,
          editableUntil: editableUntilStr,
        })
        .returning();

      // Create goals
      const createdGoals = await Promise.all(
        validated.goals.map(async (goal) => {
          const [created] = await tx
            .insert(goals)
            .values({
              id: createId(),
              userGoalSetId: goalSetId,
              title: goal.goalText.substring(0, 255),
              description: goal.goalText,
              goalText: goal.goalText,
              goalOrder: goal.goalOrder,
              validationStatus: "pending",
            })
            .returning();
          return created;
        })
      );

      // Sort goals by goalOrder
      createdGoals.sort((a, b) => (a.goalOrder || 0) - (b.goalOrder || 0));

      return { ...goalSet, goals: createdGoals };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, "goal-sets:POST");
  }
}
