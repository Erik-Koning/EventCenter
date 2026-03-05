import { Mic2, Users } from "lucide-react";
import type { Attendee } from "@/data/types";

interface AttendeeCardProps {
  attendee: Attendee;
}

export function AttendeeCard({ attendee }: AttendeeCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {attendee.initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{attendee.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {attendee.title}
        </p>
      </div>
      <div
        className="flex-shrink-0"
        title={attendee.isSpeaker ? "Speaker" : "Attendee"}
      >
        {attendee.isSpeaker ? (
          <Mic2 className="h-4 w-4 text-primary" />
        ) : (
          <Users className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
