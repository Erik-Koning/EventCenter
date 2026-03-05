import { create } from "zustand";

export interface Insight {
  title: string;
  description: string;
}

export interface NetworkingGroup {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  creatorName: string;
  topWords: string[];
  insights: Insight[];
  memberCount: number;
  createdAt: string;
}

export interface NetworkingMessage {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  content: string;
  isAiSummary: boolean;
  createdAt: string;
}

export interface MindMapNode {
  id: string;
  groupId: string;
  parentId: string | null;
  label: string;
  positionX: number;
  positionY: number;
  createdByUserId: string;
  createdAt: string;
}

interface NetworkingState {
  // Data
  groups: NetworkingGroup[];
  selectedGroupId: string | null;
  messages: NetworkingMessage[];
  mindMapNodes: MindMapNode[];
  isMember: boolean;

  // Preview panel state
  previewGroupId: string | null;
  previewIsMember: boolean;

  // Connection state
  wsConnected: boolean;

  // Loading states
  groupsLoading: boolean;
  messagesLoading: boolean;
  mindMapLoading: boolean;

  // Actions
  setGroups: (groups: NetworkingGroup[]) => void;
  selectGroup: (groupId: string | null) => void;
  setMessages: (messages: NetworkingMessage[]) => void;
  appendMessages: (messages: NetworkingMessage[]) => void;
  setMindMapNodes: (nodes: MindMapNode[]) => void;
  updateMindMapNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  addMindMapNode: (node: MindMapNode) => void;
  removeMindMapNode: (nodeId: string) => void;
  setIsMember: (isMember: boolean) => void;
  setPreviewGroupId: (id: string | null) => void;
  setPreviewIsMember: (isMember: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  setGroupsLoading: (loading: boolean) => void;
  setMessagesLoading: (loading: boolean) => void;
  setMindMapLoading: (loading: boolean) => void;
  addGroup: (group: NetworkingGroup) => void;
  removeGroup: (groupId: string) => void;
  updateGroupTopWords: (groupId: string, topWords: string[]) => void;
  updateGroupInsights: (groupId: string, insights: Insight[]) => void;
  updateGroupMemberCount: (groupId: string, memberCount: number) => void;
}

export const useNetworkingStore = create<NetworkingState>((set) => ({
  groups: [],
  selectedGroupId: null,
  messages: [],
  mindMapNodes: [],
  isMember: false,
  previewGroupId: null,
  previewIsMember: false,
  wsConnected: false,
  groupsLoading: false,
  messagesLoading: false,
  mindMapLoading: false,

  setGroups: (groups) => set({ groups }),

  selectGroup: (groupId) =>
    set({ selectedGroupId: groupId, messages: [], mindMapNodes: [], isMember: false }),

  setMessages: (messages) => set({ messages }),

  appendMessages: (newMessages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const unique = newMessages.filter((m) => !existingIds.has(m.id));
      if (unique.length === 0) return state;
      return { messages: [...state.messages, ...unique] };
    }),

  setMindMapNodes: (nodes) => {
    const seen = new Set<string>();
    const unique = nodes.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    set({ mindMapNodes: unique });
  },

  updateMindMapNode: (nodeId, updates) =>
    set((state) => ({
      mindMapNodes: state.mindMapNodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
    })),

  addMindMapNode: (node) =>
    set((state) => {
      if (state.mindMapNodes.some((n) => n.id === node.id)) return state;
      return { mindMapNodes: [...state.mindMapNodes, node] };
    }),

  removeMindMapNode: (nodeId) =>
    set((state) => ({
      mindMapNodes: state.mindMapNodes.filter((n) => n.id !== nodeId),
    })),

  setIsMember: (isMember) => set({ isMember }),
  setPreviewGroupId: (id) => set({ previewGroupId: id, previewIsMember: false }),
  setPreviewIsMember: (isMember) => set({ previewIsMember: isMember }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setGroupsLoading: (loading) => set({ groupsLoading: loading }),
  setMessagesLoading: (loading) => set({ messagesLoading: loading }),
  setMindMapLoading: (loading) => set({ mindMapLoading: loading }),

  addGroup: (group) =>
    set((state) => ({ groups: [group, ...state.groups] })),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId,
    })),

  updateGroupTopWords: (groupId, topWords) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, topWords } : g
      ),
    })),

  updateGroupInsights: (groupId, insights) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, insights } : g
      ),
    })),

  updateGroupMemberCount: (groupId, memberCount) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, memberCount } : g
      ),
    })),
}));
