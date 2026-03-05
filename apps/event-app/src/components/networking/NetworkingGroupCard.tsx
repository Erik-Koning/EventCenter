"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NetworkingGroup } from "@/lib/stores/networkingStore";

interface NetworkingGroupCardProps {
  group: NetworkingGroup;
  isSelected: boolean;
  onSelect: () => void;
}

export function NetworkingGroupCard({
  group,
  isSelected,
  onSelect,
}: NetworkingGroupCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-[220px] flex-col rounded-xl border border-border bg-white p-4 text-left transition-all duration-150",
        isSelected
          ? "border-primary/30 bg-primary/[0.03] shadow-sm"
          : "hover:border-border/60 hover:shadow-sm"
      )}
    >
      <h3 className="text-sm font-semibold text-foreground truncate">
        {group.name}
      </h3>

      {group.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {group.description}
        </p>
      )}

      {/* Insight badges */}
      {group.insights && group.insights.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {group.insights.slice(0, 5).map((insight, i) => (
            <span
              key={`${insight.title}-${i}`}
              title={insight.description}
              className="inline-flex rounded-full bg-primary/[0.06] px-2 py-0.5 text-[10px] font-medium text-primary cursor-default"
            >
              {insight.title}
            </span>
          ))}
        </div>
      )}

      {/* Footer: member count + creator */}
      <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {group.memberCount}
        </span>
        <span className="truncate ml-2">by {group.creatorName}</span>
      </div>
    </button>
  );
}
