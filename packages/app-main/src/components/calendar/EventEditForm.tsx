"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { CalendarEvent } from "./CalendarGrid";

interface EventEditFormProps {
  event: CalendarEvent;
  linkedFollowUp?: { id: string; title: string; status: string } | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function EventEditForm({
  event,
  linkedFollowUp,
  onSaved,
  onCancel,
}: EventEditFormProps) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [location, setLocation] = useState(event.location || "");
  const [startDate, setStartDate] = useState(
    format(new Date(event.startDate), "yyyy-MM-dd'T'HH:mm")
  );
  const [endDate, setEndDate] = useState(
    format(new Date(event.endDate), "yyyy-MM-dd'T'HH:mm")
  );
  const [availability, setAvailability] = useState(event.availability);
  const [isPrivate, setIsPrivate] = useState(event.isPrivate);
  const [syncFollowUp, setSyncFollowUp] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          location: location || null,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          availability,
          isPrivate,
          syncFollowUp: linkedFollowUp ? syncFollowUp : undefined,
        }),
      });

      if (response.ok) {
        onSaved();
      }
    } catch (error) {
      console.error("Failed to update event:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClassName =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
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
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClassName}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Start</label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputClassName}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">End</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Availability</label>
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className={inputClassName}
        >
          <option value="busy">Busy</option>
          <option value="free">Free</option>
          <option value="working_elsewhere">Working Elsewhere</option>
          <option value="tentative">Tentative</option>
          <option value="out_of_office">Out of Office</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPrivate"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="rounded border-border"
        />
        <label htmlFor="isPrivate" className="text-sm">
          Private event
        </label>
      </div>

      {linkedFollowUp && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <input
            type="checkbox"
            id="syncFollowUp"
            checked={syncFollowUp}
            onChange={(e) => setSyncFollowUp(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="syncFollowUp" className="text-sm text-amber-700 dark:text-amber-300">
            Also update linked follow-up: {linkedFollowUp.title}
          </label>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
