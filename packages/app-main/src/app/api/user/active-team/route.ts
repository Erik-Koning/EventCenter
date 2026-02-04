import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, teams, teamMembers } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";

const updateActiveTeamSchema = z.object({
  teamId: z.string().nullable(),
});

/**
 * GET /api/user/active-team - Get user's current active team
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        activeTeamId: true,
      },
      with: {
        activeTeam: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json({
      activeTeamId: dbUser?.activeTeamId || null,
      activeTeam: dbUser?.activeTeam || null,
    });
  } catch (error) {
    return handleApiError(error, "user/active-team:GET");
  }
}

/**
 * PATCH /api/user/active-team - Update user's active team
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = updateActiveTeamSchema.parse(body);

    // If setting a team, verify user is a member
    if (validated.teamId) {
      const membership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, validated.teamId),
          eq(teamMembers.userId, user.id)
        ),
      });

      if (!membership) {
        return apiError(
          "You are not a member of this team",
          ErrorCode.FORBIDDEN,
          403
        );
      }
    }

    const [updated] = await db
      .update(users)
      .set({ activeTeamId: validated.teamId })
      .where(eq(users.id, user.id))
      .returning({
        activeTeamId: users.activeTeamId,
      });

    // Fetch the active team details if set
    let activeTeam = null;
    if (updated.activeTeamId) {
      activeTeam = await db.query.teams.findFirst({
        where: eq(teams.id, updated.activeTeamId),
        columns: {
          id: true,
          name: true,
          description: true,
        },
      });
    }

    return NextResponse.json({
      activeTeamId: updated.activeTeamId,
      activeTeam,
    });
  } catch (error) {
    return handleApiError(error, "user/active-team:PATCH");
  }
}
