-- Subscription / plan state synced from Stripe (via Edge webhook). Service role writes; users read own row.

create table public.user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free'
    check (plan_id in ('free', 'starter', 'business')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_user_entitlements_stripe_customer
  on public.user_entitlements (stripe_customer_id);

create index idx_user_entitlements_stripe_subscription
  on public.user_entitlements (stripe_subscription_id);

alter table public.user_entitlements enable row level security;

create policy "user_entitlements_select_own"
  on public.user_entitlements for select
  using (auth.uid() = user_id);
