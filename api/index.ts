// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — self-contained, lightweight entry point.
//
// WHY self-contained (no `import ... from "../server"`):
//  • `server.ts` is a ~2300-line dev server: it pulls `vite` middleware,
//    serves static files from `dist/`, and reads/writes JSON "databases"
//    with `fs` — none of which works inside a Vercel serverless function.
//  • Importing the whole file also drags heavy deps into the function bundle
//    and crashes cold starts (ERR_MODULE_NOT_FOUND / FUNCTION_INVOCATION_FAILED).
//  • So this function implements the HTTP API surface the frontend needs
//    (health, subscriptions, admin read paths, Gemini AI proxy) directly on
//    Express, with in-memory state. Writes are best-effort (serverless FS is
//    ephemeral) and never throw.
// ─────────────────────────────────────────────────────────────────────────────
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import crypto from "node:crypto";

const app = express();
app.use(express.json({ limit: "15mb" }));

// ── CORS (allows preview deployments & custom domains) ───────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-device-id, x-fingerprint-hash");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ── Health & status ─────────────────────────────────────────────────────────
// NOTE: getApiKey is defined in the Gemini section below (function hoisting
// makes it available here at runtime).
app.get(["/api/health", "/api", "/", "/health"], (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ebnili-api",
    time: new Date().toISOString(),
    // Deployment fingerprint — lets us verify which commit is actually live.
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7),
    env: process.env.VERCEL_ENV ?? "local",
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    hasKey: Boolean(getApiKey()),
  });
});

// ── Subscriptions: stateless defaults (client holds source of truth) ─────────
const DEFAULT_SUBSCRIPTION = {
  tier: "free",
  status: "active",
  planName: "Starter Free",
  generationsUsedToday: 0,
  generationsLimitToday: 5,
  canExportZip: false,
  canDeployCustomDomain: false,
  canUseVisualInspector: true,
  priorityAiModel: false,
  transactions: [],
};

// ── Subscriptions: accept BOTH endpoints the frontend uses ──────────────────
function subscriptionPayload() {
  return {
    success: true,
    subscription: { ...DEFAULT_SUBSCRIPTION, activatedAt: new Date().toISOString() },
    orangeWalletNumber: "01207782741",
    supportWhatsappNumber: "01207782741",
  };
}

app.get("/api/subscriptions/current", (_req: Request, res: Response) => {
  res.json(subscriptionPayload());
});

// Frontend SubscriptionModal posts to /auto-verify; server.ts activates the
// plan immediately, so mirror that: return an activated subscription object.
function activateSubscription(body: Record<string, unknown>) {
  const planId = (body.planId as string) || "pro";
  const planName =
    planId === "business" ? "Business" : planId === "pro" ? "Pro" : "Starter Free";
  const tier = (planId === "business" ? "business" : planId === "pro" ? "pro" : "free") as
    | "free"
    | "pro"
    | "business";
  return {
    success: true,
    status: "confirmed",
    subscription: {
      ...DEFAULT_SUBSCRIPTION,
      tier,
      status: "active",
      planName,
      activatedAt: new Date().toISOString(),
      generationsLimitToday: tier === "free" ? 5 : 9999,
      canExportZip: tier !== "free",
      canDeployCustomDomain: tier === "business",
      priorityAiModel: tier !== "free",
    },
  };
}

app.post("/api/subscriptions/auto-verify", (req: Request, res: Response) => {
  res.json(activateSubscription((req.body as Record<string, unknown>) ?? {}));
});

app.post("/api/subscriptions/submit-orange-cash", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "pending",
    message: "تم استلام طلبك بنجاح، سيتم مراجعته وتفعيل اشتراكك.",
    transactionId: `txn_${Date.now()}`,
  });
});

app.post("/api/subscriptions/reset-free", (_req: Request, res: Response) => {
  res.json({ success: true, subscription: DEFAULT_SUBSCRIPTION });
});

// ── Device protection (stateless stubs) ─────────────────────────────────────
app.get("/api/protection/status", (req: Request, res: Response) => {
  res.json({
    success: true,
    deviceId: req.query.deviceId ?? null,
    isBlocked: false,
    freeGenerationsUsed: 0,
    freeGenerationsLimit: 5,
  });
});

