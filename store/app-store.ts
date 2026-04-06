import { create } from "zustand";

type SyncState = "idle" | "syncing" | "error";

interface AppState {
  online: boolean;
  syncState: SyncState;
  lastSyncAt: string | null;
  setOnline: (v: boolean) => void;
  setSyncState: (s: SyncState) => void;
  setLastSyncAt: (iso: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  syncState: "idle",
  lastSyncAt: null,
  setOnline: (v) => set({ online: v }),
  setSyncState: (syncState) => set({ syncState }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}));
