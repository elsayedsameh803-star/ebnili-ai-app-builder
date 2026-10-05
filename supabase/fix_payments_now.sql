-- ═══════════════════════════════════════════════════════════════════════════
--  EMERGENCY BOOTSTRAP  ·  ebnily_payments (safe to run as many times as you like)
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY YOU ARE RUNNING THIS
-- -----------------------
--   Error: Failed to run sql query: ERROR: 42P01:
--   relation "public.ebnily_payments" does not exist
--
-- That is NOT a missing COLUMN — the table itself was never created. `alter
-- table … add column` can only patch a table that exists, so it failed too.
--
-- The full, canonical script lives in `supabase/projects.sql`. Run this
-- smaller bootstrap if you want the dashboard back first; it creates the table
-- the payments/revenue screens read and nothing else.
--
-- SAFE TO RE-RUN: every statement is `if not exists`, and existing rows are
-- never dropped. After this succeeds, run `supabase/projects.sql` in full to
-- finish the remaining tables.

-- ── 1) Create the table ─────────────────────────────────────────────────────
-- This is the FULL, current shape, so nothing needs patching afterwards.

create table if not exists public.ebnily_payments (
  id                   text primary key,
  account_email        text        not null default '',
  account_id           text        not null default '',
  plan_id              text        not null default 'pro',
  billing_cycle        text        not null default 'monthly',
  amount_egp           numeric(10,2) not null default 0,
  amount_usd           numeric(10,2) not null default 0,
  sender_phone         text        not null default '',
  transaction_ref      text        not null default '',
  receipt_path         text,               -- object key inside the payments bucket
  receipt_file_name    text,
  notes                text,
  status               text        not null default 'pending'
                         check (status in ('pending','confirmed','rejected')),
  submitted_at         timestamptz not null default now(),
  reviewed_at          timestamptz,
  reviewed_by          text
);

-- ── 2) Indexes the dashboard sorts and filters on ──────────────────────────

create index if not exists ebnily_payments_status_submitted_idx
  on public.ebnily_payments (status, submitted_at desc);

create index if not exists ebnily_payments_account_idx
  on public.ebnily_payments (account_email);

-- ── 3) Security: RLS on, browser locked out, service_role kept working ─────
-- The API reads this table with the service key ONLY; `service_role` bypasses
-- RLS by design, so a leaked anon key cannot read any payment even if someone
-- changes the request headers.

alter table public.ebnily_payments enable row level security;

revoke all on public.ebnily_payments from anon, authenticated;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ── 4) VERIFY — must list every column the API selects ─────────────────────
--   select column_name from information_schema.columns
--    where table_name = 'ebnily_payments'
--    order by ordinal_position;
--
-- Expected 16 columns, in this order:
--   id, account_email, account_id, plan_id, billing_cycle, amount_egp,
--   amount_usd, sender_phone, transaction_ref, receipt_path,
--   receipt_file_name, notes, status, submitted_at, reviewed_at, reviewed_by
--
-- If any is missing, copy the error text here — PostgREST rejects the WHOLE
-- query when a single name in `select` is unknown, which is what produced
-- "payments, revenue unreadable".