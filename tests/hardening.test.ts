/**
 * Production-hardening contract tests (Phases 1–12).
 *
 * Each test pins a fix so a regression fails HERE rather than in production:
 *  - Phase 1: account lookup must use the real `email` column (never a phantom
 *    `account_email` filter that 400s every lookup and downgrades paid users).
 *  - Phase 4: server key sources must never include a `VITE_*` variable.
 *  - Phase 3: payment approval writes must be conditional (atomic single win).
 *  - Phase 6: export file names must be Zip-Slip safe and size-capped.
 *  - Phase 8: advertised Business features must be honest about availability.
 */
import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { readFileSync } from "node:fs";
import { shellToken, safeRepoSlug } from "../src/lib/commands.ts";
import { SUBSCRIPTION_PLANS } from "../src/data/plans.ts";

const API_SRC = readFileSync(new URL("../api/index.ts", import.meta.url), "utf8");
const SERVER_SRC = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

/** Extract a single top-level function body (ends at the first column-0 `}`). */
function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `signature not found: ${signature}`);
  const end = src.indexOf("\n}\n", start);
  assert.ok(end > start, `unterminated function: ${signature}`);
  return src.slice(start, end + 3);
}

describe("phase 1 — account lookup uses the real schema column", () => {
  test("lookupAccountByEmail filters on `email`, never `account_email`", () => {
    const fn = fnBody(API_SRC, "async function lookupAccountByEmail");
    assert.ok(!fn.includes("account_email"), "accounts table has no account_email column");
    assert.ok(fn.includes("email: `eq."), "filter must be on the email column");
  });

  test("lookup distinguishes db_error from not_found", () => {
    const fn = fnBody(API_SRC, "async function lookupAccountByEmail");
    assert.ok(fn.includes('reason: "db_error"'), "DB failure must be typed db_error");
    assert.ok(fn.includes('reason: "not_found"'), "missing account must be typed not_found");
  });
});

describe("phase 4 — no VITE_* secret source on the server", () => {
  test("api/index.ts getApiKeys never reads process.env.VITE_*", () => {
    const fn = fnBody(API_SRC, "function getApiKeys");
    assert.ok(!/process\.env\.VITE_/.test(fn), "VITE_* is public bundle content, never a server secret");
  });

  test("server.ts getGeminiApiKey never reads process.env.VITE_*", () => {
    const fn = fnBody(SERVER_SRC, "function getGeminiApiKey");
    assert.ok(!/process\.env\.VITE_/.test(fn), "VITE_* is public bundle content, never a server secret");
  });
});

describe("phase 3 — payment approval is a conditional (atomic) write", () => {
  test("update-status PATCH filters on status=eq.pending", () => {
    const start = API_SRC.indexOf('app.post("/api/admin/transaction/update-status"');
    assert.ok(start >= 0, "update-status route must exist");
    const block = API_SRC.slice(start, start + 9000);
    assert.ok(block.includes('status: "eq.pending"'), "the write must only match pending rows");
    assert.ok(block.includes("409"), "the race loser must answer 409, not success");
  });
});

describe("phase 6 — export sanitisation", () => {
  test("server export drops absolute paths and caps size", () => {
    const start = API_SRC.indexOf('app.post("/api/projects/export"');
    assert.ok(start >= 0, "export route must exist");
    const block = API_SRC.slice(start, start + 4000);
    assert.ok(block.includes('startsWith("/")'), "absolute paths must be dropped");
    assert.ok(block.includes("EXPORT_TOO_LARGE"), "oversized exports must be refused");
    assert.ok(block.includes("EXPORT_TOO_MANY_FILES"), "entry count must be capped");
  });

  test("shellToken refuses traversal and flag-like names", () => {
    assert.equal(shellToken("../evil"), "my-app");
    assert.equal(shellToken("-rf"), "my-app");
    assert.equal(shellToken("my-app"), "my-app");
  });

  test("safeRepoSlug accepts owner/repo and rejects URLs with traversal", () => {
    assert.equal(safeRepoSlug("octo/app"), "octo/app");
    assert.equal(safeRepoSlug("../../etc"), null);
  });
});

describe("phase 8 — advertised features are honest", () => {
  test("business plan marks unshipped features as coming soon", () => {
    const biz = SUBSCRIPTION_PLANS.find((p) => p.id === "business");
    assert.ok(biz, "business plan must exist");
    const text = [...biz.featuresEn, ...biz.featuresAr].join("\n").toLowerCase();
    assert.ok(text.includes("custom-domain") || text.includes("نطاق مخصص"), "custom domain must be mentioned");
    assert.ok(text.includes("coming soon") || text.includes("قريباً"), "unshipped items must say coming soon");
  });

  test("free plan states preview-only limits", () => {
    const free = SUBSCRIPTION_PLANS.find((p) => p.id === "free");
    assert.ok(free, "free plan must exist");
    const text = [...free.featuresEn].join("\n").toLowerCase();
    assert.ok(text.includes("no code export") || text.includes("no publishing"), "free limits must be explicit");
  });
});
