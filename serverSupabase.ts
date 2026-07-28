/**
 * Server-side Supabase access shared by billing and AI metering.
 *
 * Uses the SERVICE ROLE key (bypasses RLS) for privileged writes such as
 * subscription/usage updates from verified webhooks or metered endpoints, and
 * verifies user JWTs presented on authenticated API calls.
 */
import type { Request } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Privileged Supabase client, or null when not configured. */
export const admin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

export const isAdminConfigured = (): boolean => Boolean(admin);

/** Verify the Supabase JWT on the request and return the user (or null). */
export async function getUserFromRequest(req: Request) {
  if (!admin) return null;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

/** True when the user OWNS the workspace (owners manage billing). */
export async function assertWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  if (!admin) return false;
  const { data, error } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .single();
  if (error || !data) return false;
  return data.owner_id === userId;
}

/** True when the user is a MEMBER of the workspace (any role). */
export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  if (!admin) return false;
  const { data, error } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(!error && data);
}
