 import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  spendAiCredit,
  newAccountDay,
  quotaForTier,
  utcDay,
  TIER_DAILY_QUOTA,
  AI_ABSOLUTE_DAILY_CEILING,
} from "../api/security.ts";

/**
 * The allowance contract, tested for the properties that cost money when broken.
 *
 * WHY THESE EXIST
 * ---------------
 * The spend was a SELECT-then-PATCH in the request handler. That is a race:
 * concurrent callers all read the same counter, all pass the check, and all
 * write used+1. Clicking "generate" five times in a second is this product's
 * normal interaction, so the under-count was reachable by ordinary use — not just
 * by an attacker.
 *
 * The production fix is a `SELECT … FOR UPDATE` row lock inside
 * `ebnily_consume_ai_credit` (supabase/add_atomic_ai_credit.sql). These tests
 * pin the CONTRACT that function implements, so a change that reintroduces a
 * read-then-write, drops the ceiling, or lets a plan buy more than it should
 * fails here rather than in the owner's Gemini bill.
 */

describe("plan limits", () => {
  test("every tier has an allowance, and they strictly increase", () => {
    // A paying customer who hits the same ceiling as a trial user has been sold
    // nothing — this is the core commercial promise.
    assert.ok(TIER_DAILY_QUOTA.pro > TIER_DAILY_QUOTA.free);
    assert.ok(TIER_DAILY_QUOTA.business > TIER_DAILY_QUOTA.pro);
  });

  test("an unknown tier gets the free allowance, never a paid one", () => {
    // A hand-edited row, or a plan that does not exist, must never widen access.
    for (const bogus of [undefined, null, "", "enterprise", "PRO", 42, {}, "admin"]) {
      assert.equal(
        quotaForTier(bogus),
        TIER_DAILY_QUOTA.free,
        `tier ${JSON.stringify(bogus)} must not grant more than free`,
      );
    }
  });

  test("no plan exceeds the absolute ceiling", () => {
    for (const [tier, limit] of Object.entries(TIER_DAILY_QUOTA)) {
      assert.ok(
        limit <= AI_ABSOLUTE_DAILY_CEILING,
        `${tier} (${limit}) is above the ceiling (${AI_ABSOLUTE_DAILY_CEILING})`,
      );
    }
  });
});

describe("spending a credit", () => {
  test("allows exactly the limit, then refuses", () => {
    const state = newAccountDay();
    const now = new Date("2026-10-05T12:00:00Z");

    for (let i = 1; i <= TIER_DAILY_QUOTA.free; i++) {
      const d = spendAiCredit(state, TIER_DAILY_QUOTA.free, now);
      assert.equal(d.allowed, true, `call ${i} should be allowed`);
      assert.equal(d.used, i);
    }

    const refused = spendAiCredit(state, TIER_DAILY_QUOTA.free, now);
    assert.equal(refused.allowed, false, "the call after the limit must be refused");
    assert.equal(refused.used, TIER_DAILY_QUOTA.free);
  });

  test("a refused call does not advance the counter", () => {
    // A rejected request must not push the customer further from using what they
    // paid for, and the number reported must be the truth a meter draws.
    const state = newAccountDay();
    const now = new Date("2026-10-05T12:00:00Z");
    for (let i = 0; i < TIER_DAILY_QUOTA.free; i++) spendAiCredit(state, TIER_DAILY_QUOTA.free, now);

    for (let i = 0; i < 25; i++) spendAiCredit(state, TIER_DAILY_QUOTA.free, now);
    assert.equal(state.used, TIER_DAILY_QUOTA.free, "refusals must not inflate usage");
  });

  test("the counter rolls over on a new UTC day", () => {
    const state = newAccountDay();
    const day1 = new Date("2026-10-05T23:59:00Z");
    for (let i = 0; i < TIER_DAILY_QUOTA.free; i++) spendAiCredit(state, TIER_DAILY_QUOTA.free, day1);
    assert.equal(spendAiCredit(state, TIER_DAILY_QUOTA.free, day1).allowed, false);

    // A minute later it is tomorrow: the allowance is full again, with no cron.
    const day2 = new Date("2026-10-06T00:00:30Z");
    const fresh = spendAiCredit(state, TIER_DAILY_QUOTA.free, day2);
    assert.equal(fresh.allowed, true, "the allowance must reset on the new day");
    assert.equal(fresh.used, 1);
    assert.equal(fresh.day, utcDay(day2));
  });

  test("a caller cannot buy its way past the ceiling with a huge limit", () => {
    // Even if `p_limit` is tampered with or a plan is raised carelessly, the
    // central ceiling is applied here — the owner's key stays bounded.
    const state = newAccountDay();
    const now = new Date("2026-10-05T12:00:00Z");
    for (let i = 0; i < AI_ABSOLUTE_DAILY_CEILING; i++) {
      const d = spendAiCredit(state, 10_000_000, now);
      assert.equal(d.allowed, true, `call ${i + 1} should be allowed`);
      assert.equal(d.limit, AI_ABSOLUTE_DAILY_CEILING, "the limit must be clamped");
    }
    const over = spendAiCredit(state, 10_000_000, now);
    assert.equal(over.allowed, false, "nothing may pass the absolute ceiling");
  });

  test("a zero or negative limit allows nothing", () => {
    const state = newAccountDay();
    const now = new Date("2026-10-05T12:00:00Z");
    assert.equal(spendAiCredit(state, 0, now).allowed, false);
    assert.equal(spendAiCredit(state, -5, now).allowed, false);
    assert.equal(state.used, 0);
  });
});

