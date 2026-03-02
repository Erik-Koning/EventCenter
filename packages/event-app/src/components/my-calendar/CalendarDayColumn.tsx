"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import type { Session, Speaker } from "@/data/types";
import { formatTimeRange } from "@/lib/time";

interface CalendarDayColumnProps {
  day: 1 | 2 | 3;
  sessions: Session[];
  speakers: Speaker[];
  onRemoveSession: (sessionId: string) => void;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am-7pm

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function CalendarDayColumn({
  day,
  sessions,
  speakers,
  onRemoveSession,
}: CalendarDayColumnProps) {
  const speakerMap = useMemo(
    () => new Map(speakers.map((s) => [s.id, s])),
    [speakers]
  );

  const startMinutes = 7 * 60; // 7:00 AM
  const totalMinutes = 12 * 60; // 12 hours (7am-7pm)

  return (
    <div className="relative max-h-[600px] overflow-y-auto rounded-xl border border-border bg-white">
      <div className="relative" style={{ height: `${totalMinutes + 32}px` }}>
        {/* Hour grid lines */}
        {HOURS.map((hour) => {
          const top = (hour - 7) * 60 + 8;
          return (
            <div
              key={hour}
              className="pointer-events-none absolute left-0 right-0"
              style={{ top }}
            >
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
        {sessions.map((session) => {
          const sessionStart = timeToMinutes(session.startTime) - startMinutes;
          const sessionDuration =
            timeToMinutes(session.endTime) - timeToMinutes(session.startTime);
          const speaker = speakerMap.get(session.speakerId);

          return (
            <div
              key={session.id}
              className="absolute left-16 right-3 z-10"
              style={{
                top: `${sessionStart + 12}px`,
                height: `${sessionDuration - 8}px`,
              }}
            >
              <div className="group flex h-full items-start rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {session.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTimeRange(session.startTime, session.endTime)}
                    {speaker && ` · ${speaker.name}`}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveSession(session.id)}
                  className="flex-shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50">
              Click + on a session to add it to your calendar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
