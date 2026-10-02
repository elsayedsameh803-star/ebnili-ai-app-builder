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
| POST     | `/api/admin/auth`                     | Admin PIN auth (signed HttpOnly session cookie)     |
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

> **Export:** the ZIP is generated in the browser from the user's own project
> files (see `src/components/ExportModal.tsx`). There is no server route that
> serves the platform's source code.

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

The app runs on `http://localhost:3000`. Override the port with the `PORT`
environment variable — `server.ts` reads it, so any PaaS (Render, Railway, Fly,
Docker) that injects a public port works without a code change:

```bash
PORT=8080 npm start
```

### One API, two runners

The HTTP surface lives in exactly one file, `api/index.ts`. It is the Vercel
serverless entry point, and `server.ts` — the runner used by `npm run dev`,
`npm start` and any self-hosted deployment — **mounts that same app** instead of
declaring its own routes.

This matters: `server.ts` previously carried a second, much smaller copy of the
API. It had no `/api/auth/*`, no `/api/projects*` and no `/api/github/*`, so a
self-hosted deployment served a site where the login wall listed no providers,
the project store returned 404, and repository import did not exist at all. The
two runners are now structurally incapable of drifting apart.

If you add a route, add it to `api/index.ts` — it is immediately available in
both environments.

## Environment Variables

| Variable          | Description                              | Required |
| ----------------- | ---------------------------------------- | -------- |
| `GEMINI_API_KEY`  | Google Gemini API key for AI calls       | Yes      |
| `APP_URL`         | Public URL of the deployed app           | No       |
| `PORT`            | Listen port for `npm start` (default 3000) | No      |

## Launch checklist

The application builds and every endpoint is verified working. These are the
remaining steps that only the site owner can perform — they require credentials
that must never be committed.

### 1. Environment variables (Vercel → Settings → Environment Variables)

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable                                        | Purpose                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `GEMINI_API_KEY`                                 | AI generation (site is unusable without) |
| `APP_URL`                                        | Pins the OAuth callbacks to one domain   |
| `AUTH_SESSION_SECRET`                            | Signs the sign-in session cookie         |
| `ADMIN_PIN` (8+ chars) · `ADMIN_SESSION_SECRET`  | Owner dashboard                          |
| `SITE_OWNER_EMAIL`                               | The single owner account                 |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`         | Sign-in + project database               |
| `SUPABASE_SERVICE_ROLE_KEY`                      | Server-side database access              |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`      | Repository import (separate OAuth app)   |

### 2. Supabase

1. Run `supabase/projects.sql` once in the SQL editor.
2. Create a **public** bucket named `payments-pending` (receipt images).

Until the database is reachable, stateful endpoints answer `503 DB_UNAVAILABLE`
and the dashboard says so explicitly — it never shows a convincing page of
zeros that looks like working data.

### 3. OAuth callback URLs

Register these **exactly** (a trailing slash or `/api` difference is rejected):

| Provider | Callback URL                                        |
| -------- | --------------------------------------------------- |
| Google   | `https://<domain>/api/auth/callback/google`         |
| GitHub sign-in | `https://<domain>/api/auth/callback/github`   |
| GitHub import  | `https://<domain>/api/github/callback`      |

The import dialog displays the exact URL the server sends with a copy button,
and `GET /api/github/config` returns it as JSON — nothing has to be guessed.

### 4. Verify after deploy

```bash
curl -s https://<domain>/api/health     # {"status":"ok","hasKey":true}
```

If `hasKey` is `false`, the AI calls will fail — the key is missing from the
deployment, not from the code.

### Sign-in (Google / GitHub)

The app gates the whole studio behind a login wall. Sign-in is **brokered by
Supabase**, because Supabase owns the OAuth apps in this project — Google and
GitHub only know Supabase's callback
(`https://<ref>.supabase.co/auth/v1/callback`), so a direct code exchange from
this server always fails with `redirect_uri_mismatch`.

