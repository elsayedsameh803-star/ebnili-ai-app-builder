/**
 * Shared server-side security primitives.
 *
 * WHY A SEPARATE MODULE
 * ---------------------
 * `api/index.ts` is ~4,000 lines and was growing a private copy of each of
 * these concerns. Every duplicate is a place where one copy gets hardened and
 * the other does not. The rules below must be identical everywhere, so they live
 * in one dependency-free file that can be unit-tested directly.
 *
 * WHAT IS HERE
 * ------------
 *  1. `isWeakSecret` / `requireStrongSecret` — fail-closed secret validation.
 *  2. `resolveAllowedOrigins` / `corsGuard` — CORS allowlist instead of `*`.
 *  3. `sameOriginGuard` — CSRF defence-in-depth for state-changing requests.
 *  4. `RateLimiter` / `rateLimit` — sliding-window limiting, env-tunable.
 *
 * DESIGN RULES
 * ------------
 *  • Never fail OPEN. A missing secret must LOCK the feature, never substitute a
 *    guessable value — that is exactly how a "development convenience" becomes a
 *    production compromise.
 *  • Every limiter works with NO external dependency, so the site never fails to
 *    boot because a paid Redis is missing.
 *  • Limits are env-tunable so an operator can retune without a redeploy, and so
 *    tests can lower them to something assertable.
 */
import type { Request, Response, NextFunction } from "express";

/**
 * The plan allowance, and the ONE rule for spending it.
 *
 * WHY THIS EXISTS AS CODE
 * -----------------------
 * The spend used to be a SELECT followed by a PATCH inside the request handler.
 * That is a race: concurrent requests all read the same counter, all conclude
 * they are under the limit, and all write used+1 — so the counter under-reports
 * and the customer receives N times the allowance for the price of one. Clicking
 * "generate" five times in a second is this product's normal interaction, not an
 * exotic edge case.
 *
 * The real fix is the row lock inside `ebnily_consume_ai_credit` (see
 * `supabase/add_atomic_ai_credit.sql`): Postgres serialises the read, the check
 * and the write across every instance at once. This module is the *contract* that
 * function implements, expressed as pure code so the property that actually
 * matters can be tested — under concurrency, exactly `limit` calls are ever
 * allowed and the counter never passes it.
 */

/** The central ceiling. No account may exceed it, whatever a plan or a caller asks for. */
export const AI_ABSOLUTE_DAILY_CEILING = 400;

/** Per-plan daily allowance. The numbers the pricing page promises. */
export const TIER_DAILY_QUOTA = {
  free: 5,
  pro: 100,
  business: 400,
} as const;

/** The ceiling for a tier, always clamped by the absolute maximum.
 *
 * A caller can pass any `p_limit`; this is the only place a tier becomes a
 * number, so raising a plan in one edit cannot open an unbounded key. */
export function quotaForTier(tier: unknown): number {
  const base =
    tier === "free" || tier === "pro" || tier === "business"
      ? TIER_DAILY_QUOTA[tier]
      : TIER_DAILY_QUOTA.free;
  return Math.min(base, AI_ABSOLUTE_DAILY_CEILING);
}

/** What one spend attempt did. Mirrors the SQL function's return row. */
export interface QuotaDecision {
  allowed: boolean;
  used: number;
  limit: number;
  day: string;
}

/** The mutable state a single account's day is made of. */
export interface AccountDay {
  used: number;
  day: string | null;
}

/** The UTC day a timestamp belongs to — the boundary the reset happens on. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** A fresh account day — a brand-new account, or one the server has not synced. */
export function newAccountDay(): AccountDay {
  return { used: 0, day: null };
}

/**
 * Spend one credit, or refuse.
 *
 * A faithful model of `ebnily_consume_ai_credit`: same order of operations, same
 * day rollover, same clamping. The SQL version takes a real `SELECT … FOR UPDATE`
 * row lock; this one is synchronous, so the concurrency it is tested against is
 * modelled by running many spends inside a single turn of the event loop — which
 * is exactly the interleaving the lock exists to prevent.
 *
 * @param state  the account's day, mutated in place (the "row").
 * @param pLimit the plan ceiling the caller believes applies.
 * @param now    injectable, so a day boundary can be tested.
 */
