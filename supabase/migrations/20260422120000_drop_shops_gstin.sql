-- Khatta-khata focus: no GSTIN on shop profile (tier-2/3 traders, informal books).

alter table public.shops drop column if exists gstin;