// ── Admin (owner-only, guarded by an HMAC-signed HttpOnly session cookie) ────
// SECURITY (kept in sync with server.ts):
//  • PIN-only, timing-safe verification — knowing the public admin email must
//    NEVER grant owner access.
//  • Rate-limited login attempts (best effort per serverless instance).
//  • Every admin read/write route below requires a valid session cookie, so
//    these endpoints are no longer anonymous.
const ADMIN_COOKIE_NAME = "ebnili_admin_session";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const ADMIN_FAIL_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_MAX_FAILS = 10;
const adminLoginFailures = new Map<string, { count: number; resetAt: number }>();

// Stateless environment: REAL defaults only (zero fabricated numbers).
const DEFAULT_ADMIN_SETTINGS = {
  orangeWalletNumber: "01207782741",
  defaultFreeLimit: 5,
  autoVerificationEnabled: true,
  supportWhatsappNumber: "01207782741",
  siteName: "إبنيلي | Ebnili AI Studio",
  adminEmail: "elsayedsameh803@gmail.com",
};

function expectedAdminPin(): string {
  return (process.env.ADMIN_PIN || "1977Sameh@").trim();
}

function adminSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || expectedAdminPin();
}

function signAdminExpiry(exp: string): string {
  return crypto.createHmac("sha256", adminSessionSecret()).update(exp).digest("base64url");
}

function issueAdminSession(): string {
  const exp = String(Date.now() + ADMIN_SESSION_TTL_MS);
  return `${exp}.${signAdminExpiry(exp)}`;
}

function isValidAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const sep = token.indexOf(".");
  if (sep <= 0) return false;
  const exp = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  const expected = signAdminExpiry(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const expNum = Number(exp);
  return Number.isFinite(expNum) && Date.now() < expNum;
}

function readAdminCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === ADMIN_COOKIE_NAME) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function adminClientKey(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return ip || req.socket.remoteAddress || "unknown";
}

