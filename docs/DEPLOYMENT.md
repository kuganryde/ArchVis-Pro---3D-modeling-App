# ArchViz Pro — Deployment & Go-Live Checklist

Everything needed to run ArchViz Pro in production, in one place.

> **Billing requires the Node server.** The app can be served as a static site,
> but Stripe Checkout and webhooks need `npm run start` (Express). Deploy the
> server if you want paid plans.

---

## 1. Modes at a glance

| Mode | Trigger | What you get |
|------|---------|--------------|
| **Local** | No Supabase env vars | Single user, localStorage, BYOK AI. Static hosting is fine. |
| **SaaS** | `VITE_SUPABASE_*` set | Accounts, workspaces, cloud projects, team, plan gating. |
| **+ Hosted AI** | `GEMINI_API_KEY` + service role | Metered AI generations per plan (BYOK still works as fallback). |
| **+ Billing** | `STRIPE_*` set + Node server | Stripe subscriptions (Pro / Team) with the billing portal. |

Each layer is additive and independently optional.

---

## 2. Environment variables

`VITE_`-prefixed vars are exposed to the browser at build time. Everything else
is **server-only** — never expose secret keys to the client.

### Client (build-time)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | SaaS | Supabase project URL (`https://<ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | SaaS | Supabase anon / publishable key. |
| `VITE_GA_MEASUREMENT_ID` | No | Google Analytics 4 ID (`G-…`). Analytics off when unset. |

### Server (runtime, secret)

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | No | Port to bind (defaults to 3000). |
| `APP_URL` | Recommended | Public base URL, used for Stripe redirect links. Falls back to request origin. |
| `GEMINI_API_KEY` | Hosted AI | Platform Gemini key for metered AI. |
| `SUPABASE_URL` | Billing / AI | Supabase URL for the server (falls back to `VITE_SUPABASE_URL`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Billing / AI | Service-role key — used by webhooks + AI metering (bypasses RLS). **Keep secret.** |
| `STRIPE_SECRET_KEY` | Billing | Stripe secret key (`sk_live_…` / `sk_test_…`). |
| `STRIPE_WEBHOOK_SECRET` | Billing | Signing secret for the webhook endpoint (`whsec_…`). |
| `STRIPE_PRICE_PRO` | Billing | Stripe price ID for the Pro plan. |
| `STRIPE_PRICE_TEAM` | Billing | Stripe price ID for the Team plan. |

See `.env.example` for the annotated template.

---

## 3. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations **in order** (SQL Editor → paste file contents → Run):

   | File | Adds |
   |------|------|
   | `supabase/migrations/0001_init.sql` | profiles, workspaces, workspace_members, projects, RLS, signup trigger |
   | `supabase/migrations/0002_billing.sql` | subscriptions table (for Stripe) |
   | `supabase/migrations/0003_ai_usage.sql` | hosted-AI usage metering |
   | `supabase/migrations/0004_blueprint_storage.sql` | private `blueprints` storage bucket + RLS |
   | `supabase/migrations/0005_ai_cache.sql` | AI result cache |
   | `supabase/migrations/0006_team.sql` | invitations, roles, membership RLS |

3. Copy the **Project URL** and **anon key** → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Copy the **service_role key** (Project Settings → API) → `SUPABASE_SERVICE_ROLE_KEY` (server only).
5. Verify:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public'
   order by table_name;
   ```
   Expect: `ai_cache, ai_usage, invitations, profiles, projects, subscriptions, workspace_members, workspaces`.

---

## 4. Stripe setup (billing)

Prices already created on the account (live mode):

| Plan | Price ID | Amount |
|------|----------|--------|
| Pro | `price_1Ty6UzCFxF2ThjHwPHc9iwU8` | $39/mo |
| Team | `price_1Ty6V4CFxF2ThjHwcs42usTv` | $99/mo |

> For **test mode**, create equivalent test-mode prices and use their IDs +
> `sk_test_…` keys instead.

1. Set `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM` to the IDs above.
2. Get your **secret key** (Dashboard → Developers → API keys) → `STRIPE_SECRET_KEY`.
3. Add a **webhook** (Dashboard → Developers → Webhooks):
   - Endpoint: `https://<your-host>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (the webhook writes subscription rows).

Security notes: the secret key never reaches the browser; Checkout/portal require a
valid Supabase JWT and workspace ownership; the webhook verifies its signature.

---

## 5. Build & run

```bash
npm install
npm run build          # client -> dist/ , server -> dist/server.cjs
NODE_ENV=production npm run start
```

The server listens on `PORT` (default 3000) and serves the built client from
`dist/`. Container-friendly (e.g. Cloud Run): expose the port, provide env vars
as secrets, and set `APP_URL` to the public URL.

---

## 6. Go-live checklist

- [ ] Supabase project created; migrations `0001`–`0006` applied and verified.
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set, then **rebuilt**
      (client env vars are baked at build time).
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set on the server.
- [ ] (Hosted AI) `GEMINI_API_KEY` set.
- [ ] (Billing) `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`,
      `STRIPE_PRICE_TEAM` set; webhook endpoint added.
- [ ] `APP_URL` set to the public URL.
- [ ] Node server deployed and reachable (billing needs it).
- [ ] Optional: `VITE_GA_MEASUREMENT_ID` for analytics.

---

## 7. Verify after deploy

```bash
curl https://<your-host>/api/health
# { "status":"ok", "billing":true, "hostedAi":true, ... }
```

- `billing:true` → Stripe fully configured.
- `hostedAi:true` → platform Gemini key + service role present.

Then, in the app: sign up → create a project → run AI → open **Plans & Billing**
and complete a Stripe Checkout (test card `4242 4242 4242 4242` in test mode) →
confirm the plan activates (the webhook updates `subscriptions`).

---

## 8. Post-deploy hardening

- Run Supabase **Advisors** (Dashboard → Advisors, or the MCP `get_advisors`)
  after applying migrations to catch missing RLS / security issues.
- Confirm the `blueprints` storage bucket is **private**.
- Rotate the service-role and Stripe secret keys if they were ever exposed.
- Complete the `[jurisdiction]` field in `src/data/legal.ts` and have the legal
  documents reviewed by counsel.