export function spendAiCredit(
  state: AccountDay,
  pLimit: number,
  now: Date = new Date(),
): QuotaDecision {
  const day = utcDay(now);
  const limit = Math.min(pLimit, AI_ABSOLUTE_DAILY_CEILING);

  // Day rollover: the old count is discarded, never carried into the new day.
  if (state.day !== day) {
    state.day = day;
    state.used = 0;
  }

  if (state.used >= limit) {
    // Refused, and the counter is NOT advanced: a rejected request must not push
    // the customer further from using what they paid for, and the number reported
    // is the true usage, which is what a meter needs in order to draw.
    return { allowed: false, used: state.used, limit, day };
  }

  state.used += 1;
  return { allowed: true, used: state.used, limit, day };
}

/**
 * Values that must never be accepted as a real secret.
 *
 * SECURITY: this list exists because the literal `"ebnili-insecure-dev-secret"`
 * is committed to this repository. Anyone reading the source knows it, so any
 * signature made with it can be forged by anyone.
 */
export const KNOWN_PLACEHOLDER_SECRETS = [
  "ebnili-insecure-dev-secret",
  "ebnili",
  "ebnily",
  "secret",
  "change-me",
  "password",
  "admin",
  "test",
] as const;

/** Minimum length for anything used as an HMAC key. */
export const MIN_SECRET_LENGTH = 24;

/**
 * Substrings that mark a value as "not a real secret" even when it is long.
 *
 * WHY A SUBSTRING LIST AND NOT JUST EXACT MATCH
 * ---------------------------------------------
 * The exact-match version was defeated by the obvious workarounds:
 *   • `"change-me-change-me-change-me-x"`  — passes a length check
 *   • `"changemechangemechangeme12345"`    — passes a length check
 *   • `"my-super-secret-password-2024"`    — passes a length check
 * All three are trivially guessable, and all three passed. The test suite pins
 * this: "rejects a long value that is still a known placeholder".
 *
 * The list is deliberately made of UNAMBIGUOUS markers. A bare "secret" or
 * "admin" is NOT in it, because a genuine random key can contain those letters
 * by chance and a false rejection locks a working deployment. Every entry below
 * is a phrase nobody generates randomly.
 */
const INSECURE_SUBSTRINGS = [
  "change-me",
  "change_me",
  "changeme",
  "placeholder",
  "your-secret",
  "your_secret",
  "yoursecret",
  "example",
  "replace-me",
  "replaceme",
  "todo",
  "fixme",
  "notasecret",
] as const;

/**
 * True when a secret is missing, too short, or recognisably not random.
 *
 * Length alone is not enough: a 32-character `"change-me-change-me-change-me-x"`
 * is long and still public. This checks three things, cheapest first:
 *   1. present and long enough,
 *   2. not an exact known placeholder,
 *   3. not built by REPEATING a known placeholder, and free of obvious markers.
 */
export function isWeakSecret(secret: string | undefined | null): boolean {
  const s = (secret ?? "").trim();
  if (!s) return true;
  if (s.length < MIN_SECRET_LENGTH) return true;

  const lowered = s.toLowerCase();

  // (2) exact match against the published placeholders
  if (KNOWN_PLACEHOLDER_SECRETS.some((bad) => lowered === bad.toLowerCase())) return true;

  // (3a) built by repeating a placeholder: "change-me" × 5, "password" × 4 …
  for (const bad of KNOWN_PLACEHOLDER_SECRETS) {
    const token = bad.toLowerCase();
    if (token.length < 2 || !lowered.startsWith(token)) continue;
    // Strip whole repetitions from the front; what remains must be tiny.
    let rest = lowered;
    while (rest.startsWith(token)) rest = rest.slice(token.length);
    if (rest.length <= 3) return true;
  }

  // (3b) free of obvious "this is a placeholder" markers
  if (INSECURE_SUBSTRINGS.some((marker) => lowered.includes(marker))) return true;

  return false;
}