function registerAdminLoginFailure(req: Request): void {
  const key = adminClientKey(req);
  const rec = adminLoginFailures.get(key);
  if (!rec || Date.now() > rec.resetAt) {
    adminLoginFailures.set(key, { count: 1, resetAt: Date.now() + ADMIN_FAIL_WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

function pinMatches(pin: unknown): boolean {
  const submitted = Buffer.from(typeof pin === "string" ? pin.trim() : "");
  let match = false;
  // Constant-time comparison against every configured candidate.
  for (const candidate of [expectedAdminPin()]) {
    const c = Buffer.from(candidate);
    if (submitted.length === c.length && crypto.timingSafeEqual(submitted, c)) match = true;
  }
  return match;
}

// Every admin read/write route must present a valid session cookie.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isValidAdminSession(readAdminCookie(req))) {
    return res
      .status(401)
      .json({ success: false, message: "انتهت الجلسة أو غير مصرح — سجّل الدخول مجدداً كمالك الموقع." });
  }
  next();
}

app.post("/api/admin/auth", (req: Request, res: Response) => {
  const { pin } = (req.body as { pin?: string; email?: string }) ?? {};
  const failureRec = adminLoginFailures.get(adminClientKey(req));
  if (failureRec && Date.now() <= failureRec.resetAt && failureRec.count >= ADMIN_MAX_FAILS) {
    const throttleMsg = "محاولات دخول كثيرة جداً — أعد المحاولة بعد 10 دقائق.";
    return res.status(429).json({ success: false, message: throttleMsg, error: throttleMsg });
  }
  // PIN-only: an email address alone must never grant owner access.
  if (!pinMatches(pin)) {
    registerAdminLoginFailure(req);
    const invalidMsg = "رمز الدخول غير صحيحة";
    return res.status(401).json({ success: false, message: invalidMsg, error: invalidMsg });
  }
  adminLoginFailures.delete(adminClientKey(req));
  res.cookie(ADMIN_COOKIE_NAME, issueAdminSession(), {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  });
  res.json({ success: true });
});

app.get("/api/admin/overview", requireAdmin, (_req: Request, res: Response) => {
  // Stateless environment: report only REAL values — no invented statistics.
  res.json({
    success: true,
    stats: {
      totalDevicesCount: 0,
      blockedDevicesCount: 0,
      activeProUsersCount: 0,
      totalGenerationsExecuted: 0,
      totalRevenueEGP: 0,
      totalTransactionsCount: 0,
      lastActiveTime: new Date().toISOString(),
    },
    settings: DEFAULT_ADMIN_SETTINGS,
    devices: [],
    recentTransactions: [],
  });
});

for (const p of [
  "/api/admin/device/toggle-block",
  "/api/admin/device/reset-quota",
  "/api/admin/device/set-tier",
  "/api/admin/transaction/update-status",
  "/api/admin/settings",
]) {
  app.post(p, requireAdmin, (_req: Request, res: Response) =>
    res.json({
      success: true,
      path: p,
      // Serverless FS is read-only: accepted, but nothing persists until a DB
      // is attached (documented in README). Never echo the raw body back.
      persisted: false,
      message: "تم الاستلام — التخزين الدائم غير متاح في بيئة الخوادم الحالية.",
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// User authentication — Google & GitHub (OAuth 2.0 authorization-code flow)
// ─────────────────────────────────────────────────────────────────────────────
// SECURITY NOTES:
//  • The client secret NEVER reaches the browser. The code → token exchange and
//    the profile lookup both happen here, server-side.
//  • `state` is a single-use random nonce kept in a short-lived HttpOnly cookie
//    and compared on the way back, which blocks CSRF / login-injection.
//  • The session is a stateless HMAC-SHA256 signed HttpOnly cookie, so it works
//    on Vercel's stateless serverless runtime with no database attached.
//  • Both providers are OPTIONAL. When their env vars are missing,
//    `/api/auth/providers` reports `configured: false` and the UI hides them —
//    the rest of the app keeps working exactly as before.
// Env vars: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GITHUB_CLIENT_ID /
//           GITHUB_CLIENT_SECRET / AUTH_SESSION_SECRET / APP_URL
// ─────────────────────────────────────────────────────────────────────────────

type AuthReq = Request;
type AuthRes = Response;
type AuthProviderId = "google" | "github";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture: string;
  provider: AuthProviderId;
}

interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
  configured: boolean;
}

const AUTH_COOKIE_NAME = "ebnili_user_session";
const AUTH_STATE_COOKIE = "ebnili_oauth_state";
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const AUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function authSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PIN ||
    "ebnili-insecure-dev-secret"
  );
}

function hmacB64(input: string): string {
  return crypto.createHmac("sha256", authSessionSecret()).update(input).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readCookie(req: AuthReq, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

// Absolute origin of THIS request — correct behind Vercel / any reverse proxy.
function requestBaseUrl(req: AuthReq): string {
  const configured = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const fwdProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const fwdHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const proto = fwdProto || req.protocol || "http";
  const host = fwdHost || req.headers.host || "localhost:3000";
  return `${proto}://${host}`;
}

function authCallbackUrl(req: AuthReq, provider: AuthProviderId): string {
  return `${requestBaseUrl(req)}/api/auth/callback/${provider}`;
}

function providerConfig(provider: AuthProviderId): ProviderCredentials {
  if (provider === "google") {
    const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
    return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
  }
  const clientId = (process.env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || "").trim();
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

function issueAuthSession(user: AuthUser): string {
  const body = Buffer.from(
    JSON.stringify({ ...user, iat: Date.now(), exp: Date.now() + AUTH_SESSION_TTL_MS }),
  ).toString("base64url");
  return `${body}.${hmacB64(body)}`;
}

function readAuthSession(req: AuthReq): AuthUser | null {
  const token = readCookie(req, AUTH_COOKIE_NAME);
  if (!token) return null;
  const sep = token.indexOf(".");
  if (sep <= 0) return null;
  const body = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  if (!safeEqual(sig, hmacB64(body))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: string;
      provider?: string;
      exp?: number;
    };
    if (!parsed?.id || !parsed?.provider) return null;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return {
      id: String(parsed.id),
      name: String(parsed.name || parsed.email || "Ebnili User"),
      email: String(parsed.email || ""),
      picture: String(parsed.picture || ""),
      provider: parsed.provider === "github" ? "github" : "google",
    };
  } catch {
    return null;
  }
}
// ── Provider token exchange + profile fetch (no SDK, plain fetch) ────────────
async function exchangeGoogleCode(code: string, redirectUri: string): Promise<AuthUser | null> {
  const { clientId, clientSecret } = providerConfig("google");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) return null;
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return null;

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  if (!info.sub) return null;
  return {
    id: String(info.sub),
    name: String(info.name || info.email || "Google User"),
    email: String(info.email || ""),
    picture: String(info.picture || ""),
    provider: "google",
  };
}

async function exchangeGitHubCode(code: string, redirectUri: string): Promise<AuthUser | null> {
  const { clientId, clientSecret } = providerConfig("github");
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!tokenRes.ok) return null;
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return null;

  const ghHeaders = {
    Authorization: `Bearer ${tokenJson.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Ebnili-App",
  };
  const userRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
  if (!userRes.ok) return null;
  const ghUser = (await userRes.json()) as {
    id?: number;
    login?: string;
    name?: string;
    email?: string | null;
    avatar_url?: string;
  };
  if (!ghUser.id) return null;

  // GitHub users may hide their email — fall back to the verified primary one.
  let email = ghUser.email || "";
  if (!email) {
    try {
      const emailsRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as {
          email?: string;
          primary?: boolean;
          verified?: boolean;
        }[];
        const match = emails.find((e) => e?.primary && e?.verified) || emails.find((e) => e?.verified);
        email = match?.email || "";
      }
    } catch {
      /* email stays empty — login still succeeds */
    }
  }

  return {
    id: String(ghUser.id),
    name: String(ghUser.name || ghUser.login || "GitHub User"),
    email,
    picture: ghUser.avatar_url || "",
    provider: "github",
  };
}
// ── Auth routes ─────────────────────────────────────────────────────────────
// NOTE: the literal paths below are registered BEFORE `/api/auth/:provider`,
// otherwise Express would treat "me" / "logout" / "providers" as a provider id.

// Which providers can actually be used right now (drives the UI).
app.get("/api/auth/providers", (_req: AuthReq, res: AuthRes) => {
  const ids: AuthProviderId[] = ["google", "github"];
  res.json({
    success: true,
    providers: ids.map((id) => ({ id, configured: providerConfig(id).configured })),
  });
});

// Who am I? Returns `{ authenticated: false }` for guests — never an error.
app.get("/api/auth/me", (req: AuthReq, res: AuthRes) => {
  const user = readAuthSession(req);
  res.json({ success: true, authenticated: Boolean(user), user });
});

app.post("/api/auth/logout", (_req: AuthReq, res: AuthRes) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.clearCookie(AUTH_STATE_COOKIE, { path: "/" });
  res.json({ success: true, authenticated: false });
});

// Step 1 — bounce the browser to the provider's consent screen.
app.get("/api/auth/:provider", (req: AuthReq, res: AuthRes) => {
  const provider = String(req.params.provider || "").toLowerCase() as AuthProviderId;
  const home = requestBaseUrl(req);

  if (provider !== "google" && provider !== "github") {
    return res.status(404).json({ success: false, message: "Unknown auth provider" });
  }
  const cfg = providerConfig(provider);
  if (!cfg.configured) {
    return res.redirect(`${home}/?auth_error=not_configured`);
  }

  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(AUTH_STATE_COOKIE, `${provider}.${state}`, {
    httpOnly: true,
    secure: Boolean(process.env.VERCEL),
    sameSite: "lax", // the provider returns via a top-level GET navigation
    path: "/",
    maxAge: AUTH_STATE_TTL_MS,
  });

  const redirectUri = authCallbackUrl(req, provider);
  const url =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", provider === "google" ? "openid email profile" : "read:user user:email");
  if (provider === "google") url.searchParams.set("prompt", "select_account");

  return res.redirect(url.toString());
});

// Step 2 — the provider redirects back here with ?code=…&state=…
app.get("/api/auth/callback/:provider", async (req: AuthReq, res: AuthRes) => {
  const provider = String(req.params.provider || "").toLowerCase() as AuthProviderId;
  const home = requestBaseUrl(req);
  const fail = (reason: string) => res.redirect(`${home}/?auth_error=${encodeURIComponent(reason)}`);

  if (provider !== "google" && provider !== "github") return fail("unknown_provider");

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";
  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("missing_code");

  // Single-use CSRF nonce: the cookie is cleared on first read, so a replayed
  // callback URL can never mint a second session.
  const expected = readCookie(req, AUTH_STATE_COOKIE);
  res.clearCookie(AUTH_STATE_COOKIE, { path: "/" });
  if (!expected) return fail("state_cookie_missing");
  const sep = expected.indexOf(".");
  if (sep <= 0) return fail("state_cookie_invalid");
  if (expected.slice(0, sep) !== provider) return fail("state_provider_mismatch");
  if (!safeEqual(expected.slice(sep + 1), state)) return fail("state_mismatch");

  const cfg = providerConfig(provider);
  if (!cfg.configured) return fail("not_configured");

  try {
    const redirectUri = authCallbackUrl(req, provider);
    const user =
      provider === "google"
        ? await exchangeGoogleCode(code, redirectUri)
        : await exchangeGitHubCode(code, redirectUri);
    if (!user) return fail("profile_failed");

    res.cookie(AUTH_COOKIE_NAME, issueAuthSession(user), {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_TTL_MS,
    });
    return res.redirect(`${home}/?auth=success`);
  } catch (e) {
    console.error("auth callback failed:", e instanceof Error ? e.message : String(e));
    return fail("exchange_failed");
  }
});

// ── Gemini AI proxy ─────────────────────────────────────────────────────────
// Accepts GEMINI_API_KEY plus common aliases so the function works no matter
// which exact variable name was configured in the Vercel dashboard.
function getApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ""
  ).trim();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// Model priority is based on the official Gemini model catalogue and live
// production behaviour. Keep concrete stable IDs instead of relying on a
// moving alias: the alias can be unavailable for a particular API key.
//   gemini-3.5-flash     → stable, fast, and strong for coding workflows
//   gemini-3.5-flash-lite → stable low-latency fallback for text generation
//   gemini-3.8-flash     → newest flagship Flash, kept after the stable 3.5
//   gemini-flash-latest  → official hot-swapped alias
//   gemini-3.7-flash     → previous-generation stable coding model
//   gemini-3.6-flash     → last-resort stable model (can be slower)
// gemini-2.5-flash remains excluded because the production key received a
// 404 "no longer available to new users" response on 2026-09-24.
const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

// Keep the whole function below Vercel's 60-second limit with room for the
// response to be serialized. A complete HTML document is more likely to finish
// on the primary model, while a low-latency fallback gets a shorter slice.
const GEMINI_TOTAL_BUDGET_MS = 45_000;
const GEMINI_ATTEMPT_TIMEOUT_MS = 18_000;

async function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// A 404/"no longer available"/invalid-key failure means the model is unusable
// for this API key. A timeout is also not useful to retry within the same
// serverless request: it has already consumed its entire attempt budget.
// Keep transient 429/503 failures eligible for one short second pass.
function classifyModelError(raw: string): "permanent" | "timeout" | "transient" {
  if (
    /\b400\b|\b401\b|\b403\b|\b404\b|invalid argument|bad request|is not found|no longer available|not found for API key|API key not valid|API_KEY_INVALID/i.test(
      raw,
    )
  ) {
    return "permanent";
  }
  if (/timed out|deadline exceeded/i.test(raw)) return "timeout";
  return "transient";
}

async function generateWithGemini(ai: GoogleGenAI, prompt: string, systemInstruction?: string) {
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
  const failures: string[] = [];
  const deadModels = new Set<string>();
  const retryableModels = new Set<string>();
  const attempts = new Map<string, number>();
  let lastError: unknown = null;

  // Retry only short-lived quota/capacity failures. Repeating a 404 or a
  // timed-out request cannot make this response arrive any faster.
  const MAX_PASSES = 2;
  const MAX_ATTEMPTS_PER_MODEL = 2;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    let attempted = false;

    for (const model of CANDIDATE_MODELS) {
      if (deadModels.has(model) || (attempts.get(model) ?? 0) >= MAX_ATTEMPTS_PER_MODEL) continue;
      if (pass > 1 && !retryableModels.has(model)) continue;

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        failures.push(`budget exhausted before pass ${pass}`);
        break;
      }

      attempted = true;
      attempts.set(model, (attempts.get(model) ?? 0) + 1);
      const attemptTimeout = Math.min(remaining, GEMINI_ATTEMPT_TIMEOUT_MS);
      const usesThinkingLevel = model === "gemini-3.5-flash" || model === "gemini-3.5-flash-lite";
      // `low` is supported by both stable 3.5 Flash variants. Avoid changing
      // the shared config when there is no system instruction.
      const config: {
        systemInstruction?: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(usesThinkingLevel ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      };

      try {
        // NOTE: `contents` must be a plain string (not an array). Passing an
        // array of strings makes the SDK throw a 500 inside the function.
        const result = await withDeadline(
          ai.models.generateContent({
            model,
            contents: prompt,
            ...(Object.keys(config).length > 0 ? { config } : {}),
          }),
          attemptTimeout,
          `Gemini model "${model}"`,
        );
        if (!extractText(result).trim()) {
          throw new Error(`Gemini model "${model}" returned an empty response`);
        }
        return result;
      } catch (e) {
        lastError = e;
        const raw = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ");
        const errorKind = classifyModelError(raw);
        if (errorKind === "permanent") deadModels.add(model);
        if (errorKind === "transient") retryableModels.add(model);
        failures.push(`p${pass} ${model}: ${raw.slice(0, 160)}`);
      }
    }

    const canRetry = CANDIDATE_MODELS.some(
      (model) =>
        !deadModels.has(model) &&
        retryableModels.has(model) &&
        (attempts.get(model) ?? 0) < MAX_ATTEMPTS_PER_MODEL,
    );
    if (!attempted || !canRetry || deadline - Date.now() <= 0) break;

    // Leave two seconds for JSON serialization and the Vercel response itself.
    const pause = Math.min(700 * pass, Math.max(0, deadline - Date.now() - 2_000));
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
  }

  const detail = failures.join(" | ").slice(0, 1800);
  console.error(`generateWithGemini: all models failed — ${detail}`);
  throw lastError
    ? new Error(`${lastError instanceof Error ? lastError.message : String(lastError)} [per-model: ${detail}]`)
    : new Error(`All candidate Gemini models are currently unavailable [per-model: ${detail}]`);
}

// The @google/genai SDK returns `response.text` as a *getter property*, not a
// method — read it defensively so we never send an empty `code` back.
function extractText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as { text?: unknown; candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  if (typeof r.text === "string" && r.text.length > 0) return r.text;
  try {
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
  } catch {
    return "";
  }
}

// ── Owner-defined generation standards (applied to every AI endpoint) ─────
const CORE_RULES = `NON-NEGOTIABLE STANDARDS:
1. CLEAN OUTPUT ONLY — deliver the complete code artifact in exactly the format specified and nothing else: no explanations, no greetings, no recommendations, no suggestions, no conversational commentary. Inside the generated user interface, include absolutely no side text, tips, watermarks, "AI-generated" badges, or any written commentary addressed to the user.
2. FLAGSHIP QUALITY — match the polish of the largest commercial web platforms: modern clean UI/UX, cohesive design tokens, generous spacing, accessible contrast, smooth micro-interactions, pixel-consistent components, full mobile-first responsiveness, RTL layout with Arabic typography when the request is in Arabic, and a result production-ready for immediate use.
3. STABILITY FIRST — never jeopardize generation: emit syntactically valid complete documents (doctype, head, body always present), preserve every existing working feature when refining, never truncate, never emit placeholders or pseudo-code, and keep JavaScript error-free with zero console errors.`;

const GENERATE_SYSTEM = `You are Ebnily AI, an elite full-stack engineer and UI/UX designer generating single-file interactive web applications that run directly inside an iframe.
Return ONLY one complete standalone HTML document beginning with <!DOCTYPE html> and ending with </html>, including the Tailwind CDN (https://cdn.tailwindcss.com), an icon library, Google Fonts (Cairo font with dir="rtl" when Arabic is requested), full state management in an inline <script>, realistic mock data, interactive forms, search and filtering, modals, and mobile responsiveness.
No markdown fences, no JSON, no prose before or after the document.
${CORE_RULES}`;

const REFINE_SYSTEM = `You are Ebnily AI's precision code refiner. Apply the user's modification request to the provided HTML application.
Return ONLY the complete updated HTML document (from <!DOCTYPE html> to </html>) with the requested change applied while every existing feature, style, and script keeps working. No explanations, no diffs, no markdown fences, no prose.
${CORE_RULES}`;

const STUDIO_SYSTEM = `You are the Ebnily AI studio assistant. Produce exactly the artifact the request asks for — pure text, pure code, or a pure JSON object exactly as the caller requires — with zero commentary around it.
${CORE_RULES}`;

// Strip prose/markdown wrappers some models add so clients always receive
// code only (owner standard #1) without touching valid documents.
function stripToCode(text: string): string {
  let t = (text || "").trim();
  // Unwrap a response that is nothing but one fenced block.
  const fence = t.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
  if (fence && typeof fence[1] === "string") t = fence[1].trim();
  // Cut any prose written before the document.
  const start = t.search(/<!DOCTYPE html>/i);
  if (start > 0) t = t.slice(start);
  // Cut fences/commentary written after </html> (tail prose, change lists…).
  const end = t.search(/<\/html>/i);
  if (end >= 0) {
    t = t.slice(0, end + "</html>".length);
  } else {
    // Truncated document: drop a trailing closing fence if present.
    const closeFence = t.indexOf("```");
    if (closeFence > 10) t = t.slice(0, closeFence);
  }
  return t.trim();
}

// Selected-element context posted by the visual inspector.
type SelectedElementContext = {
  tagName?: string;
  text?: string;
  className?: string;
  selector?: string;
};

// Normalize whatever the model returned into a complete HTML document.
// Returns "" when nothing usable came back so callers can fall back instead
// of failing (owner standard #3: generation must never break, never 500).
function normalizeRefinedHtml(raw: string): string {
  let t = (raw || "").trim();
  if (!t) return "";
  const fence = t.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
  if (fence && typeof fence[1] === "string") t = fence[1].trim();
  if (t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t) as { html?: unknown };
      if (typeof parsed.html === "string" && parsed.html.trim()) t = parsed.html.trim();
    } catch {
      // Not JSON — keep the raw text and continue below.
    }
  }
  const doc = stripToCode(t);
  if (!doc) return "";
  if (/<!DOCTYPE html>/i.test(doc)) return doc;
  if (/<html[\s>]/i.test(doc)) return `<!DOCTYPE html>\n${doc}`;
  return "";
}

// Deterministic local refinement used whenever the AI call cannot complete
// (missing key, model failure, timeout, empty reply). Mirrors server.ts so
// /api/ai/refine-app always answers 200 with usable code — never 500.
function applyLocalRefinement(html: string, prompt: string, selectedElement?: SelectedElementContext): string {
  let updated = html;
  const p = prompt.toLowerCase();

  if (p.includes("dark") || p.includes("داكن") || p.includes("اسود") || p.includes("دارك")) {
    if (!updated.includes("class=\"dark\"")) {
      updated = updated.replace(/<body([^>]*)class="([^"]*)"/i, '<body$1class="$2 bg-slate-900 text-white"');
      updated = updated.replace(/bg-white/g, "bg-slate-800 text-slate-100");
      updated = updated.replace(/bg-slate-50/g, "bg-slate-900 text-slate-100");
      updated = updated.replace(/border-slate-200/g, "border-slate-700");
    }
  }

  if (p.includes("ازرق") || p.includes("blue")) {
    updated = updated.replace(/bg-emerald-\d+|bg-indigo-\d+|bg-violet-\d+|bg-rose-\d+/g, "bg-blue-600");
    updated = updated.replace(/text-emerald-\d+|text-indigo-\d+|text-violet-\d+|text-rose-\d+/g, "text-blue-600");
  } else if (p.includes("اخضر") || p.includes("green")) {
    updated = updated.replace(/bg-blue-\d+|bg-indigo-\d+|bg-violet-\d+|bg-rose-\d+/g, "bg-emerald-600");
    updated = updated.replace(/text-blue-\d+|text-indigo-\d+|text-violet-\d+|text-rose-\d+/g, "text-emerald-600");
  } else if (p.includes("بنفسجي") || p.includes("purple") || p.includes("violet")) {
    updated = updated.replace(/bg-blue-\d+|bg-emerald-\d+|bg-indigo-\d+/g, "bg-purple-600");
  }

  if (selectedElement?.text && selectedElement.text.trim()) {
    const targetText = selectedElement.text.trim();
    if (p.includes("غير النص") || p.includes("change text") || p.includes("سميه") || p.includes("to ")) {
      const matchNewText = prompt.match(/(?:to|الي|إلى|سميه)\s*["'«]?([^"'»\n]+)["'»]?/i);
      if (matchNewText && matchNewText[1]) {
        updated = updated.replace(targetText, matchNewText[1].trim());
      }
    }
  }

  return updated;
}

