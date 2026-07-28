/**
 * Cloud data layer for workspaces and projects. All calls assume Supabase is
 * configured and the user is authenticated; RLS enforces tenant isolation.
 */
import { supabase } from './supabase';
import { PlacedAsset, RoomDefinition } from '../types';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

export interface ProjectDesign {
  rooms: RoomDefinition[];
  assets: PlacedAsset[];
  /** Legacy inline data URL (older projects / before object storage). */
  blueprintImage?: string | null;
  /** Preferred: Storage object path for the blueprint image. */
  blueprintPath?: string | null;
}

export interface Project extends ProjectSummary {
  workspace_id: string;
  data: ProjectDesign;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** The user's workspaces (RLS scopes this to memberships). */
export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await client()
    .from('workspaces')
    .select('id, name, owner_id')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Ensure the user has at least one workspace, returning the first. */
export async function ensureWorkspace(): Promise<Workspace> {
  const existing = await listWorkspaces();
  if (existing.length > 0) return existing[0];

  // The signup trigger normally creates one; create a fallback if missing.
  const { data: auth } = await client().auth.getUser();
  const uid = auth.user?.id;
  const { data, error } = await client()
    .from('workspaces')
    .insert({ name: 'My Workspace', owner_id: uid })
    .select('id, name, owner_id')
    .single();
  if (error) throw error;
  await client().from('workspace_members').insert({ workspace_id: data.id, user_id: uid, role: 'owner' });
  return data;
}

/** Projects in a workspace, newest first. */
export async function listProjects(workspaceId: string): Promise<ProjectSummary[]> {
  const { data, error } = await client()
    .from('projects')
    .select('id, name, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await client()
    .from('projects')
    .select('id, workspace_id, name, data, updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function createProject(
  workspaceId: string,
  name: string,
  design: ProjectDesign
): Promise<Project> {
  const { data: auth } = await client().auth.getUser();
  const { data, error } = await client()
    .from('projects')
    .insert({ workspace_id: workspaceId, name, data: design, created_by: auth.user?.id })
    .select('id, workspace_id, name, data, updated_at')
    .single();
  if (error) throw error;
  return data as Project;
}

/** Persist a project's design payload (used by autosave). */
export async function saveProjectDesign(id: string, design: ProjectDesign): Promise<void> {
  const { error } = await client().from('projects').update({ data: design }).eq('id', id);
  if (error) throw error;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const { error } = await client().from('projects').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await client().from('projects').delete().eq('id', id);
  if (error) throw error;
}
