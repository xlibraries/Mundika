"use client";

import { useWorkspacePrefs } from "@/store/workspace-preferences";

export function ViewMenu() {
  const {
    showNavParties: showNavPartiesRaw,
    showNavInventory: showNavInventoryRaw,
    showNavLedger: showNavLedgerRaw,
    showNavItems: showNavItemsRaw,
    showSectionParties: showSectionPartiesRaw,
    showSectionLedger: showSectionLedgerRaw,
    setShowNavParties,
    setShowNavInventory,
    setShowNavLedger,
    setShowNavItems,
    setShowSectionParties,
    setShowSectionLedger,
  } = useWorkspacePrefs();

  const showNavParties = showNavPartiesRaw ?? true;
  const showNavInventory = showNavInventoryRaw ?? true;
  const showNavLedger = showNavLedgerRaw ?? true;
  const showNavItems = showNavItemsRaw ?? false;
  const showSectionParties = showSectionPartiesRaw ?? true;
  const showSectionLedger = showSectionLedgerRaw ?? true;

  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        View
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/10 bg-zinc-900 p-3 shadow-2xl">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Sidebar links
        </p>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showNavParties}
            onChange={(e) => setShowNavParties(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900"
          />
          Parties
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showNavInventory}
            onChange={(e) => setShowNavInventory(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900"
          />
          Inventory
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showNavLedger}
            onChange={(e) => setShowNavLedger(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900"
          />
          Ledger
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showNavItems}
            onChange={(e) => setShowNavItems(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900"
          />
          Items (separate page)
        </label>
        <div className="my-2 border-t border-white/[0.06]" />
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          On this page
        </p>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showSectionParties}
            onChange={(e) => setShowSectionParties(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900"
          />
          Parties block
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showSectionLedger}
            onChange={(e) => setShowSectionLedger(e.target.checked)}
            className="rounded border-white/20 bg-zinc-900"
          />
          Ledger block
        </label>
      </div>
    </details>
  );
}
