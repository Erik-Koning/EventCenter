import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendees } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";

/**
 * GET /api/account - Get current user's attendee profile (title, interests)
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const attendee = await db.query.attendees.findFirst({
      where: eq(attendees.userId, user.id),
      columns: {
        title: true,
        interests: true,
        company: true,
      },
    });

    return NextResponse.json(attendee ?? { title: null, interests: null, company: null });
  } catch (error) {
    return handleApiError(error, "account:GET");
  }
}

const updateSchema = z.object({
  title: z.string().max(255).optional(),
  interests: z.string().max(2000).optional(),
  company: z.string().max(255).optional(),
});

/**
 * PATCH /api/account - Update current user's attendee profile
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = updateSchema.parse(body);

    const attendee = await db.query.attendees.findFirst({
      where: eq(attendees.userId, user.id),
    });

    if (!attendee) return commonErrors.notFound("Attendee profile");

    const [updated] = await db
      .update(attendees)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(attendees.id, attendee.id))
      .returning({
        title: attendees.title,
        interests: attendees.interests,
        company: attendees.company,
      });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "account:PATCH");
  }
}
