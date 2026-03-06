"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ThumbsUp, Eye, MessageCircle, Clock, LayoutGrid } from "lucide-react";
import type { DayRecap } from "@/data/day-recaps";

interface DayRecapPopupProps {
  recap: DayRecap | undefined;
  open: boolean;
  onClose: () => void;
}

const TRACK_COLORS: Record<string, string> = {
  Leadership: "bg-red-50 text-red-700 border-red-200",
  Technology: "bg-blue-50 text-blue-700 border-blue-200",
  Strategy: "bg-amber-50 text-amber-700 border-amber-200",
  Innovation: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Culture: "bg-violet-50 text-violet-700 border-violet-200",
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function DayRecapPopup({ recap, open, onClose }: DayRecapPopupProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !recap) return null;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-xl animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="px-6 pt-6 pb-0">
            <h2 className="text-lg font-semibold text-foreground">
              Day {recap.day} Recap
            </h2>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>{recap.totalSessions} sessions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDuration(recap.totalDurationMinutes)}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-5 p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {recap.summary}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {recap.trackBreakdown.map(({ track, count }) => (
                <span
                  key={track}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TRACK_COLORS[track] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}
                >
                  {track} ({count})
                </span>
              ))}
            </div>

            <div className="grid gap-2.5">
              <HighlightCard
                icon={<ThumbsUp className="h-4 w-4 text-primary" />}
                label="Most Upvoted"
                title={recap.mostUpvotedSession.title}
                stat={`${recap.mostUpvotedSession.upvotes} upvotes`}
              />
              <HighlightCard
                icon={<Eye className="h-4 w-4 text-primary/70" />}
                label="Most Viewed"
                title={recap.mostViewedSession.title}
                stat={`${recap.mostViewedSession.views} views`}
              />
              <HighlightCard
                icon={<MessageCircle className="h-4 w-4 text-primary/70" />}
                label="Most Discussed"
                title={recap.mostTalkativeSession.title}
                stat={`${recap.mostTalkativeSession.commentCount} comments`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function HighlightCard({
  icon,
  label,
  title,
  stat,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  stat: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/[0.03] to-transparent p-3 transition-colors hover:from-primary/[0.06]">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{stat}</p>
    </div>
  );
}
