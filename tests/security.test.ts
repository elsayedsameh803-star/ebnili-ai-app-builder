/**
 * Security regression tests.
 *
 * WHY THESE EXIST
 * ---------------
 * Every test here pins a vulnerability that was actually present in this codebase
 * and has since been fixed. They are executable documentation: if one of these
 * assertions fails again, a real vulnerability is back, and the test name says
 * which one.
 *
 * Dependency-free (`node:assert` + `node:test`) so `npm test` works on a fresh
 * clone with nothing installed beyond the project's own deps.
 *
 * RUN: `npm test`
 */
import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  DEFAULT_STAFF_EMAILS,
  isStaffEmail,
  isWeakSecret,
  normalizeEmail,
  requireStrongSecret,
  resolveAllowedOrigins,
  corsGuard,
  sameOriginGuard,
  RateLimiter,
  rateLimit,
  clientKey,
  staffEmails,
  MIN_SECRET_LENGTH,
  normalizeAdmins,
  isActiveAdmin,
  MAX_ADMIN_EMAILS,
} from "../api/security.ts";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Minimal express-like response double. */
function makeRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 0,
    body: undefined as unknown,
    headers,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

function makeReq(opts: {
  method?: string;
  origin?: string;
  referer?: string;
  host?: string;
  fwd?: string;
  authEmail?: string;
}) {
  return {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.host ? { host: opts.host } : {}),
      ...(opts.origin ? { origin: opts.origin } : {}),
      ...(opts.referer ? { referer: opts.referer } : {}),
      ...(opts.fwd ? { "x-forwarded-for": opts.fwd } : {}),
    },
    socket: { remoteAddress: "10.0.0.1" },
    ...(opts.authEmail ? { authEmail: opts.authEmail } : {}),
  } as never;
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── 1. Weak secrets (the session-forgery vulnerability) ───────────────────────

describe("isWeakSecret", () => {
  test("rejects an empty or whitespace value", () => {
    assert.equal(isWeakSecret(""), true);
    assert.equal(isWeakSecret("   "), true);
    assert.equal(isWeakSecret(undefined), true);
    assert.equal(isWeakSecret(null), true);
  });

  test("rejects anything shorter than the minimum", () => {
    assert.equal(isWeakSecret("short"), true);
    assert.equal(isWeakSecret("a".repeat(MIN_SECRET_LENGTH - 1)), true);
  });

  test("rejects the placeholder that WAS committed to this repository", () => {
    // This is the exact literal that used to sign session cookies. Re-introducing
    // it as a fallback must fail the build.
    assert.equal(isWeakSecret("ebnili-insecure-dev-secret"), true);
  });

  test("is case-insensitive about placeholders", () => {
    assert.equal(isWeakSecret("EBNILI-INSECURE-DEV-SECRET"), true);
  });

  test("accepts a genuine random secret", () => {
    assert.equal(isWeakSecret("f3a9c2e18b7d4056a9c1e2f3b4d5e6f7"), false);
  });
});

// ── 2. CORS allowlist (the `*` vulnerability) ─────────────────────────────────

