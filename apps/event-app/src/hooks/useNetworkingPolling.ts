import { useEffect, useRef, useCallback } from "react";
import { WebPubSubClient } from "@azure/web-pubsub-client";
import {
  useNetworkingStore,
  type NetworkingMessage,
  type MindMapNode,
} from "@/lib/stores/networkingStore";
import { useEventStore } from "@/lib/stores/eventStore";

const GROUPS_POLL_MS = 30_000;
const MESSAGES_POLL_MS = 3_000;
const MINDMAP_POLL_MS = 5_000;

export function useNetworkingPolling() {
  const currentEvent = useEventStore((s) => s.currentEvent);
  const selectedGroupId = useNetworkingStore((s) => s.selectedGroupId);
  const isMember = useNetworkingStore((s) => s.isMember);
  const setGroups = useNetworkingStore((s) => s.setGroups);
  const setGroupsLoading = useNetworkingStore((s) => s.setGroupsLoading);
  const appendMessages = useNetworkingStore((s) => s.appendMessages);
  const setMessages = useNetworkingStore((s) => s.setMessages);
  const setMessagesLoading = useNetworkingStore((s) => s.setMessagesLoading);
  const setMindMapNodes = useNetworkingStore((s) => s.setMindMapNodes);
  const setMindMapLoading = useNetworkingStore((s) => s.setMindMapLoading);
  const addMindMapNode = useNetworkingStore((s) => s.addMindMapNode);
  const updateMindMapNode = useNetworkingStore((s) => s.updateMindMapNode);
  const removeMindMapNode = useNetworkingStore((s) => s.removeMindMapNode);
  const updateGroupMemberCount = useNetworkingStore((s) => s.updateGroupMemberCount);
  const updateGroupTopWords = useNetworkingStore((s) => s.updateGroupTopWords);
  const updateGroupInsights = useNetworkingStore((s) => s.updateGroupInsights);
  const setWsConnected = useNetworkingStore((s) => s.setWsConnected);

  const wsClientRef = useRef<WebPubSubClient | null>(null);
  const latestTimestampRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Poll groups list (unchanged — keep 30s polling)
  useEffect(() => {
    let active = true;

    async function fetchGroups() {
      if (!currentEvent?.id) {
        setGroups([]);
        setGroupsLoading(false);
        return;
      }
      try {
        setGroupsLoading(true);
        const res = await fetch(`/api/networking/groups?eventId=${currentEvent.id}`);
        if (res.ok && active) {
          const data = await res.json();
          setGroups(data);
        }
      } catch {
        // ignore
      } finally {
        if (active) setGroupsLoading(false);
      }
    }

    fetchGroups();
    const interval = setInterval(fetchGroups, GROUPS_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [setGroups, setGroupsLoading, currentEvent?.id]);

  // Reset state when group changes
  useEffect(() => {
    latestTimestampRef.current = null;
    initialLoadDoneRef.current = false;
  }, [selectedGroupId]);

  // Handle incoming PubSub event
  const handlePubSubEvent = useCallback(
    (event: { data: Record<string, unknown> }) => {
      const { type, data } = event.data as {
        type: string;
        data: Record<string, unknown>;
        group: string;
      };

      switch (type) {
        case "message:new": {
          const msg = data as unknown as NetworkingMessage;
          appendMessages([msg]);
          break;
        }
        case "insights:updated": {
          const { insights } = data as unknown as { insights: { title: string; description: string }[] };
          if (insights && selectedGroupId) {
            updateGroupInsights(selectedGroupId, insights);
          }
          break;
        }
        case "mindmap:node:add":
          addMindMapNode(data as unknown as MindMapNode);
          break;
        case "mindmap:node:update": {
          const node = data as unknown as MindMapNode;
          updateMindMapNode(node.id, node);
          break;
        }
        case "mindmap:node:delete":
          removeMindMapNode((data as unknown as { id: string }).id);
          break;
        case "member:join": {
          const join = data as unknown as { userId: string; memberCount: number };
          if (join.memberCount != null && selectedGroupId) {
            updateGroupMemberCount(selectedGroupId, join.memberCount);
          }
          break;
        }
        case "member:leave":
          // Re-fetch groups to get updated count
          if (currentEvent?.id) {
            fetch(`/api/networking/groups?eventId=${currentEvent.id}`)
              .then((r) => r.json())
              .then(setGroups)
              .catch(() => {});
          }
          break;
      }
    },
    [
      appendMessages,
      addMindMapNode,
      updateMindMapNode,
      removeMindMapNode,
      updateGroupMemberCount,
      updateGroupTopWords,
      updateGroupInsights,
      setGroups,
      selectedGroupId,
      currentEvent?.id,
    ]
  );

  // WebSocket + initial REST load for messages and mindmap
  useEffect(() => {
    if (!selectedGroupId) return;
    let active = true;
    let wsClient: WebPubSubClient | null = null;
    let msgPollInterval: ReturnType<typeof setInterval> | null = null;
    let mindmapPollInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchMessages() {
      try {
        if (!initialLoadDoneRef.current) setMessagesLoading(true);
        const afterParam = latestTimestampRef.current
          ? `?after=${encodeURIComponent(latestTimestampRef.current)}`
          : "";
        const res = await fetch(
          `/api/networking/groups/${selectedGroupId}/messages${afterParam}`
        );
        if (res.ok && active) {
          const data = await res.json();
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
        if (active) setMessagesLoading(false);
      }
    }

    async function fetchMindMap() {
      try {
        setMindMapLoading(true);
        const res = await fetch(
          `/api/networking/groups/${selectedGroupId}/mindmap`
        );
        if (res.ok && active) {
          const data = await res.json();
          setMindMapNodes(data);
        }
      } catch {
        // ignore
      } finally {
        if (active) setMindMapLoading(false);
      }
    }

    async function connectWebSocket() {
      try {
        const res = await fetch("/api/networking/pubsub/negotiate");
        if (!res.ok) {
          console.warn("[PubSub] Negotiate failed with status", res.status, "— falling back to polling");
          return false;
        }
        const { url } = await res.json();
        if (!url || !active) {
          console.warn("[PubSub] No WebSocket URL returned — falling back to polling");
          return false;
        }

        wsClient = new WebPubSubClient(url);
        wsClientRef.current = wsClient;

        wsClient.on("server-message", (e) => {
          handlePubSubEvent({ data: e.message.data as Record<string, unknown> });
        });

        wsClient.on("group-message", (e) => {
          handlePubSubEvent({ data: e.message.data as Record<string, unknown> });
        });

        wsClient.on("disconnected", () => {
          if (active) {
            console.warn("[PubSub] WebSocket disconnected");
            setWsConnected(false);
          }
        });

        wsClient.on("connected", () => {
          if (active) setWsConnected(true);
        });

        await wsClient.start();
        return true;
      } catch (err) {
        console.warn("[PubSub] WebSocket connection failed — falling back to polling", err);
        return false;
      }
    }

    function startPollingFallback() {
      console.warn("[PubSub] Using polling fallback for messages and mindmap");
      msgPollInterval = setInterval(fetchMessages, MESSAGES_POLL_MS);
      mindmapPollInterval = setInterval(fetchMindMap, MINDMAP_POLL_MS);
    }

    // Initial REST loads + WebSocket setup
    async function init() {
      // Do initial REST loads
      await Promise.all([fetchMessages(), fetchMindMap()]);
      if (!active) return;

      // Try WebSocket connection
      const connected = await connectWebSocket();
      if (!active) return;

      if (!connected) {
        startPollingFallback();
      }
    }

    init();

    return () => {
      active = false;
      if (msgPollInterval) clearInterval(msgPollInterval);
      if (mindmapPollInterval) clearInterval(mindmapPollInterval);
      if (wsClient) {
        wsClient.stop();
        wsClientRef.current = null;
      }
      setWsConnected(false);
    };
  }, [
    selectedGroupId,
    setMessages,
    appendMessages,
    setMessagesLoading,
    setMindMapNodes,
    setMindMapLoading,
    addMindMapNode,
    updateMindMapNode,
    removeMindMapNode,
    updateGroupMemberCount,
    updateGroupTopWords,
    setWsConnected,
    setGroups,
    handlePubSubEvent,
  ]);
}
