"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/cn";
import { icons } from "@/components/layout/nav-icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Workspace", icon: icons.dashboard },
  { href: "/billing", label: "Billing", icon: icons.billing },
  { href: "/purchases", label: "Purchases", icon: icons.purchases },
];

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {NAV_ITEMS.map((n) => {
        const active =
          n.href === "/dashboard"
            ? pathname === "/dashboard" || pathname.startsWith("/dashboard")
            : pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[#e8f0fe] text-[#1a73e8]"
                : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
            )}
          >
            <span
              className={cn(
                "transition-colors",
                active
                  ? "text-[#1a73e8]"
                  : "text-[#5f6368] group-hover:text-[#202124]"
              )}
            >
              {n.icon}
            </span>
            {n.label}
            {active ? (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#1a73e8]" />
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
  const isWorkspace = pathname === "/dashboard" || pathname.startsWith("/dashboard");

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
    <div className="flex min-h-full flex-col bg-white md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-[#dadce0] bg-white px-4 shadow-sm md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded p-2 text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#202124]"
          aria-label="Open menu"
        >
          {icons.menu}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded border border-[#dadce0] bg-[#e6f4ea] text-xs font-bold text-[#188038]">
            M
          </span>
          <span className="text-sm font-medium text-[#202124]">Mundika</span>
        </div>
        <span className="w-10" aria-hidden />
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(88vw,288px)] flex-col border-r border-[#dadce0] bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-[#dadce0] p-4">
              <span className="text-sm font-medium text-[#202124]">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
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
            <div className="border-t border-[#dadce0] p-3">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm font-medium text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#202124]"
              >
                {icons.logout}
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col border-r border-[#dadce0] bg-[#f8f9fa] py-5 md:flex">
        <div className="mb-5 flex items-center gap-3 px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-[#dadce0] bg-white text-sm font-bold text-[#188038] shadow-sm">
            M
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#202124]">
              Mundika
            </p>
            <p className="text-[11px] text-[#5f6368]">Sheets on steroids</p>
          </div>
        </div>
        <div className="flex-1 px-2">
          <NavLinks />
        </div>
        <div className="px-2 pt-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm font-medium text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#202124]"
          >
            {icons.logout}
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-white">
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
