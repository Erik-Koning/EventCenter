"use client";

import { cn } from "@common/lib/utils";
import type { Session, Speaker } from "@/data/types";
import { MapPin, Clock } from "lucide-react";
import { formatTimeRange } from "@/lib/time";

interface SessionBlockProps {
  session: Session;
  speaker: Speaker | undefined;
  onClick: (session: Session) => void;
}

const TRACK_COLORS: Record<string, string> = {
  Leadership: "border-l-primary",
  Technology: "border-l-blue-500",
  Strategy: "border-l-amber-500",
  Innovation: "border-l-emerald-500",
  Culture: "border-l-violet-500",
};

export function SessionBlock({ session, speaker, onClick }: SessionBlockProps) {
  const trackColor = session.track
    ? TRACK_COLORS[session.track] ?? "border-l-gray-300"
    : "border-l-gray-300";

  return (
    <button
      onClick={() => onClick(session)}
      className={cn(
        "group w-full rounded-lg border border-border bg-white p-3 text-left shadow-2xs transition-all duration-150 hover:shadow-sm",
        "border-l-[3px]",
        trackColor
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {formatTimeRange(session.startTime, session.endTime)}
        </span>
        <span className="mx-0.5">·</span>
        <MapPin className="h-3 w-3" />
        <span>{session.location}</span>
      </div>
      <p className="text-sm font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
        {session.title}
      </p>
      {speaker && (
        <p className="mt-1 text-xs text-muted-foreground">{speaker.name}</p>
      )}
    </button>
  );
}