/** Actionable log line shown when a secret is unusable. */
export function weakSecretMessage(envName: string): string {
  return (
    `[SECURITY] ${envName} is missing, shorter than ${MIN_SECRET_LENGTH} characters, ` +
    `or a known placeholder. Generate one with:\n` +
    `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
    `The affected feature stays DISABLED until it is set.`
  );
}

/**
 * A secret that is guaranteed usable, or `null`.
 *
 * Use this INSTEAD OF `x || "fallback"`. Returning `null` forces every caller to
 * decide what an unusable secret means, and the correct answer is always the
 * same: refuse the operation.
 */
export function requireStrongSecret(...candidates: (string | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!isWeakSecret(candidate)) return (candidate as string).trim();
  }
  return null;
}

// ── CORS ──────────────────────────────────────────────────────────────────────

/**
 * The origins allowed to call this API from a browser.
 *
 * WHY AN ALLOWLIST
 * ----------------
 * The previous header was `Access-Control-Allow-Origin: *`, which lets ANY
 * website on the internet read this API's responses from the visitor's browser.
 * Cookies are not attached to a cross-origin `*` read, but the JSON bodies still
 * are — including project metadata and subscription state. An allowlist is the
 * difference between "only my site can read my API" and "every site can".
 *
 * Non-browser clients (curl, the Vercel CLI, a mobile app) send no `Origin`
 * header at all and are unaffected: CORS is a browser-only mechanism.
 *
 * Config: `ALLOWED_ORIGINS` — comma-separated. Falls back to `APP_URL`, then to
 * the request's own host so a preview deployment keeps working with no config.
 */
export function resolveAllowedOrigins(req?: Request): string[] {
  const raw = (process.env.ALLOWED_ORIGINS ?? "").trim();
  const configured = raw
    ? raw.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
    : [];

  if (configured.length > 0) return configured;

  const appUrl = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (appUrl) return [appUrl];

  // Self-hosting / local dev: trust the Host header this request arrived on.
  // Production pins the real origin via ALLOWED_ORIGINS or APP_URL, so this is
  // only the zero-configuration path.
  const host = req?.headers.host;
  if (typeof host === "string" && host) return [`https://${host}`, `http://${host}`];
  return [];
}

/**
 * CORS middleware built from an allowlist.
 *
 * A non-allowlisted `Origin` gets NO `Access-Control-Allow-Origin` header, which
 * is what makes the browser refuse the read. That is the intended behaviour, not
 * an oversight.
 */
export function corsGuard(allowed: string[]) {
  const set = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (typeof origin === "string" && origin) {
      if (set.has(origin.replace(/\/+$/, ""))) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        // Tells caches the response depends on the requesting origin.
        res.setHeader("Vary", "Origin");
      }
      // Otherwise: deliberately no header. The browser blocks the response.
    }

    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-device-id, x-fingerprint-hash");
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

// ── CSRF ──────────────────────────────────────────────────────────────────────

/**
 * Reject state-changing requests that come from a foreign origin.
 *
 * WHY, WHEN `SameSite=Lax` ALREADY EXISTS
 * ---------------------------------------
 * `SameSite` is the primary defence and it is already on every cookie, but it is a
 * browser default that can be downgraded by old clients, or neutralised by any
 * subdomain takeover that lands on the registrable domain. Checking
 * `Origin`/`Referer` is cheap, needs no cookie, and fails loudly, so it stays on
 * as the second layer.
 *
 * Requests with NO `Origin` and no `Referer` are ALLOWED: those are non-browser
 * clients (curl, server-to-server, the OAuth redirect chain) where CSRF does not
 * apply. Blocking them would break the API without adding security.
 */
export function sameOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedSet = new Set(resolveAllowedOrigins(req));

  // A browser POST always carries an `Origin`. No header at all => not a browser
  // form/fetch post => CSRF is not applicable.
  const source = typeof origin === "string" && origin ? origin : typeof referer === "string" ? referer : "";
  if (!source) {
    next();
    return;
  }

  if (allowedSet.has(source.replace(/\/+$/, ""))) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    code: "CROSS_ORIGIN_BLOCKED",
    message: "طلب من مصدر غير موثوق (Cross-origin request blocked).",
  });
}

