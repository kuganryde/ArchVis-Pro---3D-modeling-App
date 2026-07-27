/**
 * Supabase client, created from env vars. When the vars are absent the app
 * runs in single-user "local mode" (localStorage) exactly as before — SaaS
 * features (accounts, cloud projects) only switch on once Supabase is configured.
 *
 * Configure via:
 *   VITE_SUPABASE_URL       = https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY  = <anon/publishable key>
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both Supabase env vars are present — enables SaaS mode. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** Shared Supabase client, or null in local mode. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
