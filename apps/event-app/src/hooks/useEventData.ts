"use client";

import { useQuery } from "@tanstack/react-query";
import type { Session, Speaker, Attendee } from "@/data/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useEventSessions(eventId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["event-sessions", eventId],
    queryFn: () => fetchJson<Session[]>(`/api/events/${eventId}/sessions`),
    enabled: !!eventId,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading && !!eventId,
    error: query.error?.message ?? null,
  };
}

export function useEventSpeakers(eventId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["event-speakers", eventId],
    queryFn: () => fetchJson<Speaker[]>(`/api/events/${eventId}/speakers`),
    enabled: !!eventId,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading && !!eventId,
    error: query.error?.message ?? null,
  };
}

export function useEventAttendees(eventId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => fetchJson<Attendee[]>(`/api/events/${eventId}/attendees`),
    enabled: !!eventId,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading && !!eventId,
    error: query.error?.message ?? null,
  };
}
