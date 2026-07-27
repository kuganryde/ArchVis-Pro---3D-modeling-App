/**
 * Stripe billing for ArchViz Pro (server-side).
 *
 * Everything here is env-gated: if STRIPE_SECRET_KEY / the Supabase service key
 * are absent, billing is simply disabled and the endpoints report so — the rest
 * of the app is unaffected.
 *
 * Security model:
 *   - The Stripe secret key never leaves the server.
 *   - Checkout / portal calls require a valid Supabase JWT (Authorization
 *     header); only a workspace's OWNER may manage its billing.
 *   - Subscription state is written to the DB only from verified Stripe
 *     webhooks, using the Supabase service-role key (bypasses RLS).
 */
import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PLANS, PlanId } from "./src/shared/plans";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const admin: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

/** Billing works only when Stripe + the Supabase service client + a Pro price exist. */
export const isBillingConfigured = (): boolean =>
  Boolean(stripe && admin && process.env[PLANS.pro.priceEnv as string]);

/** Stripe price ID configured for a paid plan, if any. */
function priceIdForPlan(plan: PlanId): string | undefined {
  const env = PLANS[plan]?.priceEnv;
  return env ? process.env[env] : undefined;
}

/** Reverse-map a Stripe price ID back to our plan id. */
function planForPriceId(priceId: string | undefined): PlanId {
  if (!priceId) return "free";
  if (priceId === process.env[PLANS.pro.priceEnv as string]) return "pro";
  if (priceId === process.env[PLANS.team.priceEnv as string]) return "team";
  return "free";
}

/** Verify the Supabase JWT on the request and return the user (or null). */
async function getUser(req: Request) {
  if (!admin) return null;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

/** Confirm the user OWNS the workspace (only owners manage billing). */
async function assertWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  if (!admin) return false;
  const { data, error } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .single();
  if (error || !data) return false;
  return data.owner_id === userId;
}

/** Base URL for Stripe redirect links. */
function originOf(req: Request): string {
  return (
    process.env.APP_URL ||
    (req.headers.origin as string) ||
    `${req.protocol}://${req.get("host")}`
  );
}

/** Upsert the subscription row for a workspace (called from webhooks). */
async function upsertSubscription(row: {
  workspace_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan?: PlanId;
  status?: string;
  current_period_end?: string | null;
}) {
  if (!admin) return;
  await admin
    .from("subscriptions")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
}

/**
 * Register the Stripe webhook. MUST be called BEFORE express.json() is mounted,
 * because signature verification needs the raw request body.
 */
export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        return res.status(503).json({ error: "Billing is not configured." });
      }
      const sig = req.headers["stripe-signature"] as string;
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err?.message);
        return res.status(400).send(`Webhook Error: ${err?.message}`);
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const s = event.data.object as Stripe.Checkout.Session;
            const workspaceId = (s.client_reference_id || s.metadata?.workspace_id) as string;
            if (workspaceId) {
              await upsertSubscription({
                workspace_id: workspaceId,
                stripe_customer_id: (s.customer as string) || null,
                stripe_subscription_id: (s.subscription as string) || null,
              });
            }
            break;
          }
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            const workspaceId = sub.metadata?.workspace_id as string;
            const priceId = sub.items?.data?.[0]?.price?.id;
            const plan = event.type === "customer.subscription.deleted" ? "free" : planForPriceId(priceId);
            if (workspaceId) {
              await upsertSubscription({
                workspace_id: workspaceId,
                stripe_customer_id: (sub.customer as string) || null,
                stripe_subscription_id: sub.id,
                plan,
                status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
                current_period_end: (sub as any).current_period_end
                  ? new Date((sub as any).current_period_end * 1000).toISOString()
                  : null,
              });
            }
            break;
          }
          default:
            break;
        }
        return res.json({ received: true });
      } catch (err: any) {
        console.error("Stripe webhook handler error:", err?.message || err);
        return res.status(500).json({ error: "Webhook handling failed." });
      }
    }
  );
}

/** Register the JSON billing routes (call AFTER express.json() is mounted). */
export function registerBillingRoutes(app: Express) {
  // Public: what plans exist and whether checkout is live.
  app.get("/api/billing/config", (_req, res) => {
    const enabled = isBillingConfigured();
    res.json({
      enabled,
      plans: Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        priceLabel: p.priceLabel,
        blurb: p.blurb,
        features: p.features,
        maxProjects: p.maxProjects,
        purchasable: p.id !== "free" && Boolean(priceIdForPlan(p.id)),
      })),
    });
  });

  // Start a subscription Checkout for a workspace.
  app.post("/api/billing/checkout", async (req: Request, res: Response) => {
    if (!stripe || !isBillingConfigured()) {
      return res.status(503).json({ error: "Billing is not configured on this server." });
    }
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "You must be signed in." });

    const { workspaceId, plan } = req.body as { workspaceId?: string; plan?: PlanId };
    if (!workspaceId || !plan) return res.status(400).json({ error: "workspaceId and plan are required." });

    const priceId = priceIdForPlan(plan);
    if (!priceId) return res.status(400).json({ error: `Plan "${plan}" is not purchasable.` });

    if (!(await assertWorkspaceOwner(workspaceId, user.id))) {
      return res.status(403).json({ error: "Only the workspace owner can manage billing." });
    }

    try {
      // Reuse an existing Stripe customer for this workspace if we have one.
      const { data: existing } = await admin!
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      let customerId = existing?.stripe_customer_id as string | undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { workspace_id: workspaceId },
        });
        customerId = customer.id;
        await upsertSubscription({ workspace_id: workspaceId, stripe_customer_id: customerId });
      }

      const base = originOf(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: workspaceId,
        metadata: { workspace_id: workspaceId, plan },
        subscription_data: { metadata: { workspace_id: workspaceId, plan } },
        success_url: `${base}/?billing=success`,
        cancel_url: `${base}/?billing=cancelled`,
        allow_promotion_codes: true,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Could not start checkout." });
    }
  });

  // Open the Stripe billing portal (manage / cancel).
  app.post("/api/billing/portal", async (req: Request, res: Response) => {
    if (!stripe || !isBillingConfigured()) {
      return res.status(503).json({ error: "Billing is not configured on this server." });
    }
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "You must be signed in." });

    const { workspaceId } = req.body as { workspaceId?: string };
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required." });
    if (!(await assertWorkspaceOwner(workspaceId, user.id))) {
      return res.status(403).json({ error: "Only the workspace owner can manage billing." });
    }

    try {
      const { data } = await admin!
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      const customerId = data?.stripe_customer_id as string | undefined;
      if (!customerId) return res.status(400).json({ error: "No billing account yet — subscribe first." });

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${originOf(req)}/`,
      });
      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Billing portal error:", err?.message || err);
      return res.status(500).json({ error: err?.message || "Could not open billing portal." });
    }
  });
}
