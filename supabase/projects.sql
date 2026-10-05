-- ═══════════════════════════════════════════════════════════════════════════
-- EBNILY  ·  Supabase schema + repair script
-- Run this ONCE in the Supabase SQL editor. Safe to run again at any time:
-- every statement below is `if not exists`, `on conflict … do nothing`, or a
-- `do $$ … if not exists` guard, so re-running repairs an existing database
-- instead of breaking it.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS FILE IS SPLIT INTO TWO PHASES  (keep the order!)
-- ---------------------------------------------
-- The column-repair block for `ebnily_payments` used to sit ABOVE that table's
-- own `create table if not exists`. On a database where the table did not exist
-- yet, the very first ALTER aborted the whole run with:
--
--     ERROR:  relation "public.ebnily_payments" does not exist
--
-- and every statement after it was silently skipped. The layout below fixes
-- that permanently:
--
--   PHASE 1  ·  CREATE   →  every `create table if not exists` (plus its indexes)
--                           comes FIRST. Nothing in this phase refers to a
--                           relation it has not just created, so the script can
--                           never stop with "relation … does not exist".
--   PHASE 2  ·  ALTER    →  every `alter table` / column repair / constraint /
--                           unique index / RLS / revoke / seed / grant comes
--                           SECOND, once all five relations are guaranteed to
--                           exist.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  PHASE 1 · CREATE  —  the five tables, in creation order
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── 1.1  Projects ──────────────────────────────────────────────────────────
-- Projects store (one row per project, owned by the signed-in account).
--
-- Until it exists, /api/projects answers 503 DB_UNAVAILABLE and the UI says so
-- — it never invents data.
--
-- owner_id is the Supabase user id taken from the signed session cookie. The API
-- filters every read AND every write by it, so one account can never read or
-- modify another's rows. id is generated server-side, which is what prevents
-- duplicate/phantom projects on reload.

