/**
 * Client helpers for HOSTED (metered) AI. Used when a signed-in user has NOT
 * supplied their own Gemini key: the request goes to the server, which uses the
 * platform key and meters usage against the workspace's plan. Errors carry the
 * HTTP status so the UI can react (401 re-auth, 402 upgrade prompt).
 */
import { supabase } from './supabase';

export class HostedAiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function authedPost(path: string, body: unknown): Promise<any> {
  if (!supabase) throw new HostedAiError(401, 'Not signed in.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new HostedAiError(401, 'Not signed in.');

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new HostedAiError(res.status, json.error || 'AI request failed.', json.code);
  return json;
}

/** Hosted blueprint digitization → raw { rooms, assets } layout. */
export function digitizeBlueprintHosted(workspaceId: string, base64Data: string, mimeType: string) {
  return authedPost('/api/ai/digitize', { workspaceId, base64Data, mimeType });
}

/** Hosted prompt-to-layout → raw { rooms, assets } layout. */
export function rebuildFromPromptHosted(workspaceId: string, prompt: string) {
  return authedPost('/api/ai/rebuild', { workspaceId, prompt });
}

export interface AiUsage {
  enabled: boolean;
  plan?: string;
  used?: number;
  limit?: number | null;
}

/** Current month's hosted-AI usage for a workspace (for the credits UI). */
export async function getAiUsage(workspaceId: string): Promise<AiUsage> {
  if (!supabase) return { enabled: false };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { enabled: false };
  try {
    const res = await fetch(`/api/ai/usage?workspaceId=${encodeURIComponent(workspaceId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { enabled: false };
    return await res.json();
  } catch {
    return { enabled: false };
  }
}
