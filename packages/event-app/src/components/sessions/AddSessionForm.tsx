"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@common/components/ui/dialog";
import { useSessionStore } from "@/lib/stores/sessionStore";
import type { Session } from "@/data/types";

interface AddSessionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSessionForm({ open, onOpenChange }: AddSessionFormProps) {
  const addSession = useSessionStore((s) => s.addSession);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [day, setDay] = useState<1 | 2 | 3>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const session: Session = {
      id: `user-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      speakerId: "",
      day,
      startTime,
      endTime,
      location: location.trim() || "TBD",
      tags: ["proposed"],
      isUserSubmitted: true,
    };

    addSession(session);
    onOpenChange(false);
    setTitle("");
    setDescription("");
    setSpeakerName("");
    setDay(1);
    setStartTime("09:00");
    setEndTime("10:00");
    setLocation("");
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Propose a Session</DialogTitle>
          <DialogDescription>
            Submit a session idea for the offsite
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will this session cover?"
              rows={3}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Speaker Name
            </label>
            <input
              type="text"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              placeholder="Who will present?"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Day
              </label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value) as 1 | 2 | 3)}
                className={inputClass}
              >
                <option value={1}>Day 1</option>
                <option value={2}>Day 2</option>
                <option value={3}>Day 3</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room or venue"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Submit Proposal
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
