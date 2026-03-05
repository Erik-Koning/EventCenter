"use client";

import { cn } from "@common/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function SessionsSkeleton() {
  return (
    <div>
      {/* Day tabs */}
      <div className="mb-6 flex gap-2">
        <Bone className="h-10 w-44 rounded-xl" />
        <Bone className="h-10 w-44 rounded-xl" />
        <Bone className="h-10 w-44 rounded-xl" />
      </div>

      {/* Session cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Bone className="h-5 w-3/5" />
                <Bone className="h-4 w-2/5" />
              </div>
              <Bone className="h-8 w-16 rounded-lg" />
            </div>
            <Bone className="h-3 w-full" />
            <div className="flex gap-2">
              <Bone className="h-5 w-20 rounded-full" />
              <Bone className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
