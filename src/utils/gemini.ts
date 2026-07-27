/**
 * Browser-side Gemini client. Because ArchViz Pro is Bring-Your-Own-Key, the
 * user's key already lives in the browser, so we can call Gemini directly from
 * the client with the official web SDK. This removes the hard dependency on the
 * Express backend — the AI features work even when the app is served as a
 * static site (where /api/* would 404).
 */
import {
  MODELS_TO_TRY,
  LAYOUT_RESPONSE_SCHEMA,
  DIGITIZE_PROMPT,
  buildRebuildInstructions,
  classifyGeminiError,
} from '../shared/geminiSpec';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS_PER_MODEL = 3;

/** Error carrying the classified HTTP-ish status so the UI can react (e.g. 401). */
export class GeminiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GeminiClientError';
    this.status = status;
  }
}

/**
 * Run a layout generation with model fallback and smart retries. Only transient
 * errors (rate limit, 5xx, network) are retried; invalid-key / permission /
 * bad-request errors fail fast with a clean message.
 */
async function generateLayout(apiKey: string, contents: any): Promise<any> {
  const cleanedKey = (apiKey || '').trim();
  if (!cleanedKey) {
    throw new GeminiClientError(401, 'A Gemini API key is required.');
  }

  // Lazy-load the SDK so it is code-split out of the initial bundle and only
  // fetched the first time a user actually runs an AI action.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: cleanedKey });
  let lastStatus = 503;
  let lastMessage = 'Failed to reach Gemini after retrying multiple models.';

  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: LAYOUT_RESPONSE_SCHEMA,
          },
        });
        return JSON.parse(response.text || '{}');
      } catch (error: any) {
        const classified = classifyGeminiError(error);
        lastStatus = classified.status;
        lastMessage = classified.message;

        // Auth / bad-request errors will never succeed — abort immediately.
        if (!classified.retryable && !classified.tryNextModel) {
          throw new GeminiClientError(classified.status, classified.message);
        }
        // Model unavailable — stop retrying this model, fall back to the next.
        if (classified.tryNextModel && !classified.retryable) break;
        // Transient — back off and retry the same model.
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await delay(Math.pow(2, attempt) * 1000 + Math.random() * 500);
        }
      }
    }
  }

  throw new GeminiClientError(lastStatus, lastMessage);
}

/** Digitize an uploaded blueprint image into a raw { rooms, assets } layout. */
export async function digitizeBlueprintClient(
  apiKey: string,
  base64Data: string,
  mimeType: string
): Promise<any> {
  const imagePart = { inlineData: { data: base64Data, mimeType: mimeType || 'image/png' } };
  return generateLayout(apiKey, [imagePart, { text: DIGITIZE_PROMPT }]);
}

/** Generate a raw { rooms, assets } layout from a free-text description. */
export async function rebuildFromPromptClient(apiKey: string, prompt: string): Promise<any> {
  return generateLayout(apiKey, [{ text: buildRebuildInstructions(prompt) }]);
}
