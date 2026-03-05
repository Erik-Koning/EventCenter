"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { MessageCircle, X, Minus, Trash2, Send, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useChatStore, type WidgetState } from "@/lib/stores/chatStore";

const ANIMATION = { duration: 0.25, ease: "easeOut" as const };

/** Lightweight markdown: **bold**, *italic*, `code`, and bullet lists */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Bullet list item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-1.5 pl-1">
          <span className="text-muted-foreground select-none">&#8226;</span>
          <span>{formatInline(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Header (### or ##)
    if (trimmed.startsWith("### ")) {
      elements.push(<div key={i} className="font-semibold mt-1">{formatInline(trimmed.slice(4))}</div>);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(<div key={i} className="font-semibold mt-1">{formatInline(trimmed.slice(3))}</div>);
      continue;
    }

    // Empty line = paragraph break
    if (!trimmed) {
      if (i > 0 && i < lines.length - 1) {
        elements.push(<div key={i} className="h-1.5" />);
      }
      continue;
    }

    elements.push(<div key={i}>{formatInline(line)}</div>);
  }

  return elements;
}

/** Inline formatting: **bold**, *italic*, `code` */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="rounded bg-foreground/10 px-1 py-0.5 text-[0.85em]">
          {match[4]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function ChatWidget() {
  const {
    messages,
    widgetState,
    isLoading,
    error,
    setWidgetState,
    sendMessage,
    clearChat,
  } = useChatStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (widgetState === "expanded") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, widgetState]);

  // Focus input when expanding
  useEffect(() => {
    if (widgetState === "expanded" || widgetState === "hover") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [widgetState]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput("");
      sendMessage(trimmed);
    },
    [input, isLoading, sendMessage]
  );

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Only hover-expand if collapsed — check supports hover (non-touch)
    if (widgetState === "collapsed" && window.matchMedia("(hover: hover)").matches) {
      setWidgetState("hover");
    }
  }, [widgetState, setWidgetState]);

  const handleMouseLeave = useCallback(() => {
    if (widgetState === "hover") {
      hoverTimeoutRef.current = setTimeout(() => {
        const state = useChatStore.getState();
        if (state.widgetState === "hover") {
          setWidgetState("collapsed");
        }
      }, 300);
    }
  }, [widgetState, setWidgetState]);

  const handleFabClick = useCallback(() => {
    if (widgetState === "collapsed") {
      setWidgetState("hover");
    }
  }, [widgetState, setWidgetState]);

  const recentMessages = messages.slice(-3);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="wait">
        {widgetState === "collapsed" && (
          <motion.button
            key="fab"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={ANIMATION}
            onClick={handleFabClick}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            aria-label="Open chat"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}

        {widgetState === "hover" && (
          <motion.div
            key="hover"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={ANIMATION}
            className="flex w-80 flex-col overflow-hidden rounded-2xl bg-background shadow-xl border"
            style={{ height: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Event Assistant</span>
              <button
                onClick={() => setWidgetState("collapsed")}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message preview */}
            <div className="flex-1 overflow-hidden px-4 py-2">
              {recentMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-2">
                  Ask me about the event agenda, speakers, or discussions.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-xs leading-relaxed ${
                        msg.role === "user" ? "text-right" : "text-left text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`inline-block max-w-[90%] rounded-lg px-2 py-1 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.content.length > 80
                          ? msg.content.slice(0, 80) + "..."
                          : msg.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t px-3 py-2">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="rounded-lg bg-primary p-1.5 text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {widgetState === "expanded" && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={ANIMATION}
            className="flex w-[400px] flex-col overflow-hidden rounded-2xl bg-background shadow-xl border"
            style={{ height: 520 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Event Assistant</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setWidgetState("collapsed")}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Minimize"
                  title="Minimize"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center pt-8">
                  Ask me about the event agenda, speakers, sessions, or what people are discussing.
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" && !msg.content ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Thinking...</span>
                      </div>
                    ) : msg.role === "assistant" ? (
                      renderMarkdown(msg.content)
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {error && (
                <div className="text-center text-xs text-destructive py-1">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
