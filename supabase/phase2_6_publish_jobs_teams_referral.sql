-- ═══════════════════════════════════════════════════════════════════════════
-- EBNILY  ·  Phase 2 & 5 & 6 additions
--   • Publish  (Phase 2)  → publish a project to a stable public URL slug
--   • Jobs     (Phase 2)  → long-running AI build queue (async, pollable)
--   • Teams    (Phase 5)  → shared projects with explicit roles/permissions
--   • Referral (Phase 6)  → invite code + credited referral tracking
--
-- Run ONCE in the Supabase SQL editor. SAFE TO RE-RUN: every statement is
-- `create table if not exists`, `add column if not exists`, or an idempotent
-- index/grant. It APPENDS to `supabase/projects.sql` — never edits that file.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 2.1  PROJECTS: publish columns ───────────────────────────────────────────
-- A published project is served at /api/s/:slug with NO session (a public
-- link). The slug is minted server-side and unique; the API flips `published`
-- rather than duplicating the row, so there is exactly one source of truth.
-- `published_html` is a frozen snapshot at publish time — editing the draft
-- afterwards must NOT change the public link until re-publish.
alter table public.ebnily_projects
  add column if not exists published      boolean     not null default false,
  add column if not exists slug           text        unique,
  add column if not exists published_html text,
  add column if not exists published_at   timestamptz;

create index if not exists ebnily_projects_slug_idx
  on public.ebnily_projects (slug)
  where published = true;


-- ── 2.2  JOBS: async AI build queue ──────────────────────────────────────────
-- WHY: a full-app generation streams for up to the serverless function timeout.
-- A job row lets the client start a build, close the tab, and poll for the
-- result instead of holding one HTTP request open for the whole generation.
create table if not exists public.ebnily_jobs (
  id          text        primary key,
  owner_id    text        not null,
  kind        text        not null default 'generate',   -- generate | refine | architect
  status      text        not null default 'queued',      -- queued | running | done | failed
  prompt      text        not null default '',
  result      jsonb,                                      -- { files, code } on success
  error       text,                                       -- human-readable on failure
  progress    integer     not null default 0,             -- 0..100, coarse
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ebnily_jobs_owner_created_idx
  on public.ebnily_jobs (owner_id, created_at desc);


-- ── 5  TEAMS + PERMISSIONS ───────────────────────────────────────────────────
-- A team shares projects. `role` is the permission boundary and is enforced
-- SERVER-SIDE on every project mutation: owner > member > guest. Columns and
-- roles mirror the existing `UserTeam` / `UserTeamMember` types in src/types.ts
-- exactly (name_ar/name_en, owner|member|guest) so no client type is duplicated.
create table if not exists public.ebnily_teams (
  id          text        primary key,
  owner_id    text        not null,             -- the account that created it
  name_ar     text        not null default '',
  name_en     text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.ebnily_team_members (
  id          text        primary key,
  team_id     text        not null,
  user_id     text        not null,             -- member's account id
  user_email  text        not null,
  user_name   text        not null default '',
  role        text        not null default 'guest',   -- owner | member | guest
  joined_at   timestamptz not null default now(),
  active      boolean     not null default true,
  unique (team_id, user_id)
);

create index if not exists ebnily_team_members_team_idx
  on public.ebnily_team_members (team_id);
create index if not exists ebnily_team_members_user_idx
  on public.ebnily_team_members (user_id);


-- ── 6  REFERRALS ─────────────────────────────────────────────────────────────
-- Each account gets ONE invite code. A referral row records that code A invited
-- account B. Written once (unique on the referred account) so an invite cannot
-- be farmed by the same person twice. `rewarded` grants a bonus asynchronously.
create table if not exists public.ebnily_referrals (
  id              text        primary key,
  referrer_email  text        not null,   -- who shared the code
  referrer_code   text        not null,
  referred_email  text        not null,   -- who signed up with it (unique → once)
  referred_at     timestamptz not null default now(),
  rewarded        boolean     not null default false,
  unique (referred_email)
);

create index if not exists ebnily_referrals_code_idx
  on public.ebnily_referrals (referrer_code);

-- The referral code is resolved SERVER-side (code → account) in O(1), so each
-- account stores its own single code rather than every code being reverse-hashed
-- from an email. Added lazily on first visit (see GET /api/referral), so this is
-- a nullable, unique column — never required for the account row itself.
alter table public.ebnily_accounts
  add column if not exists referral_code text;

create unique index if not exists ebnily_accounts_referral_code_key
  on public.ebnily_accounts (referral_code)
  where referral_code is not null;


-- ── ATOMIC BONUS GRANT (referral reward) ─────────────────────────────────────
-- Granting a bonus is the INVERSE of spending and must be just as atomic: two
-- applies racing the same referrer would otherwise both read the counter, both
-- subtract, and both write the same value — crediting half the bonus. A single
-- UPDATE … RETURNING inside a locked function is the same guarantee
-- `ebnily_consume_ai_credit` relies on, for exactly the same reason. It lowers
-- TODAY's counter only (floor 0), so a bonus raises what the referrer can still
-- spend today without ever touching a hard ceiling.
create or replace function public.ebnily_grant_ai_credit(
  p_account_id text,
  p_amount     integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_used  integer;
begin
  update public.ebnily_accounts
     set ai_used = greatest(0, ai_used - greatest(0, p_amount)),
         ai_day  = v_today
   where account_id = p_account_id
     and ai_day = v_today
  returning ai_used into v_used;
  return coalesce(v_used, 0);
end;
$$;

revoke all on function public.ebnily_grant_ai_credit(text, integer) from public, anon, authenticated;
grant execute on function public.ebnily_grant_ai_credit(text, integer) to service_role;


-- ── SERVICE-ROLE ACCESS (RLS) ────────────────────────────────────────────────
alter table public.ebnily_jobs           enable row level security;
alter table public.ebnily_teams          enable row level security;
alter table public.ebnily_team_members   enable row level security;
alter table public.ebnily_referrals      enable row level security;

revoke all on public.ebnily_jobs           from anon, authenticated;
revoke all on public.ebnily_teams          from anon, authenticated;
revoke all on public.ebnily_team_members   from anon, authenticated;
revoke all on public.ebnily_referrals      from anon, authenticated;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
--   select id, slug, published, published_at from public.ebnily_projects
--     where published = true limit 10;
--   select id, kind, status, progress from public.ebnily_jobs
--     order by created_at desc limit 10;
--   select team_id, user_email, role from public.ebnily_team_members limit 20;
--   select referrer_code, referred_email, rewarded from public.ebnily_referrals;


