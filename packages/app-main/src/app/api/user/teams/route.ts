import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

/**
 * GET /api/user/teams - Get teams the current user is a member of
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const memberships = await db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, user.id),
      with: {
        team: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: [asc(teamMembers.joinedAt)],
    });

    return NextResponse.json({
      teams: memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        description: m.team.description,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error, "user/teams:GET");
  }
}

/**
 * POST /api/user/teams - Create a new team (user becomes owner)
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createTeamSchema.parse(body);

    // Create team and add user as owner in a transaction
    const teamId = createId();
    const memberId = createId();

    const [team] = await db
      .insert(teams)
      .values({
        id: teamId,
        name: validated.name,
        description: validated.description || null,
        createdById: user.id,
      })
      .returning({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        createdAt: teams.createdAt,
      });

    // Add user as owner
    await db.insert(teamMembers).values({
      id: memberId,
      teamId: teamId,
      userId: user.id,
      role: "owner",
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "user/teams:POST");
  }
}
