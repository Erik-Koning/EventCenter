import { create } from "zustand";

interface CalendarState {
  selectedSessionIds: string[];

  addSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
  hasSession: (sessionId: string) => boolean;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  selectedSessionIds: [],

  addSession: (sessionId) =>
    set((state) => {
      if (state.selectedSessionIds.includes(sessionId)) return state;
      return { selectedSessionIds: [...state.selectedSessionIds, sessionId] };
    }),

  removeSession: (sessionId) =>
    set((state) => ({
      selectedSessionIds: state.selectedSessionIds.filter((id) => id !== sessionId),
    })),

  hasSession: (sessionId) => get().selectedSessionIds.includes(sessionId),
}));