| Variable                            | Description                                | Required                                   |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`          | Supabase project URL                        | Yes, for sign-in                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Supabase anon key                           | Yes, for sign-in                           |
| `AUTH_SESSION_SECRET`               | HMAC secret signing the session cookie      | Yes, for sign-in                           |
| `APP_URL`                           | Public origin, e.g. `https://ebnily.vercel.app` | Yes, for sign-in                      |
| `GOOGLE_CLIENT_ID` / `_SECRET`      | Only for a **directly owned** Google app    | No — Supabase route is used when present   |
| `GITHUB_CLIENT_ID` / `_SECRET`      | Only for a **directly owned** GitHub app    | No — Supabase route is used when present   |

### Owner dashboard — required secrets

The admin PIN used to be **hard-coded in the source** (`"1977Sameh@"`), and the
same value doubled as the signing key for both the admin session cookie and the
Pro/Business plan-grant cookie. Anyone who read the public repository could mint
an unlimited admin session and a free upgrade. Both are gone: nothing sensitive
is read from the code any more, and the secrets below are the only thing that
grants access.

| Variable                | Purpose                                              | Required |
| ----------------------- | ---------------------------------------------------- | -------- |
| `ADMIN_PIN`             | Owner PIN (≥ 8 chars)                                | Yes, for the admin dashboard |
| `ADMIN_SESSION_SECRET`  | Signs the admin session cookie                        | Recommended |
| `PLAN_GRANT_SECRET`     | Signs the Pro/Business grant cookie                   | Yes, for paid activations |
| `SITE_OWNER_EMAIL`      | The owner account; gates every owner-only surface      | Yes, for owner features |

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Behaviour when they are missing:

- No `ADMIN_PIN` → `POST /api/admin/auth` answers **503** with the setup
  instruction, instead of "wrong PIN" forever.
- No `SITE_OWNER_EMAIL` → `isOwnerAccount()` is always false, so no owner-only
  surface is exposed at all.
- No `PLAN_GRANT_SECRET` → a paid activation returns **503** rather than issuing
  a plan grant signed with a guessable key.
- A secret shorter than 24 characters is treated as unsafe and ignored, so a
  short placeholder cannot silently become the real key.

> **Rotate the old PIN.** It is no longer accepted by the code, but it was
> published — treat it as compromised and use a new one.

**Flow:** `/api/auth/google` → PKCE pair (verifier in an HttpOnly cookie) →
Supabase `/auth/v1/authorize` → Google → Supabase → back to
`/api/auth/callback/supabase?code=…` → we redeem the code and issue our own
signed session cookie. The Supabase tokens never reach the browser.

**One required setting in Supabase:** Authentication → URL Configuration →
**Redirect URLs** must include:

```
https://ebnily.vercel.app/api/auth/callback/supabase
```

and the **Site URL** should be `https://ebnily.vercel.app`. Supabase silently
refuses to redirect to any host that is not on that allowlist.

### GitHub repository import (separate from sign-in)

Importing a repository is a **different flow** from signing in, and it needs its
own OAuth app. Sign-in is brokered by Supabase; repository import talks to GitHub
directly, so **your own** GitHub OAuth App must have this callback registered:

1. Create the app at `github.com/settings/developers` → **OAuth Apps** → **New OAuth App**.
2. **Authorization callback URL** must be exactly:

   ```
   https://ebnily.vercel.app/api/github/callback
   ```

   Note the path: `/api/github/callback` — **not** `/api/auth/callback/github`,
   which belongs to the (Supabase-brokered) sign-in flow. Mixing the two is what
   produces GitHub's *"The redirect_uri is not associated with this application"*
   error.
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Vercel.

