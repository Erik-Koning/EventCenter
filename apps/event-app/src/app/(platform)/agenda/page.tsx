"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@common/components/ui/Tabs";
import { cn } from "@common/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { EventOverview } from "@/components/agenda/EventOverview";
import { DayCalendar } from "@/components/agenda/DayCalendar";
import { DayRecapNewspaper } from "@/components/agenda/DayRecapNewspaper";
import { useEventStore } from "@/lib/stores/eventStore";
import { useEventSessions } from "@/hooks/useEventData";
import { useRecap } from "@/hooks/useRecap";
import { FileText, Loader2 } from "lucide-react";
import { AgendaSkeleton } from "@/components/skeletons/AgendaSkeleton";

export default function AgendaPage() {
  const currentEvent = useEventStore((s) => s.currentEvent);
  const { data: sessions, isLoading } = useEventSessions(currentEvent?.id);

  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [recapDate, setRecapDate] = useState<string | null>(null);

  // Derive unique sorted dates from sessions
  const days = useMemo(() => {
    const dateSet = new Set(sessions.map((s) => s.date));
    return Array.from(dateSet).sort();
  }, [sessions]);

  const activeDate = days[activeDayIndex] ?? null;

  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      (grouped[s.date] ??= []).push(s);
    }
    return grouped;
  }, [sessions]);

  const daySpeakers = useMemo(() => {
    if (!activeDate) return [];
    const daySessions = sessionsByDate[activeDate] ?? [];
    const seen = new Set<string>();
    return daySessions
      .flatMap((s) => s.speakers)
      .filter((sp) => {
        if (seen.has(sp.id)) return false;
        seen.add(sp.id);
        return true;
      });
  }, [activeDate, sessionsByDate]);

  // Figure out which days are in the past
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const pastDays = useMemo(() => days.filter((d) => d < today), [days, today]);

  // Track which days have a ready recap (keyed by date string)
  const [readyRecaps, setReadyRecaps] = useState<Set<string>>(new Set());

  // Auto-trigger recap generation for past days + check all days for ready recaps
  useEffect(() => {
    if (!currentEvent?.id || days.length === 0) return;
    for (const date of days) {
      fetch(`/api/events/${currentEvent.id}/recap?date=${date}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "ready") {
            setReadyRecaps((prev) => {
              if (prev.has(date)) return prev;
              const next = new Set(prev);
              next.add(date);
              return next;
            });
          } else if (data.status === "not_started" && date < today) {
            // Auto-trigger for past days only
            fetch(`/api/events/${currentEvent.id}/recap`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [currentEvent?.id, days, today]);

  // Recap hook for the currently selected recap date
  const { recap, isLoading: recapLoading } = useRecap(
    currentEvent?.id,
    recapDate
  );

  const formatDayLabel = (dateStr: string, dayNum: number) => {
    const date = new Date(dateStr + "T12:00:00");
    return `Day ${dayNum} · ${format(date, "EEEE, MMM d")}`;
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Agenda" subtitle="Three days of strategic sessions, workshops, and keynotes" />
        <AgendaSkeleton />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Three days of strategic sessions, workshops, and keynotes"
      />

      <EventOverview event={currentEvent} speakers={daySpeakers} />

      <Tabs
        defaultValue="day-0"
        onValueChange={(v) => setActiveDayIndex(Number(v.replace("day-", "")))}
      >
        <TabsList className="mb-6 flex items-start gap-2 bg-transparent p-0">
          {days.map((date, i) => (
            <div key={date} className="flex flex-col items-start gap-1.5">
              <TabsTrigger
                value={`day-${i}`}
                variant="blank"
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  activeDayIndex === i
                    ? "bg-primary text-white shadow-sm"
                    : "border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {formatDayLabel(date, i + 1)}
              </TabsTrigger>
              {(date < today || readyRecaps.has(date)) && (
                <button
                  onClick={() => setRecapDate(date)}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.04] px-2.5 py-1 text-[11px] font-medium text-primary transition-all hover:bg-primary/10 hover:border-primary/25"
                >
                  <FileText className="h-3 w-3" />
                  Day {i + 1} Recap
                </button>
              )}
            </div>
          ))}
        </TabsList>

        {days.map((date, i) => (
          <TabsContent key={date} value={`day-${i}`} variant="blank">
            <DayCalendar sessions={sessionsByDate[date] ?? []} />
          </TabsContent>
        ))}
      </Tabs>

      <DayRecapNewspaper
        recap={recap}
        isLoading={recapLoading}
        open={recapDate !== null}
        onClose={() => {
          // Mark this date as ready so the button stays visible
          if (recap && recapDate) {
            setReadyRecaps((prev) => {
              if (prev.has(recapDate)) return prev;
              const next = new Set(prev);
              next.add(recapDate);
              return next;
            });
          }
          setRecapDate(null);
        }}
      />
    </>
  );
}
