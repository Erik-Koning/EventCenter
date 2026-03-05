"use client";

import { useMemo, useState, useCallback } from "react";
import { useEventStore } from "@/lib/stores/eventStore";
import { useEventAttendees, useEventSpeakers, useEventSessions } from "@/hooks/useEventData";
import { AttendeeCard } from "./AttendeeCard";
import { SpeakerPopup } from "./SpeakerPopup";
import { AttendeesSkeleton } from "@/components/skeletons/AttendeesSkeleton";
import type { Speaker } from "@/data/types";

interface AttendeeGridProps {
  search: string;
}

export function AttendeeGrid({ search }: AttendeeGridProps) {
  const currentEvent = useEventStore((s) => s.currentEvent);
  const { data: attendees, isLoading } = useEventAttendees(currentEvent?.id);
  const { data: speakers } = useEventSpeakers(currentEvent?.id);
  const { data: sessions } = useEventSessions(currentEvent?.id);

  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

  // Map attendee IDs to speaker objects for quick lookup
  const speakerById = useMemo(() => {
    const map = new Map<string, Speaker>();
    for (const s of speakers) {
      map.set(s.id, s);
    }
    return map;
  }, [speakers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return attendees;
    const q = search.toLowerCase();
    return attendees.filter((a) => a.name.toLowerCase().includes(q));
  }, [search, attendees]);

  const handleAttendeeClick = useCallback(
    (attendeeId: string) => {
      const speaker = speakerById.get(attendeeId);
      if (speaker) setSelectedSpeaker(speaker);
    },
    [speakerById]
  );

  if (isLoading) {
    return <AttendeesSkeleton />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((attendee) => (
          <AttendeeCard
            key={attendee.id}
            attendee={attendee}
            onClick={attendee.isSpeaker ? () => handleAttendeeClick(attendee.id) : undefined}
          />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No attendees found matching &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {selectedSpeaker && (
        <SpeakerPopup
          speaker={selectedSpeaker}
          sessions={sessions}
          onClose={() => setSelectedSpeaker(null)}
        />
      )}
    </>
  );
}