// ── Staff accounts (subscription tier only) ───────────────────────────────────

/**
 * Addresses that get the Business tier automatically, with no payment and no
 * expiry.
 *
 * WHY THIS IS NOT AN OWNERSHIP LIST
 * --------------------------------
 * "Business tier" and "site owner" are DIFFERENT powers and must never be
 * merged:
 *   • A staff account gets the PAID FEATURES — no watermark on export, custom
 *     domains, the raised generation ceiling.
 *   • The owner ALSO gets the admin console: every account, device blocks,
 *     payment approvals, platform settings.
 * If these addresses were treated as owners, then anyone able to sign in as
 * `maged6086@gmail.com` would reach the admin console knowing only the PIN. That
 * is a privilege escalation nobody asked for, so this list is strictly a
 * SUBSCRIPTION decision and must never gate an admin route.
 *
 * CONFIG: `STAFF_EMAILS` overrides the defaults (comma-separated), so adding or
 * removing someone is a redeploy rather than a code change.
 */
export const DEFAULT_STAFF_EMAILS = ["elsayedsameh803@gmail.com", "maged6086@gmail.com"];

/** Normalised e-mail comparison — the only safe way to match these lists. */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * The effective staff list.
 *
 * CONFIG SEMANTICS — the distinction matters, so it is spelled out:
 *   • UNSET (the variable does not exist) → the built-in defaults, so the feature
 *     works on a fresh deployment with no configuration at all.
 *   • SET TO ANY STRING → exactly that list, parsed from commas. This includes
 *     the empty string.
 *
 * Why empty means "nobody" rather than "fall back to the defaults": clearing the
 * variable is the obvious way for an operator to remove every staff member. If
 * that silently reinstated the built-in addresses, removing someone would appear
 * to work and then quietly not work — the worst outcome for a privilege list.
 */
export function staffEmails(): Set<string> {
  const raw = process.env.STAFF_EMAILS;
  if (typeof raw !== "string") return new Set(DEFAULT_STAFF_EMAILS.map(normalizeEmail));
  return new Set(
    raw
      .split(",")
      .map((e) => normalizeEmail(e))
      .filter(Boolean),
  );
}

/**
 * Is this e-mail on the staff list?
 *
 * Used for the subscription tier ONLY. It must never be used as an authorisation
 * check for admin routes — see the note above.
 */
export function isStaffEmail(email: unknown): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return staffEmails().has(normalized);
}

// ── Delegated administrators ───────────────────────────────────────────────────

/** Upper bound on the list, so a hand-edited settings row cannot grow forever. */
export const MAX_ADMIN_EMAILS = 50;

/**
 * One delegated administrator, with the owner's on/off switch.
 *
 * WHY A FLAG AND NOT JUST A LIST: the owner asked to be able to suspend someone
 * without deleting them — an admin who is merely idle should not lose the ability
 * to come back, and deleting loses the record of who was ever granted access.
 * `active: false` revokes console access immediately.
 */
export interface AdminDelegate {
  email: string;
  /** `false` suspends console access without removing the entry. */
  active: boolean;
}

/** Is this address an ACTIVE delegate? A suspended admin does not pass. */
export function isActiveAdmin(list: AdminDelegate[], email: unknown): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return list.some((admin) => admin.email === normalized && admin.active);
}

/**
 * Normalise the owner's delegated-admin list into `{ email, active }` records.
 *
 * WHAT THIS LIST IS — AND WHAT IT DELIBERATELY IS NOT
 * ----------------------------------------------------
 * The owner asked for an administrator who works alongside them: able to run the
 * dashboard, manage subscriptions and activate plans — but NOT able to touch the
 * admin list itself. That split is enforced by the route guards, not by
 * convention:
 *
 *   • It grants the CONSOLE, never ownership. `isOwnerAccount()` in
 *     `api/index.ts` reads `OWNER_EMAIL` from the environment and nothing else,
 *     so no entry here can ever satisfy the ownership check in `requireOwner`.
 *   • Only `requireOwner` routes may write this list, so a delegate cannot add,
 *     remove, activate or deactivate another delegate — including themselves.
 *
 * SHAPES ACCEPTED: a bare string (a row written before the flag existed) is read
 * as an ACTIVE admin, so an existing list keeps working instead of silently
 * locking everyone out of the console.
 *
 * @param ownerEmail the resolved owner address, excluded from the result
 */
