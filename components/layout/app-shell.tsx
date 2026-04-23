"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { withBasePath } from "@/lib/auth/site-url";
import { cn } from "@/lib/cn";
import { icons } from "@/components/layout/nav-icons";
import { DashboardRailSummary } from "@/components/layout/dashboard-rail-summary";
import { usePrimaryShopName } from "@/hooks/use-primary-shop-name";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: icons.dashboard },
  { href: "/analytics", label: "Inventory", icon: icons.analytics },
  { href: "/account", label: "Account", icon: icons.account },
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
        "flex min-h-0 flex-col justify-start gap-3 py-4",
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
                ? "border-[var(--gs-grid)] bg-[var(--gs-surface-plain)] text-[var(--gs-text)] shadow-sm"
                : "border-[var(--gs-border)] bg-[var(--gs-surface)] text-[var(--gs-text-secondary)] hover:border-[var(--gs-grid)] hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
            )}
          >
            <span
              className={cn(
                "transition-colors",
                active
                  ? "text-[var(--gs-primary)]"
                  : "text-[var(--gs-text-secondary)] group-hover:text-[var(--gs-primary)]"
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
  const { shopName, loading: shopNameLoading } = usePrimaryShopName();
  const shopTitle =
    shopNameLoading || !shopName || shopName.length === 0
      ? shopNameLoading
        ? "…"
        : "Dukan"
      : shopName;
  const badgeLetter =
    shopName && shopName.length > 0
      ? shopName.charAt(0).toLocaleUpperCase()
      : "M";
  const useWorkspaceMain =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/subscribe" ||
    pathname.startsWith("/subscribe/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === "/settings/shop" ||
    pathname.startsWith("/settings/");

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
    window.location.href = withBasePath("/");
  }

  return (
    <div className="flex min-h-full flex-col bg-[var(--gs-bg)] text-[var(--gs-text)] md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-[var(--gs-border)] bg-[var(--gs-surface)] px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl p-2 text-[var(--gs-text-secondary)] transition hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
          aria-label="Open menu"
        >
          {icons.menu}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--gs-grid)] bg-[var(--gs-surface-plain)] text-xs font-bold text-[var(--gs-primary)]">
            {shopNameLoading ? "…" : badgeLetter}
          </span>
          <div className="min-w-0 leading-none">
            <p
              className="truncate text-sm font-semibold tracking-tight text-[var(--gs-text)]"
              title={shopTitle}
            >
              {shopTitle}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gs-primary)]">
              Mundika
            </p>
          </div>
        </div>
        <span className="w-10" aria-hidden />
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--gs-overlay)]"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(88vw,288px)] flex-col border-r border-[var(--gs-border)] bg-[var(--gs-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--gs-border)] p-4">
              <span className="text-sm font-medium text-[var(--gs-text)]">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-[var(--gs-text-secondary)] hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
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
              <div className="mb-4 flex min-h-[var(--shell-ribbon-min)] items-center justify-center rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-3">
                <div className="w-full space-y-1 text-center">
                  <p
                    className="truncate text-sm font-semibold tracking-tight text-[var(--gs-text)]"
                    title={shopTitle}
                  >
                    {shopTitle}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gs-primary)]">
                    Mundika
                  </p>
                  <DashboardRailSummary pathname={pathname} />
                </div>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-[var(--gs-border)] p-3">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--gs-border)] px-3 py-2.5 text-sm font-medium text-[var(--gs-text-secondary)] transition hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
              >
                {icons.logout}
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden min-h-0 w-[220px] shrink-0 flex-col border-r border-[var(--gs-border)] bg-[var(--gs-surface)] px-3 py-6 md:flex md:min-h-screen">
        <div
          className="mb-4 flex min-h-[var(--shell-ribbon-min)] shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-4"
          aria-label={`${shopTitle}, Mundika`}
        >
          <p
            className="w-full truncate text-center text-sm font-semibold tracking-tight text-[var(--gs-text)]"
            title={shopTitle}
          >
            {shopTitle}
          </p>
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gs-primary)]">
            Mundika
          </p>
          <DashboardRailSummary pathname={pathname} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <NavLinks />
        </div>
        <div className="mt-auto shrink-0 pt-6">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--gs-border)] px-4 py-3 text-sm font-medium text-[var(--gs-text-secondary)] transition hover:border-[var(--gs-grid)] hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]"
          >
            {icons.logout}
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-[var(--gs-bg)]">
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
