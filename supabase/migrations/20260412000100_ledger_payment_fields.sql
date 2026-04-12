-- Migration: track payment medium/reference on ledger payment entries.
-- Run in Supabase SQL editor or via CLI.

alter table public.ledger_entries
  add column if not exists payment_mode text
    check (payment_mode in ('cash', 'upi', 'imps', 'rtgs', 'neft', 'bank_transfer', 'cheque', 'other'));

alter table public.ledger_entries
  add column if not exists payment_reference text;