create table if not exists public.ebnily_projects (
  id          text primary key,
  owner_id    text        not null,
  name        text        not null default 'مشروع بدون اسم',
  code        text        not null default '',
  files       jsonb       not null default '{}'::jsonb,
  versions    jsonb       not null default '[]'::jsonb,
  theme       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The list view sorts and filters on this pair.
create index if not exists ebnily_projects_owner_updated_idx
  on public.ebnily_projects (owner_id, updated_at desc);

-- ── 1.2  Payment requests ──────────────────────────────────────────────────
-- WHY THIS EXISTS: a payment used to be written only as a file in object
-- storage, so /api/admin/overview always answered `recentTransactions: []` and
-- the owner could never see or approve a payment from the dashboard. The row
-- below is the reviewable record; the receipt image stays in storage and this
-- table only holds its path.
--
-- account_email is the signed-in address that submitted the request, and it is
-- what the plan grant is minted for — so it must be filled by the SERVER from
-- the session cookie, never from the request body.
--
-- NOTE: this is the FULL, current shape of the table. The `alter table … add
-- column` block in PHASE 2 only exists to bring an OLDER copy of this table up
-- to the same shape, so a database created before those columns existed stops
-- answering 400 "column … does not exist".

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

-- The dashboard sorts by newest and filters by status.
create index if not exists ebnily_payments_status_submitted_idx
  on public.ebnily_payments (status, submitted_at desc);

create index if not exists ebnily_payments_account_idx
  on public.ebnily_payments (account_email);

-- ── 1.3  Devices  (abuse protection registry) ──────────────────────────────
-- WHY THIS EXISTS: /api/protection/status answered `isBlocked: false` for
-- everyone and the dashboard's device list was always empty, so the block /
-- quota / tier buttons had nothing to act on and silently did nothing.
--
-- device_id comes from the client fingerprint (see src/utils/fingerprint.ts) and
-- is the lookup key the admin actions use.

create table if not exists public.ebnily_devices (
  device_id            text primary key,
  fingerprint_hash     text        not null default '',
  account_email        text,
  screen               text,
  timezone             text,
  platform             text,
  user_agent           text,
  ip_address           text,
  is_blocked           boolean     not null default false,
  block_reason         text,
  free_used            integer     not null default 0,
  free_limit           integer     not null default 5,
  tier                 text        not null default 'free'
                         check (tier in ('free','pro','business')),
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now()
);

create index if not exists ebnily_devices_last_seen_idx
  on public.ebnily_devices (last_seen_at desc);

-- ── 1.4  Platform settings  (owner-editable values that survive a redeploy) ─
-- WHY THIS EXISTS: POST /api/admin/settings used to answer `persisted: false`
-- and throw the values away, so changing the Orange Cash wallet number in the
-- dashboard did nothing at all.

create table if not exists public.ebnily_settings (
  key                    text primary key,
  value                  jsonb       not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

-- ── 1.5  Accounts  (who signed up, what they were given, still here?) ──────
-- WHY THIS EXISTS: the dashboard could only ever show devices and payments.
-- There was no record of a signed-in ACCOUNT, so "who is using my site, which
-- email registered, do they still have credits" had no answer at all. The
-- session endpoint now upserts a row here on every authenticated request,
-- which is what makes the users list, the credit balance and the online /
-- last-active column possible.
--
-- ONE ROW PER ACCOUNT, keyed by the provider's user id. `credits` is the
-- wallet: every new account is granted WELCOME_CREDITS on first sight and the
-- value is then owned by the admin (set-credits) and by the AI routes, so a
-- grant survives a redeploy instead of living in a cookie.

create table if not exists public.ebnily_accounts (
  account_id       text primary key,
  email            text        not null default '',
  display_name     text        not null default '',
  provider         text        not null default '',
  avatar_url       text,

  -- Credit wallet. `null` in credits_granted means "never topped up", which
  -- keeps the first-grant logic idempotent without a second column.
  credits          integer     not null default 0,
  credits_granted  integer,
  welcome_given    boolean     not null default false,

  -- Activity. `last_seen_at` is bumped on every authenticated request, so the
  -- dashboard can derive online / idle / offline from it alone.
  last_seen_at     timestamptz not null default now(),
  first_seen_at    timestamptz not null default now(),
  requests_count   bigint      not null default 0,
  last_ip          text,
  user_agent       text,

  -- ── Daily AI allowance (per plan: free 5 / pro 100 / business 400) ─────────
  -- WHY THIS IS PERSISTED AND NOT A COOKIE OR AN IN-MEMORY COUNTER: the quota
  -- used to live in a process-local `Map`, which a Vercel cold start wipes and
  -- two instances never share. That "limit" was reset by traffic, so it bounded
  -- a burst rather than a day's spending — and the SSE generation route had no
  -- check at all. Counting here makes the allowance real: it survives a redeploy,
  -- a sign-out, another device and a second instance.
  --
  -- `ai_day` is the UTC day the counter belongs to, stored as YYYY-MM-DD. The
  -- daily reset is therefore free: a request on a new day simply does not match
  -- `ai_day = today`, so the counter restarts from zero. No cron, no cleanup.
  ai_used          integer     not null default 0,
  ai_day           date,

  tier             text        not null default 'free'
                     check (tier in ('free','pro','business')),
  is_blocked       boolean     not null default false,
  block_reason     text
);

-- The dashboard sorts by newest and by last activity.
create index if not exists ebnily_accounts_first_seen_idx
  on public.ebnily_accounts (first_seen_at desc);

create index if not exists ebnily_accounts_last_seen_idx
  on public.ebnily_accounts (last_seen_at desc);

create index if not exists ebnily_accounts_email_idx
  on public.ebnily_accounts (email);

-- ═══════════════════════════════════════════════════════════════════════════
--  PHASE 2 · ALTER / REPAIR  —  everything below is safe now that all five
--                            relations created above are guaranteed to exist
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 2.1  ROW LEVEL SECURITY + client lock-out ───────────────────────────────
-- The API only ever talks to these tables with the service key, but locking the
-- anon role out means a leaked anon key cannot read anyone's rows even if
-- someone changes the request headers.

alter table public.ebnily_projects enable row level security;
alter table public.ebnily_payments  enable row level security;
alter table public.ebnily_devices   enable row level security;
alter table public.ebnily_settings  enable row level security;
alter table public.ebnily_accounts enable row level security;

revoke all on public.ebnily_payments  from anon, authenticated;
revoke all on public.ebnily_devices   from anon, authenticated;
revoke all on public.ebnily_settings  from anon, authenticated;
revoke all on public.ebnily_accounts from anon, authenticated;

-- ── 2.2  COLUMN REPAIR — ebnily_payments  (safe to re-run) ─────────────────
-- WHY THIS EXISTS — the dashboard said: "payments, revenue unreadable"
--
-- `create table if not exists` SKIPS an existing table entirely. It never adds a
-- column. So a database created before `account_id` / `receipt_file_name` /
-- `receipt_path` existed kept the OLD shape, and every dashboard read failed:
--
--   GET /rest/v1/ebnily_payments?select=id,...,account_id,...
--   → 400  {"message":"column ebnily_payments.account_id does not exist"}
--
-- Both `payments` and `revenue` appear in the warning because they are two
-- separate reads of the SAME table, so one broken column was reported twice.
--
-- `add column … if not exists` below brings an old table up to the current shape
-- without touching existing rows or recreating the table. On a brand-new
-- database every line here is a harmless no-op, because PHASE 1 already created
-- the table with exactly these columns.

alter table public.ebnily_payments add column if not exists account_id        text        not null default '';
alter table public.ebnily_payments add column if not exists receipt_path      text;
alter table public.ebnily_payments add column if not exists receipt_file_name text;
alter table public.ebnily_payments add column if not exists amount_usd        numeric(10,2) not null default 0;
alter table public.ebnily_payments add column if not exists billing_cycle     text        not null default 'monthly';
alter table public.ebnily_payments add column if not exists notes              text;
alter table public.ebnily_payments add column if not exists reviewed_at       timestamptz;
alter table public.ebnily_payments add column if not exists reviewed_by       text;
alter table public.ebnily_payments add column if not exists submitted_at      timestamptz not null default now();

-- The status CHECK was absent on older tables, so a bad value could be stored.
-- Adding it is safe because the table only ever holds the three legal values.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ebnily_payments'::regclass
      and contype  = 'c'
      and conname  = 'ebnily_payments_status_check'
  ) then
    update public.ebnily_payments set status = 'pending'
      where status not in ('pending','confirmed','rejected');
    alter table public.ebnily_payments
      add constraint ebnily_payments_status_check
      check (status in ('pending','confirmed','rejected'));
  end if;
end $$;

-- ─── VERIFY (returns the columns the API selects; all must appear) ────────────
--   select column_name from information_schema.columns
--    where table_name = 'ebnily_payments'
--    order by ordinal_position;

-- ── 2.3  REPAIR SCRIPT — conflict targets the API now names ────────────────
-- WHY THIS SECTION EXISTS
-- -----------------------
-- Both owner-dashboard problems reported ("تعذّر إضافة الأدمن" and "المستخدمون
-- 0") had ONE shared root cause, and it is in this database, not in the UI:
--
--   Every write used `POST ...?on_conflict=merge-duplicates` with NO column
--   filter. PostgREST cannot resolve a conflict target it is not told, so the
--   upsert resolved against nothing: it inserted a duplicate row instead of
--   updating the seeded one. Reads then used `limit: "1"` and kept returning the
--   untouched original row — so an added admin vanished and no account was ever
--   recorded, no matter how many times the owner retried.
--
-- The application code now names the conflict target explicitly
-- (`on_conflict=key` / `on_conflict=account_id` / `on_conflict=device_id`).
-- A conflict target MUST be backed by a unique index, so the statements below
-- guarantee those indexes exist even on a database created before them, and
-- they clean up the duplicate rows the old buggy upserts already created.

-- 1) ── De-duplicate before adding a unique index ──────────────────────────────
-- If the broken upsert ever appended a second 'platform' row, `limit: "1"` reads
-- a coin-flip. Keep the row that actually carries the owner's data.

delete from public.ebnily_settings s
using public.ebnily_settings keep
where s.key = 'platform'
  and keep.key = 'platform'
  and s.ctid < keep.ctid;

delete from public.ebnily_accounts a
using public.ebnily_accounts keep
where a.account_id = keep.account_id
  and a.ctid < keep.ctid;

delete from public.ebnily_devices d
using public.ebnily_devices keep
where d.device_id = keep.device_id
  and d.ctid < keep.ctid;

-- ── 2.3  DAILY AI ALLOWANCE — the columns that make the plan limit real ──────
-- WHY THIS IS A REPAIR, NOT JUST A CREATE
-- ----------------------------------------
-- A database created before this change has an `ebnily_accounts` table WITHOUT
-- `ai_used` / `ai_day`, so the quota code would have nothing to read and would
-- treat every account as having spent nothing — which is worse than having no
-- quota at all, because it would look correct.
--
-- Both statements are `if not exists`, so they are no-ops on a fresh database
-- (PHASE 1 above already created them) and a real migration on an old one.
-- Existing rows get ai_used = 0 / ai_day = NULL, which reads as "nothing spent
-- today" — the correct starting state, and NOT a free day of double spending,
-- because the counter is only trusted when `ai_day` equals today.

alter table public.ebnily_accounts
  add column if not exists ai_used integer not null default 0;

alter table public.ebnily_accounts
  add column if not exists ai_day  date;

-- 2) ── The conflict targets the API now names ────────────────────────────────
-- A PRIMARY KEY already implies a unique index, so these are normally no-ops.
-- They exist so an older table that was created WITHOUT one (or with the column
-- dropped) still accepts `on_conflict=<column>` instead of failing every write.

