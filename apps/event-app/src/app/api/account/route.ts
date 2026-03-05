import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

/**
 * GET /api/account - Get current user's profile (title, interests, company)
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const row = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        title: true,
        interests: true,
        company: true,
      },
    });

    return NextResponse.json(row ?? { title: null, interests: null, company: null });
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
 * PATCH /api/account - Update current user's profile
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = updateSchema.parse(body);

    const [updated] = await db
      .update(users)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning({
        title: users.title,
        interests: users.interests,
        company: users.company,
      });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "account:PATCH");
  }
}
