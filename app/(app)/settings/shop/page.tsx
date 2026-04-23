"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserId } from "@/hooks/use-user-id";
import { createClient } from "@/utils/supabase/client";
import {
  ensureDefaultShopForUser,
  updateShopProfile,
} from "@/lib/shops/queries";
import type { ShopRow } from "@/lib/shops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

export default function ShopSettingsPage() {
  const router = useRouter();
  const { userId, loading: authLoading } = useUserId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [draft, setDraft] = useState<Partial<ShopRow>>({});

  useEffect(() => {
    if (authLoading || !userId) return;
    const supabase = createClient();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { shop: row } = await ensureDefaultShopForUser(supabase, userId);
        setShop(row);
        setDraft(row);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load shop");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, userId]);

  useEffect(() => {
    if (authLoading || userId) return;
    router.replace("/login?next=%2Fsettings%2Fshop");
  }, [authLoading, userId, router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!shop || !userId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      await updateShopProfile(supabase, shop.id, {
        name: (draft.name ?? "").trim() || shop.name,
        address_line1: emptyToNull(String(draft.address_line1 ?? "")),
        city: emptyToNull(String(draft.city ?? "")),
        state_region: emptyToNull(String(draft.state_region ?? "")),
        country: "IN",
        phone: emptyToNull(String(draft.phone ?? "")),
      });
      const { data, error: reloadErr } = await supabase
        .from("shops")
        .select("*")
        .eq("id", shop.id)
        .single();
      if (reloadErr || !data) throw reloadErr ?? new Error("Reload failed");
      const next = data as ShopRow;
      setShop(next);
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !userId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-6">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-[var(--gs-surface)]" />
        <div className="h-64 animate-pulse rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)]" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <p className="text-sm text-[var(--gs-text-secondary)]">Loading shop profile…</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <p className="text-sm text-[var(--gs-danger)]">
          {error ?? "Could not open shop profile."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gs-text-secondary)]">
          Settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--gs-text)]">
          Shop profile
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-secondary)]">
          Dukan ka naam aur pata — bill / chit par chhapne ke liye. Ye sirf
          khatta-khata ke hisaab se rakha gaya hai (GST nahi). Stock aur bill
          abhi is device par; sync baad mein (GitHub #26).
        </p>
      </div>

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-5"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
            Dukan ka naam
          </span>
          <Input
            required
            value={draft.name ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
            Mobile number
          </span>
          <Input
            type="tel"
            inputMode="tel"
            value={draft.phone ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
            Pata (optional)
          </span>
          <Input
            placeholder="Gali, bazar, landmark…"
            value={draft.address_line1 ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, address_line1: e.target.value }))
            }
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Gaon / shehar
            </span>
            <Input
              value={draft.city ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--gs-text-secondary)]">
              Rajya
            </span>
            <Input
              value={draft.state_region ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, state_region: e.target.value }))
              }
            />
          </label>
        </div>

        {error ? (
          <p className="rounded border border-[var(--gs-danger)]/30 bg-[var(--gs-danger-soft)] px-3 py-2 text-sm text-[var(--gs-danger)]">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Save shop profile"}
        </Button>
      </form>
    </div>
  );
}