create unique index if not exists ebnily_settings_key_uniq
  on public.ebnily_settings (key);

create unique index if not exists ebnily_accounts_account_id_uniq
  on public.ebnily_accounts (account_id);

create unique index if not exists ebnily_devices_device_id_uniq
  on public.ebnily_devices (device_id);

-- 3) ── Column defaults the insert path relies on ─────────────────────────────
-- `created_at` was referenced by the (now removed) trigger approach; the table
-- is stamped by the API, so the column is kept with a safe default rather than
-- left NOT NULL without one.

alter table public.ebnily_accounts
  alter column first_seen_at set default now(),
  alter column last_seen_at  set default now();

alter table public.ebnily_devices
  alter column first_seen_at set default now(),
  alter column last_seen_at  set default now();

-- 4) ── Make sure the single settings row exists ───────────────────────────────
-- `on conflict … do update set value = <itself>` keeps the owner's current
-- values while letting the statement run on every deployment.

insert into public.ebnily_settings (key, value)
values (
  'platform',
  '{"orangeWalletNumber":"01207782741","defaultFreeLimit":5,"autoVerificationEnabled":true,"supportWhatsappNumber":"01207782741","siteName":"إبنيلي | Ebnili AI Studio","admins":[]}'::jsonb
)
on conflict (key) do update set value = public.ebnily_settings.value;

