import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { goalGuides } from "@/db/schema";
import { z } from "zod";
import { requireAuth, Role } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { logAuditEvent } from "@/lib/audit";

const createGuideSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  guideType: z.enum(["role_guide", "goal_guide"]),
  content: z.record(z.unknown()),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  appliesToUserId: z.string().optional(),
});

/**
 * GET /api/admin/guides - Get all guides (admin only)
 */
export async function GET() {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;

  try {
    const guides = await db.query.goalGuides.findMany({
      with: {
        createdBy: {
          columns: { id: true, name: true },
        },
        appliesTo: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [desc(goalGuides.isDefault), desc(goalGuides.createdAt)],
    });

    return NextResponse.json({ guides });
  } catch (error) {
    return handleApiError(error, "admin/guides:GET");
  }
}

/**
 * POST /api/admin/guides - Create a new guide (admin only)
 */
export async function POST(request: Request) {
  const authResult = await requireAuth({ permissions: { role: Role.ADMIN } });
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createGuideSchema.parse(body);

    const [guide] = await db
      .insert(goalGuides)
      .values({
        id: createId(),
        title: validated.title,
        description: validated.description || null,
        guideType: validated.guideType,
        content: validated.content,
        isDefault: validated.isDefault ?? false,
        isActive: validated.isActive ?? true,
        appliesToUserId: validated.appliesToUserId || null,
        createdById: user.id,
      })
      .returning();

    await logAuditEvent({
      userId: user.id,
      action: "guide_create",
      resource: "guide",
      resourceId: guide.id,
      details: { title: validated.title, guideType: validated.guideType },
    });

    return NextResponse.json(guide, { status: 201 });
  } catch (error) {
    return handleApiError(error, "admin/guides:POST");
  }
}
