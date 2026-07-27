/**
 * Client billing helpers. Checkout / portal go through the server (Stripe secret
 * stays server-side); the current plan is read straight from Supabase (the
 * `subscriptions` row is readable by workspace members via RLS).
 */
import { supabase } from './supabase';
import { PlanId } from '../shared/plans';

export interface BillingPlanInfo {
  id: PlanId;
  name: string;
  priceLabel: string;
  blurb: string;
  features: string[];
  maxProjects: number | null;
  purchasable: boolean;
}

export interface BillingConfig {
  enabled: boolean;
  plans: BillingPlanInfo[];
}

export interface WorkspacePlan {
  plan: PlanId;
  status: string;
  currentPeriodEnd: string | null;
}

/** Fetch server billing config (whether Checkout is live + plan catalogue). */
export async function fetchBillingConfig(): Promise<BillingConfig> {
  try {
    const res = await fetch('/api/billing/config');
    if (!res.ok) return { enabled: false, plans: [] };
    return await res.json();
  } catch {
    return { enabled: false, plans: [] };
  }
}

/** Current plan for a workspace (defaults to free when no active subscription). */
export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan> {
  const free: WorkspacePlan = { plan: 'free', status: 'inactive', currentPeriodEnd: null };
  if (!supabase) return free;
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error || !data) return free;
  const active = data.status === 'active' || data.status === 'trialing';
  return {
    plan: active ? (data.plan as PlanId) : 'free',
    status: data.status,
    currentPeriodEnd: data.current_period_end,
  };
}

async function authedPost(path: string, body: unknown): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: 'Not signed in.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: 'Not signed in.' };
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json.error || 'Request failed.' };
  return json;
}

/** Start Stripe Checkout for a plan and redirect the browser to it. */
export async function startCheckout(workspaceId: string, plan: PlanId): Promise<void> {
  const { url, error } = await authedPost('/api/billing/checkout', { workspaceId, plan });
  if (error) throw new Error(error);
  if (url) window.location.href = url;
}

/** Open the Stripe billing portal (manage / cancel) and redirect to it. */
export async function openBillingPortal(workspaceId: string): Promise<void> {
  const { url, error } = await authedPost('/api/billing/portal', { workspaceId });
  if (error) throw new Error(error);
  if (url) window.location.href = url;
}
