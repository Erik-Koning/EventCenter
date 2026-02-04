import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userGoalSets, goals, dailyUpdates } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { createId } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateGoalSetSchema = z.object({
  goals: z
    .array(
      z.object({
        id: z.string().optional(),
        goalText: z.string().min(10),
        goalOrder: z.number().min(1).max(5),
      })
    )
    .min(3)
    .max(5)
    .optional(),
  status: z
    .enum([
      "draft",
      "pending_review",
      "pending_approval",
      "active",
      "completed",
      "abandoned",
    ])
    .optional(),
});

/**
 * GET /api/goal-sets/[id] - Get a specific goal set
 */
export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    const goalSet = await db.query.userGoalSets.findFirst({
      where: and(
        eq(userGoalSets.id, id),
        eq(userGoalSets.userId, user.id)
      ),
      with: {
        goals: {
          orderBy: [goals.goalOrder],
          with: {
            progressEstimates: true,
            expertReviews: true,
            expertSelections: true,
          },
        },
        dailyUpdates: {
          orderBy: [desc(dailyUpdates.createdAt)],
          limit: 10,
        },
      },
    });

    if (!goalSet) {
      return apiError("Goal set not found", ErrorCode.NOT_FOUND, 404);
    }

    return NextResponse.json(goalSet);
  } catch (error) {
    return handleApiError(error, "goal-sets/[id]:GET");
  }
}

/**
 * PUT /api/goal-sets/[id] - Update a goal set
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    // Check ownership and editable status
    const existingGoalSet = await db.query.userGoalSets.findFirst({
      where: and(
        eq(userGoalSets.id, id),
        eq(userGoalSets.userId, user.id)
      ),
    });

    if (!existingGoalSet) {
      return apiError("Goal set not found", ErrorCode.NOT_FOUND, 404);
    }

    // Check if still in editable window
    if (existingGoalSet.editableUntil) {
      const editableUntilDate = new Date(existingGoalSet.editableUntil);
      if (new Date() > editableUntilDate) {
        return apiError(
          "Goal set is no longer editable",
          ErrorCode.FORBIDDEN,
          403,
          { editableUntil: existingGoalSet.editableUntil }
        );
      }
    }

    const body = await request.json();
    const validated = updateGoalSetSchema.parse(body);

    // Update in a transaction
    await db.transaction(async (tx) => {
      // Update goals if provided
      if (validated.goals) {
        // Delete existing goals
        await tx
          .delete(goals)
          .where(eq(goals.userGoalSetId, id));

        // Create new goals
        for (const goal of validated.goals) {
          await tx
            .insert(goals)
            .values({
              id: createId(),
              userGoalSetId: id,
              title: goal.goalText.substring(0, 255),
              description: goal.goalText,
              goalText: goal.goalText,
              goalOrder: goal.goalOrder,
              validationStatus: "pending",
            });
        }
      }

      // Update status if provided
      if (validated.status) {
        await tx
          .update(userGoalSets)
          .set({
            status: validated.status,
            updatedAt: new Date(),
          })
          .where(eq(userGoalSets.id, id));
      }
    });

    // Fetch updated goal set
    const updatedGoalSet = await db.query.userGoalSets.findFirst({
      where: eq(userGoalSets.id, id),
      with: {
        goals: {
          orderBy: [goals.goalOrder],
        },
      },
    });

    return NextResponse.json(updatedGoalSet);
  } catch (error) {
    return handleApiError(error, "goal-sets/[id]:PUT");
  }
}

/**
 * DELETE /api/goal-sets/[id] - Delete a goal set
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    const goalSet = await db.query.userGoalSets.findFirst({
      where: and(
        eq(userGoalSets.id, id),
        eq(userGoalSets.userId, user.id)
      ),
    });

    if (!goalSet) {
      return apiError("Goal set not found", ErrorCode.NOT_FOUND, 404);
    }

    // Only allow deletion of draft goal sets
    if (goalSet.status !== "draft") {
      return apiError(
        "Can only delete draft goal sets",
        ErrorCode.FORBIDDEN,
        403,
        { currentStatus: goalSet.status }
      );
    }

    await db
      .delete(userGoalSets)
      .where(eq(userGoalSets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "goal-sets/[id]:DELETE");
  }
}
