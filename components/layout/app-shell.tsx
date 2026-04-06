"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/cn";
import { icons } from "@/components/layout/nav-icons";
import { useWorkspacePrefs } from "@/store/workspace-preferences";

type NavKey = "parties" | "inventory" | "ledger" | "items";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ReactNode;
  navKey?: NavKey;
}> = [
  { href: "/dashboard", label: "Workspace", icon: icons.dashboard },
  { href: "/billing", label: "Billing", icon: icons.billing },
  { href: "/parties", label: "Parties", icon: icons.parties, navKey: "parties" },
  {
    href: "/inventory",
    label: "Inventory",
    icon: icons.inventory,
    navKey: "inventory",
  },
  { href: "/ledger", label: "Ledger", icon: icons.ledger, navKey: "ledger" },
  { href: "/items", label: "Items", icon: icons.items, navKey: "items" },
];

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const showNavParties = useWorkspacePrefs((s) => s.showNavParties ?? true);
  const showNavInventory = useWorkspacePrefs(
    (s) => s.showNavInventory ?? true
  );
  const showNavLedger = useWorkspacePrefs((s) => s.showNavLedger ?? true);
  const showNavItems = useWorkspacePrefs((s) => s.showNavItems ?? false);

  const visible = useMemo(() => {
    return NAV_ITEMS.filter((n) => {
      if (!n.navKey) return true;
      switch (n.navKey) {
        case "parties":
          return showNavParties;
        case "inventory":
          return showNavInventory;
        case "ledger":
          return showNavLedger;
        case "items":
          return showNavItems;
        default:
          return true;
      }
    });
  }, [showNavInventory, showNavItems, showNavLedger, showNavParties]);

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {visible.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-amber-500/10 text-amber-400"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
            )}
          >
            <span
              className={cn(
                "transition-colors",
                active ? "text-amber-400" : "text-zinc-500 group-hover:text-zinc-300"
              )}
            >
              {n.icon}
            </span>
            {n.label}
            {active ? (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isWorkspace = pathname === "/dashboard";

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-950 md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-zinc-950/90 px-4 backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-100"
          aria-label="Open menu"
        >
          {icons.menu}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-xs font-bold text-amber-400">
            M
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            Mundika
          </span>
        </div>
        <span className="w-10" aria-hidden />
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(88vw,288px)] flex-col border-r border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
              <span className="text-sm font-semibold text-zinc-100">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="size-5"
                  aria-hidden
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    d="M6 6l12 12M18 6L6 18"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-white/[0.06] p-3">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
              >
                {icons.logout}
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/80 py-6 md:flex">
        <div className="mb-6 flex items-center gap-3 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 text-sm font-bold text-amber-400 ring-1 ring-amber-500/20">
            M
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">
              Mundika
            </p>
            <p className="text-[11px] text-zinc-500">Ledger &amp; stock</p>
          </div>
        </div>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
          >
            {icons.logout}
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div
          className={cn(
            "mx-auto min-w-0",
            isWorkspace
              ? "w-full max-w-none px-3 py-4 md:px-6 md:py-6"
              : "max-w-5xl px-4 py-6 md:px-8 md:py-10"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
