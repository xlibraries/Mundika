import { cn } from "@/lib/cn";

/** Outer panel used by Khata, Contacts, and Stock (analytics workspace). */
export const WORKSPACE_PANEL =
  "overflow-hidden rounded-xl border border-[var(--gs-border)]/90 bg-[var(--gs-surface)]";

/** Title + filters strip inside {@link WORKSPACE_PANEL}. */
export const WORKSPACE_PANEL_HEADER =
  "border-b border-[var(--gs-border)]/70 bg-[var(--gs-surface-plain)]/50 px-3 py-3 sm:px-4";

export type WorkspaceEntryAccent = "expense" | "income" | "neutral";

/** One grouped row / card (ledger entry, contact, stock line). */
export function workspaceEntryShell(accent: WorkspaceEntryAccent) {
  return cn(
    "relative isolate z-0 overflow-hidden rounded-xl border border-[var(--gs-border)]/85 bg-[var(--gs-surface-plain)]/95 shadow-sm ring-1 ring-inset ring-black/[0.04]",
    accent === "expense" &&
      "border-l-[3px] border-l-[var(--gs-text-secondary)]",
    accent === "income" && "border-l-[3px] border-l-[var(--gs-success)]",
    accent === "neutral" &&
      "border-l-[3px] border-l-[var(--gs-text-secondary)]"
  );
}

/** Nested block under a card (ledger payments, stock transfer form). */
export const WORKSPACE_INSET_EXPANDED =
  "relative z-[1] space-y-2 border-t border-dashed border-[var(--gs-border)]/55 bg-[var(--gs-surface)]/20 px-2.5 py-2.5";
