import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@common/lib/utils";
import { Clock, MapPin } from "lucide-react";
import type { Speaker, Session } from "@/data/types";
import { formatTimeRange } from "@/lib/time";
import { format } from "date-fns";

interface SpeakerCardProps {
  speaker: Speaker;
  sessions: Session[];
}

const TRACK_DOT_COLORS: Record<string, string> = {
  Leadership: "bg-red-500",
  Technology: "bg-blue-500",
  Strategy: "bg-amber-500",
  Innovation: "bg-emerald-500",
  Culture: "bg-violet-500",
};

export function SpeakerCard({ speaker, sessions }: SpeakerCardProps) {
  const speakerSessions = useMemo(
    () => sessions.filter((s) => s.speakers.some((sp) => sp.id === speaker.id)),
    [sessions, speaker.id]
  );

  return (
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
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
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
      href={`/sessions/${session.id}?from=speakers`}
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
