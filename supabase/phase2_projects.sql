-- ═══════════════════════════════════════════════════════════════════════════
--  PHASE 2 · PROJECT PUBLISHING + VERSION HISTORY
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this ONCE on the live database, then deploy. Safe to re-run: every
-- statement is `if not exists`.
--
-- WHY `share_slug` AND NOT THE PROJECT NAME
-- ----------------------------------------
-- The previous share link was `origin/preview/<slugified project name>`, which
-- the DeployModal built in the browser. That had three defects:
--
--  1. No route served it. `/preview/foo` fell through `vercel.json`'s SPA
--     fallback into index.html — a visitor got a blank studio, not their app.
--  2. It was derived from the NAME, so two projects called "لوحة تحكم" shared one
--     link, and renaming a project silently broke every link already shared.
--  3. It never checked that anything was published, so the modal could claim
--     "published" for a project that was not — the exact lie phase 2 forbids.
--
-- A slug is minted ONCE by the server at publish time, is stable for the life
-- of the project, and is what the public route resolves. `published` is the
-- switch: the route answers 404 unless it is true, so an unpublished project is
-- genuinely private rather than merely "not linked to".

alter table public.ebnily_projects
  add column if not exists share_slug   text;

alter table public.ebnily_projects
  add column if not exists published    boolean not null default false;

alter table public.ebnily_projects
  add column if not exists published_at timestamptz;

-- Uniqueness is what makes `/preview/<slug>` unambiguous: two projects must
-- never resolve to the same address, or a shared link would serve somebody
-- else's app. NULLs are allowed and do not collide (a project is not published).
create unique index if not exists ebnily_projects_share_slug_uniq
  on public.ebnily_projects (share_slug);

-- The public route filters on published, so this index is the hot path for
-- every anonymous visitor — including the common "not published" case.
create index if not exists ebnily_projects_published_idx
  on public.ebnily_projects (published);

-- ── VERIFY ───────────────────────────────────────────────────────────────────
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'ebnily_projects'
--      and column_name in ('share_slug','published','published_at')
--    order by column_name;
--
-- Expected 3 rows: published | boolean | NO, published_at | date| timestamptz | YES,
-- share_slug | text | YES.
--
-- Confirm no two projects share a slug (must return 0 rows):
--   select share_slug, count(*)
--     from public.ebnily_projects
--    where share_slug is not null
--    group by share_slug having count(*) > 1;
--
-- The functions/columns from phase 1 are unrelated and untouched by this file.