-- ═══════════════════════════════════════════════════════════════════════════
--  ATOMIC AI ALLOWANCE — the single source of truth for AI usage
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY A DATABASE FUNCTION AND NOT A READ-THEN-WRITE IN THE API
-- -------------------------------------------------------
-- Any implementation that SELECTs the counter and then PATCHes it back is a
-- race: N simultaneous requests all read the same value, all decide they are
-- under the limit, and all write used+1. The counter under-reports and the
-- customer gets N times the allowance for the price of one. That is not a rare
-- edge case — a user who hits "generate" five times in a second is exactly the
-- normal interaction with this product.
--
-- A single `UPDATE … WHERE … RETURNING` inside a PL/pgSQL function is atomic:
-- Postgres takes a row lock for the duration, so the check and the increment
-- cannot be interleaved. Concurrent callers are serialised by the database
-- itself, with no application-level locking and nothing to get wrong.
--
-- The function is the ONLY place an AI allowance is spent. The API never writes
-- `ai_used` directly.
--
-- RETURNED SHAPE
--   allowed  → true when a credit was actually taken
--   used     → the counter AFTER this call (what the customer has spent today)
--   limit    → the plan ceiling that applied
--   day      → the UTC day the counter belongs to (so the client can show when
--              it resets without guessing the server's timezone)

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
  v_today   date := (now() at time zone 'utc')::date;
  v_row     public.ebnily_accounts;
begin
  -- The row lock is taken here. Two callers racing on the same account are
  -- serialised at this point, which is the entire point of the function.
  select * into v_row
    from public.ebnily_accounts
   where account_id = p_account_id
     for update;

  -- No account row: the caller is authenticated but has never synced, so there
  -- is nothing to charge. Refusing is correct — a missing row must never read as
  -- "unlimited".
  if not found then
    return query select false, 0, p_limit, v_today;
    return;
  end if;

  -- Day rollover happens HERE, inside the same locked transaction. Yesterday's
  -- count is discarded without a cron, and a client cannot race the boundary by
  -- reading before the write.
  if v_row.ai_day is distinct from v_today then
    v_row.ai_used := 0;
  end if;

  -- Hard guard independent of the plan: a plan ceiling can be raised in code,
  -- but nothing can push one account past this, and a signed but tampered
  -- `limit` argument cannot either.
  if v_row.ai_used >= least(p_limit, public.ebnily_ai_ceiling()) then
    update public.ebnily_accounts
       set ai_day = v_today
     where account_id = p_account_id;
    return query select false, v_row.ai_used, least(p_limit, public.ebnily_ai_ceiling()), v_today;
    return;
  end if;

  v_row.ai_used := v_row.ai_used + 1;

  update public.ebnily_accounts
     set ai_used = v_row.ai_used,
         ai_day  = v_today
   where account_id = p_account_id;

  return query
    select true, v_row.ai_used, least(p_limit, public.ebnily_ai_ceiling()), v_today;
end;
$$;

-- The read-only sibling: same numbers, spends nothing. A UI that polls this on
-- an interval must not be charged for watching the meter.
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

-- CENTRAL CEILING
-- ---------------
-- The single number no account may exceed, whatever the plan says. Every check
-- in `ebnily_consume_ai_credit` is clamped by it, so raising a plan in the
-- application code can never accidentally open an unbounded key. Change it in
-- ONE place; the API does not carry a competing copy.
create or replace function public.ebnily_ai_ceiling()
returns integer
language sql
immutable
as $$
  select 400;
$$;

revoke all on function public.ebnily_consume_ai_credit(text, integer) from public, anon, authenticated;
revoke all on function public.ebnily_read_ai_credit(text) from public, anon, authenticated;
revoke all on function public.ebnily_ai_ceiling() from public, anon, authenticated;

-- Only the service role (which bypasses RLS by design) may call these. The
-- browser must never be able to credit itself.
grant execute on function public.ebnily_consume_ai_credit(text, integer) to service_role;
grant execute on function public.ebnily_read_ai_credit(text) to service_role;
grant execute on function public.ebnily_ai_ceiling() to service_role;

-- ── VERIFY ───────────────────────────────────────────────────────────────────
--   select proname, prosecdef
--     from pg_proc
--    where proname in ('ebnily_consume_ai_credit','ebnily_read_ai_credit','ebnily_ai_ceiling');
--
-- Expect 3 rows. Then confirm the ceiling is shared by everything:
--   select public.ebnily_ai_ceiling();   -- 400
--
-- The service key is the only caller, so this never runs in the browser:
--   curl -X POST "https://<ref>.supabase.co/rest/v1/rpc/ebnily_consume_ai_credit" \
--     -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"p_account_id":"<uuid>","p_limit":100}'
--   -- {"allowed":true,"used":1,"limit_value":100,"day":"2026-10-05"}