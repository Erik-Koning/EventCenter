"use client";

import { Badge } from "@common/components/ui/badge";
import { cn } from "@common/lib/utils";
import { Clock, MapPin, User } from "lucide-react";
import type { Session, Speaker } from "@/data/types";
import { formatTimeRange } from "@/lib/time";
import { UpvoteButton } from "./UpvoteButton";

interface SessionCardProps {
  session: Session;
  speaker: Speaker | undefined;
}

const TRACK_BADGE_COLORS: Record<string, string> = {
  Leadership: "bg-red-50 gap-2 text-red-700 border-red-200",
  Technology: "bg-blue-50 text-blue-700 border-blue-200",
  Strategy: "bg-amber-50 text-amber-700 border-amber-200",
  Innovation: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Culture: "bg-violet-50 text-violet-700 border-violet-200",
};

export function SessionCard({ session, speaker }: SessionCardProps) {
  const trackColors = session.track
    ? TRACK_BADGE_COLORS[session.track] ?? "bg-gray-50 text-gray-700 border-gray-200"
    : "";

  return (
    <div className="rounded-xl border border-border bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Tags */}
          <div className="mb-2 flex flex-wrap gap-3">
            {session.track && (
              <Badge variant="outline" className={cn("text-[10px] px-2.5 py-0.5", trackColors)}>
                {session.track}
              </Badge>
            )}
            {session.isUserSubmitted && (
              <Badge className="bg-primary/10 text-primary text-[10px] border-0">
                Proposed
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-foreground">
            {session.title}
          </h3>

          {/* Metadata */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTimeRange(session.startTime, session.endTime)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {session.location}
            </span>
            {speaker && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {speaker.name}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {session.description}
          </p>
        </div>

        {/* Upvote */}
        <div className="flex-shrink-0 pt-1">
          <UpvoteButton sessionId={session.id} />
        </div>
      </div>
    </div>
  );
}
