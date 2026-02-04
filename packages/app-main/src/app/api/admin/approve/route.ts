import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userGoalSets, users, goals, expertReviews, goalProgressEstimates } from "@/db/schema";
import { z } from "zod";
import { requireAuth, Role } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { logAuditEvent } from "@/lib/audit";

const approveSchema = z.object({
  goalSetId: z.string(),
  action: z.enum(["approve", "reject", "request_changes"]),
  comment: z.string().optional(),
});

/**
 * POST /api/admin/approve - Approve or reject a goal set (admin only)
 */
export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = approveSchema.parse(body);

    const goalSet = await db.query.userGoalSets.findFirst({
      where: eq(userGoalSets.id, validated.goalSetId),
    });

    if (!goalSet) {
      return apiError("Goal set not found", ErrorCode.NOT_FOUND, 404);
    }

    if (goalSet.status !== "pending_approval") {
      return apiError(
        "Goal set is not pending approval",
        ErrorCode.BAD_REQUEST,
        400,
        { currentStatus: goalSet.status }
      );
    }

    let newStatus: string;
    switch (validated.action) {
      case "approve":
        newStatus = "active";
        break;
      case "reject":
        newStatus = "abandoned";
        break;
      case "request_changes":
        newStatus = "draft";
        break;
    }

    const [updatedGoalSet] = await db
      .update(userGoalSets)
      .set({
        status: newStatus,
        approvedById: validated.action === "approve" ? user.id : null,
        approvedAt: validated.action === "approve" ? new Date() : null,
        adminComment: validated.comment,
      })
      .where(eq(userGoalSets.id, validated.goalSetId))
      .returning();

    await logAuditEvent({
      userId: user.id,
      action: `goal_set_${validated.action}`,
      resource: "goal_set",
      resourceId: validated.goalSetId,
      details: { comment: validated.comment, previousStatus: goalSet.status, newStatus },
    });

    return NextResponse.json(updatedGoalSet);
  } catch (error) {
    return handleApiError(error, "admin/approve:POST");
  }
}

/**
 * GET /api/admin/approve - Get pending approvals (admin only)
 */
export async function GET() {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;

  try {
    const pendingGoalSets = await db.query.userGoalSets.findMany({
      where: eq(userGoalSets.status, "pending_approval"),
      with: {
        user: {
          columns: { id: true, name: true, email: true, image: true },
        },
        goals: {
          orderBy: [asc(goals.goalOrder)],
          with: {
            expertReviews: true,
            progressEstimates: true,
          },
        },
      },
      orderBy: [asc(userGoalSets.createdAt)],
    });

    return NextResponse.json({ pendingGoalSets });
  } catch (error) {
    return handleApiError(error, "admin/approve:GET");
  }
}
