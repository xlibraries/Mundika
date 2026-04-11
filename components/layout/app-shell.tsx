"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/cn";
import { icons } from "@/components/layout/nav-icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inventory", icon: icons.dashboard },
  { href: "/billing", label: "Billing", icon: icons.billing },
  { href: "/purchases", label: "Purchases", icon: icons.purchases },
  { href: "/analytics", label: "Analytics", icon: icons.analytics },
] as const;

function navItemActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex min-h-0 flex-1 flex-col justify-center gap-8 py-6",
        className
      )}
    >
      {NAV_ITEMS.map((n) => {
        const active = navItemActive(n.href, pathname);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "group flex min-h-[3.5rem] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
              active
                ? "border-[#a3c9b0] bg-[#faf9f5] text-[#2a382f] shadow-sm"
                : "border-[#cfe3d4] bg-[#f1f6f2] text-[#5c6e62] hover:border-[#b8d4c2] hover:bg-[#e8f2ea] hover:text-[#2a382f]"
            )}
          >
            <span
              className={cn(
                "transition-colors",
                active
                  ? "text-[#4d7a5c]"
                  : "text-[#7a9180] group-hover:text-[#4d7a5c]"
              )}
            >
              {n.icon}
            </span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const useWorkspaceMain =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/");

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
    <div className="flex min-h-full flex-col bg-[#f6faf7] text-[#2a382f] md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-[#cfe3d4] bg-[#eef5f0] px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl p-2 text-[#5c6e62] transition hover:bg-[#e3efe6] hover:text-[#2a382f]"
          aria-label="Open menu"
        >
          {icons.menu}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#b8d4c2] bg-[#faf9f5] text-xs font-bold text-[#4d7a5c]">
            M
          </span>
          <span className="text-sm font-medium text-[#2a382f]">Mundika</span>
        </div>
        <span className="w-10" aria-hidden />
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#2a382f]/35"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(88vw,288px)] flex-col border-r border-[#cfe3d4] bg-[#eef5f0] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#cfe3d4] p-4">
              <span className="text-sm font-medium text-[#2a382f]">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-[#5c6e62] hover:bg-[#e3efe6] hover:text-[#2a382f]"
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
            <div className="flex flex-1 flex-col overflow-y-auto p-3">
              <div className="mb-4 flex min-h-[var(--shell-ribbon-min)] items-center justify-center rounded-2xl border border-[#cfe3d4] bg-[#faf9f5] px-3 py-3">
                <p className="text-center text-sm font-semibold tracking-tight text-[#2a382f]">
                  Mundika
                </p>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-[#cfe3d4] p-3">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-xl border border-[#cfe3d4] px-3 py-2.5 text-sm font-medium text-[#5c6e62] transition hover:bg-[#e3efe6] hover:text-[#2a382f]"
              >
                {icons.logout}
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden min-h-0 w-[220px] shrink-0 flex-col border-r border-[#cfe3d4] bg-[#eef5f0] px-3 py-6 md:flex md:min-h-screen">
        <div
          className="mb-4 flex min-h-[var(--shell-ribbon-min)] shrink-0 flex-col items-center justify-center rounded-2xl border border-[#cfe3d4] bg-[#faf9f5] px-3 py-4"
          aria-label="Mundika"
        >
          <p className="text-center text-sm font-semibold tracking-tight text-[#2a382f]">
            Mundika
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <NavLinks />
        </div>
        <div className="mt-auto shrink-0 pt-6">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#cfe3d4] px-4 py-3 text-sm font-medium text-[#5c6e62] transition hover:border-[#b8d4c2] hover:bg-[#e3efe6] hover:text-[#2a382f]"
          >
            {icons.logout}
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-[#f6faf7]">
        <div
          className={cn(
            "mx-auto min-h-full min-w-0",
            useWorkspaceMain
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
