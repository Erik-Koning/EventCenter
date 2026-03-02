"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { SESSIONS } from "@/data/sessions";
import { SPEAKERS } from "@/data/speakers";
import { EVENT_INFO } from "@/data/event";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { SessionCard } from "./SessionCard";

const DAY_DATES: Record<number, string> = {
  1: EVENT_INFO.dates.day1,
  2: EVENT_INFO.dates.day2,
  3: EVENT_INFO.dates.day3,
};

function formatDayHeader(dateStr: string, dayNum: number) {
  const date = new Date(dateStr + "T12:00:00");
  return `Day ${dayNum} — ${format(date, "EEEE, MMMM d")}`;
}

export function SessionList() {
  const userSessions = useSessionStore((s) => s.userSessions);
  const upvotes = useSessionStore((s) => s.upvotes);

  const speakerMap = useMemo(
    () => new Map(SPEAKERS.map((s) => [s.id, s])),
    []
  );

  const sessionsByDay = useMemo(() => {
    const combined = [...SESSIONS, ...userSessions];
    const grouped: Record<number, typeof combined> = { 1: [], 2: [], 3: [] };
    for (const session of combined) {
      (grouped[session.day] ??= []).push(session);
    }
    // Sort each day's sessions by upvotes descending
    for (const day of [1, 2, 3]) {
      grouped[day].sort((a, b) => (upvotes[b.id] ?? 0) - (upvotes[a.id] ?? 0));
    }
    return grouped;
  }, [userSessions, upvotes]);

  return (
    <div className="space-y-8">
      {([1, 2, 3] as const).map((day) => (
        <section key={day}>
          <h2 className="mb-4 text-base font-semibold text-foreground">
            {formatDayHeader(DAY_DATES[day], day)}
          </h2>
          <div className="space-y-3">
            {sessionsByDay[day].map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                speaker={speakerMap.get(session.speakerId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