describe("CORS allowlist", () => {
  test("reads a comma-separated ALLOWED_ORIGINS", () => {
    const list = withEnv({ ALLOWED_ORIGINS: "https://a.com, https://b.com/", APP_URL: undefined }, () =>
      resolveAllowedOrigins(makeReq({ host: "h" })),
    );
    assert.deepEqual(list, ["https://a.com", "https://b.com"]);
  });

  test("falls back to APP_URL when no allowlist is set", () => {
    const list = withEnv({ ALLOWED_ORIGINS: undefined, APP_URL: "https://ebnily.vercel.app/" }, () =>
      resolveAllowedOrigins(makeReq({ host: "h" })),
    );
    assert.deepEqual(list, ["https://ebnily.vercel.app"]);
  });

  test("grants the header ONLY to an allowlisted origin", () => {
    const guard = corsGuard(["https://good.com"]);
    const res = makeRes();
    guard(makeReq({ origin: "https://good.com" }), res as never, () => {});
    assert.equal(res.headers["access-control-allow-origin"], "https://good.com");
  });

  test("withholds the header from a foreign origin — the regression", () => {
    const guard = corsGuard(["https://good.com"]);
    const res = makeRes();
    guard(makeReq({ origin: "https://evil.com" }), res as never, () => {});
    // No header means the browser blocks the read. THAT IS THE POINT.
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });

  test("sets Vary: Origin so a cache cannot serve one origin's response to another", () => {
    const guard = corsGuard(["https://good.com"]);
    const res = makeRes();
    guard(makeReq({ origin: "https://good.com" }), res as never, () => {});
    assert.match(String(res.headers.vary ?? ""), /Origin/i);
  });
});

// ── 3. CSRF origin guard ─────────────────────────────────────────────────────

describe("sameOriginGuard", () => {
  const ORIGIN = "https://ebnily.vercel.app";
  const env = { ALLOWED_ORIGINS: ORIGIN, APP_URL: undefined };

  test("blocks a state-changing request from a foreign origin", () => {
    const res = makeRes();
    let passed = false;
    withEnv(env, () =>
      sameOriginGuard(makeReq({ method: "POST", origin: "https://evil.com" }), res as never, () => {
        passed = true;
      }),
    );
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
  });

  test("allows a same-origin state-changing request", () => {
    const res = makeRes();
    let passed = false;
    withEnv(env, () =>
      sameOriginGuard(makeReq({ method: "POST", origin: ORIGIN }), res as never, () => {
        passed = true;
      }),
    );
    assert.equal(passed, true);
  });

  test("blocks a foreign REFERER even when Origin is absent", () => {
    const res = makeRes();
    let passed = false;
    withEnv(env, () =>
      sameOriginGuard(makeReq({ method: "POST", referer: "https://evil.com/p" }), res as never, () => {
        passed = true;
      }),
    );
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
  });

  test("never blocks safe methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const res = makeRes();
      let passed = false;
      withEnv(env, () =>
        sameOriginGuard(makeReq({ method, origin: "https://evil.com" }), res as never, () => {
          passed = true;
        }),
      );
      assert.equal(passed, true, `${method} must not be blocked`);
    }
  });

  test("allows a request with no Origin/Referer (curl, OAuth redirect, server-to-server)", () => {
    // CSRF needs a browser to carry ambient authority. A non-browser client
    // carries none, so blocking it would break the API and add no security.
    const res = makeRes();
    let passed = false;
    withEnv(env, () =>
      sameOriginGuard(makeReq({ method: "POST" }), res as never, () => {
        passed = true;
      }),
    );
    assert.equal(passed, true);
    assert.equal(res.statusCode, 0);
  });
});

// ── 4. Rate limiting ──────────────────────────────────────────────────────────

