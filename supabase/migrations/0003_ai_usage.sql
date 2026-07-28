-- ArchViz Pro — hosted AI usage metering (per workspace, per calendar month).
-- Rows are incremented only by the server (service role) after a successful
-- hosted AI generation. Members may READ their workspace's usage so the UI can
-- show remaining credits.

create table if not exists public.ai_usage (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period       text not null,            -- 'YYYY-MM' (UTC)
  count        integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, period)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage read" on public.ai_usage;
create policy "ai_usage read" on public.ai_usage
  for select using (public.is_workspace_member(workspace_id));

-- Atomic "consume one credit" — upsert + increment, returns the new count.
create or replace function public.increment_ai_usage(ws uuid, p text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (workspace_id, period, count, updated_at)
    values (ws, p, 1, now())
  on conflict (workspace_id, period)
    do update set count = public.ai_usage.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;
