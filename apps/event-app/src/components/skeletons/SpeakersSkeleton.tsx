"use client";

import { cn } from "@common/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function SpeakersSkeleton() {
  return (
    <div className="flex flex-col items-center">
      {/* Carousel card */}
      <div className="w-full rounded-2xl border border-border bg-white px-6 py-12">
        <div className="flex flex-col items-center gap-4">
          <Bone className="h-24 w-24 rounded-full" />
          <Bone className="h-6 w-48" />
          <Bone className="h-4 w-36" />
          <Bone className="h-4 w-64" />
          <div className="mt-4 w-full max-w-md space-y-2">
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-5/6" />
            <Bone className="h-3 w-4/6" />
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone
            key={i}
            className={cn("h-2 rounded-full", i === 0 ? "w-6" : "w-2")}
          />
        ))}
      </div>
    </div>
  );
}
