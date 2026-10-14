-- ═══════════════════════════════════════════════════════════════════════════
--  MONTHLY PLANS — the paid tiers measure their allowance over a month
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY THIS EXISTS
-- ---------------
-- `add_atomic_ai_credit.sql` spent the allowance against a DAILY counter
-- (`ai_used` / `ai_day`): every Pro/Business account had its whole monthly
-- budget back at every UTC midnight, so 150 credits became "150 in one evening"
-- rather than a month. This migration introduces a SEPARATE monthly counter
-- and makes the spend function window-aware, so the SAME number (150 / 400) is
-- now measured across a calendar month for a paid tier, while the FREE plan
-- keeps its daily reset.
--
-- TWO COUNTERS, NOT ONE
-- ---------------------
-- `ai_day` / `ai_used`         → the daily window  (FREE plan).
-- `ai_month` / `ai_month_used` → the monthly window (PRO / BUSINESS).
-- They are kept apart so a tier change cannot cross-contaminate them: a Free
-- account that upgrades to Pro starts the month fresh, and a Pro account that
-- drops back to Free starts the day fresh. Both are `if not exists`, so this
-- file is safe to run twice.
--
-- BACKWARD-COMPATIBLE: the function keeps its original two parameters and ADDS
-- an optional third (`p_window`), so any old caller sending only
-- `(p_account_id, p_limit)` keeps the daily behaviour exactly as before.

-- ── 1. THE MONTHLY COLUMNS ──────────────────────────────────────────────────
alter table public.ebnily_accounts
  add column if not exists ai_month      date;

-- ── 2. THE WINDOW-AWARE SPEND ───────────────────────────────────────────────
-- Same atomic row lock, same fail-closed posture as the original. The only
-- change is WHICH counter the window selects:
--   p_window = 'month' → ai_month / ai_month_used, reset key = first of month
--   anything else      → ai_day   / ai_used,      reset key = today  (unchanged)
create or replace function public.ebnily_consume_ai_credit(
  p_account_id text,
  p_limit      integer,
  p_window     text default 'day'
)
returns table (allowed boolean, used integer, limit_value integer, day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := (now() at time zone 'utc')::date;
  v_month   date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_row     public.ebnily_accounts;
  v_ceiling integer := public.ebnily_ai_ceiling();
  v_stamp   date;
  v_used    integer;
begin
  -- The row lock is taken here. Two callers racing on the same account are
  -- serialised at this point, which is the entire point of the function.
  select * into v_row
    from public.ebnily_accounts
   where account_id = p_account_id
     for update;

  -- No account row: authenticated but never synced, so nothing to charge.
  -- Refusing is correct — a missing row must never read as "unlimited".
  if not found then
    return query select false, 0, least(p_limit, v_ceiling), v_today;
    return;
  end if;

  -- Pick the counter pair for the window. The month branch reads/writes the
  -- monthly columns; every other value keeps the original daily columns.
  if p_window = 'month' then
    v_stamp := v_month;
    v_used  := coalesce(v_row.ai_month_used, 0);
    if v_row.ai_month is distinct from v_month then
      v_used := 0;
    end if;
  else
    v_stamp := v_today;
    v_used  := coalesce(v_row.ai_used, 0);
    if v_row.ai_day is distinct from v_today then
      v_used := 0;
    end if;
  end if;

  -- Hard guard independent of the plan: a plan ceiling can be raised in code,
  -- but nothing can push one account past the absolute ceiling, and a tampered
  -- `limit` argument cannot either.
  if v_used >= least(p_limit, v_ceiling) then
    if p_window = 'month' then
      update public.ebnily_accounts set ai_month = v_month where account_id = p_account_id;
    else
      update public.ebnily_accounts set ai_day = v_today where account_id = p_account_id;
    end if;
    return query select false, v_used, least(p_limit, v_ceiling), v_stamp;
    return;
  end if;

  v_used := v_used + 1;

  if p_window = 'month' then
    update public.ebnily_accounts
       set ai_month_used = v_used,
           ai_month      = v_month
     where account_id = p_account_id;
  else
    update public.ebnily_accounts
       set ai_used = v_used,
           ai_day  = v_today
     where account_id = p_account_id;
  end if;

  return query select true, v_used, least(p_limit, v_ceiling), v_stamp;
end;
$$;

-- ── 3. THE READ-ONLY SIBLING, ALSO WINDOW-AWARE ─────────────────────────────
-- Draws the meter. MUST not spend: a UI that polls on an interval would
-- otherwise burn the whole allowance by watching it. Same window selection.
create or replace function public.ebnily_read_ai_credit(
  p_account_id text,
  p_window     text default 'day'
)
returns table (used integer, day date)
language sql
security definer
set search_path = public
as $$
  select
    case
      when p_window = 'month' then coalesce(a.ai_month_used, 0)::integer
      else coalesce(a.ai_used, 0)::integer
    end,
    case
      when p_window = 'month' then a.ai_month
      else a.ai_day
    end
  from public.ebnily_accounts a
  where a.account_id = p_account_id;
$$;

-- ── PERMISSIONS (unchanged from the original: service_role only) ────────────
revoke all on function public.ebnily_consume_ai_credit(text, integer, text) from public, anon, authenticated;
revoke all on function public.ebnily_read_ai_credit(text, text) from public, anon, authenticated;
grant execute on function public.ebnily_consume_ai_credit(text, integer, text) to service_role;
grant execute on function public.ebnily_read_ai_credit(text, text) to service_role;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
--   select public.ebnily_consume_ai_credit('<uuid>', 150, 'month');  -- Pro, monthly
--   select public.ebnily_consume_ai_credit('<uuid>', 3,   'day');    -- Free, daily
--   select public.ebnily_read_ai_credit('<uuid>', 'month');          -- read the meter
