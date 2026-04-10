"use client";

import { useEffect, useRef, useState } from "react";
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

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded border border-[#dadce0] bg-white px-3 py-1.5 text-sm font-medium text-[#202124] shadow-sm transition hover:bg-[#f8f9fa]"
      >
        View
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded border border-[#dadce0] bg-white p-3 shadow-[0_1px_2px_rgba(60,64,67,0.3),0_2px_6px_2px_rgba(60,64,67,0.15)]">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
            Sidebar links
          </p>
          <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-[#202124]">
            <input
              type="checkbox"
              checked={showNavParties}
              onChange={(e) => setShowNavParties(e.target.checked)}
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            Parties
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-[#202124]">
            <input
              type="checkbox"
              checked={showNavInventory}
              onChange={(e) => setShowNavInventory(e.target.checked)}
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            Inventory
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-[#202124]">
            <input
              type="checkbox"
              checked={showNavLedger}
              onChange={(e) => setShowNavLedger(e.target.checked)}
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            Ledger
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-[#202124]">
            <input
              type="checkbox"
              checked={showNavItems}
              onChange={(e) => setShowNavItems(e.target.checked)}
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            Items (separate page)
          </label>
          <div className="my-2 border-t border-[#dadce0]" />
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#5f6368]">
            On this page
          </p>
          <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-[#202124]">
            <input
              type="checkbox"
              checked={showSectionParties}
              onChange={(e) => setShowSectionParties(e.target.checked)}
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            Parties block
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-[#202124]">
            <input
              type="checkbox"
              checked={showSectionLedger}
              onChange={(e) => setShowSectionLedger(e.target.checked)}
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            Ledger block
          </label>
        </div>
      ) : null}
    </div>
  );
}
