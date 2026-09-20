# Ebnili - AI App Builder 🇪🇬

**إبنيلي | Ebnili** — Platform for building and developing web apps with AI,
featuring live preview, a built-in code editor, subscription management,
and an Orange Cash wallet.

## Overview

| Layer         | Tech Stack                                      |
| ------------- | ----------------------------------------------- |
| Frontend      | React 19 + Vite 6 + Tailwind CSS v4             |
| Backend       | Express (TypeScript) + Google Gemini API      |
| Deployment    | Vercel (frontend static + serverless functions)  |
| Payments      | Orange Cash (Egypt) in-app subscription flow    |

## Features

- **AI App Generation** — Turn a natural-language prompt into a full web app (HTML, React component, API route, SQL schema).
- **Live Preview** — Real-time device-frame preview with desktop / tablet / mobile modes.
- **Visual Inspector** — Click any element in the preview to select, edit, or delete it.
- **Code Editor** — Monaco-style editor with syntax highlighting and version history.
- **Export to ZIP** — Download the generated project as a `.zip` archive.
- **Deploy to Custom Domain** — Built-in deployment workflow.
- **Subscription System** — Gemini AI calls gated behind free / Pro / Business tiers.
- **Orange Cash Payments** — Pay via Orange Money; admins verify transactions.
- **Admin Dashboard** — Real statistics, device management, transaction approval, settings.
- **WhatsApp Support** — Floating support button linked to the admin WhatsApp number.

## API Endpoints

All API routes are served through the Vercel serverless function at `api/index.ts`.

| Method   | Endpoint                              | Description                          |
| -------- | ------------------------------------- | ------------------------------------ |
| GET      | `/api/health`                         | Health check + API key status        |
| GET      | `/api/subscriptions/current`          | Current user subscription state      |
| POST     | `/api/subscriptions/auto-verify`      | Auto-verify Orange Cash payment      |
| POST     | `/api/subscriptions/submit-orange-cash` | Submit payment & activate sub       |
| POST     | `/api/subscriptions/reset-free`       | Reset to free tier                   |
| GET      | `/api/protection/status`              | Device fingerprint / quota status    |
| POST     | `/api/admin/auth`                     | Admin PIN / email authentication     |
| GET      | `/api/admin/overview`                 | Admin dashboard statistics           |
| POST     | `/api/admin/device/toggle-block`      | Block / unblock a device             |
| POST     | `/api/admin/device/reset-quota`       | Reset device generation quota        |
| POST     | `/api/admin/device/set-tier`          | Set device subscription tier         |
| POST     | `/api/admin/transaction/update-status` | Approve / reject a transaction      |
| POST     | `/api/admin/settings`                 | Update admin wallet / site settings  |
| POST     | `/api/ai/generate-app`                | Generate a full app from a prompt    |
| POST     | `/api/ai/refine-app`                  | Refine / edit an existing app        |
| POST     | `/api/ai/gemini-enhance-prompt`       | Enhance a prompt with Gemini         |
| POST     | `/api/ai/gemini-architect`            | Multi-target code architect          |
| POST     | `/api/ai/gemini-code-doctor`          | Optimize & fix code with Gemini      |
| GET      | `/download-project-zip`               | Download generated project ZIP       |

## Local Development

### Prerequisites

- **Node.js** ≥ 18
- **npm**
- A **Google Gemini API key** (from [Google AI Studio](https://aistudio.google.com/))

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# 3. Run the development server (Express + Vite HMR)
npm run dev

# 4. (Optional) Build for production
npm run build

# 5. Start the production server
npm start
```

The app runs on `http://localhost:3000`.

## Environment Variables

| Variable          | Description                              | Required |
| ----------------- | ---------------------------------------- | -------- |
| `GEMINI_API_KEY`  | Google Gemini API key for AI calls       | Yes      |
| `APP_URL`         | Public URL of the deployed app           | No       |

## Project Structure

```
ebnily/
├── api/
│   └── index.ts          # Vercel serverless function entry (imports server.ts)
├── public/               # Static assets & generated project ZIPs
├── src/
│   ├── components/       # React components (modals, editor, preview, etc.)
│   ├── data/             # Subscription plans & starter templates
│   ├── utils/            # Helpers (fingerprinting, etc.)
│   ├── types.ts          # Shared TypeScript types
│   ├── App.tsx           # Root component
│   ├── main.tsx          # React entry point
│   └── index.css         # Tailwind CSS imports
├── server.ts             # Express backend (all API routes)
├── index.html            # Vite HTML entry
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── vercel.json           # Vercel deployment configuration
├── package.json
└── metadata.json         # App metadata (AI Studio)
```

## Deployment

### Vercel

This project ships with an explicit `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api" }]
}
```

| Setting             | Value           | Notes                                           |
| ------------------- | --------------- | ----------------------------------------------- |
| Build command       | `npm run build` | Vite static build + esbuild server bundle       |
| Output directory    | `dist`          | Vite frontend output (served by the Vercel CDN) |
| Install command     | `npm install`   | Installs dependencies + devDependencies         |
| Serverless function | `api/index.ts`  | Express app, mounted at `/api/*` via `rewrites` |

#### Option A — Git-based deployment (recommended)

1. Push this repository to GitHub (already done for `elsayedsameh803-star/ebnili-ai-app-builder`).
2. Open [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → choose the repo.
3. Vercel reads `vercel.json` for the build settings (no manual configuration needed).
4. Add `GEMINI_API_KEY` under **Project → Settings → Environment Variables**.
5. Click **Deploy**. Every later push to `main` triggers an automatic deployment.

#### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel link          # link to an existing project (e.g. "ebnili")
vercel --prod
```

#### Option C — Already linked project

If a `.vercel/project.json` exists, just run:

```bash
vercel --prod --yes
```

> ⚠️ **Network requirement**: the Vercel CLI needs outbound access to `api.vercel.com`
> and `vercel.com`. If those hosts are blocked (firewall / sandbox / agent environment),
> use **Option A** — Vercel pulls from GitHub and builds on its own infrastructure.

### Required environment variables

| Variable         | Where to set it                           | Required          |
| ---------------- | ----------------------------------------- | ----------------- |
| `GEMINI_API_KEY` | Vercel → Settings → Environment Variables | Yes (AI features) |
| `APP_URL`        | Vercel → Settings → Environment Variables | Recommended       |

> **Note**: Without `GEMINI_API_KEY` the app still deploys and the UI works, but every
> call to a `/api/ai/*` endpoint returns an error.

### Filesystem caveat on serverless

The backend persists state in JSON files (`subscriptions_db.json`, `devices_db.json`,
`admin_settings.json`) through `fs`. Vercel's serverless filesystem is **read-only**
(except `/tmp`), so:

- ✅ Read endpoints (`/api/subscriptions/current`, `/api/admin/overview`, …) work.
- ⚠️ Write endpoints (submitting an Orange Cash payment, blocking a device, …) will not
  persist on Vercel. For production, migrate this state to a database
  (Vercel Postgres, Upstash Redis, Supabase, …).

## License

MIT
