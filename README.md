<div align="center">

# 🏢 ArchViz Pro — 3D Office Floor Planner & Asset Manager

**An immersive 3D CAD digital-twin planner for office floor layouts and low-current (network / AV) infrastructure.**

Design floor plans, drop in furniture and networking devices, visualise Wi-Fi coverage, occupancy load and cabling paths — then let AI digitize a real blueprint into an editable 3D model.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r184-000000?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?logo=google&logoColor=white)

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Screenshots](#-screenshots)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [Project Structure](#-project-structure)
- [How It Works](#-how-it-works)
- [AI Features (Bring Your Own Key)](#-ai-features-bring-your-own-key)
- [Exporting & Sharing](#-exporting--sharing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🔭 Overview

ArchViz Pro is a browser-based **digital-twin designer** for offices. It combines an
interactive Three.js 3D viewport with a low-current asset manager, so facilities,
IT and AV teams can plan and audit a space in one place:

- **Architects / space planners** lay out rooms and furniture.
- **IT / network teams** place access points, data points, CCTV and cabling.
- **AV teams** position HDMI/projector ports and interactive displays.

Everything is rendered live in 3D (or a top-down 2D blueprint view), with real-time
occupancy, coverage and collision feedback. A Google Gemini integration can turn an
uploaded blueprint image or a text prompt into a fully editable layout.

> The app is a full-stack single-page application: an Express server exposes the AI
> endpoints and serves the Vite-built React client.

---

## ✨ Key Features

### Design & Visualisation
- **Interactive 3D viewport** — orbit, pan and zoom with damped OrbitControls.
- **2D / 3D toggle** — switch between an extruded 3D model and a top-down blueprint.
- **Drag-and-drop editing** — click to select any asset, drag to reposition; edit
  name, specs, rotation and room assignment in the inspector.
- **Procedural asset models** — every device and furniture item is generated in
  code (Wi-Fi APs with signal rings, CCTV with real field-of-view cones derived
  from lens specs, glass vs. concrete walls, and more).
- **Collision & boundary detection** — overlapping or out-of-room assets are
  highlighted with a red warning ring and beacon.

### Analytics Overlays
- **Occupancy heatmap** — colour-codes rooms by asset density vs. capacity.
- **Wi-Fi coverage heatmap** — grades each room by distance to the nearest AP.
- **Cabling paths** — draws colour-coded runs from each device to the detected
  network/server room (MDF/IDF).

### Asset Library (Low-Current + Furniture)
- **Infrastructure:** Access Point, Data/LAN Port, Telephone Port, Power Outlet,
  HDMI Port, Projector Port, CCTV Camera, Door Access, Intercom.
- **Furniture:** single desk, 4-/6-person desk clusters, conference table,
  office chair, lounge chair, reception counter, whiteboard.
- **Room setup templates** — one-click boardroom, 4-workstation cluster or
  executive suite layouts.

### Blueprint & AI
- **Blueprint underlay** — upload an image or PDF floor plan to trace over, with
  opacity / scale / offset controls.
- **AI Blueprint Digitizer** — Gemini analyses an uploaded blueprint and generates
  editable rooms and a recommended asset layout.
- **AI Rebuild from Prompt** — describe an office in text and generate a layout.

### Data & Persistence
- **Autosave** — the working design is saved to `localStorage` and restored on
  reload.
- **Reports / Inventory** — searchable asset table with **CSV** and **JSON** export.
- **Share & Export** — PNG snapshot of the 3D view, a printable **PDF report**,
  JSON download, and copy-to-clipboard.

---

## 🧰 Tech Stack

| Layer        | Technology                                             |
|--------------|--------------------------------------------------------|
| UI           | React 19, Tailwind CSS v4, lucide-react icons          |
| 3D engine    | Three.js (r184) with OrbitControls                     |
| Language     | TypeScript 5.8                                          |
| Server       | Express 4 (AI endpoints + static/dev serving)          |
| AI           | `@google/genai` (Google Gemini)                        |
| Build        | Vite 6 (client) + esbuild (server bundle)              |
| Analytics    | Google Analytics 4 (optional, env-gated)               |

---

## 📸 Screenshots

> _Add screenshots or a short GIF here._ Suggested shots: the 3D workspace, the
> occupancy heatmap, the AI blueprint digitizer, and the Share & Export dialog.

```
docs/
  screenshot-workspace.png
  screenshot-heatmap.png
  screenshot-ai-digitizer.png
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ (20+ recommended)
- A **Google Gemini API key** (only required for the AI features) —
  get one free at <https://aistudio.google.com/app/apikey>

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/kuganryde/ArchVis-Pro---3D-modeling-App.git
cd ArchVis-Pro---3D-modeling-App

# 2. Install dependencies
npm install

# 3. Configure environment (optional — AI works with an in-app key too)
cp .env.example .env
#   then edit .env and set GEMINI_API_KEY / VITE_GA_MEASUREMENT_ID

# 4. Start the dev server
npm run dev
```

The app runs at **http://localhost:3000**.

> 💡 You don't need a server-side key to try the AI: click **Set API Key** in the
> app to provide your Gemini key at runtime (Bring Your Own Key). It is stored only
> in your browser's `sessionStorage`.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in as needed. All are **optional** for basic
use; the AI features require a Gemini key (server-side or in-app).

| Variable                  | Required | Description                                                                 |
|---------------------------|----------|-----------------------------------------------------------------------------|
| `GEMINI_API_KEY`          | For AI   | Server-side Google Gemini key. Falls back to the in-app key if unset.       |
| `APP_URL`                 | No       | Public URL where the app is hosted (self-referential links).                |
| `VITE_GA_MEASUREMENT_ID`  | No       | Google Analytics 4 ID (e.g. `G-XXXXXXXXXX`). Analytics is disabled if unset. |
| `VITE_SUPABASE_URL`       | For SaaS | Supabase project URL. Enables accounts + cloud projects when set (with the key below). |
| `VITE_SUPABASE_ANON_KEY`  | For SaaS | Supabase anon/publishable key. Required alongside the URL to enable SaaS mode. |

> `VITE_`-prefixed variables are exposed to the browser at build time; everything
> else stays server-side only.

---

## ☁️ SaaS Mode (multi-tenant, cloud projects)

ArchViz Pro runs in two modes, decided automatically by whether Supabase is
configured:

- **Local mode** (default, no Supabase env vars) — single user, no login;
  designs autosave to the browser's `localStorage`, exactly as before.
- **SaaS mode** (both `VITE_SUPABASE_*` set) — email/password **accounts**,
  per-user **workspaces**, and **cloud-saved projects** with a project switcher
  in the header. Tenant isolation is enforced by Postgres Row-Level Security.

### Enable SaaS mode

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: open the SQL editor and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   (or `supabase db push` with the CLI). This creates `profiles`, `workspaces`,
   `workspace_members` and `projects`, the RLS policies, and a signup trigger
   that gives each new user a personal workspace.
3. Copy the **Project URL** and **anon key** into `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
4. Restart the dev server / rebuild. Users now sign up, and each design is saved
   to their workspace in the cloud.

> The AI features remain BYOK (users supply their own Gemini key). Hosted,
> metered AI is a future milestone — see [`docs/SAAS.md`](docs/SAAS.md).

### Billing (Stripe subscriptions)

Paid plans are handled by Stripe and are **optional** — leave the Stripe env
vars empty and the app runs on the Free plan with no billing UI surfaced.

1. In Stripe, create two recurring **Prices** (Pro and Team) and copy their IDs.
2. Apply the billing migration
   [`supabase/migrations/0002_billing.sql`](supabase/migrations/0002_billing.sql)
   (adds the `subscriptions` table + RLS).
3. Add a Stripe **webhook** → `https://<your-host>/api/stripe/webhook`
   subscribed to `checkout.session.completed` and
   `customer.subscription.created|updated|deleted`.
4. Set the server env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `SUPABASE_SERVICE_ROLE_KEY`) — see
   `.env.example` — and restart.

The **Stripe secret key never reaches the browser**: Checkout and the billing
portal are created server-side, and subscription state is written to the DB only
from signature-verified webhooks. Billing requires the Node server (`npm run
start`) — a static-only deploy can't process payments.

> ⚠️ Billing endpoints live on the Express server, so a static-only host will
> serve the app but can't run Checkout/webhooks.

---

## 📜 Available Scripts

| Command          | Description                                              |
|------------------|----------------------------------------------------------|
| `npm run dev`    | Start the Express + Vite dev server on port 3000.        |
| `npm run build`  | Build the client (Vite) and bundle the server (esbuild). |
| `npm run start`  | Run the production server from `dist/`.                  |
| `npm run lint`   | Type-check the project with `tsc --noEmit`.              |
| `npm run clean`  | Remove build artifacts.                                  |

---

## 🗂 Project Structure

```
ArchVis-Pro---3D-modeling-App/
├── server.ts                     # Express server + Gemini AI endpoints
├── index.html                    # HTML shell
├── vite.config.ts                # Vite config (aliases, vendor chunk splitting)
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # App shell: state hub, modals, exports
│   ├── types.ts                  # Shared types + asset height helpers
│   ├── components/
│   │   ├── ThreeCanvas.tsx       # Three.js scene, rendering, interaction
│   │   └── CADSidebar.tsx        # Library / Rooms / Inventory panels
│   ├── data/
│   │   └── defaultFloorPlan.ts   # Seed rooms and assets
│   └── utils/
│       ├── geometry.ts           # Sizing, collision, occupancy, wall style
│       ├── layout.ts             # Normalises AI / imported payloads
│       └── persistence.ts        # localStorage autosave / restore
└── .env.example
```

---

## ⚙️ How It Works

- **State hub (`App.tsx`)** — holds all `rooms` and `assets`, the asset factory,
  room templates, blueprint state, and the export/share logic. The design
  autosaves (debounced) to `localStorage`.
- **3D engine (`ThreeCanvas.tsx`)** — builds the scene, procedurally generates a
  mesh per asset type, runs raycasting for click/drag/hover, and renders the
  heatmap, Wi-Fi and cabling overlays. Room labels are projected to an HTML HUD.
- **Sidebar (`CADSidebar.tsx`)** — the Library (add assets), Rooms (create rooms,
  apply templates, manage the blueprint underlay) and Inventory (search + export)
  tabs, plus the selected-asset inspector.
- **Server (`server.ts`)** — two AI endpoints share one retry/back-off pipeline and
  a strict JSON response schema:
  - `POST /api/digitize-blueprint` — image → rooms + assets
  - `POST /api/rebuild-from-prompt` — text → rooms + assets

---

## 🤖 AI Features (Bring Your Own Key)

The AI features use **Google Gemini** and follow a **BYOK** model:

1. Click **Set API Key** and paste your Gemini key. It is stored **only** in your
   browser's `sessionStorage` — never persisted on the server — and is proxied per
   request via an `x-gemini-api-key` header. Alternatively, set `GEMINI_API_KEY`
   on the server.
2. **Digitize a blueprint:** upload a floor-plan image/PDF, then run the AI
   digitizer to generate editable rooms and a recommended asset layout.
3. **Rebuild from a prompt:** describe the office (e.g. _"open-plan startup floor
   with a boardroom, two meeting pods and a reception"_) and generate a layout.

The server tries `gemini-2.5-flash` first and falls back to
`gemini-2.5-flash-lite`, with three attempts per model and exponential back-off.

---

## 📤 Exporting & Sharing

Open **Share & Export** in the header:

- **Copy Design JSON** — copies the full layout to the clipboard.
- **Download JSON** — a re-importable schematic backup.
- **Export as PDF** — a printable report with a 3D snapshot, room summary and full
  asset inventory (opens the browser print dialog → "Save as PDF").
- **Export as Image** — a PNG snapshot of the current 3D view.

The **Inventory** tab additionally offers **CSV** and **JSON** exports of the asset
list for spreadsheets or reporting databases.

---

## 🌐 Deployment

Build and run the production bundle:

```bash
npm run build     # → dist/ (client) and dist/server.cjs (server)
NODE_ENV=production npm run start
```

The server listens on port **3000** and serves the static client from `dist/`.
Set `GEMINI_API_KEY` (and optionally `APP_URL`, `VITE_GA_MEASUREMENT_ID`) in the
production environment. The app is container-friendly (e.g. Cloud Run) — expose
port 3000 and provide the env vars as secrets.

---

## 🩺 Troubleshooting

| Symptom                                   | Likely cause / fix                                                            |
|-------------------------------------------|-------------------------------------------------------------------------------|
| AI digitizer returns an error             | Missing/invalid Gemini key, or transient rate limiting — retry after a moment. |
| "Gemini API Key is required"              | Set the in-app key (**Set API Key**) or `GEMINI_API_KEY` on the server.        |
| Image export produces a blank PNG         | Give the 3D canvas a moment to render, then export again.                      |
| PDF report doesn't open                   | Allow pop-ups for the site (the report opens in a new tab to print).           |
| Design vanished after clearing browser    | Autosave uses `localStorage`; export JSON regularly for portable backups.      |

---

## 🛣 Roadmap

- Multi-floor / level support
- Undo / redo history
- Real-time multi-user collaboration
- Direct BIM / IFC and DWG import
- Bill-of-materials cost estimation

---

## 📄 License

This project is provided under the **Apache-2.0** license (see source headers).
Update this section if your distribution terms differ.

---

<div align="center">
Built with React, Three.js and Google Gemini.
</div>