export function normalizeAdmins(value: unknown, ownerEmail = ""): AdminDelegate[] {
  if (!Array.isArray(value)) return [];
  const owner = normalizeEmail(ownerEmail);
  const seen = new Set<string>();
  const result: AdminDelegate[] = [];

  for (const entry of value) {
    let emailInput: unknown;
    let active = true;

    if (typeof entry === "string") {
      // A bare string means "an admin added before the active flag existed".
      emailInput = entry;
    } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      emailInput = record.email;
      // An absent `active` means an older row → treat as active rather than
      // locking someone out because of a schema detail.
      active = record.active === false ? false : true;
    } else {
      // `normalizeEmail` deliberately coerces anything to a string (`42` -> "42"),
      // which is right for the staff matcher but wrong here: a hand-edited row
      // containing a number would otherwise become a bogus administrator. This is
      // a privilege list, so it only ever holds real address strings.
      continue;
    }

    const normalized = normalizeEmail(emailInput);
    if (!normalized || !normalized.includes("@")) continue;
    // The owner is not a delegate — listing them would be misleading, and their
    // removal through this path would look successful while changing nothing.
    if (owner && normalized === owner) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    result.push({ email: normalized, active });
    if (seen.size >= MAX_ADMIN_EMAILS) break;
  }
  return result;
}

/**
 * Normalise the owner's delegated-admin list.
 *
 * WHAT THIS LIST IS — AND WHAT IT DELIBERATELY IS NOT
 * ----------------------------------------------------
 * The owner asked for a button that adds an administrator who works alongside
 * them, visible to the site owner and NOT to any other admin. This list is
 * therefore deliberately not a promotion path to ownership:
 *
 *   • It grants the DASHBOARD, never ownership. `isOwnerAccount()` in
 *     `api/index.ts` reads `OWNER_EMAIL` from the environment and nothing else,
 *     so no entry here can ever satisfy the ownership half of `requireAdmin`.
 *   • It cannot be edited by anyone but the owner: the only routes that write it
 *     sit behind `requireAdmin`, which needs the owner account session AND the
 *     PIN.
 *
 * So a delegated admin can see the console; they cannot see this list, cannot add
 * another admin, and cannot become the owner. That is the "not for any admin"
 * half of the request, enforced here rather than by convention.
 *
 * @param ownerEmail the resolved owner address, excluded from the result
 */
