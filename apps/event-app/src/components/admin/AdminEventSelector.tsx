"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { useAdminStore } from "@/lib/stores/adminStore";

interface EventOption {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

export function AdminEventSelector() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const managedEventId = useAdminStore((s) => s.managedEventId);
  const setManagedEventId = useAdminStore((s) => s.setManagedEventId);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EventOption[]) => {
        setEvents(data);
        if (!managedEventId && data.length > 0) {
          setManagedEventId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-1.5">
      <Calendar className="h-4 w-4 flex-shrink-0 text-primary" />
      <select
        className="h-7 appearance-none bg-transparent pr-6 text-sm font-medium text-primary focus:outline-none cursor-pointer"
        value={managedEventId ?? ""}
        onChange={(e) => setManagedEventId(e.target.value || null)}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ec1d24' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0 center",
        }}
      >
        <option value="">Select event...</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title} ({ev.startDate})
          </option>
        ))}
      </select>
    </div>
  );
}
