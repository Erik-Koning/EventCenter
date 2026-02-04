"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@common/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { toast } from "@common/components/ui/sonner";

interface FollowUpEditDialogProps {
  followUp: {
    id: string;
    title: string;
    summary: string;
    status: string;
    dueDate: string | null;
    linkedEventId: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function FollowUpEditDialog({
  followUp,
  open,
  onOpenChange,
  onSaved,
}: FollowUpEditDialogProps) {
  const [title, setTitle] = useState(followUp.title);
  const [summary, setSummary] = useState(followUp.summary);
  const [dueDate, setDueDate] = useState(followUp.dueDate || "");
  const [syncEvent, setSyncEvent] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const inputClassName =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/updates/follow-ups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpId: followUp.id,
          status: followUp.status as "confirmed" | "completed" | "dismissed",
          title: title.trim(),
          summary,
          dueDate: dueDate || undefined,
          syncEvent: followUp.linkedEventId ? syncEvent : false,
        }),
      });

      if (!response.ok) throw new Error("Failed to update follow-up");

      toast.success("Follow-up updated");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Failed to update follow-up:", error);
      toast.error("Failed to update follow-up");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Follow-up</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClassName}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClassName}
            />
          </div>

          {followUp.linkedEventId && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <input
                type="checkbox"
                id="syncEvent"
                checked={syncEvent}
                onChange={(e) => setSyncEvent(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="syncEvent" className="text-sm text-amber-700 dark:text-amber-300">
                Also update linked calendar event
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