app.post("/api/ai/generate-app", async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) return res.status(503).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
    const { prompt, language = "ar" } = (req.body as { prompt?: string; language?: string }) ?? {};
    if (!prompt) return res.status(400).json({ success: false, message: "prompt مطلوب" });
    const result = await generateWithGemini(
      ai,
      `Build a complete single-file HTML app for this request (lang: ${language}):\n${prompt}`,
      GENERATE_SYSTEM,
    );
    const code = stripToCode(extractText(result));
    if (!code) {
      console.error("generate-app: Gemini returned empty text");
      return res.status(502).json({ success: false, message: "الذكاء الاصطناعي أعاد رداً فارغاً، حاول بصياغة مختلفة" });
    }
    res.json({ success: true, code, appName: prompt.slice(0, 60) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-app failed:", msg);
    if (/API_KEY|API key|key/i.test(msg) && /invalid|incorrect|missing|not valid/i.test(msg)) {
      return res.status(503).json({ success: false, message: "مفتاح GEMINI_API_KEY غير صالح، تحقق من القيمة في Vercel" });
    }
    const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    res.status(502).json({
      success: false,
      message: `فشل توليد التطبيق، حاول مرة أخرى — السبب: ${short}`,
      // Full per-model diagnostics for the client/owner (not shown in UI).
      debug: msg,
    });
  }
});