The import dialog shows the exact URL the server sends, with a copy button, so
there is nothing to guess. You can also read it from
`GET /api/github/config`. If `APP_URL` is not set, the host follows whichever
domain you opened the app from — set `APP_URL=https://ebnily.vercel.app` so the
callback stays stable.

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
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api" }],
  "functions": { "api/index.ts": { "maxDuration": 60 } }
}
```

| Setting             | Value           | Notes                                           |
| ------------------- | --------------- | ----------------------------------------------- |
| Build command       | `npm run build` | Vite static build + esbuild server bundle       |
| Output directory    | `dist`          | Vite frontend output (served by the Vercel CDN) |
| Install command     | `npm install`   | Installs dependencies + devDependencies         |
| Serverless function | `api/index.ts`  | Express app, mounted at `/api/*` via `rewrites` |
| Function duration   | `maxDuration: 60` | Head-room for Gemini calls (`/api/ai/*`)      |

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

### ⚠️ Vercel deployment — the serverless filesystem is read-only

`server.ts` (the local dev server) still persists state in JSON files
(`subscriptions_db.json`, `devices_db.json`, `admin_settings.json`) through `fs`.
**That file-based path does NOT work on Vercel**, where the function filesystem is
read-only outside `/tmp`.

All stateful endpoints on `api/index.ts` therefore use **Supabase (PostgREST)**
instead. On Vercel you must:

1. Create a Supabase project.
2. Run **`supabase/projects.sql`** in the SQL editor. It creates:
   | Table                | Holds                                                   |
   | -------------------- | ------------------------------------------------------- |
   | `ebnily_projects`    | Per-account projects                                    |
   | `ebnily_payments`    | The Orange Cash review queue                            |
   | `ebnily_devices`     | The device registry (blocks, quota, tier)               |
   | `ebnily_settings`    | Owner-editable platform values                          |
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.

Until that is done every stateful endpoint answers **503 `DB_UNAVAILABLE`** and the
dashboard shows "نفّذ supabase/projects.sql" — it never shows a page of zeros that
looks like a working dashboard with no data.

The one thing to run in the **Supabase dashboard → Storage** is a public bucket named
`payments-pending` (override with `PAYMENTS_BUCKET`) so receipt images can be stored.

### How a payment is actually activated

This is the flow that used to be broken end to end:

1. The customer submits from `/pay` or the subscription dialog → a row is written to
   `ebnily_payments` with `status = 'pending'` and `account_email` taken from the
   session cookie.
2. The owner opens the dashboard → **Transactions** lists the request.
3. Approving writes `status = 'confirmed'` plus `reviewed_at`. The account and tier
   are read from the stored row, never from the request body.
4. `/api/subscriptions/current` returns the paid tier to that account on any device,
   with the expiry measured from `reviewed_at`.

### Troubleshooting

#### `FUNCTION_INVOCATION_FAILED` on every `/api/*` request

**Root cause (fixed in this repository):** `package.json` declares `"type": "module"`,
so Vercel compiles TypeScript functions to **Node ESM**. Node's ESM loader refuses to
resolve **extensionless** relative imports, so a function entry that used
`import app from "../server"` crashed during cold start with:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/../server'
imported from /var/task/api/index.js
```

That crash is exactly what Vercel reports to the browser as `FUNCTION_INVOCATION_FAILED`.

**Fix:** every relative import inside a serverless function must carry an explicit
`.js` extension (`import app from "../server.js"`). TypeScript resolves `../server.js`
back to `../server.ts` while type-checking, and the emitted JS keeps the extension that
Node needs at runtime.

| Symptom                            | Cause                                        | Fix                                            |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `FUNCTION_INVOCATION_FAILED`       | ESM + extensionless relative import          | Use `../server.js` (see `api/index.ts`)        |
| `FUNCTION_INVOCATION_FAILED`       | Root throw during module evaluation          | Guard top-level code / lazy-init clients       |
| `FUNCTION_INVOCATION_TIMEOUT`      | Gemini call exceeds `maxDuration`            | Raise `functions["api/index.ts"].maxDuration`  |
| `404` on `/api/...`                | `rewrites` missing in `vercel.json`          | Keep the `/api/(.*)` → `/api` rewrite          |
| UI loads but `/api/ai/*` errors    | `GEMINI_API_KEY` not set on Vercel           | Add it under Settings → Environment Variables  |

#### Why the Vite dev-server import is loaded through a variable

`server.ts` starts the Vite dev server with `await import(viteModuleId)` instead of
`await import("vite")`. Using a variable keeps esbuild and Vercel's dependency tracer
from pulling the whole Vite toolchain (~50 MB incl. native binaries) into the
serverless function bundle. The branch only executes under `npm run dev`.

#### Express 4 vs Express 5 route syntax

The SPA fallback is registered as plain middleware rather than `app.get("*")`, because
the bare `"*"` string pattern is rejected by Express 5's router (`path-to-regexp`)
while still working on Express 4.

## License

MIT