describe("RateLimiter", () => {
  test("allows exactly `max` requests, then blocks", () => {
    const limiter = new RateLimiter({ max: 3, windowMs: 1000 }, () => 0);
    assert.equal(limiter.check("k").allowed, true);
    assert.equal(limiter.check("k").allowed, true);
    assert.equal(limiter.check("k").allowed, true);
    const blocked = limiter.check("k");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
  });

  test("counts identities independently", () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 1000 }, () => 0);
    assert.equal(limiter.check("a").allowed, true);
    assert.equal(limiter.check("a").allowed, false);
    assert.equal(limiter.check("b").allowed, true);
  });

  test("lets the window slide so a client recovers without a restart", () => {
    let now = 0;
    const limiter = new RateLimiter({ max: 2, windowMs: 1000 }, () => now);
    limiter.check("k");
    limiter.check("k");
    assert.equal(limiter.check("k").allowed, false);
    now += 1001; // past the window
    assert.equal(limiter.check("k").allowed, true);
  });

  test("reports a positive Retry-After when blocked", () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 60_000 }, () => 0);
    limiter.check("k");
    const blocked = limiter.check("k");
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec > 0, "must tell the client how long to wait");
  });

  test("sweep() keeps buckets that are still inside the default 1h age", () => {
    // A bucket that was used 10 minutes ago is NOT stale — dropping it would let
    // an attacker reset their quota simply by waiting for the sweeper.
    let now = 0;
    const limiter = new RateLimiter({ max: 5, windowMs: 1000 }, () => now);
    limiter.check("a");
    now += 10 * 60_000;
    limiter.sweep();
    assert.equal(limiter.size, 1);
  });

  test("sweep() drops buckets older than the max age, bounding memory", () => {
    let now = 0;
    const limiter = new RateLimiter({ max: 5, windowMs: 1000 }, () => now);
    limiter.check("a");
    limiter.check("b");
    assert.equal(limiter.size, 2);
    now += 2 * 60 * 60 * 1000; // 2 hours > the 1 hour default
    limiter.sweep();
    assert.equal(limiter.size, 0);
  });

  test("sweep() honours an explicit max age", () => {
    let now = 0;
    const limiter = new RateLimiter({ max: 5, windowMs: 1000 }, () => now);
    limiter.check("a");
    now += 10 * 60_000;
    limiter.sweep(5 * 60_000); // custom, shorter than the elapsed time
    assert.equal(limiter.size, 0);
  });

  test("reads limits from env and falls back when unset or nonsense", () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 1 }, () => 0);
    const fallback = { max: 7, windowMs: 1000 };
    withEnv({ RATE_LIMIT_AI_MAX: undefined, RATE_LIMIT_AI_WINDOW_MS: undefined }, () =>
      assert.deepEqual(limiter.ruleFromEnv("RATE_LIMIT_AI", fallback), fallback),
    );
    withEnv({ RATE_LIMIT_AI_MAX: "0", RATE_LIMIT_AI_WINDOW_MS: "abc" }, () =>
      assert.deepEqual(limiter.ruleFromEnv("RATE_LIMIT_AI", fallback), fallback),
    );
    withEnv({ RATE_LIMIT_AI_MAX: "42", RATE_LIMIT_AI_WINDOW_MS: "5000" }, () =>
      assert.deepEqual(limiter.ruleFromEnv("RATE_LIMIT_AI", fallback), { max: 42, windowMs: 5000 }),
    );
  });
});

describe("rateLimit middleware", () => {
  test("answers 429 with Retry-After once the limit is hit", () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 60_000 }, () => 0);
    const mw = rateLimit(limiter, { max: 1, windowMs: 60_000 }, "test");

    const first = makeRes();
    let passed = false;
    mw(makeReq({ fwd: "1.1.1.1" }), first as never, () => {
      passed = true;
    });
    assert.equal(passed, true);
    assert.equal(first.headers["x-ratelimit-limit"], "1");

    const second = makeRes();
    mw(makeReq({ fwd: "1.1.1.1" }), second as never, () => {});
    assert.equal(second.statusCode, 429);
    assert.ok(Number(second.headers["retry-after"]) > 0);
  });

  test("always emits X-RateLimit-* so a client can self-throttle", () => {
    const limiter = new RateLimiter({ max: 5, windowMs: 1000 }, () => 0);
    const mw = rateLimit(limiter, { max: 5, windowMs: 1000 }, "test");
    const res = makeRes();
    mw(makeReq({ fwd: "2.2.2.2" }), res as never, () => {});
    assert.equal(res.headers["x-ratelimit-limit"], "5");
    assert.equal(res.headers["x-ratelimit-remaining"], "4");
  });
});

