"use client";

import { cn } from "@/lib/utils";
import { IconBellRinging } from "@tabler/icons-react";
import type { CalendarEvent } from "./CalendarGrid";

const AVAILABILITY_COLORS: Record<string, string> = {
  busy: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  free: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
  working_elsewhere: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
  tentative: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  out_of_office: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
};

function isFollowUpEvent(event: CalendarEvent): boolean {
  return event.description?.startsWith("[Follow-up]") ?? false;
}

interface EventBlockProps {
  event: CalendarEvent;
  onClick: (e: React.MouseEvent) => void;
}

export default function EventBlock({ event, onClick }: EventBlockProps) {
  const followUp = isFollowUpEvent(event);

  if (followUp) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-left border",
          "transition-opacity hover:opacity-80",
          "bg-amber-100/60 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/40",
        )}
        title={event.title}
      >
        <span className="inline-flex items-center gap-0.5">
          <IconBellRinging className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{event.title}</span>
        </span>
      </button>
    );
  }

  const colorClass = AVAILABILITY_COLORS[event.availability] || AVAILABILITY_COLORS.busy;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-left border",
        "transition-opacity hover:opacity-80",
        colorClass,
      )}
      title={event.title}
    >
      {event.title}
    </button>
  );
}
