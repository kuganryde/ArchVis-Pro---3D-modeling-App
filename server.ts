import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  MODELS_TO_TRY,
  LAYOUT_RESPONSE_SCHEMA,
  DIGITIZE_PROMPT,
  buildRebuildInstructions,
  classifyGeminiError,
  ClassifiedError,
} from "./src/shared/geminiSpec";
import { registerStripeWebhook, registerBillingRoutes, isBillingConfigured } from "./billing";

dotenv.config();

const app = express();
// Respect the platform-provided port (Cloud Run, Heroku, etc.) and fall back
// to 3000 for local development.
const PORT = Number(process.env.PORT) || 3000;

// Stripe webhook must be registered with the RAW body, BEFORE the JSON parser,
// so signature verification sees the exact bytes Stripe signed.
registerStripeWebhook(app);

// Increase JSON payload size limit for image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Billing (Checkout / portal / config) — JSON routes, safe to mount here.
registerBillingRoutes(app);

// Trim + basic sanity check on a user-supplied key so we can reject obviously
// malformed input before spending a network round-trip on it.
const sanitizeKey = (key?: string): string | undefined => {
  const trimmed = (key || "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Initialize the Gemini SDK client from either the per-request BYOK key or the
// server-side env key.
const getGeminiClient = (clientKey?: string) => {
  const apiKey = sanitizeKey(clientKey) || sanitizeKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    console.warn("Warning: no Gemini API key provided (BYOK header or GEMINI_API_KEY).");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Helper delay function for exponential backoff retries
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Error carrying the classified status so the route can relay it accurately.
// The schema, prompts and classifier live in src/shared/geminiSpec so the
// server and the browser client share one source of truth.
class GeminiRequestError extends Error {
  status: number;
  constructor(classified: ClassifiedError) {
    super(classified.message);
    this.status = classified.status;
  }
}

// Generation helper with model fallback and *smart* retries: only transient
// errors (rate limit, 5xx, network) are retried. Non-retryable errors — an
// invalid key, permission denial, or a bad request — fail fast instead of
// hammering the API for ~20s before surfacing the same message.
const MAX_ATTEMPTS_PER_MODEL = 3;

const generateLayoutWithRetry = async (ai: any, contents: any) => {
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

        // Auth / bad-request errors will never succeed on any model — abort now.
        if (!classified.retryable && !classified.tryNextModel) {
          throw new GeminiRequestError(classified);
        }
        // Model unavailable — stop retrying this model, fall back to the next.
        if (classified.tryNextModel && !classified.retryable) {
          break;
        }
        // Transient — back off and retry the same model (unless out of attempts).
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

// API route to parse CAD blueprint / floor plans
app.post("/api/digitize-blueprint", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: "Missing base64Data of the blueprint file." });
    }

    const clientKey = req.headers['x-gemini-api-key'] as string;
    const ai = getGeminiClient(clientKey);
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API Key is required. Please provide it in the UI."
      });
    }

    // Package the file inline data for Gemini Vision capabilities
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || "image/png",
      },
    };

    // Query Gemini using our robust multi-attempt retry query wrapper
    const response = await generateLayoutWithRetry(ai, [imagePart, { text: DIGITIZE_PROMPT }]);

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error digitizing blueprint:", error?.message || error);
    const status = error instanceof GeminiRequestError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Failed to parse the floor plan." });
  }
});

// API route to rebuild CAD floor plan from prompt
app.post("/api/rebuild-from-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });
    
    const clientKey = req.headers['x-gemini-api-key'] as string;
    const ai = getGeminiClient(clientKey);
    if (!ai) return res.status(503).json({ error: "Gemini API Key is required. Please provide it in the UI." });

    // Reuse the same retry + schema pipeline as the digitizer so the response is
    // guaranteed to be well-formed for the client mapper.
    const response = await generateLayoutWithRetry(ai, [{ text: buildRebuildInstructions(prompt) }]);

    return res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error rebuilding from prompt:", error?.message || error);
    const status = error instanceof GeminiRequestError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Failed to rebuild from prompt." });
  }
});

// Lightweight health check for uptime monitors / container orchestrators.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    billing: isBillingConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// Configure Vite or Static server
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CAD Server successfully running on http://localhost:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error("Failed to boot CAD fullstack, nested error:", err);
});
