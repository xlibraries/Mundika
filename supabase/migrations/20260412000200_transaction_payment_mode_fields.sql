-- Migration: add payment mode/reference fields on bills and purchases.
-- Run in Supabase SQL editor or via CLI.

alter table public.bills
  add column if not exists payment_mode text
    check (payment_mode in ('cash', 'upi', 'imps', 'rtgs', 'neft', 'bank_transfer', 'cheque', 'other'));

alter table public.bills
  add column if not exists payment_reference text;

alter table public.purchases
  add column if not exists payment_mode text
    check (payment_mode in ('cash', 'upi', 'imps', 'rtgs', 'neft', 'bank_transfer', 'cheque', 'other'));

alter table public.purchases
  add column if not exists payment_reference text;