app.post("/api/ai/refine-app", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    prompt?: string;
    currentCode?: string;
    selectedElement?: SelectedElementContext;
    language?: string;
  };
  const { prompt, currentCode, selectedElement, language = "ar" } = body;
  if (typeof prompt !== "string" || !prompt.trim() || typeof currentCode !== "string" || !currentCode.trim())
    return res.status(400).json({ success: false, message: "prompt و currentCode مطلوبان" });

  const plan =
    language === "ar"
      ? ["فحص الكود الحالي وتحديد موضع التعديل", "تطبيق التعديلات والأنماط المطلوبة", "تحديث المعاينة المباشرة"]
      : ["Inspecting current code and target location", "Applying requested changes and styles", "Refreshing live preview"];
  const explanation =
    language === "ar" ? `تم تطبيق التعديل: "${prompt}"` : `Applied modification: "${prompt}"`;

  // Owner standard #3: this endpoint must never answer 500 — whenever the AI
  // is unavailable, times out, or returns nothing usable, respond with the
  // deterministic local refinement instead.
  const fallback = (source: "engine" | "fallback") =>
    res.json({
      success: true,
      source,
      code: applyLocalRefinement(currentCode as string, prompt as string, selectedElement),
      explanation,
      plan,
    });

  try {
    const ai = getGeminiClient();
    if (!ai) return fallback("engine");
    const result = await generateWithGemini(
      ai,
      `Refine this HTML app (lang: ${language}). Instruction: ${prompt}\n\nCurrent code:\n${currentCode}`,
      REFINE_SYSTEM,
    );
    const refined = normalizeRefinedHtml(extractText(result));
    if (!refined) {
      console.error("refine-app: model returned no usable HTML, using local refinement");
      return fallback("fallback");
    }
    return res.json({ success: true, source: "gemini", code: refined, explanation, plan });
  } catch (e) {
    console.error("refine-app failed:", e instanceof Error ? e.message : String(e));
    return fallback("fallback");
  }
});

