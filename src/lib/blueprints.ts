/**
 * Blueprint object storage (Supabase Storage). Blueprints are uploaded to a
 * private `blueprints` bucket under `<workspaceId>/<projectId>/…` and referenced
 * by PATH in the project; the app renders them via short-lived signed URLs.
 */
import { supabase } from './supabase';

const BUCKET = 'blueprints';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days — comfortably covers a session.

/** Convert a data URL to a Blob (browser). */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Upload a blueprint (data URL) and return its storage path. */
export async function uploadBlueprint(
  workspaceId: string,
  projectId: string,
  dataUrl: string
): Promise<string> {
  if (!supabase) throw new Error('Storage is not configured.');
  const blob = await dataUrlToBlob(dataUrl);
  const ext = blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('webp') ? 'webp' : 'png';
  const path = `${workspaceId}/${projectId}/blueprint-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type || 'image/png' });
  if (error) throw error;
  return path;
}

/** Create a short-lived signed URL for rendering a stored blueprint. */
export async function getBlueprintUrl(path: string | null | undefined): Promise<string | null> {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

/** Best-effort delete of a stored blueprint (e.g. when replaced or removed). */
export async function deleteBlueprint(path: string | null | undefined): Promise<void> {
  if (!supabase || !path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