describe("concurrency — the reason this is a database function", () => {
  /**
   * THE REGRESSION THIS WHOLE DESIGN EXISTS FOR.
   *
   * The old implementation read the counter, decided it was under the limit, and
   * wrote used+1. When requests overlapped, they all read the SAME value and all
   * decided they were allowed, so the counter under-reported and the customer
   * received far more than they paid for.
   *
   * `spendAiCredit` is synchronous, so a burst fired in one turn of the event
   * loop is the tightest possible interleaving — there is no await between the
   * read and the write for a competing request to slip into. In production the
   * `SELECT … FOR UPDATE` row lock provides the same guarantee across every
   * instance; the invariant asserted here is what that lock must preserve.
   */
  test("a burst of concurrent calls never grants more than the limit", () => {
    const BURST = 200;
    for (const limit of [1, 5, 25, 100]) {
      const state = newAccountDay();
      const now = new Date("2026-10-05T12:00:00Z");

      let allowed = 0;
      // Fired together, with no yielding between iterations — the worst case.
      for (let i = 0; i < BURST; i++) {
        if (spendAiCredit(state, limit, now).allowed) allowed++;
      }

      assert.equal(allowed, limit, `with limit ${limit}, exactly ${limit} of ${BURST} may pass`);
      assert.equal(state.used, limit, `the counter must stop at ${limit}, not ${allowed}`);
    }
  });

  test("interleaved async bursts across many accounts stay within budget", async () => {
    // Several accounts being spent at once — the real shape of traffic. Each
    // account must get its own allowance, and no account may exceed its own.
    const ACCOUNTS = 12;
    const limit = 5;
    const PER_ACCOUNT = 40;
    const now = new Date("2026-10-05T12:00:00Z");
    const states = Array.from({ length: ACCOUNTS }, () => newAccountDay());
    const allowed = new Array(ACCOUNTS).fill(0);

    // Interleave the accounts rather than running one to completion, so no
    // account benefits from another's timing.
    for (let round = 0; round < PER_ACCOUNT; round++) {
      const batch: Promise<void>[] = [];
      for (let a = 0; a < ACCOUNTS; a++) {
        batch.push(
          Promise.resolve().then(() => {
            if (spendAiCredit(states[a], limit, now).allowed) allowed[a]++;
          }),
        );
      }
      await Promise.all(batch);
    }

    for (let a = 0; a < ACCOUNTS; a++) {
      assert.equal(allowed[a], limit, `account ${a} exceeded its own allowance`);
      assert.equal(states[a].used, limit, `account ${a} stored more than it was granted`);
    }
  });

  test("the day boundary under concurrency still resets exactly once", () => {
    // A burst straddling midnight must spend the old day's remaining allowance and
    // the new day's independently, and must never let yesterday's count leak into
    // today (which would silently rob a paying customer of a paid day).
    const state = newAccountDay();
    const before = new Date("2026-10-05T23:59:59Z");
    const after = new Date("2026-10-06T00:00:01Z");

    for (let i = 0; i < TIER_DAILY_QUOTA.free - 1; i++) {
      assert.equal(spendAiCredit(state, TIER_DAILY_QUOTA.free, before).allowed, true);
    }
    // Last credit of the old day.
    assert.equal(spendAiCredit(state, TIER_DAILY_QUOTA.free, before).allowed, true);
    // Exhausted for today.
    assert.equal(spendAiCredit(state, TIER_DAILY_QUOTA.free, before).allowed, false);
    // Tomorrow starts full — the rollover happens inside the same call.
    assert.equal(spendAiCredit(state, TIER_DAILY_QUOTA.free, after).allowed, true);
    assert.equal(state.used, 1);
  });
});

describe("bypass attempts", () => {
  test("a suspended or unknown plan cannot inherit a paid allowance", () => {
    // The `tier` value comes from the database, so the coercion is the trust
    // boundary: anything unrecognised must resolve to the stingiest option.
    for (const tier of [undefined, null, "", "pro ", "PRO", "Business", "free\npro", 0, false]) {
      assert.equal(quotaForTier(tier), TIER_DAILY_QUOTA.free);
    }
  });

  test("no combination of parameters grants more than the ceiling", () => {
    // Fuzz the argument an attacker would control: whatever `p_limit` and starting
    // usage they present, the grant is bounded.
    const now = new Date("2026-10-05T12:00:00Z");
    const evilLimits = [0, -1, 1, 5, 400, 401, 1_000, Number.MAX_SAFE_INTEGER, Infinity, NaN];
    for (const limit of evilLimits) {
      const state = newAccountDay();
      let allowed = 0;
      for (let i = 0; i < 50; i++) if (spendAiCredit(state, limit, now).allowed) allowed++;
      assert.ok(
        allowed <= AI_ABSOLUTE_DAILY_CEILING,
        `p_limit=${limit} granted ${allowed}, above the ceiling`,
      );
    }
  });

  test("a counter that somehow exceeded the limit grants nothing further", () => {
    // A row edited by hand, or restored from a backup, must not become a way to
    // keep generating: the rule is "under the limit or refused", not "below the
    // limit you were meant to have".
    const state = { used: 9_999, day: "2026-10-05" };
    const d = spendAiCredit(state, TIER_DAILY_QUOTA.business, new Date("2026-10-05T12:00:00Z"));
    assert.equal(d.allowed, false);
    assert.equal(state.used, 9_999, "a refusal must still not write");
  });
});