-- Per-line shop/godown split for restoring stock when a bill is deleted
alter table public.bill_items add column if not exists qty_from_shop numeric;
alter table public.bill_items add column if not exists qty_from_godown numeric;
