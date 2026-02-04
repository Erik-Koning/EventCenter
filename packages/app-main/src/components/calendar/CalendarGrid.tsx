"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";
import EventBlock from "./EventBlock";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  availability: string;
  isPrivate: boolean;
  isSeries: boolean;
  seriesId: string | null;
  status: string;
  createdBy: { id: string; name: string };
  attendees: {
    id: string;
    userId: string;
    responseStatus: string;
    user: { id: string; name: string; email: string };
  }[];
}

interface CalendarGridProps {
  currentMonth: Date;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({
  currentMonth,
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      // Add event to each day it spans
      for (const day of days) {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        if (start <= dayEnd && end >= dayStart) {
          const key = format(day, "yyyy-MM-dd");
          const existing = map.get(key) || [];
          existing.push(event);
          map.set(key, existing);
        }
      }
    }
    return map;
  }, [events, days]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-muted/50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDate(day);
                }
              }}
              className={cn(
                "relative min-h-[90px] border-t border-r border-border p-1 text-left transition-colors cursor-pointer",
                "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !inMonth && "bg-muted/30 text-muted-foreground/50",
                selected && "bg-primary/5 ring-2 ring-primary/30",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  today && "bg-primary text-primary-foreground",
                  !today && inMonth && "text-foreground",
                )}
              >
                {format(day, "d")}
              </span>

              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="block text-[10px] text-muted-foreground pl-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
