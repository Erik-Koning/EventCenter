"use client";

import { useNetworkingPolling } from "@/hooks/useNetworkingPolling";
import { NetworkingChat } from "./NetworkingChat";
import { AISummaryPanel } from "./AISummaryPanel";
import { MindMap } from "./MindMap";

export function GroupFullLayout() {
  useNetworkingPolling();

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Desktop: Left panel — AI Summary + Mind Map */}
      <div className="hidden flex-1 flex-col gap-4 overflow-hidden lg:flex">
        <div className="h-[45%] overflow-auto rounded-xl border border-border bg-white p-4">
          <AISummaryPanel />
        </div>
        <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white p-4">
          <MindMap />
        </div>
      </div>

      {/* Right: Chat Panel */}
      <div className="flex w-full flex-col lg:w-[380px] lg:flex-shrink-0">
        <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
          <NetworkingChat />
        </div>
        {/* Mobile: stacked panels below chat */}
        <div className="mt-4 overflow-auto rounded-xl border border-border bg-white p-4 lg:hidden">
          <AISummaryPanel />
        </div>
        <div className="mt-4 h-[300px] overflow-hidden rounded-xl border border-border bg-white p-4 lg:hidden">
          <MindMap />
        </div>
      </div>
    </div>
  );
}
