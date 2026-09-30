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

revoke all on public.ebnily_projects from anon, authenticated;
