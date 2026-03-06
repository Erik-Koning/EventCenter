"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useNetworkingPolling } from "@/hooks/useNetworkingPolling";
import { NetworkingChat } from "./NetworkingChat";
import { GroupMembersDropdown } from "./GroupMembersDropdown";
import { AISummaryPanel } from "./AISummaryPanel";
import { MindMap } from "./MindMap";

type FocusedPanel = "chat" | "summary" | "mindmap" | null;

export function GroupFullLayout() {
  useNetworkingPolling();

  const [leftWidth, setLeftWidth] = useState(66); // percentage
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>(null);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(75, Math.max(25, pct)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Focus-grow adjustments
  const effectiveLeftWidth =
    focusedPanel === "chat"
      ? leftWidth + 5
      : focusedPanel === "summary" || focusedPanel === "mindmap"
        ? leftWidth - 5
        : leftWidth;

  const summaryHeight =
    focusedPanel === "summary" ? 55 : focusedPanel === "mindmap" ? 35 : 45;

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col gap-4 lg:flex-row lg:gap-0">
      {/* Desktop layout with resizable columns */}
      <div
        ref={containerRef}
        className="hidden h-full w-full lg:flex"
      >
        {/* Left: Chat Panel */}
        <div
          className="flex h-full flex-col transition-all duration-300"
          style={{ width: `${effectiveLeftWidth}%` }}
          onClick={() => setFocusedPanel("chat")}
        >
          <div className={`flex-1 overflow-hidden rounded-xl border bg-white transition-shadow duration-300 ${focusedPanel === "chat" ? "border-border/60 shadow-md ring-1 ring-black/[0.04]" : "border-border shadow-sm"}`}>
            <NetworkingChat />
          </div>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="flex w-2 flex-shrink-0 cursor-col-resize items-center justify-center"
        >
          <div className="h-8 w-1 rounded-full bg-border transition-colors hover:bg-primary/40" />
        </div>

        {/* Right: Members + AI Summary + Mind Map */}
        <div
          className="flex h-full flex-1 flex-col gap-4 overflow-hidden transition-all duration-300"
        >
          <GroupMembersDropdown />
          <div
            className={`overflow-auto rounded-xl border bg-white p-4 transition-all duration-300 ${focusedPanel === "summary" ? "border-border/60 shadow-md ring-1 ring-black/[0.04]" : "border-border shadow-sm"}`}
            style={{ height: `${summaryHeight}%` }}
            onClick={() => setFocusedPanel("summary")}
          >
            <AISummaryPanel />
          </div>
          <div
            className={`overflow-hidden rounded-xl border bg-white p-4 transition-all duration-300 ${focusedPanel === "mindmap" ? "border-border/60 shadow-md ring-1 ring-black/[0.04]" : "border-border shadow-sm"}`}
            style={{ height: `${100 - summaryHeight}%` }}
            onClick={() => setFocusedPanel("mindmap")}
          >
            <MindMap />
          </div>
        </div>
      </div>

      {/* Mobile: stacked layout (no resizer) */}
      <div className="flex flex-1 flex-col gap-4 lg:hidden">
        <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
          <NetworkingChat />
        </div>
        <GroupMembersDropdown />
        <div className="overflow-auto rounded-xl border border-border bg-white p-4">
          <AISummaryPanel />
        </div>
        <div className="h-[300px] overflow-hidden rounded-xl border border-border bg-white p-4">
          <MindMap />
        </div>
      </div>
    </div>
  );
}
