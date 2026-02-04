"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useVoiceChat } from "@/src/hooks/useVoiceChat";
import { VoiceChatInput, VoiceCountdown } from "@/src/components/chat/VoiceChatInput";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface EventChatPanelProps {
  onEventsCreated: () => void;
}

export default function EventChatPanel({
  onEventsCreated,
}: EventChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stable ref for sessionId needed in voice auto-send callback
  const sessionIdRef = useRef(sessionId);

  // Ref for speakText to break circular dependency between sendMessage and voice
  const speakTextRef = useRef<(text: string) => void>(() => {});

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string, isVoice: boolean) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/updates/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message: text,
          updatePeriod: "event_chat",
          periodDate: new Date().toISOString().split("T")[0],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.assistant_message,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Speak response if this was a voice input
      if (isVoice && data.assistant_message) {
        speakTextRef.current(data.assistant_message);
      }

      if (data.saved || data.isEventResponse) {
        onEventsCreated();
      }
    } catch (error) {
      console.error("Event chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [onEventsCreated]);

  // Ref to keep sendMessage current for voice auto-send
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const voice = useVoiceChat({
    onAutoSend: useCallback((text: string) => {
      sendMessageRef.current(text, true);
    }, []),
    onTranscript: useCallback((text: string) => {
      setInput((prev) => prev + (prev ? " " : "") + text);
    }, []),
  });

  // Keep speakText ref current
  useEffect(() => { speakTextRef.current = voice.speakText; }, [voice.speakText]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    voice.markLastInputAsManual();
    await sendMessage(trimmed, false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Event Assistant</h3>
        <p className="text-xs text-muted-foreground">
          Create events with natural language
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8 space-y-2">
            <p>Try something like:</p>
            <div className="space-y-1 text-xs">
              <p className="italic">&quot;Schedule a team standup tomorrow at 10am&quot;</p>
              <p className="italic">&quot;Book me out of office next Friday&quot;</p>
              <p className="italic">&quot;Set up a weekly team sync every Monday at 2pm&quot;</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Voice countdown overlay */}
        <VoiceCountdown
          countdownActive={voice.countdownActive}
          countdownSeconds={voice.countdownSeconds}
        />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <VoiceChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          voice={voice}
          minHeight="44px"
          rows={1}
          placeholder="Describe an event to create..."
        />
      </div>
    </div>
  );
}
