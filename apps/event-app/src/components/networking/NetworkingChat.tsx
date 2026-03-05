"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, LogIn, LogOut as LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkingStore } from "@/lib/stores/networkingStore";
import { ChatMessage } from "./ChatMessage";
import { useSiaMention } from "@/hooks/useSiaMention";
import { SiaMentionPopover } from "@/components/chat/SiaMentionPopover";
import { authClient } from "@/lib/auth-client";

interface NetworkingChatProps {
  showJoinButton?: boolean;
}

export function NetworkingChat({ showJoinButton = true }: NetworkingChatProps) {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const selectedGroupId = useNetworkingStore((s) => s.selectedGroupId);
  const messages = useNetworkingStore((s) => s.messages);
  const updateMessage = useNetworkingStore((s) => s.updateMessage);
  const isMember = useNetworkingStore((s) => s.isMember);
  const setIsMember = useNetworkingStore((s) => s.setIsMember);
  const appendMessages = useNetworkingStore((s) => s.appendMessages);
  const updateGroupTopWords = useNetworkingStore((s) => s.updateGroupTopWords);
  const updateGroupMemberCount = useNetworkingStore((s) => s.updateGroupMemberCount);
  const groups = useNetworkingStore((s) => s.groups);
  const hasInsights = (groups.find((g) => g.id === selectedGroupId)?.insights ?? []).length > 0;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);

  const group = groups.find((g) => g.id === selectedGroupId);

  const sia = useSiaMention(input, chatInputRef.current);

  const handleSiaKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const result = sia.handleKeyDown(e);
      if (typeof result === "string") {
        setInput(result);
      }
    },
    [sia]
  );

  const handleSiaSelect = useCallback(
    (index: number) => {
      const result = sia.selectOption(index);
      if (typeof result === "string") {
        setInput(result);
        chatInputRef.current?.focus();
      }
    },
    [sia]
  );

  // Track if user is scrolled to bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedGroupId || sending) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/networking/groups/${selectedGroupId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input.trim() }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        appendMessages([data]);
        if (data.topWords) {
          updateGroupTopWords(selectedGroupId, data.topWords);
        }
        setInput("");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleJoinLeave() {
    if (!selectedGroupId) return;
    setJoining(true);
    try {
      const method = isMember ? "DELETE" : "POST";
      const res = await fetch(
        `/api/networking/groups/${selectedGroupId}/members`,
        { method }
      );
      if (res.ok) {
        setIsMember(!isMember);
        const data = await res.json();
        if (data.memberCount != null) {
          updateGroupMemberCount(selectedGroupId, data.memberCount);
        } else {
          const current = group?.memberCount ?? 0;
          updateGroupMemberCount(
            selectedGroupId,
            isMember ? Math.max(current - 1, 0) : current + 1
          );
        }
      } else if (res.status === 400 && method === "POST") {
        // Already a member — sync UI state
        setIsMember(true);
      } else if (res.status === 400 && method === "DELETE") {
        // Not a member — sync UI state
        setIsMember(false);
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {group?.name ?? "Chat"}
        </h3>
        {showJoinButton && (
          <Button
            variant={isMember ? "outline" : "default"}
            size="sm"
            onClick={handleJoinLeave}
            disabled={joining}
          >
            {isMember ? (
              <>
                <LogOutIcon className="h-3.5 w-3.5" />
                Leave
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5" />
                Join
              </>
            )}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {!isMember ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Join this group to see messages and chat
            </p>
          </div>
        ) : messages.length === 0 && !hasInsights ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No messages yet — say hello!
            </p>
          </div>
        ) : messages.length === 0 ? null : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              onEdit={async (newContent) => {
                const res = await fetch(
                  `/api/networking/groups/${selectedGroupId}/messages`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId: msg.id, content: newContent }),
                  }
                );
                if (!res.ok) throw new Error("Failed to edit");
                const data = await res.json();
                updateMessage(msg.id, { content: newContent, editedAt: data.updatedAt });
              }}
            />
          ))
        )}
      </div>

      {/* Input */}
      {isMember && (
        <form
          onSubmit={handleSend}
          className="relative flex items-center gap-2 border-t border-border px-4 py-3"
        >
          {sia.isOpen && (
            <SiaMentionPopover
              options={sia.options}
              selectedIndex={sia.selectedIndex}
              onSelect={handleSiaSelect}
            />
          )}
          <input
            ref={chatInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleSiaKeyDown}
            placeholder="Type a message..."
            maxLength={5000}
            className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
