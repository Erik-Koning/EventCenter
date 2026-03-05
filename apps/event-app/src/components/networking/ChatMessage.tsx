"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessageData {
  userName: string;
  content: string;
  isAiSummary: boolean;
  createdAt: string;
  editedAt?: string;
  userId?: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
  currentUserId?: string;
  onEdit?: (newContent: string) => Promise<void>;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessage({ message, currentUserId, onEdit }: ChatMessageProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOwnMessage = currentUserId && message.userId && message.userId === currentUserId;
  const canEdit = isOwnMessage && !message.isAiSummary && onEdit;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSave() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === message.content || !onEdit) {
      setEditing(false);
      setEditValue(message.content);
      return;
    }
    setSaving(true);
    try {
      await onEdit(trimmed);
      setEditing(false);
    } catch {
      // Keep editing open on failure
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditing(false);
      setEditValue(message.content);
    }
  }

  return (
    <div
      className={cn(
        "group flex gap-2.5",
        message.isAiSummary && "rounded-lg bg-primary/[0.03] p-2"
      )}
    >
      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {message.isAiSummary ? "AI" : getInitials(message.userName)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground">
            {message.isAiSummary ? "Sia" : message.userName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
          {message.editedAt && (
            <span className="text-[10px] text-muted-foreground italic">
              (edited)
            </span>
          )}
          {canEdit && !editing && (
            <button
              onClick={() => {
                setEditValue(message.content);
                setEditing(true);
              }}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Edit message"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Small delay so Enter can fire first
                setTimeout(() => {
                  if (!saving) {
                    setEditing(false);
                    setEditValue(message.content);
                  }
                }, 150);
              }}
              disabled={saving}
              maxLength={5000}
              className="flex-1 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-foreground/80 break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}
