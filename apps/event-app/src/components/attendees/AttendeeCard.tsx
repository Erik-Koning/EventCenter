import { Mic2, Users } from "lucide-react";
import { cn } from "@common/lib/utils";
import type { Attendee } from "@/data/types";

interface AttendeeCardProps {
  attendee: Attendee;
  onClick?: () => void;
}

export function AttendeeCard({ attendee, onClick }: AttendeeCardProps) {
  const clickable = attendee.isSpeaker && !!onClick;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); } : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm",
        clickable && "cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/20"
      )}
    >
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
