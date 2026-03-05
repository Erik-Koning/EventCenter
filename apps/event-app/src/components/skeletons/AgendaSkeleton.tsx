"use client";

import { cn } from "@common/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function AgendaSkeleton() {
  return (
    <div>
      {/* Event overview card */}
      <Bone className="mb-6 h-28 w-full rounded-2xl" />

      {/* Day tabs */}
      <div className="mb-6 flex gap-2">
        <Bone className="h-10 w-44 rounded-xl" />
        <Bone className="h-10 w-44 rounded-xl" />
        <Bone className="h-10 w-44 rounded-xl" />
      </div>

      {/* Timeline items */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Bone className="h-12 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Bone className="h-5 w-3/4" />
              <Bone className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
