/**
 * Express app factory (API + middleware only). Separated from server.ts, which
 * owns listening / Vite / static serving, so tests can mount the real app on an
 * ephemeral port without booting Vite.
 */
import express from "express";
import { DIGITIZE_PROMPT, buildRebuildInstructions } from "./src/shared/geminiSpec";
import { validateDigitizeInput, validatePromptInput } from "./src/shared/validation";
import { getGeminiClient, generateLayoutWithRetry, GeminiRequestError } from "./serverGemini";
import { registerStripeWebhook, registerBillingRoutes, isBillingConfigured } from "./billing";
import { registerMeteredAiRoutes, isHostedAiConfigured, meteredDigitize, meteredRebuild } from "./aiMetering";
import { securityHeaders, apiRateLimiter, aiRateLimiter, jsonErrorHandler } from "./serverSecurity";

/** Body-size ceilings. Only blueprint uploads legitimately need a large body. */
const DEFAULT_JSON_LIMIT = "100kb";
const UPLOAD_JSON_LIMIT = "16mb"; // fits MAX_BASE64_CHARS plus JSON overhead

export function createApp(): express.Express {
  const app = express();

  // Behind a reverse proxy (Cloud Run, Render, ...) req.ip is the proxy unless we
  // trust its forwarded header; rate limiting would then throttle everyone as
  // one client. Set TRUST_PROXY to the number of proxy hops (default 1 in
  // production, 0 locally). Never "true": that lets clients spoof X-Forwarded-For.
  app.set("trust proxy", Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? 1 : 0)));
  app.disable("x-powered-by");
  app.use(securityHeaders());

  // Stripe webhook needs the RAW body and is authenticated by its signature, so
  // it is registered before both the JSON parser and the IP rate limiter.
  registerStripeWebhook(app);

  app.use("/api", apiRateLimiter(Number(process.env.API_RATE_LIMIT) || 120));

  // Large-body parser only on the two upload routes; everything else is capped
  // small. Order matters: the first parser to run consumes the body.
  const uploadJson = express.json({ limit: UPLOAD_JSON_LIMIT });
  app.use(["/api/digitize-blueprint", "/api/ai/digitize"], uploadJson);
  app.use(express.json({ limit: DEFAULT_JSON_LIMIT }));

  // Paid-upstream routes get a much tighter per-IP budget.
  const aiLimit = aiRateLimiter(Number(process.env.AI_RATE_LIMIT) || 10);
  app.use(["/api/digitize-blueprint", "/api/rebuild-from-prompt", "/api/ai/digitize", "/api/ai/rebuild"], aiLimit);

  registerBillingRoutes(app);
  registerMeteredAiRoutes(app);

  // -------------------------------------------------------------------------
  // Legacy AI endpoints. A caller-supplied Gemini key (x-gemini-api-key, BYOK) is
  // used unmetered. WITHOUT a key they delegate to the hosted path, which needs
  // a Supabase JWT + workspace membership and enforces plan limits, so they can
  // never act as an open proxy onto the platform GEMINI_API_KEY.
  // -------------------------------------------------------------------------
  const byokKey = (req: express.Request): string | undefined => {
    const raw = (req.headers["x-gemini-api-key"] as string | undefined)?.trim();
    return raw ? raw : undefined;
  };

  app.post("/api/digitize-blueprint", async (req, res) => {
    const clientKey = byokKey(req);
    if (!clientKey) return meteredDigitize(req, res);
    const input = validateDigitizeInput(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    try {
      const ai = getGeminiClient(clientKey); // caller's own key only
      if (!ai) return res.status(503).json({ error: "Gemini API Key is required. Please provide it in the UI." });
      const imagePart = { inlineData: { data: input.value.base64Data, mimeType: input.value.mimeType } };
      const response = await generateLayoutWithRetry(ai, [imagePart, { text: DIGITIZE_PROMPT }]);
      return res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Error digitizing blueprint:", error?.message || error);
      const status = error instanceof GeminiRequestError ? error.status : 500;
      return res.status(status).json({ error: error?.message || "Failed to parse the floor plan." });
    }
  });

  app.post("/api/rebuild-from-prompt", async (req, res) => {
    const clientKey = byokKey(req);
    if (!clientKey) return meteredRebuild(req, res);
    const input = validatePromptInput(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    try {
      const ai = getGeminiClient(clientKey);
      if (!ai) return res.status(503).json({ error: "Gemini API Key is required. Please provide it in the UI." });
      const response = await generateLayoutWithRetry(ai, [{ text: buildRebuildInstructions(input.value.prompt) }]);
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

  // Unknown API routes must 404 as JSON, not fall through to the SPA shell.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

  app.use(jsonErrorHandler);

  return app;
}
