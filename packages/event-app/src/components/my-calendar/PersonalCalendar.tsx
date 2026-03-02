"use client";

import { useMemo } from "react";
import { useCalendarStore } from "@/lib/stores/calendarStore";
import { CalendarDayColumn } from "./CalendarDayColumn";
import { SESSIONS } from "@/data/sessions";
import { SPEAKERS } from "@/data/speakers";

interface PersonalCalendarProps {
  day: 1 | 2 | 3;
}

export function PersonalCalendar({ day }: PersonalCalendarProps) {
  const selectedIds = useCalendarStore((s) => s.selectedSessionIds);
  const removeSession = useCalendarStore((s) => s.removeSession);

  const selectedSessions = useMemo(
    () =>
      SESSIONS.filter((s) => s.day === day && selectedIds.includes(s.id)),
    [day, selectedIds]
  );

  return (
    <CalendarDayColumn
      day={day}
      sessions={selectedSessions}
      speakers={SPEAKERS}
      onRemoveSession={removeSession}
    />
  );
}
