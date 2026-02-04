import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMembers, teamInvitations, users } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { isAllowedDomain } from "@/lib/allowed-domains";
import { logAuditEvent } from "@/lib/audit";
import { isTeamManager } from "@/lib/team-authorization";
import { sendTeamInvitationEmail } from "@common/server/emails/sendTeamInvitationEmail";
import { randomBytes } from "crypto";
import { createId } from "@/lib/utils";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/teams/[id]/invite - Invite a new user to team by email.
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
        "Only team managers or system admins can send invitations",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const body = await request.json();
    const validated = inviteSchema.parse(body);
    const email = validated.email.toLowerCase();

    // Check email domain restriction
    if (!isAllowedDomain(email)) {
      return apiError(
        "This email domain is not authorized. Only approved domains can be invited.",
        ErrorCode.VALIDATION_ERROR,
        422
      );
    }

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!team) {
      return apiError("Team not found", ErrorCode.NOT_FOUND, 404);
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // Check if already a member
      const existingMember = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, existingUser.id)
        ),
      });

      if (existingMember) {
        return apiError(
          "This user is already a member of the team",
          ErrorCode.VALIDATION_ERROR,
          409
        );
      }

      // Add them directly instead of inviting
      await logAuditEvent({
        userId: adminUser.id,
        action: "team_member_add",
        resource: "team",
        resourceId: teamId,
        details: { addedUserId: existingUser.id, email },
      });
      await db.insert(teamMembers).values({
        id: createId(),
        teamId,
        userId: existingUser.id,
        role: "member",
      });

      return NextResponse.json({
        message: "User added to team (already registered)",
        addedDirectly: true,
      });
    }

    // Check for existing pending invitation
    const existingInvitation = await db.query.teamInvitations.findFirst({
      where: and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, email),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, new Date())
      ),
    });

    if (existingInvitation) {
      return apiError(
        "An invitation has already been sent to this email",
        ErrorCode.VALIDATION_ERROR,
        409
      );
    }

    // Generate invitation token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    // Create invitation
    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        id: createId(),
        teamId,
        email,
        invitedById: adminUser.id,
        token,
        expiresAt,
      })
      .returning();

    // Send invitation email
    try {
      await sendTeamInvitationEmail(email, team.name, adminUser.name, token);
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Delete the invitation if email fails
      await db
        .delete(teamInvitations)
        .where(eq(teamInvitations.id, invitation.id));
      return apiError(
        "Failed to send invitation email",
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        502
      );
    }

    await logAuditEvent({
      userId: adminUser.id,
      action: "team_invite_send",
      resource: "team",
      resourceId: teamId,
      details: { email, invitationId: invitation.id },
    });

    return NextResponse.json(
      {
        message: "Invitation sent",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]/invite:POST");
  }
}

/**
 * DELETE /api/admin/teams/[id]/invite - Cancel a pending invitation.
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
        "Only team managers or system admins can cancel invitations",
        ErrorCode.FORBIDDEN,
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("invitationId");

    if (!invitationId) {
      return apiError("Invitation ID required", ErrorCode.BAD_REQUEST, 400);
    }

    const invitation = await db.query.teamInvitations.findFirst({
      where: and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.teamId, teamId)
      ),
    });

    if (!invitation) {
      return apiError("Invitation not found", ErrorCode.NOT_FOUND, 404);
    }

    await db
      .delete(teamInvitations)
      .where(eq(teamInvitations.id, invitationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin/teams/[id]/invite:DELETE");
  }
}
