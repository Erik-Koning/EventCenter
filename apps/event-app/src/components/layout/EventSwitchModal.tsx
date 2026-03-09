"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@common/components/ui/dialog";
import { Button } from "@common/components/ui/Button";
import { useEventStore } from "@/lib/stores/eventStore";

export function EventSwitchModal() {
  const pendingSwitch = useEventStore((s) => s.pendingSwitch);
  const currentEvent = useEventStore((s) => s.currentEvent);
  const switchEvent = useEventStore((s) => s.switchEvent);
  const dismiss = useEventStore((s) => s.dismissPendingSwitch);

  if (!pendingSwitch || !currentEvent) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch Event?</DialogTitle>
          <DialogDescription>
            &ldquo;{currentEvent.title}&rdquo; has ended. Would you like to switch to &ldquo;{pendingSwitch.title}&rdquo;?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={dismiss}>
            Keep Current
          </Button>
          <Button onClick={async () => { await switchEvent(pendingSwitch.id); window.location.reload(); }}>
            Switch Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
