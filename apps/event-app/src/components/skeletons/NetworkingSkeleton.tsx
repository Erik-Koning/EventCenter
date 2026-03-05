"use client";

import { cn } from "@common/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function NetworkingSkeleton() {
  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="flex flex-1 flex-wrap content-start gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 w-64 rounded-xl border border-border bg-white p-4 space-y-3"
          >
            <Bone className="h-4 w-3/4" />
            <Bone className="h-3 w-full" />
            <div className="flex items-center gap-2 pt-2">
              <Bone className="h-5 w-5 rounded-full" />
              <Bone className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
