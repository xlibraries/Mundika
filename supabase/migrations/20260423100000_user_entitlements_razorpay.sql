-- Razorpay (Orders + payment) metadata for Starter.
--
-- Requires public.user_entitlements from 20260422100000_user_entitlements.sql
-- when using `supabase db push` (migrations run in filename order).
--
-- If you see "relation user_entitlements does not exist", you skipped the base
-- migration: apply 20260422100000_user_entitlements.sql first, OR rely on the
-- bootstrap below (safe when the table already exists).

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free'
    check (plan_id in ('free', 'starter', 'business')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_entitlements_stripe_customer
  on public.user_entitlements (stripe_customer_id);

create index if not exists idx_user_entitlements_stripe_subscription
  on public.user_entitlements (stripe_subscription_id);

alter table public.user_entitlements enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_entitlements'
      and policyname = 'user_entitlements_select_own'
  ) then
    create policy "user_entitlements_select_own"
      on public.user_entitlements for select
      using (auth.uid() = user_id);
  end if;
end$$;

alter table public.user_entitlements
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

create index if not exists idx_user_entitlements_razorpay_order
  on public.user_entitlements (razorpay_order_id);
