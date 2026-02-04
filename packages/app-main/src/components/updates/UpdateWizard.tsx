"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@common/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { ExtractedActivitiesPreview, type ExtractedActivity } from "./ExtractedActivitiesPreview";
import { IconLoader2, IconCheck, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/src/lib/utils";
import { toast } from "@common/components/ui/sonner";
import { useVoiceChat } from "@/src/hooks/useVoiceChat";
import { VoiceChatInput, VoiceCountdown } from "@/src/components/chat/VoiceChatInput";

type UpdatePeriod = "morning" | "afternoon" | "evening" | "full_day";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UpdateWizardProps {
  className?: string;
  onDateChange?: (date: string) => void;
  initialSessionId?: string | null;
}

export function UpdateWizard({ className, onDateChange, initialSessionId }: UpdateWizardProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [updatePeriod, setUpdatePeriod] = useState<UpdatePeriod>("full_day");
  const [periodDate, setPeriodDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedActivities, setExtractedActivities] = useState<ExtractedActivity[]>([]);
  const [rawSummary, setRawSummary] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stable refs for values needed in voice auto-send callback
  const sessionIdRef = useRef(sessionId);
  const updatePeriodRef = useRef(updatePeriod);
  const periodDateRef = useRef(periodDate);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { updatePeriodRef.current = updatePeriod; }, [updatePeriod]);
  useEffect(() => { periodDateRef.current = periodDate; }, [periodDate]);

  // Ref for speakText to break circular dependency between onAutoSend and voice
  const speakTextRef = useRef<(text: string) => void>(() => {});

  const handleChatResponse = useCallback((data: {
    assistant_message: string;
    saved?: boolean;
    extractedActivities?: ExtractedActivity[];
    raw_summary?: string;
    needs_clarification?: boolean;
    activities?: { activity_type: string; quantity: number; summary: string; activity_date: string }[];
    error?: string;
    isEventResponse?: boolean;
  }) => {
    setMessages((prev) => [...prev, { role: "assistant", content: data.assistant_message }]);

    // Calendar sub-agent responses: the assistant message already contains
    // a friendly summary. No special UI needed — just show the chat message.
    if (data.isEventResponse) {
      return;
    }

    if (data.saved && data.extractedActivities?.length) {
      setExtractedActivities(
        data.extractedActivities.map((a: ExtractedActivity) => ({
          ...a,
          activityType: a.activityType,
        }))
      );
      setRawSummary(data.raw_summary || "");
      setIsSaved(true);
    } else if (!data.needs_clarification && data.activities?.length) {
      setExtractedActivities(
        data.activities.map((a, i) => ({
          id: `temp-${i}`,
          activityType: a.activity_type,
          quantity: a.quantity,
          summary: a.summary,
          activityDate: a.activity_date,
        }))
      );
      setRawSummary(data.raw_summary || "");
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Note: ${data.error}. The activities were extracted but not saved.` },
        ]);
      }
    }
  }, []);

  const voice = useVoiceChat({
    onAutoSend: useCallback((text: string) => {
      setInputValue("");
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setIsLoading(true);

      fetch("/api/updates/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message: text,
          updatePeriod: updatePeriodRef.current,
          periodDate: periodDateRef.current,
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            const errorMessage = data?.message || "Failed to send message";
            toast({ title: "Error", message: errorMessage, type: "error" });
            throw new Error(errorMessage);
          }
          return data;
        })
        .then((data) => {
          handleChatResponse(data);
          if (data.assistant_message) {
            speakTextRef.current(data.assistant_message);
          }
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, something went wrong. Please try again." },
          ]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleChatResponse]),
    onTranscript: useCallback((text: string) => {
      setInputValue((prev) => prev + (prev ? " " : "") + text);
    }, []),
  });

  // Keep speakText ref current
  useEffect(() => { speakTextRef.current = voice.speakText; }, [voice.speakText]);

  // Track if we've initialized to prevent infinite loops from URL updates
  const hasInitializedRef = useRef(false);

  // Update URL with session ID (without triggering navigation)
  const updateUrlWithSession = useCallback((newSessionId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("session", newSessionId);
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Initialize client-side values after hydration (runs once)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initSession = async () => {
      // Try to load existing session if initialSessionId provided
      if (initialSessionId) {
        try {
          const response = await fetch(`/api/updates/sessions?sessionId=${encodeURIComponent(initialSessionId)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.session) {
              setSessionId(data.session.sessionId);
              setPeriodDate(data.session.periodDate);
              onDateChange?.(data.session.periodDate);
              setUpdatePeriod(data.session.updatePeriod);
              setSessionStartedAt(new Date(data.session.startedAt));

              if (data.session.messages.length > 0) {
                setMessages(data.session.messages.map((m: { role: "user" | "assistant"; content: string }) => ({
                  role: m.role,
                  content: m.content,
                })));
              } else {
                setMessages([{
                  role: "assistant",
                  content: "Hi there! Tell me about what you accomplished today. I'll help you track your activities like experiments, mentoring sessions, presentations, learning, and more. Be as specific as you can!",
                }]);
              }

              if (data.session.extractedActivities?.length > 0) {
                setExtractedActivities(data.session.extractedActivities);
                setIsSaved(true);
              }

              setIsHydrated(true);
              return;
            }
          }
        } catch (error) {
          console.error("Failed to load session:", error);
        }
      }

      // No existing session or load failed - create new session
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setSessionId(newSessionId);
      updateUrlWithSession(newSessionId);
      setSessionStartedAt(new Date());

      const today = new Date().toISOString().split("T")[0];
      setPeriodDate(today);
      onDateChange?.(today);
      setMessages([
        {
          role: "assistant",
          content: "Hi there! Tell me about what you accomplished today. I'll help you track your activities like experiments, mentoring sessions, presentations, learning, and more. Be as specific as you can!",
        },
      ]);
      setIsHydrated(true);
    };

    initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Cancel any active voice countdown to prevent duplicate sends
    voice.cancelCountdown();
    // Mark that this input was manual (don't auto-restart listening after TTS)
    voice.markLastInputAsManual();

    const userMessage = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/updates/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
          updatePeriod,
          periodDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || "Failed to send message";
        toast({ title: "Error", message: errorMessage, type: "error" });
        throw new Error(errorMessage);
      }

      handleChatResponse(data);

      // Speak the assistant's response if TTS is enabled
      if (data.assistant_message) {
        voice.speakText(data.assistant_message);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = async () => {
    await fetch(`/api/updates/chat?sessionId=${sessionId}`, { method: "DELETE" }).catch(() => {});

    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSessionId(newSessionId);
    updateUrlWithSession(newSessionId);
    setSessionStartedAt(new Date());

    setMessages([
      {
        role: "assistant",
        content: "Hi there! Tell me about what you accomplished today. I'll help you track your activities like experiments, mentoring sessions, presentations, learning, and more. Be as specific as you can!",
      },
    ]);
    setExtractedActivities([]);
    setRawSummary("");
    setIsSaved(false);
  };

  const handleDone = () => {
    router.push("/home");
  };

  // Show loading state until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <div className={cn("max-w-2xl mx-auto", className)}>
        <Card className="mb-4">
          <CardContent className="py-3 px-4">
            <div className="h-8 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if session is within 12 hours (can continue chatting)
  const canContinueChat = sessionStartedAt
    ? (Date.now() - sessionStartedAt.getTime()) < 12 * 60 * 60 * 1000
    : true;

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      {/* Settings bar */}
      <Card className="mb-4">
        <CardContent className="px-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Date:</label>
              <input
                type="date"
                value={periodDate}
                onChange={(e) => {
                  setPeriodDate(e.target.value);
                  onDateChange?.(e.target.value);
                }}
                disabled={isSaved}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Period:</label>
              <Select
                value={updatePeriod}
                onValueChange={(v) => setUpdatePeriod(v as UpdatePeriod)}
                disabled={isSaved}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="full_day">Full Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isSaved && (
              <Button variant="outline" size="sm" onClick={handleNewSession} className="ml-auto gap-2">
                <IconRefresh className="h-4 w-4" />
                New Update
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="mb-4">
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-4 relative">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "text-sm prose prose-sm max-w-none",
                      message.role === "user"
                        ? "prose-invert"
                        : "prose-neutral dark:prose-invert",
                      "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                      "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5",
                      "[&_strong]:font-semibold [&_code]:bg-black/10 [&_code]:px-1 [&_code]:rounded"
                    )}
                  >
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
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

          {/* Input area - available if session is within 12 hours */}
          {canContinueChat && (
            <div className="border-t p-4">
              <VoiceChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSendMessage}
                isLoading={isLoading}
                placeholder="Describe what you did today..."
                voice={voice}
                showRotatingBorder
                minHeight="80px"
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted activities preview */}
      {extractedActivities.length > 0 && (
        <div className="space-y-4">
          <ExtractedActivitiesPreview
            activities={extractedActivities}
            rawSummary={rawSummary}
          />

          {isSaved && canContinueChat && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleNewSession} className="gap-2">
                <IconRefresh className="h-4 w-4" />
                Add Another Update
              </Button>
              <Button onClick={handleDone} className="gap-2">
                <IconCheck className="h-4 w-4" />
                Done
              </Button>
            </div>
          )}
          {!canContinueChat && (
            <div className="flex justify-between">
              <p className="text-sm text-muted-foreground">
                This session has expired. Start a new session to add more activities.
              </p>
              <Button onClick={handleNewSession} className="gap-2">
                <IconRefresh className="h-4 w-4" />
                Start New Session
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
