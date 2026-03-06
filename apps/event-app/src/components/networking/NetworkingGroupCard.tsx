"use client";

import { useState } from "react";
import { Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@common/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@common/components/ui/dialog";
import type { NetworkingGroup } from "@/lib/stores/networkingStore";
import { useNetworkingStore } from "@/lib/stores/networkingStore";

interface NetworkingGroupCardProps {
  group: NetworkingGroup;
  isSelected: boolean;
  isAdmin?: boolean;
  onSelect: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export function NetworkingGroupCard({
  group,
  isSelected,
  isAdmin,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: NetworkingGroupCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeGroup = useNetworkingStore((s) => s.removeGroup);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/networking/groups/${group.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        removeGroup(group.id);
        setConfirmOpen(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={onSelect}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        className={cn(
          "group/card relative flex w-[220px] flex-col rounded-xl border border-border bg-white p-4 text-left transition-all duration-150",
          isSelected
            ? "border-primary/30 bg-primary/[0.03] shadow-sm"
            : "hover:border-border/60 hover:shadow-sm"
        )}
      >
        {/* Admin delete button */}
        {isAdmin && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                setConfirmOpen(true);
              }
            }}
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/card:opacity-100"
            title="Delete group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </div>
        )}

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

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{group.name}&rdquo;? This will remove all messages, members, and mind map data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
