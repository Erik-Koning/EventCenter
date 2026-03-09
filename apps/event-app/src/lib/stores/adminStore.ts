import { create } from "zustand";

interface AdminState {
  managedEventId: string | null;
  setManagedEventId: (id: string | null) => void;
  activeTab: number;
  setActiveTab: (tab: number) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  managedEventId: null,
  setManagedEventId: (id) => set({ managedEventId: id }),
  activeTab: 0,
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
