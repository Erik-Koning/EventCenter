import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers, users } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { sendTeamAddedEmail } from "@common/server/emails/sendTeamAddedEmail";
import { isTeamOwner, isTeamManager } from "@/lib/team-authorization";
import { createId } from "@/lib/utils";
import { logAuditEvent } from "@/lib/audit";

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["member", "admin"]).default("member"),
});

const removeMemberSchema = z.object({
  userId: z.string(),
});

const updateRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(["member", "admin", "owner"]),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/teams/[id]/members - Add existing user to team.
 * Allowed for team managers (owner/admin) or system admins.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user: adminUser } = authResult;

  const { id: teamId } = await params;

  try {
    // Check authorization: team manager or system admin
    const managerCheck = await isTeamManager(teamId, adminUser.id);
    const isSystemAdmin = adminUser.role === "admin";

    if (!managerCheck && !isSystemAdmin) {
      return apiError(
        "Only team managers or system admins can add members",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const body = await request.json();
    const validated = addMemberSchema.parse(body);

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    // Verify user exists
    const userToAdd = await db.query.users.findFirst({
      where: eq(users.id, validated.userId),
      columns: { id: true, email: true, name: true },
    });

    if (!userToAdd) {
      return apiError("User not found", ErrorCode.NOT_FOUND, 404);
    }

    // Check if already a member
    const existingMember = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, validated.userId)
      ),
    });

    if (existingMember) {
      return apiError(
        "User is already a member of this team",
        ErrorCode.VALIDATION_ERROR,
        409
      );
    }

    // Add member
    const [member] = await db
      .insert(teamMembers)
      .values({
        id: createId(),
        teamId,
        userId: validated.userId,
        role: validated.role,
      })
      .returning();

    // Get member with user info
    const memberWithUser = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.id, member.id),
      with: {
        user: {
          columns: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Send notification email
    try {
      await sendTeamAddedEmail(
        userToAdd.email,
        userToAdd.name,
        team.name,
        adminUser.name
      );
    } catch (emailError) {
      console.error("Failed to send team added email:", emailError);
      // Don't fail the request if email fails
    }

    await logAuditEvent({
      userId: adminUser.id,
      action: "team_member_add",
      resource: "team",
      resourceId: teamId,
      details: { addedUserId: validated.userId, role: validated.role },
    });

    return NextResponse.json(memberWithUser, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]/members:POST");
  }
}

/**
 * DELETE /api/admin/teams/[id]/members - Remove member from team.
 * Allowed for team managers (owner/admin) or system admins.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  const { id: teamId } = await params;

  try {
    // Check authorization: team manager or system admin
    const managerCheck = await isTeamManager(teamId, authResult.user.id);
    const isSystemAdmin = authResult.user.role === "admin";

    if (!managerCheck && !isSystemAdmin) {
      return apiError(
        "Only team managers or system admins can remove members",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const body = await request.json();
    const validated = removeMemberSchema.parse(body);

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    // Check if member exists
    const member = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, validated.userId)
      ),
    });

    if (!member) {
      return apiError("Member not found", ErrorCode.NOT_FOUND, 404);
    }

    // Prevent removing the owner
    if (member.role === "owner") {
      return apiError("Cannot remove the team owner", ErrorCode.FORBIDDEN, 403);
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, validated.userId)
        )
      );

    await logAuditEvent({
      userId: authResult.user.id,
      action: "team_member_remove",
      resource: "team",
      resourceId: teamId,
      details: { removedUserId: validated.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]/members:DELETE");
  }
}

/**
 * PATCH /api/admin/teams/[id]/members - Update member role
 * Team admins/owners and system admins can change roles.
 * Ownership transfer requires team owner or system admin specifically.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user: currentUser } = authResult;

  const { id: teamId } = await params;

  try {
    const body = await request.json();
    const validated = updateRoleSchema.parse(body);

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    // Check authorization - must be team admin/owner or system admin
    const isManager = await isTeamManager(teamId, currentUser.id);
    const isOwner = await isTeamOwner(teamId, currentUser.id);
    const isSystemAdmin = currentUser.role === "admin";

    if (!isManager && !isSystemAdmin) {
      return apiError(
        "Only team admins, owners, or system admins can change member roles",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    // Get the member to update
    const memberToUpdate = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, validated.userId)
      ),
    });

    if (!memberToUpdate) {
      return apiError("Member not found", ErrorCode.NOT_FOUND, 404);
    }

    // Handle ownership transfer
    if (validated.role === "owner") {
      // Only current owner can transfer ownership
      if (!isOwner && !isSystemAdmin) {
        return apiError(
          "Only the current owner can transfer ownership",
          ErrorCode.FORBIDDEN,
          403
        );
      }

      // Transfer ownership in a transaction
      await db.transaction(async (tx) => {
        // Demote current owner to admin
        await tx
          .update(teamMembers)
          .set({ role: "admin" })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, "owner")));

        // Promote new owner
        await tx
          .update(teamMembers)
          .set({ role: "owner" })
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, validated.userId)
            )
          );
      });
    } else {
      // Prevent demoting the owner without transferring ownership
      if (memberToUpdate.role === "owner") {
        return apiError(
          "Cannot demote the owner. Transfer ownership first.",
          ErrorCode.VALIDATION_ERROR,
          400
        );
      }

      // Update role
      await db
        .update(teamMembers)
        .set({ role: validated.role })
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, validated.userId)
          )
        );
    }

    await logAuditEvent({
      userId: currentUser.id,
      action: validated.role === "owner" ? "team_ownership_transfer" : "team_role_change",
      resource: "team",
      resourceId: teamId,
      details: {
        targetUserId: validated.userId,
        previousRole: memberToUpdate.role,
        newRole: validated.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]/members:PATCH");
  }
}
