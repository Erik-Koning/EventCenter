"use client";

import { useState, useRef } from "react";
import { FileText, Upload, Trash2, Loader2 } from "lucide-react";
import {
  useSessionDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "@/hooks/useSessionDocuments";
import { DocumentViewer } from "./DocumentViewer";
import { authClient } from "@/lib/auth-client";
import type { SessionDocument, DocumentCategory } from "@/hooks/useSessionDocuments";

const ACCEPT =
  ".pptx,.docx,.xlsx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SessionDocumentsProps {
  sessionId: string;
  speakerUserIds: string[];
  category?: DocumentCategory;
  title?: string;
}

export function SessionDocuments({
  sessionId,
  speakerUserIds,
  category = "speaker_document",
  title = "Speaker Documents",
}: SessionDocumentsProps) {
  const { data: documents, isLoading } = useSessionDocuments(sessionId, category);
  const uploadMutation = useUploadDocument(sessionId, category);
  const deleteMutation = useDeleteDocument(sessionId, category);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDoc, setActiveDoc] = useState<SessionDocument | null>(null);

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const isSpeaker = currentUserId
    ? speakerUserIds.includes(currentUserId)
    : false;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const canUpload = category === "transcript_note" ? !!currentUserId : isSpeaker || isAdmin;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  if (isLoading) {
    return (
      <div className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  if (documents.length === 0 && !canUpload) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload
            </button>
          </>
        )}
      </div>

      {uploadMutation.isError && (
        <p className="mb-2 text-xs text-destructive">
          {uploadMutation.error.message}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors cursor-pointer hover:bg-muted/50 ${
                activeDoc?.id === doc.id ? "bg-muted/50 border-primary/30" : ""
              }`}
              onClick={() =>
                setActiveDoc(activeDoc?.id === doc.id ? null : doc)
              }
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{doc.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.uploaderName ?? "Unknown"} &middot;{" "}
                  {formatFileSize(doc.fileSize)}
                </p>
              </div>
              {(doc.uploadedById === currentUserId || isAdmin) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(doc.id);
                  }}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  title="Delete document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {activeDoc && (
        <DocumentViewer
          fileName={activeDoc.fileName}
          sasUrl={activeDoc.sasUrl}
          contentType={activeDoc.contentType}
          onClose={() => setActiveDoc(null)}
        />
      )}
    </div>
  );
}
