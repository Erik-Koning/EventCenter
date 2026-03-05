import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type WidgetState = "collapsed" | "hover" | "expanded";

interface ChatState {
  messages: ChatMessage[];
  widgetState: WidgetState;
  isLoading: boolean;
  error: string | null;

  setWidgetState: (state: WidgetState) => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  widgetState: "collapsed",
  isLoading: false,
  error: null,

  setWidgetState: (widgetState) => set({ widgetState }),

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const assistantId = crypto.randomUUID();

    set((state) => ({
      messages: [
        ...state.messages,
        userMessage,
        // Placeholder for streaming assistant message
        {
          id: assistantId,
          role: "assistant" as const,
          content: "",
          createdAt: new Date().toISOString(),
        },
      ],
      widgetState: "expanded",
      isLoading: true,
      error: null,
    }));

    try {
      const { messages } = get();
      // Exclude the empty placeholder from history
      const history = messages
        .filter((m) => m.id !== assistantId)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || `Error ${res.status}`);
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        // Update the assistant message in place
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          ),
        }));
      }

      // If no content came through, show fallback
      if (!accumulated.trim()) {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: "I couldn't generate a response." }
              : m
          ),
        }));
      }

      set({ isLoading: false });
    } catch (err) {
      // Remove the empty placeholder on error
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== assistantId || m.content),
        isLoading: false,
        error: err instanceof Error ? err.message : "Something went wrong",
      }));
    }
  },

  clearChat: () => set({ messages: [], error: null }),
}));
