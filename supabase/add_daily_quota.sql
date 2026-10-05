-- ═══════════════════════════════════════════════════════════════════════════
--  DAILY AI ALLOWANCE — run this ONCE on the live database
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY YOU NEED TO RUN THIS BY HAND
-- -------------------------------
-- The server now counts AI usage in the database instead of in a process-local
-- Map. That Map was wiped by every Vercel cold start and never shared between
-- instances, so the "daily limit" it enforced was really just a speed bump —
-- and the streaming route had no check at all. These two columns are what make
-- the limit (and therefore the Pro/Business distinction) actually hold.
--
-- The deployed code treats a missing column as "no usage recorded", so the site
-- keeps working if you skip this — but the allowance will not be enforced until
-- the columns exist. That is the whole point of this file.
--
-- SAFE TO RE-RUN: both statements are `if not exists`. No data is modified and
-- nothing is deleted. Existing accounts start at 0 used for today, which is
-- correct: they have not been counted yet.

alter table public.ebnily_accounts
  add column if not exists ai_used integer not null default 0;

alter table public.ebnily_accounts
  add column if not exists ai_day  date;

-- ── VERIFY: must return exactly 2 rows ─────────────────────────────────────
--   select column_name, data_type
--     from information_schema.columns
--    where table_name = 'ebnily_accounts'
--      and column_name in ('ai_used','ai_day')
--    order by column_name;
--
-- Expected:
--   ai_day  | date
--   ai_used | integer
--
-- The limits the server applies once these exist (per day, per account):
--   free      5    (a demo is enough; not enough to ship a real product)
--   pro     100    (a real project runs ~10-30 generations a day)
--   business 400    (an agency running several clients at once)
--
-- If you want to change them later, edit `TIER_DAILY_QUOTA` in api/index.ts and
-- redeploy — nothing here is hard-coded in the database.