import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { DIGITIZE_PROMPT, buildRebuildInstructions } from "./src/shared/geminiSpec";
import { getGeminiClient, generateLayoutWithRetry, GeminiRequestError } from "./serverGemini";
import { registerStripeWebhook, registerBillingRoutes, isBillingConfigured } from "./billing";
import { registerMeteredAiRoutes, isHostedAiConfigured } from "./aiMetering";

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

// Hosted, metered AI endpoints (platform key, plan-gated usage).
registerMeteredAiRoutes(app);

// ---------------------------------------------------------------------------
// BYOK proxy endpoints (below): accept a per-request Gemini key header and are
// unmetered. The client normally calls Gemini directly for BYOK, but these keep
// working for server-key deployments and API consumers. Hosted/metered AI lives
// in aiMetering.ts.
// ---------------------------------------------------------------------------

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
    hostedAi: isHostedAiConfigured(),
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
