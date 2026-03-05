import { create } from "zustand";

interface AdminState {
  managedEventId: string | null;
  setManagedEventId: (id: string | null) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  managedEventId: null,
  setManagedEventId: (id) => set({ managedEventId: id }),
}));
