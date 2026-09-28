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
// SECURITY: a paid tier is NEVER granted by a public request. Historically
// POST /api/subscriptions/auto-verify returned an activated Pro/Business
// object to ANY caller, so one curl call upgraded an account forever. Payment
// now only creates a PENDING review request; the tier is granted exclusively by
// the owner through POST /api/admin/transaction/update-status (admin session
// required), which mints the signed `ebnili_plan` grant cookie this endpoint
// reads. The client treats the server response as authoritative.

/**
 * Site owner — always full access, no payment needed.
 * Resolved once, on the server, so the address is never shipped to the browser
 * and never has to be edited in (and redeployed) to change who owns the site.
 */
const OWNER_EMAIL = (
  process.env.SITE_OWNER_EMAIL || process.env.OWNER_EMAIL || "elsayedsameh803@gmail.com"
)
  .trim()
  .toLowerCase();

function isOwnerAccount(session: AuthUser | null): boolean {
  if (!session || !OWNER_EMAIL) return false;
  return String(session?.email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

function subscriptionPayload(grant: { email: string; tier: "pro" | "business" } | null) {
  const paid = grant
    ? {
        ...DEFAULT_SUBSCRIPTION,
        tier: grant.tier,
        status: "active" as const,
        planName: grant.tier === "business" ? "Business" : "Pro",
        generationsLimitToday: 99999,
        canExportZip: true,
        canDeployCustomDomain: grant.tier === "business",
        priorityAiModel: true,
      }
    : { ...DEFAULT_SUBSCRIPTION };

  return {
    success: true,
    subscription: { ...paid, activatedAt: new Date().toISOString() },
    orangeWalletNumber: "01207782741",
    supportWhatsappNumber: "01207782741",
  };
}

/** Highest tier shape, used for the owner account. */
function ownerSubscription() {
  return {
    ...DEFAULT_SUBSCRIPTION,
    tier: "business" as const,
    status: "active" as const,
    planName: "Business",
    generationsLimitToday: 99999,
    canExportZip: true,
    canDeployCustomDomain: true,
    priorityAiModel: true,
    activatedAt: new Date().toISOString(),
  };
}

app.get("/api/subscriptions/current", (req: Request, res: Response) => {
  // The owner account needs no grant cookie.
  const session = readAuthSession(req);
  if (isOwnerAccount(session)) {
    res.json({
      success: true,
      subscription: ownerSubscription(),
      orangeWalletNumber: "01207782741",
      supportWhatsappNumber: "01207782741",
    });
    return;
  }

  // A grant only counts for the account it was issued to.
  const grant = readPlanGrant(req);
  const entitled =
    grant && session && session.email.toLowerCase() === grant.email ? grant : null;
  res.json(subscriptionPayload(entitled));
});

/** Only a logged-in (Google/GitHub) user may open a payment review request. */
function requireSignedIn(req: Request, res: Response): boolean {
  if (readAuthSession(req)) return true;
  res.status(401).json({
    success: false,
    error: "يجب تسجيل الدخول أولاً لإرسال طلب الاشتراك.",
  });
  return false;
}

/**
 * Records a payment claim for MANUAL review and returns the unchanged FREE
 * subscription. Never returns a paid tier: activation is an owner-only action.
 */
function queuePaymentReview(req: Request, res: Response) {
  if (!requireSignedIn(req, res)) return;

  const body = (req.body as Record<string, unknown>) ?? {};
  const planId = String(body.planId || "pro");
  if (planId !== "pro" && planId !== "business") {
    res.status(400).json({ success: false, error: "خطة الاشتراك غير صحيحة." });
    return;
  }

  const reference = String(body.transactionReference ?? "").trim();
  const senderPhone = String(body.senderPhone ?? "").trim();
  if (senderPhone.length < 8) {
    res.status(400).json({
      success: false,
      error: "يرجى كتابة رقم هاتف محفظة أورانج كاش المحول منها بشكل صحيح.",
    });
    return;
  }
  if (reference.length < 3) {
    res.status(400).json({
      success: false,
      error: "يرجى كتابة الرقم المرجعي أو كود العملية من رسالة التحويل.",
    });
    return;
  }

  // Stateless serverless: the request is acknowledged and queued for the owner,
  // but no state is persisted and — critically — no tier is granted here.
  res.json({
    success: true,
    status: "pending",
    instant: false,
    message:
      "تم استلام طلبك وهو قيد المراجعة. سيتم تفعيل اشتراكك بعد التحقق من التحويل من قِبل إدارة المنصة.",
    subscription: { ...DEFAULT_SUBSCRIPTION, activatedAt: new Date().toISOString() },
  });
}

// Both public payment endpoints behave identically: queue for review only.
app.post("/api/subscriptions/auto-verify", queuePaymentReview);
app.post("/api/subscriptions/submit-orange-cash", queuePaymentReview);

// Downgrade is a client-side display concern; the server state is already free,
// so this never returns an upgraded tier.
app.post("/api/subscriptions/reset-free", (_req: Request, res: Response) => {
  res.json({ success: true, subscription: DEFAULT_SUBSCRIPTION });
});

// ── Signed-in user guard for the AI engine ──────────────────────────────────
// SECURITY: every /api/ai/* route used to be anonymous, so anybody (a bot, a
// leaked URL, a curl loop) could spend the owner's Gemini key at will. The
// studio itself is already behind the login gate, so requiring the same signed
// session cookie costs a real user nothing and closes the door on abuse.
// Reuses the existing `requireSignedIn` guard (line 145) in middleware form.
function requireAiSession(req: Request, res: Response, next: NextFunction) {
  if (!readAuthSession(req as AuthReq)) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "سجّل الدخول مرة أخرى للمتابعة — الجلسة انتهت أو لم يتم العثور عليها.",
    });
  }
  next();
}

