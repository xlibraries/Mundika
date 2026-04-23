-- Shop (business) profile + membership. Operational inventory/bills remain user-scoped until a follow-up migration.

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text not null default 'IN',
  gstin text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index idx_shop_members_user on public.shop_members (user_id);

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;

create policy "shops_select_member"
  on public.shops for select
  using (
    exists (
      select 1 from public.shop_members m
      where m.shop_id = shops.id and m.user_id = auth.uid()
    )
  );

create policy "shops_update_admin"
  on public.shops for update
  using (
    exists (
      select 1 from public.shop_members m
      where m.shop_id = shops.id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.shop_members m
      where m.shop_id = shops.id and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy "shop_members_select_own"
  on public.shop_members for select
  using (user_id = auth.uid());

-- RPC creates shop + owner row (bypasses missing INSERT policies on shops for direct client inserts).
create or replace function public.create_shop_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 1 then
    raise exception 'Shop name is required';
  end if;
  insert into public.shops (name)
  values (trim(p_name))
  returning id into sid;
  insert into public.shop_members (shop_id, user_id, role)
  values (sid, auth.uid(), 'owner');
  return sid;
end;
$$;

grant execute on function public.create_shop_with_owner (text) to authenticated;