describe("clientKey", () => {
  test("prefers the signed-in account over the IP", () => {
    // Otherwise one person behind a shared NAT exhausts everyone's quota.
    assert.equal(clientKey(makeReq({ fwd: "1.1.1.1", authEmail: "A@B.com" }), "ai"), "ai:a@b.com");
  });

  test("falls back to the IP for an anonymous caller", () => {
    assert.equal(clientKey(makeReq({ fwd: "1.1.1.1" }), "ai"), "ai:1.1.1.1");
  });

  test("uses only the FIRST forwarded IP (the real client on Vercel)", () => {
    assert.equal(clientKey(makeReq({ fwd: "9.9.9.9, 10.0.0.1" }), "ai"), "ai:9.9.9.9");
  });

  test("never produces an undefined key", () => {
    const key = clientKey(makeReq({}), "ai");
    assert.ok(key.startsWith("ai:"));
    assert.notEqual(key, "ai:undefined");
  });
});

// ── 5. Long values that merely LOOK random ───────────────────────────────────
// This section exists because the FIRST pass of `isWeakSecret` only did an exact
// match, so `"change-me".repeat(5)` sailed through. The test caught it.

describe("isWeakSecret — long-but-obvious values", () => {
  test("rejects a placeholder repeated to reach the length threshold", () => {
    // 45 chars of "change-me" and 32 chars of "password". Both clear a naive
    // length check; both are trivially guessable.
    assert.equal(isWeakSecret("change-me".repeat(5)), true);
    assert.equal(isWeakSecret("password".repeat(4)), true);
    assert.equal(isWeakSecret("changeme".repeat(4)), true);
  });

  test("rejects a long value carrying an obvious placeholder marker", () => {
    assert.equal(isWeakSecret("a-very-long-change-me-value-here"), true);
    assert.equal(isWeakSecret("this-is-just-a-placeholder-01"), true);
    assert.equal(isWeakSecret("your-secret-key-goes-right-here"), true);
  });

  test("is case-insensitive about a repeated placeholder", () => {
    assert.equal(isWeakSecret("CHANGE-ME".repeat(5)), true);
  });

  test("does NOT false-positive on a random key that happens to contain the letters", () => {
    // A real 32-byte hex key can contain almost any letter sequence by chance. A
    // check that rejected those would lock a working deployment on a technicality,
    // so the marker list is deliberately made of unambiguous phrases only.
    assert.equal(isWeakSecret("0aBcDeF0123456789abcdef01234567"), false);
  });
});

// ── 6. Staff accounts (subscription tier, NOT admin) ─────────────────────────

