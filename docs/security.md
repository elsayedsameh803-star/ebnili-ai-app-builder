# Security

What was fixed, why it mattered, and how to verify it. Every item below was a
real defect in this codebase, not a hypothetical.

Run the regression suite with:

```bash
npm test
```

36 tests, no external dependencies. They pin the exact rules the server
enforces, so a regression fails the build rather than shipping.

---

## Phase 1 — critical

### 1.1 The session-signing key had a published fallback

**The bug.** `authSessionSecret()` resolved to a literal
`"ebnili-insecure-dev-secret"` — a string committed to this repository — whenever
`AUTH_SESSION_SECRET` was unset or short. Anyone who read the source could mint a
session cookie for the owner's address and take the site over. It logged a
warning and continued, so the operator was told while the site stayed open.

**The fix.** Fail closed. `requireStrongSecret()` returns `null` for an unusable
secret, and:

| Situation | Before | Now |
|---|---|---|
| No secret | signs with a public key | `issueAuthSession()` returns `null` → nobody can sign in |
| Forged cookie | verified against the public key | `readAuthSession()` returns `null` → rejected |
| Marketing / pricing pages | worked | still work |

The site does not crash. Only the authenticated surfaces lock, and `/api/health`
reports the problem so the cause is obvious.

**Set it:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.2 Cookies lost `Secure` outside Vercel

**The bug.** `secure: Boolean(process.env.VERCEL)`. Any production deployment
*not* on Vercel — the self-hosted `server.ts`, a container, a proxy — shipped
session cookies without `Secure`, so they travelled in cleartext over any `http://`
hop.

**The fix.** `cookiesAreSecure(req)` decides from what the request actually looks
like: `x-forwarded-proto`, then `NODE_ENV`, then `req.secure`. `npm run dev` still
works; a real deployment never weakens.

### 1.3 The plan grant was a bearer token

**The audit finding was partly wrong.** The grant cookie *was* already bound to
the session e-mail at both call sites. What was missing was a name for the rule, so
a third call site could silently skip it.

**The fix.** `grantBelongsToSession(grant, session)` is now the single named
check, documented at `readPlanGrant` and asserted directly by the tests.

### 1.4 `postMessage` accepted messages from any window

**The bug.** The preview bridge posted with `targetOrigin: '*'`, and the listener
validated neither `e.source` nor `e.origin`. Any tab or opener could send
`LOVABLE_ELEMENT_SELECTED` and drive the inspector, or flood the console drawer
with fake output.

**The fix.**

---

## Phase 2 — abuse resistance

### 2.1 CORS was `*`

`Access-Control-Allow-Origin: *` let any website read this API's responses from a
visitor's browser — project metadata and subscription state included. Cookies are
not attached to a cross-origin `*` read, but the JSON bodies are.

Now an allowlist, resolved in this order: `ALLOWED_ORIGINS` → `APP_URL` → the
request's own host. A non-allowlisted origin gets **no** CORS header, so the
browser refuses the read. `Vary: Origin` is set so a cache cannot serve one
origin's response to another.

### 2.2 No general rate limiting

The AI quota was per-account, but project writes, payment receipts and the admin
login were unlimited — each a resource an attacker could exhaust for free.

| Scope | Default | Covers |
|---|---|---|
| `RATE_LIMIT_API_*` | 300 / min | every `/api` request |
| `RATE_LIMIT_AI_*` | 20 / min | all `/api/ai/*`, via `requireAiSession` |
| `RATE_LIMIT_WRITE_*` | 30 / min | project create/update |
| `RATE_LIMIT_AUTH_*` | 20 / 10 min | admin login |

Limits are keyed on the **signed-in account** where available, falling back to IP
— an IP-only limit punishes a whole office for one person's mistake. Every
response carries `X-RateLimit-Limit` / `X-RateLimit-Remaining`, and a 429 carries
`Retry-After`, so a client can throttle itself.

Every limit is env-tunable without a redeploy.

### 2.3 No CSRF check

`SameSite: Lax` was the only defence. `sameOriginGuard` adds an `Origin`/`Referer`
check on state-changing methods as defence-in-depth — it costs nothing, needs no
cookie, and survives a subdomain takeover.

Requests with **no** `Origin` and no `Referer` are allowed: those are non-browser
clients (curl, server-to-server, the OAuth redirect chain) that carry no ambient
authority, so blocking them would break the API without adding security.

---

## Phase 3 — operations

### 3.1 `/api/health` always said "ok"

A deployment with no signing key, no AI key and no database still answered
`status: "ok"`, so no alert could ever fire.

It now returns `ok` or `degraded`, plus a `problems` array naming broken
invariants:

```
GET /api/health
{
  "status": "degraded",
  "problems": ["AUTH_SESSION_SECRET_MISSING", "DATABASE_NOT_CONFIGURED"],
  "features": { "signInPossible": false, "adminConfigured": true }
}
```

Names only — never a secret value, never an e-mail address. The HTTP status stays
200 so a load balancer does not restart a working deployment; `degraded` is the
signal to alert on.

---

## Known limitations

**In-memory limits are per-instance.** On Vercel the runtime is stateless and
reuses instances, so the map raises the floor against casual abuse but a
determined attacker with parallel requests can exceed it. This is an honest
trade-off versus requiring Redis before the site can boot. To upgrade, set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and route `rateLimit`
through the store; the in-memory path stays as the fallback so a store outage
cannot take the site down.

**`x-forwarded-for` is trusted.** Correct on Vercel (the platform sets it and the
first value is the real client). Behind another proxy, review it.

**The daily AI cap is still in-memory** (`aiUsage`), so it resets per instance. The
short-window `RATE_LIMIT_AI_*` limit is the effective bound; the daily cap is a
second, longer-horizon layer.

---

## A note on the audit that produced this

The original review listed ten findings. Two did not survive verification:

- **"The plan grant is not bound to the session"** — it was, at both call sites.
  The real gap was that the rule was unnamed and untested.
- **"`dist-server/server.cjs` leaks secrets"** — the directory is gitignored and was
  never committed. Verified with `git check-ignore`.

Everything else was real and is fixed above.

- Outgoing: the parent origin is baked into the injected script and used as the
  explicit target.
- Incoming: `e.source === iframeRef.current.contentWindow`.

`e.origin` is deliberately **not** used on the receiving side. The frame is
sandboxed without `allow-same-origin`, so its origin is the opaque string `"null"`
and an origin comparison would reject every legitimate message.
