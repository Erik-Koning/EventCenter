import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  networkingGroupMembers,
  networkingMindMapNodes,
} from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { broadcastToGroup } from "@/lib/pubsub";

const createNodeSchema = z.object({
  parentId: z.string().max(255).nullable().optional(),
  label: z.string().min(1).max(200),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

/**
 * GET /api/networking/groups/[groupId]/mindmap - Get all mind map nodes
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { groupId } = await params;

  try {
    const nodes = await db.query.networkingMindMapNodes.findMany({
      where: eq(networkingMindMapNodes.groupId, groupId),
    });

    return NextResponse.json(nodes);
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/mindmap:GET");
  }
}

/**
 * POST /api/networking/groups/[groupId]/mindmap - Create node
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;
  const { groupId } = await params;

  try {
    // Verify membership
    const membership = await db.query.networkingGroupMembers.findFirst({
      where: and(
        eq(networkingGroupMembers.groupId, groupId),
        eq(networkingGroupMembers.userId, user.id)
      ),
    });
    if (!membership) return commonErrors.forbidden();

    const body = await request.json();
    const validated = createNodeSchema.parse(body);

    // If parentId is provided, calculate radial position around parent
    let posX = validated.positionX ?? 0;
    let posY = validated.positionY ?? 0;

    if (validated.parentId) {
      const parent = await db.query.networkingMindMapNodes.findFirst({
        where: eq(networkingMindMapNodes.id, validated.parentId),
      });
      if (parent) {
        // Count existing children to determine angle
        const siblings = await db.query.networkingMindMapNodes.findMany({
          where: and(
            eq(networkingMindMapNodes.groupId, groupId),
            eq(networkingMindMapNodes.parentId, validated.parentId)
          ),
        });
        const angle = (siblings.length * (2 * Math.PI)) / Math.max(siblings.length + 1, 4);
        const radius = 150;
        posX = parent.positionX + radius * Math.cos(angle);
        posY = parent.positionY + radius * Math.sin(angle);
      }
    }

    const nodeId = createId();
    const [node] = await db
      .insert(networkingMindMapNodes)
      .values({
        id: nodeId,
        groupId,
        parentId: validated.parentId ?? null,
        label: validated.label,
        positionX: posX,
        positionY: posY,
        createdByUserId: user.id,
      })
      .returning();

    await broadcastToGroup(groupId, { type: "mindmap:node:add", data: node });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    return handleApiError(error, "networking/groups/[groupId]/mindmap:POST");
  }
}