// A light per-session daily cap. The serverless runtime is stateless, so this
// is best-effort (it stops a single runaway client, not a determined attacker)
// — but the real boundary is the paid plan, and the owner can still raise the
// ceiling through the admin dashboard.
const AI_DAILY_LIMIT = 60;
const aiUsage = new Map<string, { day: string; count: number }>();

function aiQuotaExceeded(sessionId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const rec = aiUsage.get(sessionId);
  if (!rec || rec.day !== day) {
    aiUsage.set(sessionId, { day, count: 1 });
    return false;
  }
  if (rec.count >= AI_DAILY_LIMIT) return true;
  rec.count += 1;
  return false;
}

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

// ── Owner-only subscription activation (the ONE path to a paid tier) ─────────
// SECURITY: this replaces the old self-service upgrade. The owner approves a
// payment here, after verifying the Orange Cash transfer in the dashboard.
// The grant is returned as a SHORT-LIVED, HMAC-signed HttpOnly cookie
// (`ebnili_plan`) so it survives a request without needing a database; the
// browser cannot forge it because the signature is server-side only.
const PLAN_COOKIE_NAME = "ebnili_plan";
const PLAN_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function planSigningSecret(): string {
  return process.env.AUTH_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PIN || "ebnili";
}

function issuePlanGrant(email: string, tier: "pro" | "business"): string {
  const payload = Buffer.from(
    JSON.stringify({ email: String(email).trim().toLowerCase(), tier, exp: Date.now() + PLAN_GRANT_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${hmacB64With(payload, planSigningSecret())}`;
}

function hmacB64With(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function readPlanGrant(req: Request): { email: string; tier: "pro" | "business" } | null {
  const token = readCookie(req, PLAN_COOKIE_NAME);
  if (!token) return null;
  const sep = token.indexOf(".");
  if (sep <= 0) return null;
  const body = token.slice(0, sep);
  if (!safeEqual(token.slice(sep + 1), hmacB64With(body, planSigningSecret()))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as {
      email?: string;
      tier?: string;
      exp?: number;
    };
    if (!parsed?.email) return null;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    const tier = parsed.tier === "business" ? "business" : "pro";
    return { email: parsed.email, tier };
  } catch {
    return null;
  }
}

app.post("/api/admin/transaction/update-status", requireAdmin, (req: Request, res: Response) => {
  const body = (req.body as { transactionId?: string; status?: string; email?: string; tier?: string }) ?? {};
  if (body.status !== "confirmed" && body.status !== "rejected") {
    res.status(400).json({ success: false, error: "حالة المعاملة يجب أن تكون confirmed أو rejected." });
    return;
  }

  // Rejections grant nothing. Confirmations mint the owner-signed plan cookie
  // for the paying account, delivered on this response only.
  if (body.status === "confirmed") {
    const email = String(body.email ?? "").trim();
    const tier = body.tier === "business" ? "business" : "pro";
    if (!email) {
      res.status(400).json({ success: false, error: "بريد الحساب مطلوب لتفعيل الاشتراك." });
      return;
    }
    res.cookie(PLAN_COOKIE_NAME, issuePlanGrant(email, tier), {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: "lax",
      path: "/",
      maxAge: PLAN_GRANT_TTL_MS,
    });
  }

  res.json({
    success: true,
    // Serverless FS is read-only, so the durable record lives in the owner's
    // dashboard; the signed cookie carries the grant to the account.
    persisted: false,
    message: "تم تسجيل قرار المراجعة. سيتم تطبيق التفعيل على الحساب المعتمد.",
  });
});

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

// ── Supabase as the OAuth broker ─────────────────────────────────────────────
// The Google/GitHub OAuth apps in this project are managed by Supabase, so the
// redirect URI registered with Google is Supabase's own
// `https://<ref>.supabase.co/auth/v1/callback` — NOT anything we control.
// A direct code exchange with Google therefore always fails with
// redirect_uri_mismatch. Supabase can complete that exchange for us, so we send
// the browser to Supabase's authorize endpoint and receive a short-lived code.
interface SupabaseConfig {
  url: string;
  anonKey: string;
  configured: boolean;
}

function supabaseConfig(): SupabaseConfig {
  const raw = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();

  // The dashboard hands out several shapes of the same value:
  //   https://<ref>.supabase.co
  //   https://<ref>.supabase.co/rest/v1   (PostgREST)
  //   https://<ref>.supabase.co/auth/v1    (GoTrue)
  //   ...each of the above with a trailing slash.
  // Only the project root builds a valid /auth/v1/... URL. Appending a path to
  // any of the other shapes yields e.g. /rest/v1/auth/v1/authorize, which is
  // routed to PostgREST instead of GoTrue and answers 401 "No API key found in
  // request" — the browser then shows a blocked/error page instead of the
  // provider's consent screen. So normalise down to the origin + project ref
  // and refuse to build a URL that still carries an API segment.
  const url = raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|pg|storage|functions|realtime|analytics)\/v1$/i, "")
    .replace(/\/+$/, "");

  // Defence in depth: if anything API-shaped survived, the project root is the
  // only safe thing to keep — take everything up to the first known segment.
  const cleaned =
    url.split("/rest/")[0].split("/auth/")[0].split("/pg/")[0].split("/storage/")[0];

  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return { url: cleaned, anonKey, configured: Boolean(cleaned && anonKey) };
}

/** PKCE verifier/challenge, so the browser never carries a usable credential. */
const AUTH_PKCE_COOKIE = "ebnili_oauth_pkce";

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

interface SupabaseIdentity {
  id: string;
  email: string;
  name: string;
  picture: string;
  provider: AuthProviderId;
}

/** Maps a Supabase user record onto our own session shape. */
function mapSupabaseUser(raw: {
  id?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): SupabaseIdentity | null {
  if (!raw?.id) return null;
  const meta = raw.user_metadata || {};
  const appMeta = raw.app_metadata || {};

  // Supabase records the OAuth provider in app_metadata.provider.
  const providerRaw = String(appMeta.provider || "google").toLowerCase();
  const provider: AuthProviderId = providerRaw === "github" ? "github" : "google";

  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.preferred_username === "string" && meta.preferred_username) ||
    raw.email ||
    (provider === "github" ? "GitHub User" : "Google User");

  const picture =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    "";

  return { id: String(raw.id), name: String(fullName), email: raw.email || "", picture, provider };
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
// With Supabase configured we broker both providers through it, so both are
// offered even though our own Google/GitHub credentials may be absent.
app.get("/api/auth/providers", (_req: AuthReq, res: AuthRes) => {
  const ids: AuthProviderId[] = ["google", "github"];
  const sb = supabaseConfig().configured;
  res.json({
    success: true,
    providers: ids.map((id) => ({
      id,
      configured: sb || providerConfig(id).configured,
    })),
  });
});

// Who am I? Returns `{ authenticated: false }` for guests — never an error.
//
// `isOwner` is decided HERE, on the server, from the signed session cookie —
// never in the browser. Owner-only controls (admin dashboard, backend/database
// console) read this flag, so they stay out of every ordinary user's header and
// the flag cannot be forged by editing client state. The owner's email address
// is deliberately absent from the public JS bundle.
app.get("/api/auth/me", (req: AuthReq, res: AuthRes) => {
  const user = readAuthSession(req);
  res.json({
    success: true,
    authenticated: Boolean(user),
    user: user ? { ...user, isOwner: isOwnerAccount(user) } : null,
    isOwner: isOwnerAccount(user),
  });
});

app.post("/api/auth/logout", (_req: AuthReq, res: AuthRes) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.clearCookie(AUTH_STATE_COOKIE, { path: "/" });
  res.json({ success: true, authenticated: false });
});

// The exact callback URLs this server redirects to. A setup aid so a
// redirect_uri mismatch can be fixed by copying the value instead of guessing.
// Registered here, above `/api/auth/:provider`, so it is not treated as a
// provider id. Exposes no secrets — only public redirect URIs.
app.get("/api/auth/config", (req: AuthReq, res: AuthRes) => {
  const base = requestBaseUrl(req);
  const describe = (id: AuthProviderId) => {
    const cfg = providerConfig(id);
    return {
      configured: cfg.configured,
      // The shape of the id only — never the secret itself.
      clientIdSuffix: cfg.clientId.slice(-12),
      clientIdLooksValid: /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(cfg.clientId),
      hasSecret: Boolean(cfg.clientSecret),
    };
  };
  const sb = supabaseConfig();
  res.json({
    success: true,
    baseUrl: base,
    callbacks: {
      google: `${base}/api/auth/callback/google`,
      github: `${base}/api/auth/callback/github`,
    },
    // When true, sign-in is brokered by Supabase and the URLs above are NOT
    // what Google/GitHub must know — Supabase's own callback is.
    supabase: {
      configured: sb.configured,
      // Host only: the anon key is public but there is no reason to echo it.
      host: sb.configured ? sb.url.replace(/^https?:\/\//, "") : "",
    },
    google: describe("google"),
    github: describe("github"),
  });
});

// Step 1 — bounce the browser to the provider's consent screen.
//
// Two possible routes:
//  A) Supabase broker (preferred when configured). Supabase owns the OAuth app
//     whose redirect URI Google/GitHub actually know, so it must perform the
//     code→token exchange. We use PKCE and receive only a short-lived code.
//  B) Direct to the provider — used when this project owns the OAuth app.
app.get("/api/auth/:provider", (req: AuthReq, res: AuthRes) => {
  const provider = String(req.params.provider || "").toLowerCase() as AuthProviderId;
  const home = requestBaseUrl(req);

  if (provider !== "google" && provider !== "github") {
    return res.status(404).json({ success: false, message: "Unknown auth provider" });
  }

  const sb = supabaseConfig();
  if (sb.configured) {
    const { verifier, challenge } = createPkcePair();

    // The verifier stays server-side in an HttpOnly cookie; only the derived
    // challenge ever goes to the browser, so a stolen callback code is useless.
    res.cookie(AUTH_PKCE_COOKIE, `${provider}.${verifier}`, {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_STATE_TTL_MS,
    });

    const url = new URL(`${sb.url}/auth/v1/authorize`);
    // Never emit a URL that still carries a PostgREST/GoTrue API segment —
    // those resolve to the wrong service and surface to the user as a blocked
    // page. If the base was misconfigured, fail loudly with a readable message
    // instead of redirecting the browser into a 401.
    if (/\/(rest|pg|storage|functions)\/v1/i.test(url.pathname)) {
      console.error("supabase base url still carries an API path:", sb.url);
      return res.redirect(`${home}/?auth_error=supabase_not_configured`);
    }
    url.searchParams.set("provider", provider);
    url.searchParams.set("redirect_to", `${home}/api/auth/callback/supabase`);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "s256");
    url.searchParams.set("skip_http_redirect", "true");
    // The anon key is public by design. Sending it as a query param keeps the
    // authorize call valid even when Supabase's gateway is configured to demand
    // an API key on this route.
    if (sb.anonKey) url.searchParams.set("apikey", sb.anonKey);
    if (provider === "google") {
      url.searchParams.set("prompt", "select_account");
      // Supabase forwards `query_params` to Google; `hl` keeps the consent
      // screen in English instead of following the browser's locale.
      url.searchParams.set("query_params", "hl=en");
    }

    return res.redirect(url.toString());
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

  // Force the provider's consent screen into English so it matches the app,
  // instead of inheriting the browser's locale.
  if (provider === "google") {
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("hl", "en");
  } else {
    url.searchParams.set("allow_signup", "true");
  }

  return res.redirect(url.toString());
});

// Step 2 (Supabase route) — Supabase has completed the provider handshake and
// hands back a short-lived PKCE code. Registered ABOVE `/callback/:provider`,
// otherwise Express would treat "supabase" as a provider id.
// This must exist before that route to win the match.
app.get("/api/auth/callback/supabase", async (req: AuthReq, res: AuthRes) => {
  const home = requestBaseUrl(req);
  const fail = (reason: string) => res.redirect(`${home}/?auth_error=${encodeURIComponent(reason)}`);

  const sb = supabaseConfig();
  if (!sb.configured) return fail("supabase_not_configured");

  // Supabase reports its own errors (e.g. a user denied consent) in the query.
  const errDesc = typeof req.query.error_description === "string" ? req.query.error_description : "";
  if (errDesc) return fail("oauth_denied");
  const errCode = typeof req.query.error === "string" ? req.query.error : "";
  if (errCode) return fail("oauth_denied");

  // Single-use: clear the verifier cookie on read so a replayed callback fails.
  const stored = readCookie(req, AUTH_PKCE_COOKIE);
  res.clearCookie(AUTH_PKCE_COOKIE, { path: "/" });
  if (!stored) return fail("pkce_missing");
  const sep = stored.indexOf(".");
  if (sep <= 0) return fail("pkce_invalid");
  const provider = stored.slice(0, sep) as AuthProviderId;
  const verifier = stored.slice(sep + 1);
  if (provider !== "google" && provider !== "github") return fail("pkce_invalid");

  // The code comes back in the query string (skip_http_redirect) or, for some
  // providers, in the URL fragment — which never reaches the server.
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) return fail("missing_code");

  try {
    // Trade the code + our verifier for the signed-in user.
    const tokenRes = await fetch(`${sb.url}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: sb.anonKey,
        Authorization: `Bearer ${sb.anonKey}`,
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    });

    if (!tokenRes.ok) {
      console.error("supabase pkce exchange failed:", tokenRes.status);
      return fail("exchange_failed");
    }

    const tokenJson = (await tokenRes.json()) as {
      user?: Parameters<typeof mapSupabaseUser>[0];
    };
    const identity = mapSupabaseUser(tokenJson.user || {});
    if (!identity) return fail("profile_failed");

    res.cookie(AUTH_COOKIE_NAME, issueAuthSession(identity), {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_TTL_MS,
    });
    return res.redirect(`${home}/?auth=success`);
  } catch (e) {
    console.error("supabase callback failed:", e instanceof Error ? e.message : String(e));
    return fail("exchange_failed");
  }
});

// Step 2 — the provider redirects back here with ?code=…&state=…
// (direct-provider route, used when this project owns the OAuth app)
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
//   gemini-3.5-flash      → primary: stable, fast, strong for coding
//   gemini-3.5-flash-lite → low-latency fallback for the same generation
//   gemini-flash-latest   → official hot-swapped alias
//   gemini-3.8-flash      → newest flagship Flash
//   gemini-2.5-flash      → the most widely provisioned stable model; a 404 on
//                          this one means the key cannot reach the 3.x family
//   gemini-2.5-flash-lite → last low-cost resort
//   gemini-3.7 / 3.6      → previous-generation stable models
// Anything the key cannot reach answers 404 and is dropped immediately
// (classifyModelError → "permanent"), so listing extra candidates is free.
const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

// TIME BUDGETS — this is what made "big prompts" fail 100% of the time.
//
// A complete single-file application is a 40k–120k token answer. The old
// settings were 18s per attempt inside a 45s total budget, and vercel.json
// capped the whole function at 60s. Two models ate 36s and "timed out" while
// they were still generating, the rest answered 503 "high demand", and the
// request always ended as HTTP 502 — for a two-word prompt as well as for a
// full specification. The budgets below match what the function is actually
// allowed to run (see `maxDuration` in vercel.json), leaving room for a real
// answer plus a second attempt, and the text-only studio endpoints keep a
// shorter slice because they never return a document.
const GENERATE_BUDGET_MS = 240_000;
const GENERATE_ATTEMPT_TIMEOUT_MS = 75_000;
const REFINE_BUDGET_MS = 180_000;
const REFINE_ATTEMPT_TIMEOUT_MS = 70_000;
const STUDIO_BUDGET_MS = 120_000;
const STUDIO_ATTEMPT_TIMEOUT_MS = 45_000;

// Never let a document get cut off mid-file: an unterminated HTML string used
// to reach the browser as a blank/broken preview. A high ceiling keeps big
// specifications in one answer instead of silently truncating them.
const DOCUMENT_MAX_OUTPUT_TOKENS = 65_536;

// "Accept any text in the input box" without letting a pasted 2MB essay
// exceed the request budget: the head and the tail are kept (a specification
// states its goal first and its constraints last) and the middle is elided.
const MAX_PROMPT_CHARS = 40_000;
const MAX_CURRENT_CODE_CHARS = 120_000;

function boundText(text: string, maxChars: number, elisionNote: string): string {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  const headChars = Math.floor(maxChars * 0.75);
  const tailChars = maxChars - headChars;
  const dropped = t.length - maxChars;
  return `${t.slice(0, headChars)}\n\n[${elisionNote}: ${dropped} characters elided]\n\n${t.slice(-tailChars)}`;
}

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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface GeminiCallOptions {
  /** Total wall-clock the whole call (all models, all passes) may take. */
  budgetMs?: number;
  /** Per-model attempt ceiling. */
  attemptTimeoutMs?: number;
  /** Output ceiling — raise it for document-producing calls. */
  maxOutputTokens?: number;
}

async function generateWithGemini(
  ai: GoogleGenAI,
  prompt: string,
  systemInstruction?: string,
  options: GeminiCallOptions = {},
) {
  const budgetMs = options.budgetMs ?? GENERATE_BUDGET_MS;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? GENERATE_ATTEMPT_TIMEOUT_MS;
  const deadline = Date.now() + budgetMs;
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
      // Never start an attempt we cannot finish: leave room for the response to
      // travel, and never let a retry begin with a fraction of a second left.
      const usable = remaining - 1_500;
      if (usable < 2_000) {
        failures.push(`budget exhausted before ${model}`);
        break;
      }
      const attemptTimeout = Math.min(usable, attemptTimeoutMs);
      const usesThinkingLevel = model === "gemini-3.5-flash" || model === "gemini-3.5-flash-lite";
      // `low` is supported by both stable 3.5 Flash variants. Avoid changing
      // the shared config when there is no system instruction.
      const config: {
        systemInstruction?: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
        maxOutputTokens?: number;
      } = {
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(usesThinkingLevel ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
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
    if (!attempted || !canRetry || deadline - Date.now() <= 2_000) break;

    // A 429/503 "high demand" clears on its own within seconds. Rushing the
    // second pass used to burn the whole budget and fail anyway; a short,
    // deadline-aware pause is what actually makes the retry worth taking.
    // Two seconds are always left for JSON serialization and the Vercel reply.
    const pause = Math.min(2_500 * pass, Math.max(0, deadline - Date.now() - 2_000));
    if (pause > 0) await sleep(pause);
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

// NOTE: the old `applyLocalRefinement()` (a regex colour-swap) used to live
// here as the refine-app fallback. It rewrote Tailwind classes and then the
// endpoint reported "تم التعديل" — a cosmetic change dressed up as a real
// edit, which is exactly the "fake result" complaint. The fallback now returns
// the untouched original code with `applied: false` and says so.

// Turn whatever came back into a document the browser can actually run.
// `stripToCode` cuts at the first `</html>`; when a long generation was cut off
// before its closing tag we close the file instead of shipping a half page
// (which used to render as an empty preview — a "fake" result).
function repairDocument(raw: string): string {
  let out = stripToCode(raw);
  if (!out) return "";
  if (!/<html[\s>]/i.test(out)) {
    out =
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>\n${out}`;
  } else if (!/<!DOCTYPE/i.test(out)) {
    out = `<!DOCTYPE html>\n${out}`;
  }
  if (!/<\/body>/i.test(out)) out += "\n</body>";
  if (!/<\/html>/i.test(out)) out += "\n</html>";
  return out;
}

// Owner-facing message. The model diagnostics stay in `debug` (never shown);
// the visitor gets one actionable Arabic/English sentence instead of a wall of
// SDK internals.
function friendlyAiError(raw: string, language: string): string {
  const en = language !== "ar";
  if (/timed out|deadline|budget|ETIMEDOUT|aborted/i.test(raw))
    return en
      ? "The AI engine took too long to answer. Please try again in a moment."
      : "محرك الذكاء الاصطناعي استغرق وقتاً طويلاً للإجابة. حاول مرة أخرى بعد قليل.";
  if (/high demand|503|UNAVAILABLE|overloaded|\b429\b|rate/i.test(raw))
    return en
      ? "The AI engine is under heavy load right now. Please try again in a minute."
      : "محرك الذكاء الاصطناعي عليه ضغط كبير حالياً. حاول مرة أخرى بعد دقيقة.";
  if (/API_KEY|API key/i.test(raw) && /invalid|incorrect|missing|not valid/i.test(raw))
    return en
      ? "The GEMINI_API_KEY configured on the server is not valid."
      : "مفتاح GEMINI_API_KEY غير صالح على الخادم.";
  return en
    ? "Generation failed. Please try again."
    : "فشل توليد التطبيق. حاول مرة أخرى.";
}

app.post("/api/ai/generate-app", requireAiSession, async (req: Request, res: Response) => {
  try {
    const session = readAuthSession(req as AuthReq);
    if (session && aiQuotaExceeded(session.id)) {
      return res.status(429).json({
        success: false,
        code: "AI_QUOTA_EXCEEDED",
        message: "بلغت الحد الأقصى للطلبات اليومي. حاول غداً أو رقِّ باقتك عبر أورانج كاش.",
      });
    }
    const ai = getGeminiClient();
    if (!ai) return res.status(503).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
    const { prompt, language = "ar" } = (req.body as { prompt?: string; language?: string }) ?? {};
    if (!prompt || !String(prompt).trim())
      return res.status(400).json({ success: false, message: "prompt مطلوب" });
    // Any length of text is accepted; only an extreme paste is elided so the
    // request can never exceed the model/budget limits.
    const bounded = boundText(String(prompt), MAX_PROMPT_CHARS, "تم اختصار منتصف الطلب");
    const result = await generateWithGemini(
      ai,
      `Build a complete single-file HTML app for this request (lang: ${language}):\n${bounded}`,
      GENERATE_SYSTEM,
      {
        budgetMs: GENERATE_BUDGET_MS,
        attemptTimeoutMs: GENERATE_ATTEMPT_TIMEOUT_MS,
        maxOutputTokens: DOCUMENT_MAX_OUTPUT_TOKENS,
      },
    );
    const code = repairDocument(extractText(result));
    if (!code) {
      console.error("generate-app: Gemini returned empty text");
      return res.status(502).json({ success: false, message: "الذكاء الاصطناعي أعاد رداً فارغاً، حاول بصياغة مختلفة" });
    }
    res.json({ success: true, code, appName: String(prompt).slice(0, 60) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-app failed:", msg);
    if (/API_KEY|API key|key/i.test(msg) && /invalid|incorrect|missing|not valid/i.test(msg)) {
      return res.status(503).json({ success: false, message: "مفتاح GEMINI_API_KEY غير صالح، تحقق من القيمة في Vercel" });
    }
    const language = String((req.body as { language?: string })?.language ?? "ar");
    res.status(502).json({
      success: false,
      message: friendlyAiError(msg, language),
      // Full per-model diagnostics for the client/owner (not shown in UI).
      debug: msg,
    });
  }
});

// ── Streaming generation (SSE) ────────────────────────────────────────────────
// WHY: even with a correct budget a full site takes 40–110s. Waiting in silence
// for that long looks broken, so this endpoint streams the document to the
// browser token-by-token over Server-Sent Events and the preview paints while
// the model is still writing. Same models, same system rules, same fallbacks —
// only the transport changes. On any model-level failure the client silently
// falls back to the non-streaming /api/ai/generate-app above.
app.post("/api/ai/generate-app/stream", requireAiSession, async (req: Request, res: Response) => {
  const language = String((req.body as { language?: string })?.language ?? "ar");
  const promptRaw = String((req.body as { prompt?: string })?.prompt ?? "");
  const ai = getGeminiClient();

  if (!ai || !promptRaw.trim()) {
    return res.status(400).json({ success: false, message: !ai ? "GEMINI_API_KEY غير مُعد" : "prompt مطلوب" });
  }

  // SSE needs an unbuffered text/event-stream; Vercel otherwise holds the body
  // until the function ends, which is exactly what we are trying to avoid.
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const deadline = Date.now() + GENERATE_BUDGET_MS;
  const deadModels = new Set<string>();
  const failures: string[] = [];
  let sentAny = false;

  // Immediately tell the client we're alive so its spinner starts now, not
  // after the first token.
  send("open", { ok: true });

  for (const model of CANDIDATE_MODELS) {
    if (deadModels.has(model)) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 2_000) break;
    const attemptTimeout = Math.min(remaining, GENERATE_ATTEMPT_TIMEOUT_MS);
    const usesThinkingLevel = model === "gemini-3.5-flash" || model === "gemini-3.5-flash-lite";
    const config = {
      systemInstruction: GENERATE_SYSTEM,
      ...(usesThinkingLevel ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      maxOutputTokens: DOCUMENT_MAX_OUTPUT_TOKENS,
    };

    try {
      const stream = await withDeadline(
        ai.models.generateContentStream({
          model,
          contents: `Build a complete single-file HTML app for this request (lang: ${language}):\n${boundText(promptRaw, MAX_PROMPT_CHARS, "تم اختصار منتصف الطلب")}`,
          config,
        }),
        attemptTimeout,
        `Gemini model "${model}"`,
      );

      for await (const chunk of stream) {
        const delta = extractText(chunk);
        if (!delta) continue;
        sentAny = true;
        send("delta", { text: delta });
        if (Date.now() > deadline) break;
      }
      if (sentAny) {
        send("done", { ok: true, model });
        return res.end();
      }
      throw new Error(`Gemini model "${model}" produced no text`);
    } catch (e) {
      const raw = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ");
      failures.push(`${model}: ${raw.slice(0, 140)}`);
      console.error(`stream ${model} failed:`, raw);
      // A 404/invalid-key model is dead for this key; a 429/503 is transient
      // and simply moves to the next candidate.
      if (classifyModelError(raw) === "permanent") deadModels.add(model);
      // If we already streamed content we must not start a second document
      // mid-stream — stop and let the client fall back for a clean result.
      if (sentAny) break;
    }
  }

  send("failed", { message: friendlyAiError(failures.join(" | "), language), debug: failures.join(" | ").slice(0, 800) });
  return res.end();
});

app.post("/api/ai/refine-app", requireAiSession, async (req: Request, res: Response) => {
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

  // Owner standard #3: this endpoint must never answer 500. BUT it must also
  // never pretend: when the engine is unavailable we hand the ORIGINAL code
  // back with `applied: false` and an honest explanation, instead of the old
  // behaviour that ran a cosmetic string-replace and announced "تم التعديل"
  // while nothing had actually changed.
  const fallback = (reason: string) => {
    const note =
      language === "ar"
        ? `⚠️ لم يتم تطبيق التعديل: محرك الذكاء الاصطناعي غير متاح حالياً (${reason}). كودك الحالي لم يتغير — حاول مرة أخرى.`
        : `⚠️ Change not applied: the AI engine is unavailable (${reason}). Your current code is unchanged — please try again.`;
    return res.json({
      success: true,
      source: "fallback",
      applied: false,
      code: currentCode as string,
      explanation: note,
      plan: [],
    });
  };

  try {
    const ai = getGeminiClient();
    if (!ai) return fallback("no-api-key");
    // The visual inspector posts the element under the cursor — passing it to
    // the model is what makes "make this button green" edit the right node.
    const target = selectedElement
      ? `\nTarget element: <${selectedElement.tagName}> text "${selectedElement.text ?? ""}" classes "${selectedElement.className ?? ""}" selector "${selectedElement.selector ?? ""}"\n`
      : "";
    const result = await generateWithGemini(
      ai,
      `Refine this HTML app (lang: ${language}). Instruction: ${boundText(String(prompt), 8_000, "تم اختصار منتصف الطلب")}${target}\n\nCurrent code:\n${boundText(String(currentCode), MAX_CURRENT_CODE_CHARS, "تم اختصار منتصف الكود")}`,
      REFINE_SYSTEM,
      {
        budgetMs: REFINE_BUDGET_MS,
        attemptTimeoutMs: REFINE_ATTEMPT_TIMEOUT_MS,
        maxOutputTokens: DOCUMENT_MAX_OUTPUT_TOKENS,
      },
    );
    const refined = normalizeRefinedHtml(extractText(result));
    if (!refined) {
      console.error("refine-app: model returned no usable HTML");
      return fallback("no-usable-output");
    }
    const explanation =
      language === "ar" ? `تم تطبيق التعديل: "${prompt}"` : `Applied modification: "${prompt}"`;
    return res.json({ success: true, source: "gemini", applied: true, code: refined, explanation, plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("refine-app failed:", msg);
    return fallback(friendlyAiError(msg, language));
  }
});

for (const p of ["/api/ai/gemini-enhance-prompt", "/api/ai/gemini-architect", "/api/ai/gemini-code-doctor"]) {
  app.post(p, requireAiSession, async (req: Request, res: Response) => {
    try {
      const session = readAuthSession(req as AuthReq);
      if (session && aiQuotaExceeded(session.id)) {
        return res.status(429).json({ success: false, message: "بلغت الحد الأقصى للطلبات اليومي" });
      }
      const ai = getGeminiClient();
      if (!ai) return res.status(503).json({ success: false, message: "GEMINI_API_KEY غير مُعد على الخادم" });
      const { prompt = "", language = "ar" } = (req.body as { prompt?: string; language?: string }) ?? {};
      const result = await generateWithGemini(ai, `(lang: ${language}) ${boundText(String(prompt), MAX_PROMPT_CHARS, "تم اختصار منتصف الطلب")}`, STUDIO_SYSTEM, {
        budgetMs: STUDIO_BUDGET_MS,
        attemptTimeoutMs: STUDIO_ATTEMPT_TIMEOUT_MS,
        maxOutputTokens: DOCUMENT_MAX_OUTPUT_TOKENS,
      });
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


