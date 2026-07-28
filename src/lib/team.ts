/**
 * Team collaboration data layer: members, roles, and invitations.
 * RLS enforces who can do what; the UI mirrors those rules.
 */
import { supabase } from './supabase';

export type Role = 'owner' | 'admin' | 'member';

export interface Member {
  userId: string;
  role: Role;
  name: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member';
  status: string;
  createdAt: string;
  workspaceName?: string;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** Members of a workspace, with display names resolved from profiles. */
export async function listMembers(workspaceId: string): Promise<Member[]> {
  const { data, error } = await client()
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.user_id);

  let names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await client().from('profiles').select('id, full_name').in('id', ids);
    names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || 'Member']));
  }

  const rank: Record<Role, number> = { owner: 0, admin: 1, member: 2 };
  return rows
    .map((r) => ({ userId: r.user_id, role: r.role as Role, name: names[r.user_id] || 'Member' }))
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
}

/** Pending invitations for a workspace (admin view). */
export async function listInvitations(workspaceId: string): Promise<Invitation[]> {
  const { data, error } = await client()
    .from('invitations')
    .select('id, workspace_id, email, role, status, created_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) => ({
    id: i.id,
    workspaceId: i.workspace_id,
    email: i.email,
    role: i.role,
    status: i.status,
    createdAt: i.created_at,
  }));
}

/** Invite someone by email. Admins only (enforced by RLS). */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: 'admin' | 'member'
): Promise<void> {
  const { data: auth } = await client().auth.getUser();
  const { error } = await client()
    .from('invitations')
    .insert({ workspace_id: workspaceId, email: email.trim().toLowerCase(), role, invited_by: auth.user?.id });
  if (error) throw error;
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await client().from('invitations').update({ status: 'revoked' }).eq('id', id);
  if (error) throw error;
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await client()
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function changeRole(workspaceId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await client()
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Pending invitations addressed to the signed-in user (across workspaces). */
export async function listMyInvitations(myEmail: string): Promise<Invitation[]> {
  const { data, error } = await client()
    .from('invitations')
    .select('id, workspace_id, email, role, status, created_at, workspaces(name)')
    .eq('status', 'pending')
    .ilike('email', myEmail.trim());
  if (error) return [];
  return (data ?? []).map((i: any) => ({
    id: i.id,
    workspaceId: i.workspace_id,
    email: i.email,
    role: i.role,
    status: i.status,
    createdAt: i.created_at,
    workspaceName: i.workspaces?.name,
  }));
}

/** Accept an invitation; returns the joined workspace id. */
export async function acceptInvitation(id: string): Promise<string> {
  const { data, error } = await client().rpc('accept_invitation', { invite: id });
  if (error) throw error;
  return data as string;
}
