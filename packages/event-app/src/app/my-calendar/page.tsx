"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@common/components/ui/Tabs";
import { cn } from "@common/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { PersonalCalendar } from "@/components/my-calendar/PersonalCalendar";
import { SessionPool } from "@/components/my-calendar/SessionPool";
import { EVENT_INFO } from "@/data/event";

export default function MyCalendarPage() {
  const [activeDay, setActiveDay] = useState<1 | 2 | 3>(1);

  const formatDayLabel = (dateStr: string, dayNum: number) => {
    const date = new Date(dateStr + "T12:00:00");
    return `Day ${dayNum} · ${format(date, "EEEE, MMM d")}`;
  };

  return (
    <>
      <PageHeader
        title="My Calendar"
        subtitle="Build your personal schedule by adding sessions"
      />

      <Tabs
        defaultValue="day-1"
        onValueChange={(v) => setActiveDay(Number(v.split("-")[1]) as 1 | 2 | 3)}
      >
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
                activeDay === day.num
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

        {([1, 2, 3] as const).map((day) => (
          <TabsContent key={day} value={`day-${day}`}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
              <SessionPool dayFilter={day} />
              <PersonalCalendar day={day} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
