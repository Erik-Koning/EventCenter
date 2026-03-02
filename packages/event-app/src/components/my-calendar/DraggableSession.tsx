"use client";

import { cn } from "@common/lib/utils";
import type { Session } from "@/data/types";
import { formatTimeRange } from "@/lib/time";
import { Check } from "lucide-react";

interface SessionPoolItemProps {
  session: Session;
  isSelected: boolean;
  onAdd: () => void;
}

export function DraggableSession({
  session,
  isSelected,
  onAdd,
}: SessionPoolItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-white p-2.5 text-xs transition-all",
        isSelected
          ? "border-primary/20 bg-primary/[0.04] opacity-60"
          : "hover:shadow-sm"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{session.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatTimeRange(session.startTime, session.endTime)} · {session.location}
        </p>
      </div>

      <button
        onClick={onAdd}
        disabled={isSelected}
        className={cn(
          "flex-shrink-0 rounded-md p-1 transition-colors",
          isSelected
            ? "text-primary"
            : "text-muted-foreground/40 hover:bg-primary/10 hover:text-primary"
        )}
      >
        {isSelected ? (
          <Check className="h-4 w-4" />
        ) : (
          <span className="flex h-4 w-4 items-center justify-center text-sm leading-none">
            +
          </span>
        )}
      </button>
    </div>
  );
}
