"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/parties", label: "Parties" },
  { href: "/items", label: "Items" },
  { href: "/inventory", label: "Inventory" },
  { href: "/billing", label: "Billing" },
  { href: "/ledger", label: "Ledger" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-row gap-1 border-b border-zinc-200 bg-zinc-50 p-2 md:w-48 md:flex-col md:border-b-0 md:border-r md:p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-0 px-2 py-1 text-sm font-semibold tracking-tight md:mb-2">
          Mundika
        </div>
        <nav className="flex flex-1 flex-wrap gap-1 md:flex-col">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="mt-auto hidden rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-200 md:block dark:hover:bg-zinc-800"
          onClick={() => void createClient().auth.signOut()}
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      <div className="border-t border-zinc-200 p-2 md:hidden dark:border-zinc-800">
        <button
          type="button"
          className="w-full rounded-md py-2 text-sm text-zinc-600 dark:text-zinc-400"
          onClick={() => void createClient().auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
