import { create } from "zustand";
import type { Session } from "@/data/types";

interface SessionState {
  upvotes: Record<string, number>;
  userUpvoted: Record<string, boolean>;
  userSessions: Session[];

  hydateUpvotes: (sessions: Session[]) => void;
  toggleUpvote: (sessionId: string) => void;
  addSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  upvotes: {},
  userUpvoted: {},
  userSessions: [],

  hydateUpvotes: (sessions) => {
    const upvotes: Record<string, number> = {};
    const userUpvoted: Record<string, boolean> = {};
    for (const s of sessions) {
      upvotes[s.id] = s.upvoteCount ?? 0;
      userUpvoted[s.id] = s.userUpvoted ?? false;
    }
    set({ upvotes, userUpvoted });
  },

  toggleUpvote: (sessionId) => {
    const state = get();
    const wasUpvoted = state.userUpvoted[sessionId];

    // Optimistic update
    set({
      upvotes: {
        ...state.upvotes,
        [sessionId]: (state.upvotes[sessionId] ?? 0) + (wasUpvoted ? -1 : 1),
      },
      userUpvoted: {
        ...state.userUpvoted,
        [sessionId]: !wasUpvoted,
      },
    });

    // Persist to API
    fetch(`/api/sessions/${sessionId}/upvote`, { method: "POST" })
      .then((res) => res.json())
      .then((data: { upvoted: boolean; count: number }) => {
        // Reconcile with server state
        set((s) => ({
          upvotes: { ...s.upvotes, [sessionId]: data.count },
          userUpvoted: { ...s.userUpvoted, [sessionId]: data.upvoted },
        }));
      })
      .catch(() => {
        // Revert on error
        set((s) => ({
          upvotes: {
            ...s.upvotes,
            [sessionId]: (s.upvotes[sessionId] ?? 0) + (wasUpvoted ? 1 : -1),
          },
          userUpvoted: { ...s.userUpvoted, [sessionId]: wasUpvoted },
        }));
      });
  },

  addSession: (session) =>
    set((state) => ({
      userSessions: [...state.userSessions, { ...session, isUserSubmitted: true }],
    })),
}));
