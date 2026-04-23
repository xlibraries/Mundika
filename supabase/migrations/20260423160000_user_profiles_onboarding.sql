-- Post-auth onboarding completion + optional SMS proof timestamp.

alter table public.user_profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists phone_verified_at timestamptz;

-- Existing rows: do not block current users behind the new gate.
update public.user_profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null;
