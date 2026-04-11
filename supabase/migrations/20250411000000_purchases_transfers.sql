-- Migration: add purchases, purchase_items, stock_transfers tables
-- and backfill missing columns on bills / ledger_entries.
-- Run in Supabase SQL editor or via CLI.

-- ── purchases ────────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  purchase_number integer not null,
  party_id        uuid not null references public.parties (id) on delete restrict,
  party_name_snapshot text not null,
  purchase_date   date not null,
  ref_number      text,
  payment_type    text not null check (payment_type in ('cash', 'credit')),
  total           numeric not null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_purchases_user_date on public.purchases (user_id, purchase_date);

alter table public.purchases enable row level security;

create policy "purchases_own" on public.purchases for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── purchase_items ────────────────────────────────────────────────────────────
create table if not exists public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  item_id     uuid not null references public.items (id) on delete restrict,
  qty         numeric not null,
  unit_cost   numeric not null,
  line_total  numeric not null,
  destination text not null check (destination in ('shop', 'godown')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_purchase_items_purchase on public.purchase_items (purchase_id);

alter table public.purchase_items enable row level security;

create policy "purchase_items_own" on public.purchase_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── stock_transfers ───────────────────────────────────────────────────────────
create table if not exists public.stock_transfers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  item_id            uuid not null references public.items (id) on delete restrict,
  item_name_snapshot text not null,
  from_location      text not null check (from_location in ('shop', 'godown')),
  to_location        text not null check (to_location in ('shop', 'godown')),
  qty                numeric not null,
  note               text,
  transfer_date      date not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_stock_transfers_user on public.stock_transfers (user_id, transfer_date);

alter table public.stock_transfers enable row level security;

create policy "stock_transfers_own" on public.stock_transfers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── ledger_entries: ref_purchase_id (purchases table now exists) ──────────────
alter table public.ledger_entries
  add column if not exists ref_purchase_id uuid references public.purchases (id) on delete set null;

-- ── bills: bill_number ────────────────────────────────────────────────────────
alter table public.bills
  add column if not exists bill_number integer;
