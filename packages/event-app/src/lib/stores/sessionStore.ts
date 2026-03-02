import { create } from "zustand";
import type { Session } from "@/data/types";

interface SessionState {
  upvotes: Record<string, number>;
  userUpvoted: Record<string, boolean>;
  userSessions: Session[];

  toggleUpvote: (sessionId: string) => void;
  addSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  upvotes: {},
  userUpvoted: {},
  userSessions: [],

  toggleUpvote: (sessionId) =>
    set((state) => {
      const isUpvoted = state.userUpvoted[sessionId];
      return {
        upvotes: {
          ...state.upvotes,
          [sessionId]: (state.upvotes[sessionId] ?? 0) + (isUpvoted ? -1 : 1),
        },
        userUpvoted: {
          ...state.userUpvoted,
          [sessionId]: !isUpvoted,
        },
      };
    }),

  addSession: (session) =>
    set((state) => ({
      userSessions: [...state.userSessions, { ...session, isUserSubmitted: true }],
    })),
}));
