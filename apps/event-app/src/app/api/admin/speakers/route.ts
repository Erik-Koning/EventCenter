import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";

const createSpeakerSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  bio: z.string().min(1),
  imageUrl: z.string().optional(),
  initials: z.string().min(1).max(10),
});

export async function GET() {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const allSpeakers = await db
      .select()
      .from(users)
      .where(eq(users.isSpeaker, true))
      .orderBy(desc(users.createdAt));

    return NextResponse.json(allSpeakers);
  } catch (error) {
    return handleApiError(error, "admin/speakers:GET");
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: "admin" } });
  if (!authResult.success) return authResult.response;

  try {
    const body = await request.json();
    const validated = createSpeakerSchema.parse(body);

    const now = new Date();
    const [speaker] = await db
      .insert(users)
      .values({
        id: createId(),
        name: validated.name,
        title: validated.title,
        company: validated.company ?? "Scotiabank",
        bio: validated.bio,
        imageUrl: validated.imageUrl ?? "",
        initials: validated.initials,
        isSpeaker: true,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(speaker, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/speakers:POST");
  }
}
