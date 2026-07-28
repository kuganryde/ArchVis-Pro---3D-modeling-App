/**
 * Hosted, metered AI endpoints. These use the platform GEMINI_API_KEY and meter
 * usage per workspace against the plan's monthly allowance, turning AI into a
 * plan-gated feature. (Users with their own BYOK key call Gemini directly from
 * the browser and are never metered here.)
 *
 * Endpoints (all require a Supabase JWT + workspace membership):
 *   POST /api/ai/digitize  { workspaceId, base64Data, mimeType }
 *   POST /api/ai/rebuild   { workspaceId, prompt }
 *   GET  /api/ai/usage?workspaceId=...   -> { plan, used, limit }
 */
import type { Express, Request, Response } from "express";
import { admin, isAdminConfigured, getUserFromRequest, isWorkspaceMember } from "./serverSupabase";
import { getGeminiClient, generateLayoutWithRetry, GeminiRequestError } from "./serverGemini";
import { DIGITIZE_PROMPT, buildRebuildInstructions } from "./src/shared/geminiSpec";
import { PlanId, aiCreditsForPlan } from "./src/shared/plans";

/** Hosted AI works only when the platform key + Supabase admin are configured. */
export const isHostedAiConfigured = (): boolean =>
  Boolean(process.env.GEMINI_API_KEY && isAdminConfigured());

/** Current UTC billing period, e.g. "2026-07". */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Resolve a workspace's active plan from its subscription (defaults to free). */
async function resolvePlan(workspaceId: string): Promise<PlanId> {
  if (!admin) return "free";
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (data && (data.status === "active" || data.status === "trialing")) {
    return data.plan as PlanId;
  }
  return "free";
}

/** Read this month's hosted-AI usage count for a workspace. */
async function usageThisPeriod(workspaceId: string): Promise<number> {
  if (!admin) return 0;
  const { data } = await admin
    .from("ai_usage")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("period", currentPeriod())
    .maybeSingle();
  return data?.count ?? 0;
}

/** Atomically consume one credit and return the new count. */
async function consumeCredit(workspaceId: string): Promise<number> {
  if (!admin) return 0;
  const { data, error } = await admin.rpc("increment_ai_usage", {
    ws: workspaceId,
    p: currentPeriod(),
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Shared guard: auth + membership + plan + remaining-credit check. */
async function guard(req: Request, res: Response): Promise<{ workspaceId: string; plan: PlanId } | null> {
  if (!isHostedAiConfigured()) {
    res.status(503).json({ error: "Hosted AI is not configured on this server. Add your own Gemini key instead." });
    return null;
  }
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "You must be signed in." });
    return null;
  }
  const workspaceId = (req.body?.workspaceId || req.query?.workspaceId) as string;
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId is required." });
    return null;
  }
  if (!(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "You don't have access to this workspace." });
    return null;
  }
  const plan = await resolvePlan(workspaceId);
  const limit = aiCreditsForPlan(plan);
  if (limit !== null) {
    const used = await usageThisPeriod(workspaceId);
    if (used >= limit) {
      res.status(402).json({
        error: `You've used all ${limit} AI generations on the ${plan} plan this month. Upgrade for more, or add your own Gemini key.`,
        code: "AI_LIMIT_REACHED",
      });
      return null;
    }
  }
  return { workspaceId, plan };
}

export function registerMeteredAiRoutes(app: Express) {
  // Remaining hosted-AI credits for the current month.
  app.get("/api/ai/usage", async (req: Request, res: Response) => {
    if (!isHostedAiConfigured()) return res.json({ enabled: false });
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "You must be signed in." });
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required." });
    if (!(await isWorkspaceMember(workspaceId, user.id))) {
      return res.status(403).json({ error: "You don't have access to this workspace." });
    }
    const plan = await resolvePlan(workspaceId);
    return res.json({
      enabled: true,
      plan,
      used: await usageThisPeriod(workspaceId),
      limit: aiCreditsForPlan(plan), // null = unlimited
    });
  });

  const runGeneration = async (res: Response, contents: any, workspaceId: string) => {
    const ai = getGeminiClient(); // platform key
    if (!ai) return res.status(503).json({ error: "Hosted AI is not available." });
    try {
      const response = await generateLayoutWithRetry(ai, contents);
      const data = JSON.parse(response.text || "{}");
      const used = await consumeCredit(workspaceId); // only meter on success
      return res.json({ ...data, _usage: used });
    } catch (error: any) {
      const status = error instanceof GeminiRequestError ? error.status : 500;
      return res.status(status).json({ error: error?.message || "AI generation failed." });
    }
  };

  app.post("/api/ai/digitize", async (req: Request, res: Response) => {
    const ok = await guard(req, res);
    if (!ok) return;
    const { base64Data, mimeType } = req.body as { base64Data?: string; mimeType?: string };
    if (!base64Data) return res.status(400).json({ error: "Missing base64Data of the blueprint." });
    const imagePart = { inlineData: { data: base64Data, mimeType: mimeType || "image/png" } };
    return runGeneration(res, [imagePart, { text: DIGITIZE_PROMPT }], ok.workspaceId);
  });

  app.post("/api/ai/rebuild", async (req: Request, res: Response) => {
    const ok = await guard(req, res);
    if (!ok) return;
    const { prompt } = req.body as { prompt?: string };
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });
    return runGeneration(res, [{ text: buildRebuildInstructions(prompt) }], ok.workspaceId);
  });
}
