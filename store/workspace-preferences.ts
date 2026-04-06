import { create } from "zustand";
import { persist } from "zustand/middleware";

type WorkspacePrefs = {
  /** Show sidebar links to /parties, /inventory, /ledger, /items */
  showNavParties: boolean;
  showNavInventory: boolean;
  showNavLedger: boolean;
  showNavItems: boolean;
  /** Show Parties / Ledger blocks on the workspace page */
  showSectionParties: boolean;
  showSectionLedger: boolean;
  setShowNavParties: (v: boolean) => void;
  setShowNavInventory: (v: boolean) => void;
  setShowNavLedger: (v: boolean) => void;
  setShowNavItems: (v: boolean) => void;
  setShowSectionParties: (v: boolean) => void;
  setShowSectionLedger: (v: boolean) => void;
};

export const useWorkspacePrefs = create<WorkspacePrefs>()(
  persist(
    (set) => ({
      showNavParties: true,
      showNavInventory: true,
      showNavLedger: true,
      showNavItems: false,
      showSectionParties: true,
      showSectionLedger: true,
      setShowNavParties: (showNavParties) => set({ showNavParties }),
      setShowNavInventory: (showNavInventory) => set({ showNavInventory }),
      setShowNavLedger: (showNavLedger) => set({ showNavLedger }),
      setShowNavItems: (showNavItems) => set({ showNavItems }),
      setShowSectionParties: (showSectionParties) => set({ showSectionParties }),
      setShowSectionLedger: (showSectionLedger) => set({ showSectionLedger }),
    }),
    { name: "mundika-workspace-prefs" }
  )
);
