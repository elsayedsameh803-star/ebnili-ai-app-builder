-- Projects store (one row per project, owned by the signed-in account).
--
-- Run this ONCE in the Supabase SQL editor. Until it exists, /api/projects
-- answers 503 DB_UNAVAILABLE and the UI says so — it never invents data.
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

-- Defence in depth: the API only ever talks to this table with the service key,
-- but locking the anon role out means a leaked anon key cannot read anyone's
-- projects even if someone changes the request headers.
alter table public.ebnily_projects enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════
-- PAYMENT REQUESTS  (Orange Cash review queue)
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY THIS EXISTS: a payment used to be written only as a file in object
-- storage, so /api/admin/overview always answered `recentTransactions: []` and
-- the owner could never see or approve a payment from the dashboard. The row
-- below is the reviewable record; the receipt image stays in storage and this
-- table only holds its path.
--
-- account_email is the signed-in address that submitted the request, and it is
-- what the plan grant is minted for — so it must be filled by the SERVER from
-- the session cookie, never from the request body.

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

alter table public.ebnily_payments enable row level security;

revoke all on public.ebnily_payments from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- DEVICES  (abuse protection registry)
-- ═══════════════════════════════════════════════════════════════════════════
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

alter table public.ebnily_devices enable row level security;

revoke all on public.ebnily_devices from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- PLATFORM SETTINGS  (owner-editable values that survive a redeploy)
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY THIS EXISTS: POST /api/admin/settings used to answer `persisted: false`
-- and throw the values away, so changing the Orange Cash wallet number in the
-- dashboard did nothing at all.

create table if not exists public.ebnily_settings (
  key                    text primary key,
  value                  jsonb       not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

alter table public.ebnily_settings enable row level security;

revoke all on public.ebnily_settings from anon, authenticated;

-- Seed the single settings row so the first read has something to return.
insert into public.ebnily_settings (key, value)
values (
  'platform',
  '{"orangeWalletNumber":"01207782741","defaultFreeLimit":5,"autoVerificationEnabled":true,"supportWhatsappNumber":"01207782741","siteName":"إبنيلي | Ebnili AI Studio"}'::jsonb
)
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- ACCOUNTS  (who signed up, what they were given, and whether they are here)
-- ═══════════════════════════════════════════════════════════════════════════
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

alter table public.ebnily_accounts enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPAIR SCRIPT  (safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY THIS FILE EXISTS NOW
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
--
-- Run this once in the Supabase SQL editor. It is idempotent.

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
-- Run this after a user signs in once. It must list their row; if it returns
-- nothing, /api/auth/me could not write, and `problems` in /api/health will name
-- the missing configuration.
--
--   select account_id, email, provider, tier, credits, last_seen_at
--     from public.ebnily_accounts
--    order by first_seen_at desc
--    limit 20;
--
-- And the delegated-admin list must live inside the ONE settings row:
--
--   select key, value -> 'admins' as admins
--     from public.ebnily_settings
--    where key = 'platform';

revoke all on public.ebnily_accounts from anon, authenticated;

