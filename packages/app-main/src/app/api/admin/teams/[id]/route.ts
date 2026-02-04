import { NextResponse } from "next/server";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers, teamInvitations } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { logAuditEvent } from "@/lib/audit";
import { isTeamManager, isTeamOwner } from "@/lib/team-authorization";

const updateTeamSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/teams/[id] - Get team details.
 * Allowed for team managers (owner/admin) or system admins.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  const { id } = await params;

  try {
    // Check authorization: team manager or system admin
    const isManager = await isTeamManager(id, user.id);
    const isSystemAdmin = user.role === "admin";

    if (!isManager && !isSystemAdmin) {
      return apiError(
        "You do not have permission to view this team",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, id),
      with: {
        createdBy: {
          columns: { id: true, name: true, email: true },
        },
      },
    });

    if (!team) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    // Get team members with user info
    const members = await db.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, id),
      orderBy: [asc(teamMembers.joinedAt)],
      with: {
        user: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Get pending invitations with inviter info
    const invitations = await db.query.teamInvitations.findMany({
      where: and(
        eq(teamInvitations.teamId, id),
        eq(teamInvitations.status, "pending")
      ),
      orderBy: [desc(teamInvitations.createdAt)],
      with: {
        invitedBy: {
          columns: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      ...team,
      members,
      invitations,
    });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]:GET");
  }
}

/**
 * PATCH /api/admin/teams/[id] - Update team.
 * Allowed for team owner or system admin.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const { id } = await params;

  try {
    // Check authorization: team owner or system admin
    const ownerCheck = await isTeamOwner(id, authResult.user.id);
    const isSystemAdmin = authResult.user.role === "admin";

    if (!ownerCheck && !isSystemAdmin) {
      return apiError(
        "Only team owners or system admins can update team settings",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const body = await request.json();
    const validated = updateTeamSchema.parse(body);

    const [updatedTeam] = await db
      .update(teams)
      .set(validated)
      .where(eq(teams.id, id))
      .returning();

    if (!updatedTeam) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    // Get team with creator info
    const teamWithCreator = await db.query.teams.findFirst({
      where: eq(teams.id, id),
      with: {
        createdBy: {
          columns: { id: true, name: true, email: true },
        },
      },
    });

    await logAuditEvent({
      userId: authResult.user.id,
      action: "team_update",
      resource: "team",
      resourceId: id,
      details: validated,
    });

    return NextResponse.json(teamWithCreator);
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]:PATCH");
  }
}

/**
 * DELETE /api/admin/teams/[id] - Delete team.
 * Allowed for team owner or system admin.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const { id } = await params;

  try {
    // Check authorization: team owner or system admin
    const ownerCheck = await isTeamOwner(id, authResult.user.id);
    const isSystemAdmin = authResult.user.role === "admin";

    if (!ownerCheck && !isSystemAdmin) {
      return apiError(
        "Only team owners or system admins can delete teams",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const [deletedTeam] = await db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning();

    if (!deletedTeam) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    await logAuditEvent({
      userId: authResult.user.id,
      action: "team_delete",
      resource: "team",
      resourceId: id,
      details: { teamName: deletedTeam.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]:DELETE");
  }
}
