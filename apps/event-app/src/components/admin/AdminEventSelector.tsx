"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { useAdminStore } from "@/lib/stores/adminStore";

interface EventOption {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

export function AdminEventSelector() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [open, setOpen] = useState(false);
  const managedEventId = useAdminStore((s) => s.managedEventId);
  const setManagedEventId = useAdminStore((s) => s.setManagedEventId);
  const ref = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(() => {
    fetch("/api/admin/events")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EventOption[]) => setEvents(data))
      .catch(() => {});
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Re-fetch when managed event changes (e.g. after creating a new event)
  const prevManagedEventId = useRef(managedEventId);
  useEffect(() => {
    if (managedEventId !== prevManagedEventId.current) {
      prevManagedEventId.current = managedEventId;
      fetchEvents();
    }
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = events.find((e) => e.id === managedEventId);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-2 transition-all hover:bg-primary/[0.08] hover:border-primary/30"
      >
        <Calendar className="h-4 w-4 flex-shrink-0 text-primary" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {selected ? selected.title : "No event selected"}
          </span>
          {selected && (
            <span className="text-[11px] text-muted-foreground leading-tight">
              {formatDate(selected.startDate)} – {formatDate(selected.endDate)}
            </span>
          )}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-white py-1.5 shadow-lg">
          {/* No event option */}
          <button
            onClick={() => {
              setManagedEventId(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/80"
          >
            <div className="flex h-5 w-5 items-center justify-center">
              {!managedEventId && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
            <span className="text-sm text-muted-foreground">No event selected</span>
          </button>

          {events.length > 0 && (
            <div className="mx-3 my-1 border-t border-border" />
          )}

          {events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => {
                setManagedEventId(ev.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/80 ${
                managedEventId === ev.id ? "bg-primary/[0.04]" : ""
              }`}
            >
              <div className="flex h-5 w-5 items-center justify-center">
                {managedEventId === ev.id && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {ev.title}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(ev.startDate)} – {formatDate(ev.endDate)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
