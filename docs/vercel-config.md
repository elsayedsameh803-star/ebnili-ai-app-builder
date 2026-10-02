# vercel.json — why it looks like this

The rationale for this file used to live in `"//rewrites"`, `"//headers"` and
`"//functions"` keys inside `vercel.json` itself. **Vercel rejects those keys** —
`vercel --prod` fails with:

```
Error: Invalid vercel.json - should NOT have additional property `//rewrites`. Please remove it.
```

The schema allows only the documented properties, so every deployment attempt
was aborting before the build even started. JSON has no comment syntax either,
so the reasoning is kept here instead.

## `rewrites` — order matters

Vercel applies the **first** matching rule, and rewrites run **before** the
static file server. Two consequences:

1. The generated SEO pages must sit **above** the SPA fallback. Otherwise
   `/pricing` is answered with the login shell — which is exactly what kept the
   site out of Google, because the crawler received a page with no text.
2. The `/api/:path*` rule must be **first**, so no page rule can swallow a
   backend call.

The legal pages (`/privacy`, `/terms`, `/contact`, `/about`) are rewritten for
the same reason as `/pricing`: the footer links to them by URL, so they must
resolve to a real static document rather than the studio shell.

Trailing-slash duplicates are intentionally absent — Vercel normalises the
request path before matching, so `/pricing` and `/pricing/` resolve to the same
rule.

The final catch-all excludes `/api` (`/((?!api/).*)`) so the serverless
function's own headers and routing survive.

## `headers`

The explicit `/sitemap.xml` and `/robots.txt` rules were **removed**: both files
ship from `dist/` and are served as-is, so rewriting a path onto itself was a
no-op. The `Content-Type` override for `robots.txt` went too — Vercel already
sends `text/plain` for `.txt`.

`Cross-Origin-Opener-Policy` was **dropped**: it only makes sense alongside
`Cross-Origin-Embedder-Policy`, and a lone COOP can break the OAuth popup flow.

The catch-all deliberately **excludes `/api`** so the function's own headers
survive.

## `functions`

`maxDuration: 60` is the hard ceiling on the Hobby plan. Pro and Enterprise
allow more, and declaring a value **above the plan limit fails the deployment at
build time** rather than warning. The AI routes stream one Gemini response and
finish well inside that window. Raise this only after upgrading the plan.
