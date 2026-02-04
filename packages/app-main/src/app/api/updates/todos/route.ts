import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { userTodos } from "@/db/schema";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, apiError, ErrorCode } from "@/lib/api-error";
import { createId } from "@/lib/utils";

/**
 * GET /api/updates/todos - Get user's todos
 * Query params: status (optional) - "pending", "completed", or "all"
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

    // Build conditions
    const conditions = [eq(userTodos.userId, user.id)];
    if (status !== "all") {
      conditions.push(eq(userTodos.status, status));
    }

    const todos = await db.query.userTodos.findMany({
      where: and(...conditions),
      orderBy: [
        userTodos.status, // pending first (alphabetically before completed)
        userTodos.sortOrder,
        desc(userTodos.createdAt),
      ],
    });

    return NextResponse.json({
      todos: todos.map((todo) => ({
        id: todo.id,
        content: todo.content,
        status: todo.status,
        completedAt: todo.completedAt?.toISOString() || null,
        createdAt: todo.createdAt.toISOString(),
      })),
      count: todos.length,
    });
  } catch (error) {
    return handleApiError(error, "updates/todos:GET");
  }
}

const createSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000),
});

/**
 * POST /api/updates/todos - Create a new todo
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = createSchema.parse(body);

    // Get the highest sortOrder for this user
    const maxOrderTodo = await db.query.userTodos.findFirst({
      where: eq(userTodos.userId, user.id),
      orderBy: [desc(userTodos.sortOrder)],
      columns: { sortOrder: true },
    });

    const [todo] = await db
      .insert(userTodos)
      .values({
        id: createId(),
        userId: user.id,
        content: validated.content,
        sortOrder: (maxOrderTodo?.sortOrder ?? -1) + 1,
      })
      .returning();

    return NextResponse.json({
      success: true,
      todo: {
        id: todo.id,
        content: todo.content,
        status: todo.status,
        completedAt: null,
        createdAt: todo.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "updates/todos:POST");
  }
}

const patchSchema = z.object({
  todoId: z.string(),
  content: z.string().min(1).max(2000).optional(),
  status: z.enum(["pending", "completed"]).optional(),
});

/**
 * PATCH /api/updates/todos - Update a todo (content or status)
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const body = await request.json();
    const validated = patchSchema.parse(body);

    // Verify todo belongs to user
    const todo = await db.query.userTodos.findFirst({
      where: eq(userTodos.id, validated.todoId),
    });

    if (!todo) {
      return apiError("Todo not found", ErrorCode.NOT_FOUND, 404);
    }

    if (todo.userId !== user.id) {
      return apiError("Unauthorized", ErrorCode.FORBIDDEN, 403);
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validated.content !== undefined) {
      updateData.content = validated.content;
    }

    if (validated.status !== undefined) {
      updateData.status = validated.status;
      updateData.completedAt = validated.status === "completed" ? new Date() : null;
    }

    const [updated] = await db
      .update(userTodos)
      .set(updateData)
      .where(eq(userTodos.id, validated.todoId))
      .returning();

    return NextResponse.json({
      success: true,
      todo: {
        id: updated.id,
        content: updated.content,
        status: updated.status,
        completedAt: updated.completedAt?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "updates/todos:PATCH");
  }
}

/**
 * DELETE /api/updates/todos - Delete a todo
 */
export async function DELETE(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const todoId = searchParams.get("todoId");

    if (!todoId) {
      return apiError("Todo ID required", ErrorCode.BAD_REQUEST, 400);
    }

    // Verify todo belongs to user
    const todo = await db.query.userTodos.findFirst({
      where: eq(userTodos.id, todoId),
    });

    if (!todo) {
      return apiError("Todo not found", ErrorCode.NOT_FOUND, 404);
    }

    if (todo.userId !== user.id) {
      return apiError("Unauthorized", ErrorCode.FORBIDDEN, 403);
    }

    await db
      .delete(userTodos)
      .where(eq(userTodos.id, todoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "updates/todos:DELETE");
  }
}
