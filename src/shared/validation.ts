/**
 * Input validation for the AI endpoints. Shared by the BYOK proxy routes and the
 * metered hosted routes so both enforce identical limits. Pure functions (no
 * Express / Node imports) so they are trivially unit-testable.
 *
 * Why: these routes forward caller-controlled data to a paid third-party API.
 * Without strict limits an authenticated (or BYOK) caller could push arbitrary
 * payloads, oversized files or prompt-stuffing through our server.
 */

/** Blueprint formats we accept. PDFs are rasterised client-side to PNG first. */
export const ALLOWED_BLUEPRINT_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Max length of the base64 string (~10 MB of binary once decoded). */
export const MAX_BASE64_CHARS = 14 * 1024 * 1024;

/** Max length of a free-text layout prompt. */
export const MAX_PROMPT_CHARS = 4000;

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// `error?`/`value?` on both arms keep property access type-safe even though the
// project does not enable strictNullChecks (which discriminated-union narrowing needs).
export type Validated<T> =
  | { ok: true; value: T; error?: undefined }
  | { ok: false; error: string; value?: undefined };

export interface DigitizeInput {
  base64Data: string;
  mimeType: string;
}

/** Validate a blueprint-digitize request body. Rejects before any Gemini call. */
export function validateDigitizeInput(body: unknown): Validated<DigitizeInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const { base64Data } = b;
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    return { ok: false, error: 'Missing base64Data of the blueprint file.' };
  }
  if (base64Data.length > MAX_BASE64_CHARS) {
    return { ok: false, error: 'Blueprint file is too large (max ~10 MB).' };
  }
  if (!BASE64_RE.test(base64Data)) {
    return { ok: false, error: 'base64Data is not valid base64.' };
  }
  const mimeType = typeof b.mimeType === 'string' && b.mimeType ? b.mimeType.toLowerCase() : 'image/png';
  if (!(ALLOWED_BLUEPRINT_MIME as readonly string[]).includes(mimeType)) {
    return { ok: false, error: `Unsupported file type. Allowed: ${ALLOWED_BLUEPRINT_MIME.join(', ')}.` };
  }
  return { ok: true, value: { base64Data, mimeType } };
}

/** Validate a rebuild-from-prompt request body. */
export function validatePromptInput(body: unknown): Validated<{ prompt: string }> {
  const raw = ((body ?? {}) as Record<string, unknown>).prompt;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'No prompt provided.' };
  }
  if (raw.length > MAX_PROMPT_CHARS) {
    return { ok: false, error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).` };
  }
  return { ok: true, value: { prompt: raw } };
}
