/**
 * Plan catalogue shared by the client (pricing UI + gating) and the server
 * (mapping Stripe price IDs -> plans). Prices themselves live in Stripe; the
 * matching price IDs are supplied via env vars named by `priceEnv`.
 */
export type PlanId = 'free' | 'pro' | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  blurb: string;
  features: string[];
  /** Max projects allowed; null = unlimited. */
  maxProjects: number | null;
  /** Server env var holding this plan's Stripe price ID (paid plans only). */
  priceEnv?: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    blurb: 'For trying it out and solo one-offs.',
    features: ['1 project', 'BYOK AI (your Gemini key)', '3D + 2D workspace', 'PNG / JSON export'],
    maxProjects: 1,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$39',
    blurb: 'For professionals running real projects.',
    features: [
      'Unlimited projects',
      'Everything in Free',
      'PDF reports + bill of materials',
      'Priority support',
    ],
    maxProjects: null,
    priceEnv: 'STRIPE_PRICE_PRO',
  },
  team: {
    id: 'team',
    name: 'Team',
    priceLabel: '$99',
    blurb: 'For integrators and facilities teams.',
    features: ['Everything in Pro', 'Shared workspace', 'Team roles (coming soon)', 'SSO (coming soon)'],
    maxProjects: null,
    priceEnv: 'STRIPE_PRICE_TEAM',
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team'];

/** How many projects a plan permits (null = unlimited). */
export function maxProjectsForPlan(plan: PlanId): number | null {
  return PLANS[plan]?.maxProjects ?? PLANS.free.maxProjects;
}
