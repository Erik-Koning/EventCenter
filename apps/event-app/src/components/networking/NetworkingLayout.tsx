"use client";

import { useCallback } from "react";
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
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useNetworkingPolling();

  const handleGroupClick = useCallback(
    (groupId: string) => {
      if (!isDesktop) {
        router.push(`/networking/${groupId}`);
        return;
      }
      setPreviewGroupId(previewGroupId === groupId ? null : groupId);
    },
    [isDesktop, router, setPreviewGroupId, previewGroupId]
  );

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
        <NetworkingGroupList onGroupClick={handleGroupClick} />
      </div>

      {/* Inline preview panel — sits beside, no overlay */}
      <AnimatePresence mode="wait">
        {showPanel && (
          <motion.div
            key={previewGroupId}
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
