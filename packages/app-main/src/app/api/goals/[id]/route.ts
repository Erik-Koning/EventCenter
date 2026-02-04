import { NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, expertReviews, goalUpdates } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

const updateGoalSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255).optional(),
  description: z.string().min(10, "Description must be at least 10 characters").optional(),
  targetDate: z.string().optional().nullable().transform((s) => (s ? new Date(s) : null)),
  status: z.enum(["active", "completed", "paused", "draft"]).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/goals/[id] - Get a single goal with all details
 */
export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    const goal = await db.query.goals.findFirst({
      where: and(
        eq(goals.id, id),
        eq(goals.userId, user.id)
      ),
      with: {
        expertReviews: {
          orderBy: [desc(expertReviews.createdAt)],
        },
        goalUpdates: {
          orderBy: [desc(goalUpdates.createdAt)],
        },
        progressEstimates: true,
      },
    });

    if (!goal) {
      return commonErrors.notFound("Goal");
    }

    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error, "goals:GET:id");
  }
}

/**
 * PATCH /api/goals/[id] - Update a goal
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateGoalSchema.parse(body);

    // Verify ownership
    const existingGoal = await db.query.goals.findFirst({
      where: and(
        eq(goals.id, id),
        eq(goals.userId, user.id)
      ),
    });

    if (!existingGoal) {
      return commonErrors.notFound("Goal");
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validated.title) {
      updateData.title = validated.title;
    }
    if (validated.description) {
      updateData.description = validated.description;
    }
    if (validated.targetDate !== undefined) {
      updateData.targetDate = validated.targetDate;
    }
    if (validated.status) {
      updateData.status = validated.status;
    }

    const [goal] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();

    // Fetch with relations
    const goalWithRelations = await db.query.goals.findFirst({
      where: eq(goals.id, id),
      with: {
        expertReviews: true,
      },
    });

    // Get counts
    const updateCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(goalUpdates)
      .where(eq(goalUpdates.goalId, id));

    return NextResponse.json({
      ...goalWithRelations,
      _count: {
        goalUpdates: Number(updateCount[0]?.count ?? 0),
      },
    });
  } catch (error) {
    return handleApiError(error, "goals:PATCH");
  }
}

/**
 * DELETE /api/goals/[id] - Delete a goal
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    // Verify ownership
    const existingGoal = await db.query.goals.findFirst({
      where: and(
        eq(goals.id, id),
        eq(goals.userId, user.id)
      ),
    });

    if (!existingGoal) {
      return commonErrors.notFound("Goal");
    }

    await db
      .delete(goals)
      .where(eq(goals.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "goals:DELETE");
  }
}
