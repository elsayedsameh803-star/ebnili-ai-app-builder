-- ═══════════════════════════════════════════════════════════════════════════
--  PHASE 1 · ATOMIC AI ALLOWANCE — run this ONCE, in order, before deploying
-- ═══════════════════════════════════════════════════════════════════════════
-- This is the ONE file to paste. It replaces two others that must otherwise be
-- run in the right order by hand:
--   add_daily_quota.sql      (columns)    ← must run BEFORE the functions
--   add_atomic_ai_credit.sql (functions)
-- Running the functions without the columns fails, and running the columns
-- without the functions leaves the allowance unenforced. One file, no order to
-- remember.
--
-- ⚠️  RUN THIS BEFORE THE CODE DEPLOY
-- ------------------------------------
-- The server is now FAIL-CLOSED: if `ebnily_consume_ai_credit` does not exist,
-- every AI request is refused. That is deliberate — an outage must never become
-- an unlimited window on the owner's Gemini key — but it means deploying the
-- code without this file breaks the studio. SQL first, deploy second.
--
-- WHY A DATABASE FUNCTION AND NOT A READ-THEN-WRITE IN THE API
-- ------------------------------------------------------------
-- Any implementation that SELECTs the counter and then PATCHes it back is a
-- race: N simultaneous requests all read the same value, all decide they are
-- under the limit, and all write used+1. The counter under-reports and the
-- customer gets N times the allowance for the price of one. That is not a rare
-- edge case — a user who hits "generate" five times in a second is exactly the
-- normal interaction with this product.
--
-- A `SELECT … FOR UPDATE` inside a PL/pgSQL function is atomic: Postgres holds
-- the row lock for the whole function, so the day rollover, the limit check and
-- the increment cannot interleave. Concurrent callers are serialised by the
-- database itself, and it is correct across every Vercel instance at once.
--
-- This function is the ONLY place an AI allowance is spent. The API never writes
-- `ai_used` directly.
--
-- SAFE TO RE-RUN: `if not exists` for the columns, `create or replace` for the
-- functions. No data is modified, nothing is deleted.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) COLUMNS — must exist before the functions that reference them
-- ─────────────────────────────────────────────────────────────────────────────
-- A database created before this change has `ebnily_accounts` WITHOUT these, so
-- the quota code would have nothing to read and would treat every account as
-- having spent nothing — which is worse than having no quota at all, because it
-- would look correct.
--
-- `ai_day` is the UTC day the counter belongs to, stored as YYYY-MM-DD. The
-- daily reset is therefore free: a request on a new day simply does not match
-- `ai_day`, so the counter restarts from zero. No cron, no cleanup job.

alter table public.ebnily_accounts
  add column if not exists ai_used integer not null default 0;

alter table public.ebnily_accounts
  add column if not exists ai_day  date;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) CENTRAL CEILING — defined first, because the consume function calls it
-- ─────────────────────────────────────────────────────────────────────────────
-- The single number no account may exceed, whatever the plan says. Every check
-- below is clamped by it, so raising a plan in the application code can never
-- accidentally open an unbounded key, and a tampered `p_limit` argument cannot
-- either. Change it in ONE place; the API keeps no competing copy.
--
--   free      5    a demo is enough to fall in love, not enough to ship
--   pro     100    a real project runs ~10-30 generations a day
--   business 400    an agency's whole studio
-- The plan-specific numbers live in `api/security.ts` (TIER_DAILY_QUOTA);
-- this is the hard backstop that clamps ALL of them.

create or replace function public.ebnily_ai_ceiling()
returns integer
language sql
immutable
as $$
  select 400;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- 3) THE ATOMIC SPEND
-- ─────────────────────────────────────────────────────────────────────────────
-- RETURNED SHAPE
--   allowed     → true only when a credit was actually taken
--   used        → the counter AFTER this call (what was spent today)
--   limit_value → the ceiling that applied (clamped by ebnily_ai_ceiling)
--   day         → the UTC day the counter belongs to, so the client can show
--                 when it resets without guessing the server's timezone

create or replace function public.ebnily_consume_ai_credit(
  p_account_id text,
  p_limit      integer
)
returns table (allowed boolean, used integer, limit_value integer, day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_row   public.ebnily_accounts;
  v_allow integer;
begin
  -- The row lock. Two callers racing on the same account are serialised here,
  -- which is the entire point of the function.
  select * into v_row
    from public.ebnily_accounts
   where account_id = p_account_id
     for update;

  -- No row: authenticated but never synced, so there is nothing to charge.
  -- Refusing is correct — a missing row must never read as "unlimited".
  if not found then
    return query select false, 0, least(coalesce(p_limit, 0), public.ebnily_ai_ceiling()), v_today;
    return;
  end if;

  -- Day rollover inside the SAME locked transaction: yesterday's count is
  -- discarded without a cron, and a client cannot race the boundary by reading
  -- before the write.
  if v_row.ai_day is distinct from v_today then
    v_row.ai_used := 0;
  end if;

  v_allow := least(coalesce(p_limit, 0), public.ebnily_ai_ceiling());

  if v_row.ai_used >= v_allow then
    -- Refused. The counter is NOT advanced — a rejected request must not push
    -- the customer further from using what they paid for — but the day is
    -- stamped so the reported numbers stay truthful.
    update public.ebnily_accounts set ai_day = v_today where account_id = p_account_id;
    return query select false, v_row.ai_used, v_allow, v_today;
    return;
  end if;

  v_row.ai_used := v_row.ai_used + 1;

  update public.ebnily_accounts
     set ai_used = v_row.ai_used,
         ai_day  = v_today
   where account_id = p_account_id;

  return query select true, v_row.ai_used, v_allow, v_today;
end;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- 4) READ-ONLY SIBLING — same numbers, spends nothing
-- ─────────────────────────────────────────────────────────────────────────────
-- Used to draw the usage meter. It MUST not spend: a UI that polls on an
-- interval would otherwise burn the whole allowance by watching it.

create or replace function public.ebnily_read_ai_credit(
  p_account_id text
)
returns table (used integer, day date)
language sql
security definer
set search_path = public
as $$
  select a.ai_used::integer, a.ai_day
    from public.ebnily_accounts a
   where a.account_id = p_account_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) GRANTS — service_role only; the browser must never credit itself
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.ebnily_consume_ai_credit(text, integer) from public, anon, authenticated;
revoke all on function public.ebnily_read_ai_credit(text) from public, anon, authenticated;
revoke all on function public.ebnily_ai_ceiling() from public, anon, authenticated;

grant execute on function public.ebnily_consume_ai_credit(text, integer) to service_role;
grant execute on function public.ebnily_read_ai_credit(text) to service_role;
grant execute on function public.ebnily_ai_ceiling() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — three checks, each should return its stated shape
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The two columns exist:
--      select column_name, data_type from information_schema.columns
--       where table_name = 'ebnily_accounts'
--         and column_name in ('ai_used','ai_day')
--       order by column_name;
--      -- ai_day  | date
--      -- ai_used | integer
--
-- 2. All three functions exist and are SECURITY DEFINER:
--      select proname, prosecdef from pg_proc
--       where proname in ('ebnily_consume_ai_credit',
--                         'ebnily_read_ai_credit',
--                         'ebnily_ai_ceiling');
--      -- 3 rows, prosecdef = t
--
-- 3. The ceiling is readable:
--      select public.ebnily_ai_ceiling();   -- 400
--
-- After this succeeds, deploy the code. Until then the previous deployment is
-- still the one running, so the site stays live either way.