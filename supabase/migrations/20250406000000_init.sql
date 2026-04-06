-- Mundika: mirror of local IndexedDB (except sync_queue)
-- Run in Supabase SQL editor or via CLI.

create extension if not exists "pgcrypto";

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  unit text,
  rate_default numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  location text not null check (location in ('shop', 'godown')),
  qty numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id, location)
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  party_id uuid not null references public.parties (id) on delete restrict,
  party_name_snapshot text not null,
  bill_date date not null,
  total numeric not null,
  bill_type text not null check (bill_type in ('cash', 'credit')),
  vehicle_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  qty numeric not null,
  rate numeric not null,
  line_total numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  party_id uuid not null references public.parties (id) on delete cascade,
  party_name_snapshot text,
  entry_type text not null check (entry_type in ('sale', 'payment', 'purchase')),
  balance_delta numeric not null,
  ref_bill_id uuid references public.bills (id) on delete set null,
  note text,
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_parties_user on public.parties (user_id);
create index idx_items_user on public.items (user_id);
create index idx_inventory_user on public.inventory (user_id);
create index idx_bills_user_date on public.bills (user_id, bill_date);
create index idx_bill_items_bill on public.bill_items (bill_id);
create index idx_ledger_party on public.ledger_entries (user_id, party_id);

alter table public.parties enable row level security;
alter table public.items enable row level security;
alter table public.inventory enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.ledger_entries enable row level security;

create policy "parties_own" on public.parties for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "items_own" on public.items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "inventory_own" on public.inventory for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bills_own" on public.bills for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bill_items_own" on public.bill_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ledger_own" on public.ledger_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
