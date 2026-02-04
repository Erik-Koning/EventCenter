import { NextResponse } from "next/server";
import { eq, desc, count, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers, teamInvitations } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createTeamSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().optional(),
});

/**
 * GET /api/admin/teams - List teams the user can manage.
 * System admins see all teams. Team owners/managers see only their teams.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const isSystemAdmin = user.role === "admin";

    let teamsList;

    if (isSystemAdmin) {
      // System admins see all teams
      teamsList = await db.query.teams.findMany({
        with: {
          createdBy: {
            columns: { id: true, name: true, email: true },
          },
        },
        orderBy: [desc(teams.createdAt)],
      });
    } else {
      // Non-admins: get teams where user is owner or admin (manager)
      const managedMemberships = await db.query.teamMembers.findMany({
        where: and(
          eq(teamMembers.userId, user.id),
          inArray(teamMembers.role, ["owner", "admin"])
        ),
      });

      const managedTeamIds = managedMemberships.map((m) => m.teamId);

      if (managedTeamIds.length === 0) {
        return NextResponse.json({ teams: [] });
      }

      teamsList = await db.query.teams.findMany({
        where: inArray(teams.id, managedTeamIds),
        with: {
          createdBy: {
            columns: { id: true, name: true, email: true },
          },
        },
        orderBy: [desc(teams.createdAt)],
      });
    }

    // Get counts for each team
    const teamsWithCounts = await Promise.all(
      teamsList.map(async (team) => {
        const [membersCount] = await db
          .select({ count: count() })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));

        const [invitationsCount] = await db
          .select({ count: count() })
          .from(teamInvitations)
          .where(eq(teamInvitations.teamId, team.id));

        // Include the current user's role in this team
        const membership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, team.id),
            eq(teamMembers.userId, user.id)
          ),
        });

        return {
          ...team,
          userRole: membership?.role || null,
          _count: {
            members: Number(membersCount?.count || 0),
            invitations: Number(invitationsCount?.count || 0),
          },
        };
      })
    );

    return NextResponse.json({ teams: teamsWithCounts });
  } catch (error) {
    return handleApiError(error, "admin/teams:GET");
  }
}

/**
 * POST /api/admin/teams - Create a new team.
 * Any authenticated user can create a team (they become the owner).
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createTeamSchema.parse(body);

    const teamId = createId();

    const [team] = await db
      .insert(teams)
      .values({
        id: teamId,
        name: validated.name,
        description: validated.description,
        createdById: user.id,
      })
      .returning();

    // Auto-add creator as owner
    await db.insert(teamMembers).values({
      id: createId(),
      teamId: team.id,
      userId: user.id,
      role: "owner",
    });

    // Get team with creator info
    const teamWithCreator = await db.query.teams.findFirst({
      where: eq(teams.id, team.id),
      with: {
        createdBy: {
          columns: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(teamWithCreator, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/teams:POST");
  }
}
