import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionDocuments, sessionSpeakers, users } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { createId } from "@/lib/utils";
import { uploadBlob, deleteBlob, generateSasUrl } from "@/lib/azure-blob";

// Supports the following types
const ALLOWED_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/pdf",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/sessions/[sessionId]/documents
 * List all documents for a session. Returns docs with SAS URLs.
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const { sessionId } = await context.params;

    const docs = await db
      .select({
        id: sessionDocuments.id,
        sessionId: sessionDocuments.sessionId,
        uploadedById: sessionDocuments.uploadedById,
        fileName: sessionDocuments.fileName,
        fileSize: sessionDocuments.fileSize,
        contentType: sessionDocuments.contentType,
        blobUrl: sessionDocuments.blobUrl,
        createdAt: sessionDocuments.createdAt,
        uploaderName: users.name,
      })
      .from(sessionDocuments)
      .leftJoin(users, eq(users.id, sessionDocuments.uploadedById))
      .where(eq(sessionDocuments.sessionId, sessionId))
      .orderBy(sessionDocuments.createdAt);

    // Generate SAS URLs for each document
    const docsWithSas = await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        sasUrl: await generateSasUrl(doc.blobUrl),
      }))
    );

    return NextResponse.json(docsWithSas);
  } catch (error) {
    return handleApiError(error, "sessions/documents:GET");
  }
}

/**
 * POST /api/sessions/[sessionId]/documents
 * Upload a document. Only speakers of the session or admins.
 */
export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { sessionId } = await context.params;

    // Check permission: must be a speaker for this session or admin
    if (user.role !== "admin") {
      const isSpeaker = await db.query.sessionSpeakers.findFirst({
        where: and(
          eq(sessionSpeakers.sessionId, sessionId),
          eq(sessionSpeakers.userId, user.id)
        ),
      });
      if (!isSpeaker) {
        return NextResponse.json(
          { message: "Only speakers or admins can upload documents", error: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided", error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "File type not allowed. Accepted: .pptx, .docx, .xlsx, .pdf", error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "File too large. Maximum size is 50MB.", error: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const blobUrl = await uploadBlob(file.name, buffer, file.type);

    const id = createId();
    const [doc] = await db
      .insert(sessionDocuments)
      .values({
        id,
        sessionId,
        uploadedById: user.id,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        blobUrl,
      })
      .returning();

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    return handleApiError(error, "sessions/documents:POST");
  }
}

/**
 * DELETE /api/sessions/[sessionId]/documents
 * Delete a document. Only the uploader or admins.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;
  const { user } = authResult;

  try {
    const { documentId } = z
      .object({ documentId: z.string().min(1) })
      .parse(await request.json());

    const doc = await db.query.sessionDocuments.findFirst({
      where: eq(sessionDocuments.id, documentId),
    });

    if (!doc) {
      return NextResponse.json(
        { message: "Document not found", error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Only uploader or admin can delete
    if (doc.uploadedById !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { message: "Not authorized to delete this document", error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Delete from blob storage, then DB
    await deleteBlob(doc.blobUrl);
    await db
      .delete(sessionDocuments)
      .where(eq(sessionDocuments.id, documentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "sessions/documents:DELETE");
  }
}