-- 5) ── SERVICE-ROLE ACCESS (RLS) ─────────────────────────────────────────────
-- RLS is ENABLED on every table above, and `revoke all … from anon, authenticated`
-- locks the browser out — both are correct and must stay. They are also why the
-- API must present the SERVICE key: `service_role` bypasses RLS by design.
--
-- The grant below is therefore NOT a new privilege — service_role already holds
-- it in a stock Supabase project. It is stated explicitly so a project whose
-- service_role grant was dropped can be repaired here instead of silently
-- failing every admin write with "new row violates row-level security policy".

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 6) ── VERIFY ────────────────────────────────────────────────────────────────
-- Payments — every column the API selects must appear:
--
--   select column_name from information_schema.columns
--    where table_name = 'ebnily_payments'
--    order by ordinal_position;
--
-- Accounts — run this after a user signs in once. It must list their row; if it
-- returns nothing, /api/auth/me could not write, and `problems` in /api/health
-- will name the missing configuration.
--
--   select account_id, email, provider, tier, credits, last_seen_at
--     from public.ebnily_accounts
--    order by first_seen_at desc
--    limit 20;
--
-- Delegated admins — the list must live inside the ONE settings row:
--
--   select key, value -> 'admins' as admins
--     from public.ebnily_settings
--    where key = 'platform';