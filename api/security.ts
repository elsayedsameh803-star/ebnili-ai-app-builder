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
