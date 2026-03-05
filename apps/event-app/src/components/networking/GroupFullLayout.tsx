"use client";

import { useState, useRef, useCallback, useEffect, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useNetworkingPolling } from "@/hooks/useNetworkingPolling";
import { NetworkingChat } from "./NetworkingChat";
import { AISummaryPanel } from "./AISummaryPanel";
import { MindMap } from "./MindMap";

type FocusedPanel = "chat" | "summary" | "mindmap" | null;

function ShimmerBorder({
  active,
  children,
  className,
  style,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("relative", className)}
      style={style}
      onClick={onClick}
    >
      {/* Shimmer border layer */}
      {active && (
        <div
          className="pointer-events-none absolute -inset-[1px] z-10 overflow-hidden rounded-xl"
          style={{
            "--speed": "3s",
            "--shimmer-color": "rgba(220, 38, 38, 0.4)",
            "--spread": "90deg",
          } as CSSProperties}
        >
          <div className="absolute inset-0 overflow-visible [container-type:size]">
            <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
              <div className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
            </div>
          </div>
          {/* Inner cutout to only show the border shimmer */}
          <div className="absolute inset-[2px] rounded-[10px] bg-white" />
        </div>
      )}
      {children}
    </div>
  );
}

export function GroupFullLayout() {
  useNetworkingPolling();

  const [leftWidth, setLeftWidth] = useState(40); // percentage
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
        <ShimmerBorder
          active={focusedPanel === "chat"}
          className="flex h-full flex-col transition-all duration-300"
          style={{ width: `${effectiveLeftWidth}%` }}
          onClick={() => setFocusedPanel("chat")}
        >
          <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
            <NetworkingChat />
          </div>
        </ShimmerBorder>

        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="flex w-2 flex-shrink-0 cursor-col-resize items-center justify-center"
        >
          <div className="h-8 w-1 rounded-full bg-border transition-colors hover:bg-primary/40" />
        </div>

        {/* Right: AI Summary + Mind Map */}
        <div
          className="flex h-full flex-1 flex-col gap-4 overflow-hidden transition-all duration-300"
        >
          <ShimmerBorder
            active={focusedPanel === "summary"}
            className="overflow-auto rounded-xl border border-border bg-white p-4 transition-all duration-300"
            style={{ height: `${summaryHeight}%` }}
            onClick={() => setFocusedPanel("summary")}
          >
            <AISummaryPanel />
          </ShimmerBorder>
          <ShimmerBorder
            active={focusedPanel === "mindmap"}
            className="overflow-hidden rounded-xl border border-border bg-white p-4 transition-all duration-300"
            style={{ height: `${100 - summaryHeight}%` }}
            onClick={() => setFocusedPanel("mindmap")}
          >
            <MindMap />
          </ShimmerBorder>
        </div>
      </div>

      {/* Mobile: stacked layout (no resizer) */}
      <div className="flex flex-1 flex-col gap-4 lg:hidden">
        <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
          <NetworkingChat />
        </div>
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