describe("isStaffEmail", () => {
  const defaults = { STAFF_EMAILS: undefined };

  test("grants Business to both configured staff addresses", () => {
    withEnv(defaults, () => {
      assert.equal(isStaffEmail("elsayedsameh803@gmail.com"), true);
      assert.equal(isStaffEmail("maged6086@gmail.com"), true);
    });
  });

  test("ignores case and surrounding whitespace", () => {
    // OAuth providers are inconsistent about the casing they return; a staff
    // member must not silently drop to Free because of a capital letter.
    withEnv(defaults, () => {
      assert.equal(isStaffEmail("  Maged6086@Gmail.COM  "), true);
      assert.equal(isStaffEmail("ELSAYEDSAMEH803@GMAIL.COM"), true);
    });
  });

  test("does NOT grant Business to anyone else", () => {
    withEnv(defaults, () => {
      assert.equal(isStaffEmail("someone@example.com"), false);
      assert.equal(isStaffEmail("maged6086@gmail.com.evil.com"), false);
      assert.equal(isStaffEmail("notmaged6086@gmail.com"), false);
    });
  });

  test("treats a missing or empty e-mail as not staff", () => {
    withEnv(defaults, () => {
      assert.equal(isStaffEmail(""), false);
      assert.equal(isStaffEmail("   "), false);
      assert.equal(isStaffEmail(undefined), false);
      assert.equal(isStaffEmail(null), false);
    });
  });

  test("STAFF_EMAILS overrides the default list entirely", () => {
    // An override REPLACES, not extends. That is what makes it possible to remove
    // a former staff member without a code change.
    withEnv({ STAFF_EMAILS: "new.person@example.com" }, () => {
      assert.equal(isStaffEmail("new.person@example.com"), true);
      assert.equal(isStaffEmail("maged6086@gmail.com"), false);
      assert.equal(isStaffEmail("elsayedsameh803@gmail.com"), false);
    });
  });

  test("an empty STAFF_EMAILS grants Business to nobody", () => {
    // Clearing the variable is how an operator removes every staff member. It
    // must NOT silently reinstate the built-in addresses.
    withEnv({ STAFF_EMAILS: "" }, () => {
      assert.equal(isStaffEmail("maged6086@gmail.com"), false);
      assert.equal(isStaffEmail("elsayedsameh803@gmail.com"), false);
    });
  });

  test("an unset STAFF_EMAILS falls back to the built-in defaults", () => {
    // The other half of the same rule: no configuration at all must still work.
    withEnv({ STAFF_EMAILS: undefined }, () => {
      assert.equal(staffEmails().size, DEFAULT_STAFF_EMAILS.length);
      assert.equal(isStaffEmail("maged6086@gmail.com"), true);
    });
  });

  test("tolerates spaces and stray commas in the override", () => {
    withEnv({ STAFF_EMAILS: " a@b.com , , c@d.com " }, () => {
      assert.equal(isStaffEmail("a@b.com"), true);
      assert.equal(isStaffEmail("c@d.com"), true);
      assert.equal(isStaffEmail("maged6086@gmail.com"), false);
    });
  });

  test("is case-insensitive about the override too", () => {
    withEnv({ STAFF_EMAILS: "Mixed@Case.COM" }, () => {
      assert.equal(isStaffEmail("mixed@case.com"), true);
    });
  });
});

describe("normalizeEmail", () => {
  test("trims and lowercases, and never returns a non-string", () => {
    assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
    assert.equal(normalizeEmail(undefined), "");
    assert.equal(normalizeEmail(null), "");
    assert.equal(normalizeEmail(42), "42");
  });
});

// ── Delegated administrators ───────────────────────────────────────────────────
// The owner asked for a control that adds an admin who works alongside them,
// visible to the site owner and NOT to any other admin. These tests pin the
// properties that make that second half true.

