"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { Badge } from "@/src/components/ui/badge";
import {
  Clock,
  MapPin,
  Users,
  Lock,
  Repeat,
  Pencil,
  XCircle,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/stores/userStore";
import type { CalendarEvent } from "./CalendarGrid";
import EventEditForm from "./EventEditForm";

const AVAILABILITY_LABELS: Record<string, { label: string; variant: string }> = {
  busy: { label: "Busy", variant: "default" },
  free: { label: "Free", variant: "secondary" },
  working_elsewhere: { label: "Working Elsewhere", variant: "outline" },
  tentative: { label: "Tentative", variant: "outline" },
  out_of_office: { label: "Out of Office", variant: "destructive" },
};

interface EventDetailSheetProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdated: () => void;
}

export default function EventDetailSheet({
  event,
  open,
  onOpenChange,
  onEventUpdated,
}: EventDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [linkedFollowUp, setLinkedFollowUp] = useState<{ id: string; title: string; status: string } | null>(null);
  const currentUser = useUserStore((s) => s.user);

  // Fetch linked follow-up info when event changes
  useEffect(() => {
    if (!event || !open) {
      setLinkedFollowUp(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/events/${event.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.linkedFollowUp) {
          setLinkedFollowUp(data.linkedFollowUp);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [event?.id, open]);

  if (!event) return null;

  const isCreator = currentUser?.id === event.createdBy.id;

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const availInfo = AVAILABILITY_LABELS[event.availability] || AVAILABILITY_LABELS.busy;

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        onOpenChange(false);
        onEventUpdated();
      }
    } catch (error) {
      console.error("Failed to cancel event:", error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleEditSaved = () => {
    setIsEditing(false);
    onEventUpdated();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {event.isPrivate && <Lock className="h-4 w-4 text-muted-foreground" />}
            {event.title}
          </SheetTitle>
        </SheetHeader>

        {isEditing ? (
          <EventEditForm
            event={event}
            linkedFollowUp={linkedFollowUp}
            onSaved={handleEditSaved}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="mt-4 space-y-4">
            {/* Time */}
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <div>{format(start, "EEEE, MMMM d, yyyy")}</div>
                <div className="text-muted-foreground">
                  {format(start, "h:mm a")} - {format(end, "h:mm a")}
                </div>
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span className="text-sm">{event.location}</span>
              </div>
            )}

            {/* Series */}
            {event.isSeries && (
              <div className="flex items-start gap-3">
                <Repeat className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Recurring event</span>
              </div>
            )}

            {/* Availability */}
            <div>
              <Badge variant={availInfo.variant as "default" | "secondary" | "outline" | "destructive"}>
                {availInfo.label}
              </Badge>
            </div>

            {/* Description */}
            {event.description && (
              <div className="text-sm text-muted-foreground border-t pt-3">
                {event.description}
              </div>
            )}

            {/* Attendees */}
            {event.attendees.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Attendees ({event.attendees.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {event.attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{attendee.user.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {attendee.responseStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked follow-up */}
            {linkedFollowUp && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="text-sm">
                  <span className="text-amber-700 dark:text-amber-300 font-medium">Linked follow-up: </span>
                  <a href="/follow-ups" className="text-amber-600 dark:text-amber-400 hover:underline">
                    {linkedFollowUp.title}
                  </a>
                  <Badge variant="outline" className="ml-2 text-xs capitalize">
                    {linkedFollowUp.status === "confirmed" ? "pending" : linkedFollowUp.status}
                  </Badge>
                </div>
              </div>
            )}

            {/* Created by */}
            <div className="border-t pt-3 text-xs text-muted-foreground">
              Created by {event.createdBy.name}
            </div>

            {/* Actions */}
            {isCreator && (
              <div className="border-t pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
                    "bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
                    "bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors",
                    "disabled:opacity-50"
                  )}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {isCancelling ? "Cancelling..." : "Cancel Event"}
                </button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
