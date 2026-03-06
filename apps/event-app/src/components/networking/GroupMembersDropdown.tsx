"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useNetworkingStore } from "@/lib/stores/networkingStore";

interface Member {
  id: string;
  name: string;
  initials: string | null;
}

export function GroupMembersDropdown() {
  const selectedGroupId = useNetworkingStore((s) => s.selectedGroupId);
  const groups = useNetworkingStore((s) => s.groups);
  const setChatDraft = useNetworkingStore((s) => s.setChatDraft);
  const group = groups.find((g) => g.id === selectedGroupId);

  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch members when dropdown opens
  useEffect(() => {
    if (!open || !selectedGroupId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/networking/groups/${selectedGroupId}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Member[]) => {
        if (active) setMembers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, selectedGroupId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleMemberClick(member: Member) {
    setChatDraft(`@${member.name} `);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/50"
      >
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        {group?.memberCount ?? 0}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-white py-1 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Loading...
            </p>
          ) : members.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No members
            </p>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleMemberClick(member)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-secondary/50"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {member.initials ?? member.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-foreground">{member.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
