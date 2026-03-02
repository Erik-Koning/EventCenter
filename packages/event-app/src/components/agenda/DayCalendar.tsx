"use client";

import { useMemo } from "react";
import type { Session, Speaker } from "@/data/types";
import { SessionBlock } from "./SessionBlock";

interface DayCalendarProps {
  sessions: Session[];
  speakers: Speaker[];
  onSessionClick: (session: Session) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am to 7pm

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function DayCalendar({
  sessions,
  speakers,
  onSessionClick,
}: DayCalendarProps) {
  const speakerMap = useMemo(
    () => new Map(speakers.map((s) => [s.id, s])),
    [speakers]
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [sessions]
  );

  const startMinutes = 7 * 60; // 7:00 AM
  const totalMinutes = 12 * 60; // 12 hours (7am-7pm)

  return (
    <div className="relative max-h-[600px] overflow-y-auto rounded-xl border border-border bg-white">
      {/* Time labels + grid lines */}
      <div className="relative" style={{ height: `${totalMinutes + 16}px` }}>
        {HOURS.map((hour) => {
          const top = (hour - 7) * 60 + 8;
          return (
            <div key={hour} className="absolute left-0 right-0" style={{ top }}>
              <div className="flex items-center">
                <span className="w-16 flex-shrink-0 pr-3 text-right text-[11px] text-muted-foreground">
                  {hour === 12
                    ? "12 PM"
                    : hour > 12
                      ? `${hour - 12} PM`
                      : `${hour} AM`}
                </span>
                <div className="flex-1 border-t border-border/50" />
              </div>
            </div>
          );
        })}

        {/* Session blocks */}
        {sortedSessions.map((session) => {
          const sessionStart = timeToMinutes(session.startTime) - startMinutes;
          const sessionDuration =
            timeToMinutes(session.endTime) - timeToMinutes(session.startTime);

          return (
            <div
              key={session.id}
              className="absolute left-16 right-3"
              style={{
                top: `${sessionStart + 12}px`,
                height: `${sessionDuration - 8}px`,
              }}
            >
              <SessionBlock
                session={session}
                speaker={speakerMap.get(session.speakerId)}
                onClick={onSessionClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
