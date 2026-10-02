/**
 * DIAGNOSTIC ONLY — not part of the app, not part of the test suite.
 *
 * WHY: production answers `500 FUNCTION_INVOCATION_FAILED` on every `/api/*`
 * route. The static pages are served by Vercel's file server and work fine, so
 * the failure is invisible from outside — and it is almost certainly why the
 * sign-in screen claims the OAuth keys are missing: `fetchAuthProviders()`
 * swallows every failure and returns [], so a dead server is indistinguishable
 * from unconfigured keys.
 *
 * This walks the failure in order, printing the real error instead of a 500:
 *   1. can each bare import resolve?  (an ESM named-export miss throws at LOAD)
 *   2. does the API module itself load?
 *   3. does it answer a request once mounted?
 *
 * RUN: node scripts/diagnose-api.mjs
 */
import express from "express";

const line = (s) => console.log(`\n=== ${s} ===`);

// ── 1. Bare imports ───────────────────────────────────────────────────────────
line("1. import express");
try {
  await import("express");
  console.log("OK");
} catch (e) {
  console.log("FAIL:", e.message);
}

line("2. import @google/genai  (named export ThinkingLevel)");
try {
  const m = await import("@google/genai");
  console.log("module loaded.");
  console.log("  typeof GoogleGenAI   =", typeof m.GoogleGenAI);
  console.log("  typeof ThinkingLevel =", typeof m.ThinkingLevel);
  if (typeof m.ThinkingLevel === "undefined") {
    console.log("  >>> ThinkingLevel is NOT exported. A named import of it throws");
    console.log("  >>> SyntaxError at module load — the classic cause of");
    console.log("  >>> FUNCTION_INVOCATION_FAILED, and it would affect EVERY route.");
  } else {
    console.log("  value =", JSON.stringify(m.ThinkingLevel));
  }
} catch (e) {
  console.log("FAIL:", e.message);
  console.log(e.stack?.split("\n").slice(0, 4).join("\n"));
}

line("3. import node:crypto");
try {
  await import("node:crypto");
  console.log("OK");
} catch (e) {
  console.log("FAIL:", e.message);
}

// ── 2. The API module ─────────────────────────────────────────────────────────
line("4. load api/index.ts and answer /api/health");
try {
  const mod = await import("../api/index.ts");
  const app = mod.mountApi();
  const server = app.listen(0, async () => {
    const { port } = server.address();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      console.log("status:", res.status);
      console.log((await res.text()).slice(0, 900));
    } catch (e) {
      console.log("request failed:", e.message);
    } finally {
      server.close();
    }
  });
  server.on("error", (e) => {
    console.log("listen failed:", e.message);
    process.exit(1);
  });
} catch (e) {
  console.log("LOAD FAIL:", e.message);
  console.log(e.stack?.split("\n").slice(0, 8).join("\n"));
}

// Keep the process alive long enough for the async walk above.
setTimeout(() => {
  line("done");
  process.exit(0);
}, 4000);
