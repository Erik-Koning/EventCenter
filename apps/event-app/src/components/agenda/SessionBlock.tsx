"use client";

import Link from "next/link";
import { cn } from "@common/lib/utils";
import { Badge } from "@common/components/ui/badge";
import type { Session, Speaker } from "@/data/types";
import { MapPin, Clock } from "lucide-react";
import { formatTimeRange } from "@/lib/time";

interface SessionBlockProps {
  session: Session;
  speakers: Speaker[];
  from?: string;
}

const TRACK_BADGE_COLORS: Record<string, string> = {
  Leadership: "bg-red-50 text-red-700 border-red-200",
  Technology: "bg-blue-50 text-blue-700 border-blue-200",
  Strategy: "bg-amber-50 text-amber-700 border-amber-200",
  Innovation: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Culture: "bg-violet-50 text-violet-700 border-violet-200",
};

export function SessionBlock({ session, speakers, from }: SessionBlockProps) {
  const trackBadge = session.track
    ? TRACK_BADGE_COLORS[session.track] ?? "bg-gray-50 text-gray-700 border-gray-200"
    : "";

  const href = from
    ? `/sessions/${session.id}?from=${from}`
    : `/sessions/${session.id}`;

  return (
    <Link
      href={href}
      className="group block w-full rounded-2xl bg-gradient-to-br from-white to-gray-50/80 p-3.5 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTimeRange(session.startTime, session.endTime)}</span>
            <span className="mx-0.5">·</span>
            <MapPin className="h-3 w-3" />
            <span>{session.location}</span>
          </div>
          <p className="text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
            {session.title}
          </p>
          {speakers.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {speakers.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
        {session.track && (
          <Badge variant="outline" className={cn("flex-shrink-0 text-[9px] px-1.5 py-0", trackBadge)}>
            {session.track}
          </Badge>
        )}
      </div>
    </Link>
  );
}
