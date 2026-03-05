"use client";

import { useNetworkingStore } from "@/lib/stores/networkingStore";
import { NetworkingGroupCard } from "./NetworkingGroupCard";
import { NetworkingSkeleton } from "@/components/skeletons/NetworkingSkeleton";

interface NetworkingGroupListProps {
  onGroupClick?: (groupId: string) => void;
}

export function NetworkingGroupList({ onGroupClick }: NetworkingGroupListProps) {
  const groups = useNetworkingStore((s) => s.groups);
  const groupsLoading = useNetworkingStore((s) => s.groupsLoading);
  const previewGroupId = useNetworkingStore((s) => s.previewGroupId);

  if (groupsLoading && groups.length === 0) {
    return <NetworkingSkeleton />;
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-medium text-foreground">No groups yet</p>
        <p className="text-xs text-muted-foreground">
          Create one to start networking!
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-wrap content-start gap-2 overflow-y-auto pr-1">
      {groups.map((group) => (
        <NetworkingGroupCard
          key={group.id}
          group={group}
          isSelected={group.id === previewGroupId}
          onSelect={() => onGroupClick?.(group.id)}
        />
      ))}
    </div>
  );
}
