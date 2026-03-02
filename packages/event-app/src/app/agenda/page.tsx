"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@common/components/ui/Tabs";
import { cn } from "@common/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { EventOverview } from "@/components/agenda/EventOverview";
import { DayCalendar } from "@/components/agenda/DayCalendar";
import { SessionDetailDialog } from "@/components/agenda/SessionDetailDialog";
import { SESSIONS } from "@/data/sessions";  // REPLACE ALL OF THESE DATA IMPORTS WITH API
import { SPEAKERS } from "@/data/speakers";  // ^
import { EVENT_INFO } from "@/data/event";   // ^
import type { Session } from "@/data/types"; // ^

export default function AgendaPage() {
  const [activeDay, setActiveDay] = useState<string>("day-1");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sessionsByDay = useMemo(() => {
    return {
      1: SESSIONS.filter((s) => s.day === 1),
      2: SESSIONS.filter((s) => s.day === 2),
      3: SESSIONS.filter((s) => s.day === 3),
    };
  }, []);

  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
    setDialogOpen(true);
  };

  // Label for Day formatting
  const formatDayLabel = (dateStr: string, dayNum: number) => {
    const date = new Date(dateStr + "T12:00:00");
    return `Day ${dayNum} · ${format(date, "EEEE, MMM d")}`;
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Three days of strategic sessions, workshops, and keynotes"
      />

      <EventOverview />

      <Tabs defaultValue="day-1" onValueChange={setActiveDay}>
        <TabsList className="mb-6 flex gap-2 bg-transparent p-0">
          {([
            { value: "day-1", date: EVENT_INFO.dates.day1, num: 1 },
            { value: "day-2", date: EVENT_INFO.dates.day2, num: 2 },
            { value: "day-3", date: EVENT_INFO.dates.day3, num: 3 },
          ] as const).map((day) => (
            <div
              key={day.value}
              className={cn(
                "rounded-xl px-1 py-1 transition-colors",
                activeDay === day.value
                  ? "bg-primary/15"
                  : "bg-primary/[0.06]"
              )}
            >
              <TabsTrigger value={day.value}>
                {formatDayLabel(day.date, day.num)}
              </TabsTrigger>
            </div>
          ))}
        </TabsList>

        <TabsContent value="day-1">
          <DayCalendar
            sessions={sessionsByDay[1]}
            speakers={SPEAKERS}
            onSessionClick={handleSessionClick}
          />
        </TabsContent>
        <TabsContent value="day-2">
          <DayCalendar
            sessions={sessionsByDay[2]}
            speakers={SPEAKERS}
            onSessionClick={handleSessionClick}
          />
        </TabsContent>
        <TabsContent value="day-3">
          <DayCalendar
            sessions={sessionsByDay[3]}
            speakers={SPEAKERS}
            onSessionClick={handleSessionClick}
          />
        </TabsContent>
      </Tabs>

      <SessionDetailDialog
        session={selectedSession}
        speaker={
          selectedSession
            ? SPEAKERS.find((s) => s.id === selectedSession.speakerId)
            : undefined
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
