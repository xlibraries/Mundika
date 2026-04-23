-- Optional account contact: mobile for Razorpay prefill and support.

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text unique,
  updated_at timestamptz not null default now()
);

create index idx_user_profiles_phone on public.user_profiles (phone_e164)
  where phone_e164 is not null;

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (user_id = auth.uid());

create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (user_id = auth.uid());

create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
