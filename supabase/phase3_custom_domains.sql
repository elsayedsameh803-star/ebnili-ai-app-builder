-- ════════════════════════════════════════════════════════════════════════════════
-- Phase 3 — Custom domain linking (per-project)
-- ════════════════════════════════════════════════════════════════════════════════
-- Adds three nullable columns to `ebnily_projects` so each signed-in user can
-- attach one custom domain to a published project.
--
-- Status lifecycle:
--   pending    — domain saved, waiting for the user to add DNS records
--   verifying  — /api/domains/verify was called; DNS check in progress
--   active     — CNAME/A record confirmed; traffic routed to this project
--   failed     — DNS check failed; `custom_domain_error` holds the Arabic reason
-- ════════════════════════════════════════════════════════════════════════════════

alter table if exists public.ebnily_projects
  add column if not exists custom_domain text null,
  add column if not exists custom_domain_status text null
    constraint ebnily_projects_domain_status_check
      check (custom_domain_status in ('pending','verifying','active','failed')),
  add column if not exists custom_domain_error text null;

-- Look up a project by its custom domain for host-based routing (server.ts
-- middleware). One domain = one active project, enforced by the unique index.
create unique index if not exists ebnily_projects_custom_domain_active_idx
  on public.ebnily_projects (custom_domain)
  where custom_domain_status = 'active' and custom_domain is not null;

-- Helpful for listing a user's domains and for the re-verification cron.
create index if not exists ebnily_projects_owner_domain_idx
  on public.ebnily_projects (owner_id, custom_domain_status);