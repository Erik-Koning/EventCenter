"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type DocumentCategory = "speaker_document" | "transcript_note";

export interface SessionDocument {
  id: string;
  sessionId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  blobUrl: string;
  sasUrl: string;
  category: DocumentCategory;
  uploaderName: string | null;
  createdAt: string;
}

function documentsKey(sessionId: string, category?: DocumentCategory) {
  return ["session-documents", sessionId, category ?? "all"] as const;
}

export function useSessionDocuments(sessionId: string, category?: DocumentCategory) {
  const query = useQuery({
    queryKey: documentsKey(sessionId, category),
    queryFn: async (): Promise<SessionDocument[]> => {
      const url = category
        ? `/api/sessions/${sessionId}/documents?category=${category}`
        : `/api/sessions/${sessionId}/documents`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!sessionId,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading && !!sessionId,
    error: query.error?.message ?? null,
  };
}

export function useUploadDocument(sessionId: string, category?: DocumentCategory) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (category) {
        formData.append("category", category);
      }

      const res = await fetch(`/api/sessions/${sessionId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Upload failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(sessionId, category) });
    },
  });
}

export function useDeleteDocument(sessionId: string, category?: DocumentCategory) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Delete failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKey(sessionId, category) });
    },
  });
}
