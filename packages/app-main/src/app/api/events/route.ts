import { NextResponse } from "next/server";
import { eq, and, gte, lte, or, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamEvents, teamEventAttendees } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { isTeamMember, isTeamManager } from "@/lib/team-authorization";
import { createId } from "@/lib/utils";

const createEventSchema = z.object({
  teamId: z.string(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  availability: z.enum(["busy", "free", "working_elsewhere", "tentative", "out_of_office"]).default("busy"),
  isPrivate: z.boolean().default(false),
  attendeeIds: z.array(z.string()).default([]),
});

/**
 * GET /api/events?teamId=xxx&start=2026-02-01&end=2026-02-28
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!teamId) {
      return apiError("teamId is required", ErrorCode.BAD_REQUEST, 400);
    }

    const isMember = await isTeamMember(teamId, user.id);
    if (!isMember) {
      return apiError("Not a member of this team", ErrorCode.FORBIDDEN, 403);
    }

    const isManager = await isTeamManager(teamId, user.id);

    const events = await db.query.teamEvents.findMany({
      where: and(
        eq(teamEvents.teamId, teamId),
        ne(teamEvents.status, "cancelled"),
        startParam ? gte(teamEvents.endDate, new Date(startParam)) : undefined,
        endParam ? lte(teamEvents.startDate, new Date(endParam)) : undefined,
        // Non-managers can't see private events from other users
        !isManager
          ? or(
              eq(teamEvents.isPrivate, false),
              eq(teamEvents.createdById, user.id)
            )
          : undefined
      ),
      with: {
        attendees: {
          with: {
            user: {
              columns: { id: true, name: true, email: true },
            },
          },
        },
        createdBy: {
          columns: { id: true, name: true },
        },
      },
      orderBy: (events, { asc }) => [asc(events.startDate)],
    });

    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error, "events:GET");
  }
}

/**
 * POST /api/events - Create event directly (no LLM)
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createEventSchema.parse(body);

    const isMember = await isTeamMember(validated.teamId, user.id);
    if (!isMember) {
      return apiError("Not a member of this team", ErrorCode.FORBIDDEN, 403);
    }

    const result = await db.transaction(async (tx) => {
      const eventId = createId();
      const [event] = await tx
        .insert(teamEvents)
        .values({
          id: eventId,
          teamId: validated.teamId,
          createdById: user.id,
          title: validated.title,
          description: validated.description ?? null,
          location: validated.location ?? null,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
          availability: validated.availability,
          isPrivate: validated.isPrivate,
          status: "active",
        })
        .returning();

      // Add attendees
      const attendeeIds = validated.attendeeIds.length > 0
        ? validated.attendeeIds
        : [user.id];
      for (const attendeeId of attendeeIds) {
        await tx.insert(teamEventAttendees).values({
          id: createId(),
          eventId,
          userId: attendeeId,
          responseStatus: attendeeId === user.id ? "accepted" : "pending",
        });
      }

      return event;
    });

    return NextResponse.json({ event: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "events:POST");
  }
}