describe("normalizeAdmins", () => {
  const OWNER = "owner@example.com";

  test("keeps a normal delegate, active by default", () => {
    assert.deepEqual(normalizeAdmins([{ email: "helper@example.com", active: true }], OWNER), [
      { email: "helper@example.com", active: true },
    ]);
  });

  test("reads a bare string as an ACTIVE admin (pre-flag rows keep working)", () => {
    // A list written before the `active` flag existed must not silently lock
    // everyone out of the console after the upgrade.
    assert.deepEqual(normalizeAdmins(["helper@example.com"], OWNER), [
      { email: "helper@example.com", active: true },
    ]);
  });

  test("treats a missing `active` as active", () => {
    assert.deepEqual(normalizeAdmins([{ email: "helper@example.com" }], OWNER), [
      { email: "helper@example.com", active: true },
    ]);
  });

  test("preserves an explicit `active: false`", () => {
    // The owner's suspend switch must survive a round trip through the row.
    assert.deepEqual(normalizeAdmins([{ email: "helper@example.com", active: false }], OWNER), [
      { email: "helper@example.com", active: false },
    ]);
  });

  test("returns [] when the stored value is missing or not a list", () => {
    assert.deepEqual(normalizeAdmins(undefined, OWNER), []);
    assert.deepEqual(normalizeAdmins(null, OWNER), []);
    assert.deepEqual(normalizeAdmins("helper@example.com", OWNER), []);
    assert.deepEqual(normalizeAdmins({ email: "helper@example.com" }, OWNER), []);
  });

  test("normalises case and surrounding whitespace", () => {
    assert.deepEqual(normalizeAdmins(["  Helper@Example.COM  "], OWNER), [
      { email: "helper@example.com", active: true },
    ]);
  });

  test("de-duplicates rather than storing the same person twice", () => {
    assert.deepEqual(normalizeAdmins(["a@b.com", "A@B.COM", { email: "a@b.com", active: false }], OWNER), [
      { email: "a@b.com", active: true },
    ]);
  });

  test("never lists the owner as their own delegate", () => {
    // Regression guard: if the owner appeared here, "remove" would report success
    // while changing nothing. Ownership comes from the environment only.
    assert.deepEqual(normalizeAdmins([OWNER, "helper@example.com"], OWNER), [
      { email: "helper@example.com", active: true },
    ]);
    assert.deepEqual(normalizeAdmins(["  OWNER@EXAMPLE.COM  "], OWNER), []);
  });

  test("never coerces a non-string into a stored administrator", () => {
    // Regression guard: `normalizeEmail(42)` returns "42" by design, so without an
    // explicit type check a hand-edited row containing a number would be stored as
    // a bogus admin entry.
    assert.deepEqual(normalizeAdmins([42, true, {}, ["x"]], OWNER), []);
    assert.deepEqual(normalizeAdmins([{ email: 42 }], OWNER), []);
    assert.deepEqual(normalizeAdmins([42, { email: "helper@example.com" }], OWNER), [
      { email: "helper@example.com", active: true },
    ]);
  });

  test("caps the list so a hand-edited row cannot grow without bound", () => {
    const many = Array.from({ length: MAX_ADMIN_EMAILS + 25 }, (_, i) => `user${i}@example.com`);
    assert.equal(normalizeAdmins(many, OWNER).length, MAX_ADMIN_EMAILS);
  });

  test("is case-insensitive about the owner address it is given", () => {
    assert.deepEqual(normalizeAdmins(["Owner@Example.com"], "OWNER@example.COM"), []);
  });
});

describe("isActiveAdmin", () => {
  const list = [
    { email: "live@example.com", active: true },
    { email: "suspended@example.com", active: false },
  ];

  test("an active delegate passes", () => {
    assert.equal(isActiveAdmin(list, "live@example.com"), true);
  });

  test("a SUSPENDED delegate does not pass", () => {
    // The whole point of the flag: suspension must revoke console access
    // immediately, without deleting the entry.
    assert.equal(isActiveAdmin(list, "suspended@example.com"), false);
  });

  test("someone who is not on the list does not pass", () => {
    assert.equal(isActiveAdmin(list, "stranger@example.com"), false);
  });

  test("ignores case and surrounding whitespace", () => {
    assert.equal(isActiveAdmin(list, "  Live@Example.COM  "), true);
  });

  test("never passes for a missing or non-string address", () => {
    assert.equal(isActiveAdmin(list, undefined), false);
    assert.equal(isActiveAdmin(list, null), false);
    assert.equal(isActiveAdmin(list, ""), false);
  });

  test("an empty list grants nothing", () => {
    assert.equal(isActiveAdmin([], "live@example.com"), false);
  });
});

describe("requireStrongSecret", () => {
  test("returns null when every candidate is weak — callers must then refuse", () => {
    assert.equal(requireStrongSecret(undefined, "", "ebnili-insecure-dev-secret"), null);
  });

  test("skips weak candidates and returns the first strong one", () => {
    const good = "f3a9c2e18b7d4056a9c1e2f3b4d5e6f7";
    assert.equal(requireStrongSecret("", "change-me", good), good);
  });

  test("never returns a fallback when nothing is configured", () => {
    // THE regression: the old code did `x || "ebnili-insecure-dev-secret"`.
    // There must be no path that yields a value here without a real secret.
    assert.equal(requireStrongSecret(), null);
  });
});
