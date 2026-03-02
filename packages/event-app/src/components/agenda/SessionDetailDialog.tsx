"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@common/components/ui/dialog";
import { Badge } from "@common/components/ui/badge";
import { Clock, MapPin, User } from "lucide-react";
import type { Session, Speaker } from "@/data/types";
import { formatTimeRange } from "@/lib/time";

interface SessionDetailDialogProps {
  session: Session | null;
  speaker: Speaker | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetailDialog({
  session,
  speaker,
  open,
  onOpenChange,
}: SessionDetailDialogProps) {
  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {session.track && (
              <Badge variant="secondary" className="text-[10px]">
                {session.track}
              </Badge>
            )}
            {session.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
          <DialogTitle className="text-lg">{session.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Session details for {session.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {formatTimeRange(session.startTime, session.endTime)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{session.location}</span>
            </div>
            {speaker && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span>
                  {speaker.name}, {speaker.title}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {session.description}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
