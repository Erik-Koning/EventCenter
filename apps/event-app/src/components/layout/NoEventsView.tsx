"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarPlus, CalendarX2, Loader2 } from "lucide-react";
import { useEventStore, type EventData } from "@/lib/stores/eventStore";
import { format } from "date-fns";

function formatEventDates(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (startDate === endDate) {
    return format(start, "MMM d, yyyy");
  }
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function NoEventsView() {
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const fetchUserEvents = useEventStore((s) => s.fetchUserEvents);

  useEffect(() => {
    fetch("/api/events/available")
      .then((r) => (r.ok ? r.json() : []))
      .then((events: EventData[]) => setAvailableEvents(events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const joinEvent = useCallback(
    async (eventId: string) => {
      setJoiningEventId(eventId);
      try {
        const res = await fetch("/api/events/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        if (res.ok) {
          // Force full page reload to refresh all event-dependent data
          window.location.reload();
          return;
        }
      } finally {
        setJoiningEventId(null);
      }
    },
    []
  );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <CalendarX2 className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          You're not part of any events yet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Join an event below to get started.
        </p>

        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : availableEvents.length > 0 ? (
            <div className="space-y-2">
              {availableEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatEventDates(event.startDate, event.endDate)}
                      {event.venue && ` · ${event.venue}`}
                    </p>
                  </div>
                  <button
                    onClick={() => joinEvent(event.id)}
                    disabled={joiningEventId === event.id}
                    className="ml-3 flex flex-shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {joiningEventId === event.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    Join
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No events are currently available. Contact your administrator.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
