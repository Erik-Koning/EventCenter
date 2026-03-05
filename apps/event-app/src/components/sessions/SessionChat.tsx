"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageSquare } from "lucide-react";
import { useSessionChat } from "@/hooks/useSessionChat";
import { ChatMessage } from "@/components/networking/ChatMessage";
import { SiaMentionPopover } from "@/components/chat/SiaMentionPopover";
import { useSiaMention } from "@/hooks/useSiaMention";
import { authClient } from "@/lib/auth-client";

interface SessionChatProps {
  sessionId: string;
}

const DEFAULT_HEIGHT = 250;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 600;

export function SessionChat({ sessionId }: SessionChatProps) {
  const { messages, loading, sendMessage, updateMessage } = useSessionChat(sessionId);
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const [input, setInput] = useState("");
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const sia = useSiaMention(input, inputRef.current);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Drag-resize (top edge)
  const handleResizeDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: height };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dy = dragRef.current.startY - ev.clientY;
        setHeight(
          Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startH + dy))
        );
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    sendMessage(trimmed);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Let Sia mention popover handle first
      const handled = sia.handleKeyDown(e);
      if (handled) {
        if (typeof handled === "string") {
          setInput(handled);
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [sia, handleSend]
  );

  return (
    <div className="mt-auto pt-8 flex w-full">
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-xl border bg-background"
        style={{ height }}
      >
        {/* Top resize handle */}
        <div
          onMouseDown={handleResizeDown}
          className="flex h-5 w-full cursor-ns-resize items-center justify-center border-b bg-muted/30 hover:bg-muted/50 transition-colors"
          title="Drag to resize"
        >
          <div className="h-0.5 w-8 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Discussion
          </span>
          <span className="text-xs text-muted-foreground">
            ({messages.length})
          </span>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {loading && messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              Loading messages...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              No messages yet. Start the discussion!
            </p>
          ) : (
            messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={{
                  userName: msg.userName,
                  content: msg.content,
                  isAiSummary: msg.isAiSummary,
                  createdAt: msg.createdAt,
                  editedAt: msg.editedAt,
                  userId: msg.userId,
                }}
                currentUserId={currentUserId}
                onEdit={async (newContent) => {
                  const res = await fetch(`/api/sessions/${sessionId}/chat`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId: msg.id, content: newContent }),
                  });
                  if (!res.ok) throw new Error("Failed to edit");
                  const data = await res.json();
                  updateMessage(msg.id, newContent, data.updatedAt);
                }}
              />
            ))
          )}
        </div>

        {/* Input */}
        <div className="relative border-t px-3 py-2">
          {sia.isOpen && (
            <SiaMentionPopover
              options={sia.options}
              selectedIndex={sia.selectedIndex}
              onSelect={(i) => {
                const result = sia.selectOption(i);
                if (typeof result === "string") {
                  setInput(result);
                }
                inputRef.current?.focus();
              }}
            />
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (@ to mention Sia)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
