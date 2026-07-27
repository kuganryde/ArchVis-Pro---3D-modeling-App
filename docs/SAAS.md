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

## Milestone 2 — monetization

- **Hosted, metered AI.** Move Gemini calls server-side behind auth, using a
  platform key; meter requests/tokens per plan and keep BYOK as a free/enterprise
  fallback. (Digitization on large images is the main COGS — cache aggressively.)
- **Stripe billing.** Subscription tiers with usage-based AI credits:
  - **Free** — 1 project, BYOK key, watermarked exports.
  - **Pro** (~$29–49/user/mo) — unlimited projects, hosted AI credits, clean exports, BOM.
  - **Team** (~$99+/mo) — collaboration, roles, shared asset library, SSO.
  - **Enterprise** — self-host / BYOK, custom catalogs, SLA.
- **Blueprint storage.** Move base64 blueprints out of the JSONB row into
  Supabase Storage (object storage) and reference by URL.

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
