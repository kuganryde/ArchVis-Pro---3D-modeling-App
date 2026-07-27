-- ArchViz Pro — SaaS foundation schema
-- Multi-tenant model: users belong to workspaces; projects live in workspaces.
-- Row-Level Security ensures a user can only read/write data in workspaces they
-- are a member of.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, holds display metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspaces: the tenant boundary (an org / team / personal space).
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspace_members: which users belong to which workspace, and their role.
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- projects: a saved design (rooms + assets + blueprint) inside a workspace.
-- `data` holds the serialized design payload as JSONB.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null default 'Untitled Project',
  data          jsonb not null default '{"rooms":[],"assets":[],"blueprintImage":null}'::jsonb,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists projects_workspace_idx on public.projects (workspace_id);

-- ---------------------------------------------------------------------------
-- Helper: membership check (SECURITY DEFINER avoids RLS recursion).
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;

-- profiles: a user manages only their own profile row.
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: members can read; the owner can update/delete; any authed user
-- can create a workspace they own.
drop policy if exists "workspaces read" on public.workspaces;
create policy "workspaces read" on public.workspaces
  for select using (public.is_workspace_member(id) or owner_id = auth.uid());

drop policy if exists "workspaces insert" on public.workspaces;
create policy "workspaces insert" on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "workspaces modify" on public.workspaces;
create policy "workspaces modify" on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "workspaces delete" on public.workspaces;
create policy "workspaces delete" on public.workspaces
  for delete using (owner_id = auth.uid());

-- workspace_members: members can see the roster; users insert their own row
-- (used by the signup trigger / joining a workspace they own).
drop policy if exists "members read" on public.workspace_members;
create policy "members read" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id) or user_id = auth.uid());

drop policy if exists "members insert self" on public.workspace_members;
create policy "members insert self" on public.workspace_members
  for insert with check (user_id = auth.uid());

-- projects: full CRUD limited to members of the owning workspace.
drop policy if exists "projects member crud" on public.projects;
create policy "projects member crud" on public.projects
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- New-user bootstrap: on signup, create a profile, a personal workspace, and
-- add the user as its owner-member so they have somewhere to save projects.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (name, owner_id)
    values ('My Workspace', new.id)
    returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep projects.updated_at fresh on write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated on public.projects;
create trigger projects_touch_updated
  before update on public.projects
  for each row execute function public.touch_updated_at();
