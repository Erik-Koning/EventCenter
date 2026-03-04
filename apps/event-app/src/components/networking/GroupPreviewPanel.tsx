"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, LogIn, ExternalLink, Users, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkingStore, type MindMapNode, type NetworkingMessage } from "@/lib/stores/networkingStore";
import { ChatMessage } from "./ChatMessage";

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  topWords: string[];
  memberCount: number;
  isMember: boolean;
  creatorName: string;
}

export function GroupPreviewPanel() {
  const router = useRouter();
  const previewGroupId = useNetworkingStore((s) => s.previewGroupId);
  const previewIsMember = useNetworkingStore((s) => s.previewIsMember);
  const setPreviewGroupId = useNetworkingStore((s) => s.setPreviewGroupId);
  const setPreviewIsMember = useNetworkingStore((s) => s.setPreviewIsMember);
  const updateGroupMemberCount = useNetworkingStore((s) => s.updateGroupMemberCount);
  const groups = useNetworkingStore((s) => s.groups);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mindMapNodes, setMindMapNodes] = useState<MindMapNode[]>([]);
  const [previewMessages, setPreviewMessages] = useState<NetworkingMessage[]>([]);
  const [joining, setJoining] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch group detail
  useEffect(() => {
    if (!previewGroupId) return;
    let active = true;
    setLoading(true);
    setDetail(null);
    setMindMapNodes([]);
    setPreviewMessages([]);

    fetch(`/api/networking/groups/${previewGroupId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data: GroupDetail) => {
        if (!active) return;
        setDetail(data);
        setPreviewIsMember(data.isMember);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [previewGroupId, setPreviewIsMember]);

  // Fetch mind map nodes for preview
  useEffect(() => {
    if (!previewGroupId) return;
    let active = true;
    fetch(`/api/networking/groups/${previewGroupId}/mindmap`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active) setMindMapNodes(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [previewGroupId]);

  // Fetch last messages if member
  useEffect(() => {
    if (!previewGroupId || !previewIsMember) return;
    let active = true;
    fetch(`/api/networking/groups/${previewGroupId}/messages`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NetworkingMessage[]) => {
        if (active) {
          setPreviewMessages(data.slice(-5));
          // Scroll to bottom
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [previewGroupId, previewIsMember]);

  async function handleJoin() {
    if (!previewGroupId) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/networking/groups/${previewGroupId}/members`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.memberCount != null) {
          updateGroupMemberCount(previewGroupId, data.memberCount);
        }
        setPreviewGroupId(null);
        router.push(`/networking/${previewGroupId}`);
      } else if (res.status === 400) {
        // Already a member
        setPreviewGroupId(null);
        router.push(`/networking/${previewGroupId}`);
      }
    } finally {
      setJoining(false);
    }
  }

  async function handleSendPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !previewGroupId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/networking/groups/${previewGroupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chatInput.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setPreviewMessages((prev) => [...prev.slice(-4), msg]);
        setChatInput("");
      }
    } finally {
      setSending(false);
    }
  }

  if (!previewGroupId) return null;

  const group = groups.find((g) => g.id === previewGroupId);

  // Mind map SVG viewBox
  const svgViewBox = (() => {
    if (mindMapNodes.length === 0) return { x: -200, y: -150, w: 400, h: 300 };
    const padding = 100;
    const xs = mindMapNodes.map((n) => n.positionX);
    const ys = mindMapNodes.map((n) => n.positionY);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    return { x: minX, y: minY, w: Math.max(maxX - minX, 300), h: Math.max(maxY - minY, 200) };
  })();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setPreviewGroupId(null)}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold text-foreground truncate">
            {loading ? "Loading..." : detail?.name ?? group?.name ?? "Group"}
          </h3>
        </div>
        {!loading && (
          previewIsMember ? (
            <Button
              size="sm"
              onClick={() => {
                setPreviewGroupId(null);
                router.push(`/networking/${previewGroupId}`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
          ) : (
            <Button size="sm" onClick={handleJoin} disabled={joining}>
              {joining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              Join
            </Button>
          )
        )}
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Info section */}
            <div className="px-4 py-3 space-y-3">
              {detail?.description && (
                <p className="text-xs text-muted-foreground">{detail.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {detail?.memberCount ?? 0} members
                </span>
                {detail?.creatorName && (
                  <span>Created by {detail.creatorName}</span>
                )}
              </div>

              {/* Topic word badges */}
              {detail?.topWords && detail.topWords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.topWords.slice(0, 8).map((word) => (
                    <span
                      key={word}
                      className="inline-flex rounded-full bg-primary/[0.06] px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Mind map preview */}
            <div className="border-t border-border px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold text-foreground">Mind Map</h4>
              <div className="h-[180px] overflow-hidden rounded-lg border border-border/50 bg-secondary/30">
                {mindMapNodes.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-[11px] text-muted-foreground">No mind map nodes yet</p>
                  </div>
                ) : (
                  <svg
                    viewBox={`${svgViewBox.x} ${svgViewBox.y} ${svgViewBox.w} ${svgViewBox.h}`}
                    className="h-full w-full"
                  >
                    {/* Edges */}
                    {mindMapNodes
                      .filter((n) => n.parentId)
                      .map((node) => {
                        const parent = mindMapNodes.find((p) => p.id === node.parentId);
                        if (!parent) return null;
                        return (
                          <line
                            key={`edge-${node.id}`}
                            x1={parent.positionX}
                            y1={parent.positionY}
                            x2={node.positionX}
                            y2={node.positionY}
                            stroke="var(--border)"
                            strokeWidth="2"
                          />
                        );
                      })}
                    {/* Nodes */}
                    {mindMapNodes.map((node) => (
                      <g key={node.id}>
                        <circle
                          cx={node.positionX}
                          cy={node.positionY}
                          r={node.parentId ? 30 : 40}
                          fill={node.parentId ? "white" : "rgba(220, 38, 38, 0.06)"}
                          stroke="var(--border)"
                          strokeWidth="1"
                        />
                        <text
                          x={node.positionX}
                          y={node.positionY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="select-none pointer-events-none"
                          fill="var(--foreground)"
                          fontSize={node.parentId ? 9 : 11}
                          fontWeight={node.parentId ? 400 : 600}
                        >
                          {node.label.length > 16
                            ? node.label.slice(0, 14) + "..."
                            : node.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>

            {/* Chat preview messages */}
            <div className="border-t border-border px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold text-foreground">Chat</h4>
              {previewIsMember ? (
                <div
                  ref={scrollRef}
                  className="max-h-[200px] space-y-2 overflow-y-auto"
                >
                  {previewMessages.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No messages yet — say hello!
                    </p>
                  ) : (
                    previewMessages.map((msg) => (
                      <ChatMessage key={msg.id} message={msg} />
                    ))
                  )}
                </div>
              ) : (
                <div className="flex h-16 items-center justify-center rounded-lg bg-secondary/30">
                  <p className="text-[11px] text-muted-foreground">
                    Join to see chat messages
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Chat input — pinned at bottom */}
      {previewIsMember && (
        <form
          onSubmit={handleSendPreview}
          className="flex items-center gap-2 border-t border-border px-4 py-3"
        >
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={5000}
            className="flex-1 rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <Button
            type="submit"
            size="icon"
            className="h-7 w-7"
            disabled={!chatInput.trim() || sending}
          >
            <Send className="h-3 w-3" />
          </Button>
        </form>
      )}
    </div>
  );
}
