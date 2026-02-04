import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMembers } from "@/db/schema";

/**
 * Check if a user has manager permissions (admin or owner) for a team
 */
export async function isTeamManager(
  teamId: string,
  userId: string
): Promise<boolean> {
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  return !!membership && ["owner", "admin"].includes(membership.role);
}

/**
 * Check if a user is the owner of a team
 */
export async function isTeamOwner(
  teamId: string,
  userId: string
): Promise<boolean> {
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  return membership?.role === "owner";
}

/**
 * Check if a user is a member of a team (any role)
 */
export async function isTeamMember(
  teamId: string,
  userId: string
): Promise<boolean> {
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  return !!membership;
}

/**
 * Get a user's role in a team
 */
export async function getTeamRole(
  teamId: string,
  userId: string
): Promise<string | null> {
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  return membership?.role || null;
}
