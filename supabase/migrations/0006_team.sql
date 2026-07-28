-- ArchViz Pro — team collaboration: invitations, roles, tightened membership RLS.

-- ---------------------------------------------------------------------------
-- Admin check (owner or admin). SECURITY DEFINER to avoid RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_admin(ws uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- invitations: pending invites by email. Accepted when the invitee signs in.
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null,
  role         text not null default 'member' check (role in ('admin', 'member')),
  invited_by   uuid references auth.users (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at   timestamptz not null default now()
);
create unique index if not exists invitations_ws_email_pending
  on public.invitations (workspace_id, lower(email)) where status = 'pending';

alter table public.invitations enable row level security;

-- Admins manage their workspace's invitations.
drop policy if exists "inv admin manage" on public.invitations;
create policy "inv admin manage" on public.invitations
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- The invitee can see their own pending invitations.
drop policy if exists "inv invitee read" on public.invitations;
create policy "inv invitee read" on public.invitations
  for select using (lower(email) = lower(auth.email()) and status = 'pending');

-- ---------------------------------------------------------------------------
-- Tighten workspace_members: remove the over-permissive self-insert (it let any
-- user add themselves to ANY workspace). Joins now go through SECURITY DEFINER
-- functions only (signup trigger, create_personal_workspace, accept_invitation).
-- ---------------------------------------------------------------------------
drop policy if exists "members insert self" on public.workspace_members;

-- Admins may remove members (never the owner).
drop policy if exists "members admin delete" on public.workspace_members;
create policy "members admin delete" on public.workspace_members
  for delete using (public.is_workspace_admin(workspace_id) and role <> 'owner');

-- A member may remove themselves (leave), unless they are the owner.
drop policy if exists "members leave" on public.workspace_members;
create policy "members leave" on public.workspace_members
  for delete using (user_id = auth.uid() and role <> 'owner');

-- Admins may change a member's role (never the owner's).
drop policy if exists "members admin update" on public.workspace_members;
create policy "members admin update" on public.workspace_members
  for update using (public.is_workspace_admin(workspace_id) and role <> 'owner')
  with check (public.is_workspace_admin(workspace_id) and role <> 'owner');

-- ---------------------------------------------------------------------------
-- Let members read the profiles of people they share a workspace with (so the
-- team list can show names). Own-profile access stays via the 0001 policy.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles co-member read" on public.profiles;
create policy "profiles co-member read" on public.profiles
  for select using (
    exists (
      select 1
      from public.workspace_members me
      join public.workspace_members them on me.workspace_id = them.workspace_id
      where me.user_id = auth.uid() and them.user_id = public.profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- Controlled joins (SECURITY DEFINER).
-- ---------------------------------------------------------------------------

-- Create a personal workspace + owner membership (fallback for ensureWorkspace).
create or replace function public.create_personal_workspace(ws_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  insert into public.workspaces (name, owner_id)
    values (coalesce(nullif(ws_name, ''), 'My Workspace'), auth.uid())
    returning id into wid;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (wid, auth.uid(), 'owner');
  return wid;
end;
$$;

-- Accept an invitation addressed to the caller's email.
create or replace function public.accept_invitation(invite uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where id = invite and status = 'pending';
  if inv.id is null then
    raise exception 'Invitation not found or already handled';
  end if;
  if lower(inv.email) <> lower(auth.email()) then
    raise exception 'This invitation is for a different email address';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;
  update public.invitations set status = 'accepted' where id = invite;
  return inv.workspace_id;
end;
$$;

grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.create_personal_workspace(text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
