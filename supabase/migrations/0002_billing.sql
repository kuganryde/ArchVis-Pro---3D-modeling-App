-- ArchViz Pro — billing schema (Stripe subscriptions, per workspace).
-- One subscription row per workspace. Rows are written only by the server
-- (Stripe webhook) using the service-role key, which bypasses RLS. Members may
-- READ their workspace's subscription so the UI can gate features and show plan.

create table if not exists public.subscriptions (
  workspace_id           uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status                 text not null default 'inactive',
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Members can read their workspace's subscription. No client-side write policy:
-- all writes go through the server (service role) from verified Stripe webhooks.
drop policy if exists "subscriptions read" on public.subscriptions;
create policy "subscriptions read" on public.subscriptions
  for select using (public.is_workspace_member(workspace_id));

-- Convenience: resolve a workspace's effective plan (defaults to 'free').
create or replace function public.workspace_plan(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select plan from public.subscriptions
      where workspace_id = ws
        and status in ('active', 'trialing')
      limit 1),
    'free'
  );
$$;
