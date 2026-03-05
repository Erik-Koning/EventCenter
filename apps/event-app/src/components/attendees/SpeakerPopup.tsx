"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Clock, MapPin } from "lucide-react";
import { cn } from "@common/lib/utils";
import { format } from "date-fns";
import { formatTimeRange } from "@/lib/time";
import type { Speaker, Session } from "@/data/types";
import Link from "next/link";

const TRACK_DOT_COLORS: Record<string, string> = {
  Leadership: "bg-red-500",
  Technology: "bg-blue-500",
  Strategy: "bg-amber-500",
  Innovation: "bg-emerald-500",
  Culture: "bg-violet-500",
};

interface SpeakerPopupProps {
  speaker: Speaker;
  sessions: Session[];
  onClose: () => void;
}

export function SpeakerPopup({ speaker, sessions, onClose }: SpeakerPopupProps) {
  const speakerSessions = useMemo(
    () => sessions.filter((s) => s.speakers.some((sp) => sp.id === speaker.id)),
    [sessions, speaker.id]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-white shadow-xl animate-in fade-in-0 zoom-in-95">
          {/* Gradient overlay on solid white background */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          {/* Close button */}
          <div className="flex justify-end px-6 pt-5">
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Speaker card content — same structure as SpeakerCard */}
          <div className="px-8 pb-8">
            <div className="mx-auto max-w-2xl">
              {/* Header: info left, avatar right */}
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                    {speaker.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-primary">{speaker.title}</p>
                  <p className="text-xs text-muted-foreground">{speaker.company}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {speaker.bio}
                  </p>
                </div>

                {/* Avatar */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
                  <span className="text-2xl font-semibold text-primary">
                    {speaker.initials}
                  </span>
                </div>
              </div>

              {/* Sessions */}
              {speakerSessions.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Speaking At
                  </p>
                  <div className="grid gap-2">
                    {speakerSessions.map((session) => (
                      <SessionRow key={session.id} session={session} onClose={onClose} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SessionRow({ session, onClose }: { session: Session; onClose: () => void }) {
  const dotColor = session.track
    ? TRACK_DOT_COLORS[session.track] ?? "bg-gray-400"
    : "bg-gray-400";

  const dateLabel = (() => {
    try {
      return format(new Date(session.date + "T12:00:00"), "MMM d");
    } catch {
      return session.date;
    }
  })();

  return (
    <Link
      href={`/sessions/${session.id}?from=attendees`}
      onClick={onClose}
      className="group block rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md hover:ring-black/[0.08]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
          {session.title}
        </p>
        {session.track && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
            <span className="text-[10px] font-medium text-muted-foreground">
              {session.track}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dateLabel} · {formatTimeRange(session.startTime, session.endTime)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {session.location}
        </span>
      </div>
    </Link>
  );
}
