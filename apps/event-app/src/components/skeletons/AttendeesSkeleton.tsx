"use client";

import { cn } from "@common/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function AttendeesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-white p-4"
        >
          <Bone className="h-10 w-10 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-3/4" />
            <Bone className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