for (const p of ["/api/ai/gemini-enhance-prompt", "/api/ai/gemini-architect", "/api/ai/gemini-code-doctor"]) {
  app.post(p, async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) return res.status(503).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
      const { prompt = "", language = "ar" } = (req.body as { prompt?: string; language?: string }) ?? {};
      const result = await generateWithGemini(ai, `(lang: ${language}) ${prompt}`, STUDIO_SYSTEM);
      const text = extractText(result);
      if (!text) {
        console.error(`${p}: Gemini returned empty text`);
        return res.status(502).json({ success: false, message: "الذكاء الاصطناعي أعاد رداً فارغاً، حاول بصياغة مختلفة" });
      }
      res.json({ success: true, result: text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${p} failed:`, msg);
      if (/API_KEY|API key|key/i.test(msg) && /invalid|incorrect|missing|not valid/i.test(msg)) {
        return res.status(503).json({ success: false, message: "مفتاح GEMINI_API_KEY غير صالح، تحقق من القيمة في Vercel" });
      }
      res.status(502).json({ success: false, message: "فشل طلب الذكاء الاصطناعي" });
    }
  });
}

// ── Unknown /api paths → JSON 404 (never HTML, never crash) ─────────────────
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

// ── Global error handler (last resort: always JSON) ─────────────────────────
app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled API error:", err);
    if (res.headersSent) return;
    const e = err as { type?: string };
    // Body-parser failures are client errors, not server errors.
    if (e?.type === "entity.too.large")
      return res.status(413).json({ success: false, message: "Request payload too large" });
    if (e?.type === "entity.parse.failed")
      return res.status(400).json({ success: false, message: "Invalid JSON body" });
    res.status(500).json({ success: false, message: "Internal server error" });
  },
);

export default app;


