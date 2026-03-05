"use client";

import { useMemo } from "react";
import { useEventStore } from "@/lib/stores/eventStore";
import { useEventAttendees, useEventSpeakers } from "@/hooks/useEventData";
import { AttendeeCard } from "./AttendeeCard";
import { AttendeesSkeleton } from "@/components/skeletons/AttendeesSkeleton";

interface AttendeeGridProps {
  search: string;
}

export function AttendeeGrid({ search }: AttendeeGridProps) {
  const currentEvent = useEventStore((s) => s.currentEvent);
  const { data: attendees, isLoading } = useEventAttendees(currentEvent?.id);
  const { data: speakers } = useEventSpeakers(currentEvent?.id);

  const speakerNames = useMemo(
    () => new Set(speakers.map((s) => s.name)),
    [speakers]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter((a) => a.name.toLowerCase().includes(q));
  }, [search, attendees]);

  if (isLoading) {
    return <AttendeesSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((attendee) => (
        <AttendeeCard
          key={attendee.id}
          attendee={attendee}
          isSpeaker={speakerNames.has(attendee.name)}
        />
      ))}
      {filtered.length === 0 && (
        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
          No attendees found matching &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  );
}
