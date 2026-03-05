"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SessionDocument {
  id: string;
  sessionId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  blobUrl: string;
  sasUrl: string;
  uploaderName: string | null;
  createdAt: string;
}

function documentsKey(sessionId: string) {
  return ["session-documents", sessionId] as const;
}

export function useSessionDocuments(sessionId: string) {
  const query = useQuery({
    queryKey: documentsKey(sessionId),
    queryFn: async (): Promise<SessionDocument[]> => {
      const res = await fetch(`/api/sessions/${sessionId}/documents`);
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

export function useUploadDocument(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

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
      queryClient.invalidateQueries({ queryKey: documentsKey(sessionId) });
    },
  });
}

export function useDeleteDocument(sessionId: string) {
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
      queryClient.invalidateQueries({ queryKey: documentsKey(sessionId) });
    },
  });
}
