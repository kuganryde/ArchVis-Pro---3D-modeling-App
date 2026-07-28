-- ArchViz Pro — hosted AI result cache (per workspace).
-- Identical inputs (same blueprint image / same prompt) return the stored layout
-- instead of re-calling Gemini, cutting COGS. Cache hits do NOT consume a credit.
-- Written only by the server (service-role key); RLS is enabled with no client
-- policies, so the browser cannot read the cache directly.

create table if not exists public.ai_cache (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  cache_key    text not null,          -- sha256 of kind + normalized input
  kind         text not null,          -- 'digitize' | 'rebuild'
  result       jsonb not null,
  hits         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, cache_key)
);

alter table public.ai_cache enable row level security;
-- (no policies: only the service role — which bypasses RLS — touches this table.)
