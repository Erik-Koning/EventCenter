"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useNetworkingStore } from "@/lib/stores/networkingStore";
import { GroupFullLayout } from "@/components/networking/GroupFullLayout";

export default function NetworkingGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const selectGroup = useNetworkingStore((s) => s.selectGroup);
  const groups = useNetworkingStore((s) => s.groups);

  // Select group on mount, triggers WebSocket + polling via GroupFullLayout
  useEffect(() => {
    if (groupId) {
      // Fetch group detail to set isMember
      fetch(`/api/networking/groups/${groupId}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        })
        .then((data) => {
          useNetworkingStore.getState().setIsMember(data.isMember ?? false);
        })
        .catch(() => {});

      selectGroup(groupId);
    }
    return () => {
      selectGroup(null);
    };
  }, [groupId, selectGroup]);

  const group = groups.find((g) => g.id === groupId);

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/networking"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {group?.name ?? "Group"}
            </h1>
          </div>
        </div>
      </div>

      <GroupFullLayout />
    </>
  );
}
