import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, expertReviews } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/goals/[id]/review - Submit goal to Expert Council for review
 */
export async function POST(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth({ rateLimit: "expensive_llm" });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { id } = await params;

    // Get the goal
    const goal = await db.query.goals.findFirst({
      where: and(
        eq(goals.id, id),
        eq(goals.userId, user.id)
      ),
    });

    if (!goal) {
      return commonErrors.notFound("Goal");
    }

    // Forward to Python backend for Expert Council review
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/v1/goals/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal_id: goal.id,
        title: goal.title,
        description: goal.description,
        target_date: goal.targetDate?.toISOString() || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      return NextResponse.json(
        { message: error.detail || "Failed to get expert review", error: "EXTERNAL_SERVICE_ERROR" },
        { status: response.status }
      );
    }

    const reviewData = await response.json();

    // Store expert reviews in database
    const storedReviews = await Promise.all(
      reviewData.experts.map(async (expert: {
        expert_type: string;
        expert_name: string;
        score: number;
        feedback: string;
        suggestions: string[];
      }) => {
        const [review] = await db
          .insert(expertReviews)
          .values({
            id: createId(),
            goalId: goal.id,
            expertId: expert.expert_type,
            expertName: expert.expert_name,
            reviewContent: expert.feedback,
            score: expert.score,
            feedback: expert.feedback,
            suggestions: JSON.stringify(expert.suggestions),
            actionItems: JSON.stringify(expert.suggestions),
          })
          .returning();
        return review;
      })
    );

    // Update goal with council score and summary
    await db
      .update(goals)
      .set({
        councilScore: String(reviewData.overall_score),
        expertSummary: reviewData.summary,
        councilReviewedAt: new Date(),
        validationStatus: reviewData.overall_score >= 7 ? "valid" : "warning",
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goal.id));

    return NextResponse.json({
      goal_id: goal.id,
      overall_score: reviewData.overall_score,
      summary: reviewData.summary,
      experts: reviewData.experts,
      reviewed_at: reviewData.reviewed_at,
      stored_reviews: storedReviews.length,
    });
  } catch (error) {
    return handleApiError(error, "goals:review:POST");
  }
}
