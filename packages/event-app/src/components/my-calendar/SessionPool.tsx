"use client";

import { useMemo } from "react";
import { SESSIONS } from "@/data/sessions";
import { useCalendarStore } from "@/lib/stores/calendarStore";
import { DraggableSession } from "./DraggableSession";

interface SessionPoolProps {
  dayFilter: 1 | 2 | 3;
}

export function SessionPool({ dayFilter }: SessionPoolProps) {
  const selectedIds = useCalendarStore((s) => s.selectedSessionIds);
  const addSession = useCalendarStore((s) => s.addSession);

  const daySessions = useMemo(
    () => SESSIONS.filter((s) => s.day === dayFilter),
    [dayFilter]
  );

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Available Sessions
      </h3>
      <div className="space-y-2">
        {daySessions.map((session) => (
          <DraggableSession
            key={session.id}
            session={session}
            isSelected={selectedIds.includes(session.id)}
            onAdd={() => addSession(session.id)}
          />
        ))}
      </div>
    </div>
  );
}
