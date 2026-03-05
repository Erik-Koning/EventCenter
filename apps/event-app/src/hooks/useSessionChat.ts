import { useState, useEffect, useRef, useCallback } from "react";
import { WebPubSubClient } from "@azure/web-pubsub-client";

export interface SessionChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  content: string;
  isAiSummary: boolean;
  createdAt: string;
}

const POLL_MS = 3_000;

export function useSessionChat(sessionId: string) {
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const latestTimestampRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);
  // Track real IDs of messages we sent, so WS dedup works even before POST response replaces temp ID
  const sentIdsRef = useRef<Set<string>>(new Set());

  const appendMessages = useCallback((newMsgs: SessionChatMessage[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const unique = newMsgs.filter(
        (m) => !existingIds.has(m.id) && !sentIdsRef.current.has(m.id)
      );
      if (unique.length === 0) return prev;
      return [...prev, ...unique];
    });
  }, []);

  // Fetch + WebSocket + polling fallback
  useEffect(() => {
    let active = true;
    let wsClient: WebPubSubClient | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Reset state for new session
    setMessages([]);
    setLoading(true);
    latestTimestampRef.current = null;
    initialLoadDoneRef.current = false;

    async function fetchMessages() {
      try {
        if (!initialLoadDoneRef.current) setLoading(true);
        const afterParam = latestTimestampRef.current
          ? `?after=${encodeURIComponent(latestTimestampRef.current)}`
          : "";
        const res = await fetch(
          `/api/sessions/${sessionId}/chat${afterParam}`
        );
        if (res.ok && active) {
          const data: SessionChatMessage[] = await res.json();
          if (data.length > 0) {
            if (!initialLoadDoneRef.current) {
              setMessages(data);
              initialLoadDoneRef.current = true;
            } else {
              appendMessages(data);
            }
            const last = data[data.length - 1];
            if (last?.createdAt) latestTimestampRef.current = last.createdAt;
          } else if (!initialLoadDoneRef.current) {
            setMessages([]);
            initialLoadDoneRef.current = true;
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }

    async function connectWebSocket(): Promise<boolean> {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/chat/negotiate`
        );
        if (!res.ok) return false;
        const { url } = await res.json();
        if (!url || !active) return false;

        wsClient = new WebPubSubClient(url);

        wsClient.on("group-message", (e) => {
          const payload = e.message.data as Record<string, unknown>;
          if (payload.type === "message:new") {
            const msg = payload.data as unknown as SessionChatMessage;
            appendMessages([msg]);
          }
        });

        wsClient.on("server-message", (e) => {
          const payload = e.message.data as Record<string, unknown>;
          if (payload.type === "message:new") {
            const msg = payload.data as unknown as SessionChatMessage;
            appendMessages([msg]);
          }
        });

        wsClient.on("connected", () => {
          if (active) setWsConnected(true);
        });

        wsClient.on("disconnected", () => {
          if (active) {
            setWsConnected(false);
            // Start polling fallback on disconnect
            if (!pollInterval) {
              pollInterval = setInterval(fetchMessages, POLL_MS);
            }
          }
        });

        await wsClient.start();
        return true;
      } catch {
        return false;
      }
    }

    async function init() {
      await fetchMessages();
      if (!active) return;

      const connected = await connectWebSocket();
      if (!active) return;

      if (!connected) {
        pollInterval = setInterval(fetchMessages, POLL_MS);
      }
    }

    init();

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
      if (wsClient) {
        wsClient.stop();
      }
      setWsConnected(false);
    };
  }, [sessionId, appendMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      // Optimistic append
      const tempId = `temp-${Date.now()}`;
      const optimistic: SessionChatMessage = {
        id: tempId,
        sessionId,
        userId: "",
        userName: "You",
        content,
        isAiSummary: false,
        createdAt: new Date().toISOString(),
      };
      appendMessages([optimistic]);

      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const msg: SessionChatMessage = await res.json();
          // Track the real ID so WS dedup catches it
          sentIdsRef.current.add(msg.id);
          // Replace optimistic with real message (or drop temp if WS already delivered it)
          setMessages((prev) => {
            const wsAlreadyDelivered = prev.some((m) => m.id === msg.id);
            if (wsAlreadyDelivered) {
              // WS beat us — just remove the temp
              return prev.filter((m) => m.id !== tempId);
            }
            return prev.map((m) => (m.id === tempId ? msg : m));
          });
          if (msg.createdAt) {
            latestTimestampRef.current = msg.createdAt;
          }
          // Clean up after a short delay (WS event should have arrived by then)
          setTimeout(() => sentIdsRef.current.delete(msg.id), 5_000);
        } else {
          // Remove optimistic on failure
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [sessionId, appendMessages]
  );

  return { messages, loading, wsConnected, sendMessage };
}
