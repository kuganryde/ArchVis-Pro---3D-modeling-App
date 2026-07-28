/**
 * Server-side Gemini helpers shared by the BYOK proxy endpoints and the metered
 * hosted-AI endpoints. The prompts/schema/classifier come from the shared spec
 * so the server and the browser client behave identically.
 */
import { GoogleGenAI } from "@google/genai";
import {
  MODELS_TO_TRY,
  LAYOUT_RESPONSE_SCHEMA,
  classifyGeminiError,
  ClassifiedError,
} from "./src/shared/geminiSpec";

const sanitizeKey = (key?: string): string | undefined => {
  const trimmed = (key || "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** Build a Gemini client from a BYOK key or the platform GEMINI_API_KEY. */
export const getGeminiClient = (clientKey?: string) => {
  const apiKey = sanitizeKey(clientKey) || sanitizeKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    console.warn("Warning: no Gemini API key provided (BYOK header or GEMINI_API_KEY).");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Error carrying the classified HTTP-ish status so routes can relay it. */
export class GeminiRequestError extends Error {
  status: number;
  constructor(classified: ClassifiedError) {
    super(classified.message);
    this.status = classified.status;
  }
}

const MAX_ATTEMPTS_PER_MODEL = 3;

/**
 * Generation helper with model fallback and smart retries: only transient
 * errors (rate limit / 5xx / network) are retried; auth / bad-request errors
 * fail fast.
 */
export const generateLayoutWithRetry = async (ai: any, contents: any) => {
  let lastClassified: ClassifiedError | null = null;

  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        console.log(`AI Layout: Querying model ${model} (attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL})...`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: LAYOUT_RESPONSE_SCHEMA,
          },
        });
        console.log(`AI Layout successfully parsed with model ${model}!`);
        return response;
      } catch (error: any) {
        const classified = classifyGeminiError(error);
        lastClassified = classified;
        console.warn(`AI Layout warning [${model}, attempt ${attempt}]: ${classified.message}`);

        if (!classified.retryable && !classified.tryNextModel) {
          throw new GeminiRequestError(classified);
        }
        if (classified.tryNextModel && !classified.retryable) break;
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`Transient error — waiting ${Math.round(waitMs)}ms before retry...`);
          await delay(waitMs);
        }
      }
    }
  }

  throw new GeminiRequestError(
    lastClassified || {
      status: 503,
      message: "Failed to reach Gemini after retrying multiple models.",
      retryable: false,
      tryNextModel: false,
    }
  );
};
