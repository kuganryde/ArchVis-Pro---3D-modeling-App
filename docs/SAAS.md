# ArchViz Pro — SaaS Architecture & Roadmap

This document describes how ArchViz Pro becomes a multi-tenant SaaS and what is
built so far.

## Current state (Milestone 1 — foundation, shipped)

SaaS mode activates automatically when `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are set (see the README). With them unset the app runs
in single-user local mode (localStorage), so nothing breaks for existing users.

**Implemented:**

- **Accounts** — email/password auth via Supabase (`AuthScreen`).
- **Multi-tenancy** — `workspaces` + `workspace_members`; a signup trigger gives
  every new user a personal workspace.
- **Cloud projects** — designs (`rooms`, `assets`, `blueprintImage`) are stored
  as JSONB in `projects` and autosaved (debounced) to the cloud. A project
  switcher and "new project" live in the header.
- **Tenant isolation** — Postgres Row-Level Security scopes every read/write to
  the user's workspaces.
- **Backward compatibility** — `App` takes optional `initialDesign` / `onPersist`
  props; `SaaSGate` supplies cloud wiring, local mode uses localStorage.

**Key files:** `src/lib/supabase.ts`, `src/lib/projects.ts`,
`src/hooks/useAuth.ts`, `src/components/AuthScreen.tsx`,
`src/components/SaaSGate.tsx`, `supabase/migrations/0001_init.sql`.

## Milestone 2 — monetization (Stripe billing shipped)

**Stripe subscriptions (implemented).** Per-workspace subscriptions with plan
gating, all env-gated so the app runs free/unbilled until Stripe is configured.

- Plans (`src/shared/plans.ts`): **Free** (1 project), **Pro** ($39/mo,
  unlimited), **Team** ($99/mo). Free-plan project limit is enforced in the UI.
- Server (`billing.ts`): `/api/billing/config`, `/api/billing/checkout`
  (subscription Checkout), `/api/billing/portal` (manage/cancel), and
  `/api/stripe/webhook` (signature-verified). The Stripe secret key stays
  server-side; JWTs are verified and only a workspace **owner** can manage billing.
- DB (`supabase/migrations/0002_billing.sql`): `subscriptions` table, member
  read-only RLS (writes come only from webhooks via the service-role key),
  plus a `workspace_plan()` helper.
- Client (`src/lib/billing.ts`, `src/components/BillingModal.tsx`): pricing
  modal, upgrade → Checkout, manage → portal, plan badge in the header, and a
  post-checkout plan refresh.

**Hosted, metered AI (implemented).** When the platform `GEMINI_API_KEY` is set,
signed-in users without their own key get AI generations server-side, metered per
workspace against the plan's monthly allowance (Free 5, Pro 200, Team unlimited).
BYOK remains the unmetered fallback (billed to the user, called direct from the
browser).

- Server (`aiMetering.ts`): `POST /api/ai/digitize`, `POST /api/ai/rebuild`
  (auth + membership + plan-limit gated), `GET /api/ai/usage`. Over-limit returns
  `402` with an upgrade prompt; credit is consumed only on a successful generation.
- DB (`supabase/migrations/0003_ai_usage.sql`): `ai_usage` table (per workspace /
  month) + atomic `increment_ai_usage()` RPC; member-read RLS.
- Shared server helpers extracted to `serverSupabase.ts` (JWT/membership) and
  `serverGemini.ts` (generation), reused by billing and metering.
- Client routes AI to hosted vs BYOK automatically; `BillingModal` shows a
  monthly credits meter.

**Still to do in this milestone:**

- **Blueprint storage.** Move base64 blueprints out of the JSONB row into
  Supabase Storage (object storage) and reference by URL.
- **Entitlements by plan** beyond project/AI limits (e.g. watermarked exports on Free).
- **Caching** of AI digitization results (large images are the main COGS).

## Milestone 3 — moat & expansion

- Project versioning + shareable read-only client links.
- Manufacturer asset library with real part numbers → automatic bill-of-materials
  and cost rollups (the model already carries `specs` + `Cost`).
- Team roles/permissions; real-time multi-user collaboration.
- Integrations: procurement/ERP, Zoho, export to quoting tools.
- Multi-floor / multi-building; IFC / DWG import.

## Data model (Milestone 1)

```
auth.users (Supabase)
  └─ profiles            (1:1 display metadata)
  └─ workspaces          (tenant boundary, owned by a user)
       └─ workspace_members (user ↔ workspace, role: owner/admin/member)
       └─ projects        (name + JSONB design payload)
```

RLS: members can CRUD projects in their workspaces; workspace owners manage the
workspace; users see only their own profile.

## Notes / follow-ups

- The project currently ships **without `@types/react`**, so JSX is loosely
  typed. Adding it would improve safety but should be done as a dedicated pass
  (it will surface latent `any` usages to fix).
- Consider server-side session verification if/when AI moves back server-side.