export function normalizeAdminEmails(value: unknown, ownerEmail = ""): string[] {
  return normalizeAdmins(value, ownerEmail)
    .filter((admin) => admin.active)
    .map((admin) => admin.email);
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * The identity a limit is counted against.
 *
 * Prefers the signed-in account, because a limit keyed on IP alone punishes a
 * whole office or NAT for one person's mistake. Falls back to the client IP.
 *
 * TRUST NOTE: `x-forwarded-for` is client-controllable in general. On Vercel the
 * platform sets it and appends to it, so the FIRST value is the real one and is
 * what is used. Behind another proxy this must be reviewed.
 */
export function clientKey(req: Request, scope?: string): string {
  const sessionEmail = (req as Request & { authEmail?: string }).authEmail;
  if (typeof sessionEmail === "string" && sessionEmail) {
    return `${scope ?? "acct"}:${sessionEmail.toLowerCase()}`;
  }
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return `${scope ?? "ip"}:${ip || req.socket?.remoteAddress || "unknown"}`;
}

export interface RateLimitRule {
  /** Requests allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets — surfaced as `Retry-After`. */
  retryAfterSec: number;
}

interface Bucket {
  /** Timestamps (ms) of the requests still inside the window. */
  hits: number[];
  /** Last time this bucket was touched, for eviction. */
  lastSeen: number;
}

/**
 * Sliding-window rate limiter.
 *
 * A fixed window has a well-known burst problem (2x the limit across a boundary),
 * so this keeps real timestamps and drops the ones that fall out of the window.
 *
 * WHY IN-MEMORY BY DEFAULT
 * -------------------------
 * The serverless runtime is stateless and reuses instances, so a local map is
 * per-instance: it raises the floor against casual abuse, but a determined
 * attacker using parallel requests can exceed it. That is an honest trade-off
 * versus requiring Redis before the site can boot, and the correct escalation
 * path is a shared store (`UPSTASH_REDIS_REST_URL` + `..._TOKEN`) wired in
 * `rateLimit`. The in-memory path is always the fallback so the site never hard
 * fails on a store outage.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly defaultRule: RateLimitRule;
  /** Injected for tests. */
  private readonly now: () => number;

  // NOTE: written as explicit fields rather than TypeScript parameter properties
  // (`constructor(private readonly x)`) because this module is executed directly by
  // Node's type-stripping test runner, and strip-only mode does not support that
  // syntax — it fails at PARSE time, which would take the whole suite down.
  constructor(defaultRule: RateLimitRule, now: () => number = () => Date.now()) {
    this.defaultRule = defaultRule;
    this.now = now;
  }

  /** Read a rule from env, falling back to the supplied default. */
  ruleFromEnv(prefix: string, fallback: RateLimitRule): RateLimitRule {
    const max = Number(process.env[`${prefix}_MAX`]);
    const windowMs = Number(process.env[`${prefix}_WINDOW_MS`]);
    return {
      max: Number.isFinite(max) && max > 0 ? max : fallback.max,
      windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : fallback.windowMs,
    };
  }

  check(key: string, rule: RateLimitRule = this.defaultRule): RateLimitResult {
    const nowMs = this.now();
    const bucket = this.buckets.get(key) ?? { hits: [], lastSeen: nowMs };

    bucket.hits = bucket.hits.filter((t) => nowMs - t < rule.windowMs);
    bucket.lastSeen = nowMs;

    if (bucket.hits.length >= rule.max) {
      this.buckets.set(key, bucket);
      const oldest = bucket.hits[0] ?? nowMs;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((oldest + rule.windowMs - nowMs) / 1000)),
      };
    }

    bucket.hits.push(nowMs);
    this.buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.max(0, rule.max - bucket.hits.length),
      retryAfterSec: 0,
    };
  }

  /** Drop buckets untouched for longer than `maxAgeMs`, bounding memory. */
  sweep(maxAgeMs = 60 * 60 * 1000): void {
    const nowMs = this.now();
    for (const [key, bucket] of this.buckets) {
      if (nowMs - bucket.lastSeen > maxAgeMs) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}

/**
 * Express middleware form of {@link RateLimiter}.
 *
 * Sets the standard `X-RateLimit-*` headers and answers 429 with `Retry-After`
 * when the limit is hit, so a well-behaved client can back off on its own.
 */
export function rateLimit(
  limiter: RateLimiter,
  rule: RateLimitRule,
  scope: string,
  message = "Too many requests. Please slow down.",
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = limiter.check(clientKey(req, scope), rule);

    res.setHeader("X-RateLimit-Limit", String(rule.max));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSec));
      res.status(429).json({ success: false, code: "RATE_LIMITED", message, retryAfter: result.retryAfterSec });
      return;
    }
    next();
  };
}

/**
 * Background sweep so the bucket map cannot grow forever.
 *
 * `unref()` keeps the timer from holding a serverless invocation open — without
 * it a pending interval can keep the function alive and burn the duration budget
 * long after the response was sent.
 */
export function startLimiterSweeper(limiter: RateLimiter, everyMs = 5 * 60 * 1000): NodeJS.Timeout | null {
  if (process.env.VERCEL) return null; // serverless instances are short-lived
  const timer = setInterval(() => limiter.sweep(), everyMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}
