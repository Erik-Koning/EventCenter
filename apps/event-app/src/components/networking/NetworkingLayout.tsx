"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useNetworkingStore } from "@/lib/stores/networkingStore";
import { useNetworkingPolling } from "@/hooks/useNetworkingPolling";
import { NetworkingGroupList } from "./NetworkingGroupList";
import { GroupPreviewPanel } from "./GroupPreviewPanel";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function NetworkingLayout() {
  const router = useRouter();
  const previewGroupId = useNetworkingStore((s) => s.previewGroupId);
  const setPreviewGroupId = useNetworkingStore((s) => s.setPreviewGroupId);
  const updateGroupMemberCount = useNetworkingStore((s) => s.updateGroupMemberCount);
  const groups = useNetworkingStore((s) => s.groups);
  const groupsLoading = useNetworkingStore((s) => s.groupsLoading);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [joining, setJoining] = useState(false);

  useNetworkingPolling();

  // Auto-select first group on desktop once groups load
  useEffect(() => {
    if (isDesktop && !previewGroupId && groups.length > 0 && !groupsLoading) {
      setPreviewGroupId(groups[0].id);
    }
  }, [isDesktop, previewGroupId, groups, groupsLoading, setPreviewGroupId]);

  const handleGroupClick = useCallback(
    async (groupId: string) => {
      if (joining) return;
      setJoining(true);
      try {
        const res = await fetch(`/api/networking/groups/${groupId}/members`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.memberCount != null) {
            updateGroupMemberCount(groupId, data.memberCount);
          }
        }
        // Navigate whether join succeeded or user was already a member
        setPreviewGroupId(null);
        router.push(`/networking/${groupId}`);
      } finally {
        setJoining(false);
      }
    },
    [joining, router, setPreviewGroupId, updateGroupMemberCount]
  );

  const handleGroupHoverStart = useCallback(
    (groupId: string) => {
      if (!isDesktop) return;
      setPreviewGroupId(groupId);
    },
    [isDesktop, setPreviewGroupId]
  );

  const handleGroupHoverEnd = useCallback(() => {
    // Don't close immediately — let the user move to the panel
  }, []);

  const showPanel = !!previewGroupId;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Group list — squishes when panel opens */}
      <div
        className={cn(
          "min-w-0 overflow-y-auto transition-all duration-300",
          showPanel ? "hidden lg:block lg:flex-1" : "w-full"
        )}
      >
        <NetworkingGroupList
          onGroupClick={handleGroupClick}
          onGroupHoverStart={handleGroupHoverStart}
          onGroupHoverEnd={handleGroupHoverEnd}
        />
      </div>

      {/* Inline preview panel — sits beside, no overlay */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            key="preview-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 480, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="h-full w-[480px]">
              <GroupPreviewPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
