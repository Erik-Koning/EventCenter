"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@common/components/ui/Tabs";
import { cn } from "@common/lib/utils";
import { useEventStore } from "@/lib/stores/eventStore";
import { useEventSessions } from "@/hooks/useEventData";
import { useSessionStore } from "@/lib/stores/sessionStore";
import { SessionCard } from "./SessionCard";
import { SessionsSkeleton } from "@/components/skeletons/SessionsSkeleton";

function formatDayLabel(dateStr: string, dayNum: number) {
  const date = new Date(dateStr + "T12:00:00");
  return `Day ${dayNum} · ${format(date, "EEEE, MMM d")}`;
}

function ScrollReveal({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "50px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-500 ease-out",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

export function SessionList() {
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const currentEvent = useEventStore((s) => s.currentEvent);
  const { data: sessions, isLoading } = useEventSessions(currentEvent?.id);
  const userSessions = useSessionStore((s) => s.userSessions);
  const upvotes = useSessionStore((s) => s.upvotes);

  // Derive unique sorted dates
  const days = useMemo(() => {
    const allSessions = [...sessions, ...userSessions];
    const dateSet = new Set(allSessions.map((s) => s.date));
    return Array.from(dateSet).sort();
  }, [sessions, userSessions]);

  const sessionsByDate = useMemo(() => {
    const combined = [...sessions, ...userSessions];
    const grouped: Record<string, typeof combined> = {};
    for (const session of combined) {
      (grouped[session.date] ??= []).push(session);
    }
    // Sort by upvotes within each date
    for (const date of Object.keys(grouped)) {
      grouped[date].sort((a, b) => (upvotes[b.id] ?? 0) - (upvotes[a.id] ?? 0));
    }
    return grouped;
  }, [sessions, userSessions, upvotes]);

  if (isLoading) {
    return <SessionsSkeleton />;
  }

  return (
    <Tabs
      defaultValue="day-0"
      onValueChange={(v) => setActiveDayIndex(Number(v.replace("day-", "")))}
    >
      <TabsList className="mb-6 flex items-start gap-2 bg-transparent p-0">
        {days.map((date, i) => (
          <TabsTrigger
            key={date}
            value={`day-${i}`}
            variant="blank"
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-all",
              activeDayIndex === i
                ? "bg-primary text-white shadow-sm"
                : "border border-border bg-gradient-to-br from-primary/[0.04] to-transparent text-muted-foreground hover:from-primary/[0.08] hover:text-foreground"
            )}
          >
            {formatDayLabel(date, i + 1)}
          </TabsTrigger>
        ))}
      </TabsList>

      {days.map((date, i) => (
        <TabsContent key={date} value={`day-${i}`} variant="blank">
          <div className="space-y-3">
            {(sessionsByDate[date] ?? []).map((session, idx) => (
              <ScrollReveal key={session.id} delay={idx * 80}>
                <SessionCard
                  session={session}
                  speakers={session.speakers}
                />
              </ScrollReveal>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
