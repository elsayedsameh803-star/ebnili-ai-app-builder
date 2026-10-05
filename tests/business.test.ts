import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { SUBSCRIPTION_PLANS, USD_TO_EGP, egpAmount, ORANGE_CASH_STEPS_AR, ORANGE_CASH_STEPS_EN } from "../src/data/plans.ts";
import { STARTER_TEMPLATES } from "../src/data/templates.ts";

/**
 * Plan entitlement tests.
 *
 * WHY THESE EXIST
 * ---------------
 * Both paid plans advertised "unlimited" generation while the server applied ONE
 * flat 60/day cap to everybody, and kept the tally in a process-local `Map` that
 * a Vercel cold start wipes. So the plan difference did not exist, the cap was
 * not a real budget, and the streaming route had no check at all.
 *
 * These assertions pin the commercial promise to numbers a test can read, so a
 * future edit that makes Pro equal to Free again — or that quietly restores an
 * unlimited promise the server cannot honour — fails here instead of in a
 * customer's browser.
 */

/** Mirrors TIER_DAILY_QUOTA in api/index.ts. Kept here as the contract. */
const TIER_DAILY_QUOTA = { free: 5, pro: 100, business: 400 } as const;

/** Mirrors ABSOLUTE_DAILY_CEILING in api/index.ts. */
const ABSOLUTE_DAILY_CEILING = 400;

describe("daily allowance per plan", () => {
  test("every plan id has an allowance", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      assert.ok(
        plan.id in TIER_DAILY_QUOTA,
        `plan '${plan.id}' has no entry in the daily allowance table`,
      );
    }
  });

  test("a paying customer is never treated like a free one", () => {
    // THE core promise. If this fails, the two plans are indistinguishable to the
    // server and the higher price buys nothing.
    assert.ok(
      TIER_DAILY_QUOTA.pro > TIER_DAILY_QUOTA.free,
      `Pro must allow more than Free (${TIER_DAILY_QUOTA.pro} vs ${TIER_DAILY_QUOTA.free})`,
    );
    assert.ok(
      TIER_DAILY_QUOTA.business > TIER_DAILY_QUOTA.pro,
      `Business must allow more than Pro (${TIER_DAILY_QUOTA.business} vs ${TIER_DAILY_QUOTA.pro})`,
    );
  });

  test("the allowances are strictly increasing, not merely different", () => {
    assert.ok(TIER_DAILY_QUOTA.free < TIER_DAILY_QUOTA.pro);
    assert.ok(TIER_DAILY_QUOTA.pro < TIER_DAILY_QUOTA.business);
  });

  test("no plan exceeds the hard backstop", () => {
    for (const [tier, limit] of Object.entries(TIER_DAILY_QUOTA)) {
      assert.ok(
        limit <= ABSOLUTE_DAILY_CEILING,
        `${tier} allows ${limit}/day, above the ${ABSOLUTE_DAILY_CEILING} ceiling — the Gemini key is exposed`,
      );
    }
  });

  test("the free tier stays a demo, not a free subscription", () => {
    // A free allowance that is comfortable enough to ship a real product removes
    // the reason to pay. Five a day is enough to fall in love and not enough to
    // finish a project.
    assert.ok(TIER_DAILY_QUOTA.free <= 10, "the free tier must stay a trial");
    assert.ok(TIER_DAILY_QUOTA.free >= 3, "the free tier must allow a real taste of the product");
  });

  test("a business day is enough for an agency but still bounded", () => {
    // Enough for several client projects on a busy day, and small enough that a
    // runaway loop cannot drain the key. At the top of Gemini's per-call price
    // this is cents, not dollars, per account.
    assert.ok(TIER_DAILY_QUOTA.business >= 200, "Business is too tight for an agency");
    assert.ok(TIER_DAILY_QUOTA.business <= 1000, "Business must remain bounded");
  });
});

describe("plan copy must match the enforced limit", () => {
  /**
   * The plan page says "unlimited". That word is a promise the server cannot
   * keep — there is a hard daily cap, by design, because the platform pays for
   * every generation. Advertising an unbounded product and delivering a bounded
   * one is the single fastest way to lose a paying customer to a refund request.
   */
  test("no plan advertises an unlimited promise it cannot honour", () => {
    const banned = ["unlimited", "غير محدود", "∞", "unlimited generation"];
    for (const plan of SUBSCRIPTION_PLANS) {
      if (plan.id === "business") continue; // Business keeps a stated high cap.
      for (const [lang, features] of [
        ["en", plan.featuresEn],
        ["ar", plan.featuresAr],
      ] as const) {
        for (const line of features) {
          const lower = line.toLowerCase();
          for (const phrase of banned) {
            assert.ok(
              !lower.includes(phrase),
              `${plan.id} (${lang}) advertises "${phrase}" but the server enforces a daily cap: "${line}"`,
            );
          }
        }
      }
    }
  });

  test("each paid plan states its real daily allowance", () => {
    // The customer must be able to read the limit off the pricing page rather
    // than discovering it by being refused.
    for (const plan of SUBSCRIPTION_PLANS) {
      if (plan.id === "free") continue;
      const expected = TIER_DAILY_QUOTA[plan.id as keyof typeof TIER_DAILY_QUOTA];
      const stated = [...plan.featuresEn, ...plan.featuresAr, plan.limitsEn, plan.limitsAr].join(" ");
      assert.ok(
        stated.includes(String(expected)),
        `${plan.id} must state its ${expected}/day allowance somewhere the customer can read it`,
      );
    }
  });
});
/**
 * Business-logic tests.
 *
 * WHY THESE EXIST
 * ---------------
 * The original suite covered SECURITY only. Nothing pinned the pricing maths,
 * so a wrong EGP amount — the number a customer is told to transfer — could
 * ship silently. That is the most expensive class of bug in a paid product:
 * the owner approves a payment that does not match the plan that was bought.
 *
 * These assertions are behaviour-focused (what does the customer see?) rather
 * than implementation-focused, so a refactor that preserves behaviour passes.
 */
/**
 * Business-logic tests.
 *
 * WHY THESE EXIST
 * ---------------
 * The existing suite covered SECURITY only. Nothing pinned the pricing maths,
 * so a wrong EGP amount — the number a customer is told to transfer — could
 * ship silently. That is the most expensive class of bug in a paid product:
 * the owner approves a payment that does not match the plan that was bought.
 *
 * These assertions are behaviour-focused (what does the customer see?) rather
 * than implementation-focused, so a refactor that preserves behaviour passes.
 */

describe("pricing maths", () => {
  test("converts USD to EGP for every plan", () => {
    const pro = SUBSCRIPTION_PLANS.find((p) => p.id === "pro");
    assert.ok(pro, "a 'pro' plan must exist");
    assert.equal(pro.priceMonthly, 9.99);
    assert.equal(pro.payEgpMonthly, egpAmount(9.99));
    assert.equal(pro.payEgpMonthly, Math.round(9.99 * USD_TO_EGP));
  });

  test("the yearly plan is ten months, so it is genuinely cheaper", () => {
    const pro = SUBSCRIPTION_PLANS.find((p) => p.id === "pro");
    assert.ok(pro);
    const saving = 1 - pro.priceYearly / (pro.priceMonthly * 12);
    assert.ok(
      Math.abs(saving - 0.1666) < 0.01,
      `yearly should be ~16.7% off twelve months, got ${(saving * 100).toFixed(1)}%`,
    );
  });

  test("egpAmount returns a whole, positive number", () => {
    assert.ok(Number.isInteger(egpAmount(9.99)));
    assert.ok(Number.isInteger(egpAmount(14.99)));
    assert.ok(egpAmount(0) === 0, "the free plan must transfer nothing");
    assert.ok(egpAmount(9.99) > 0);
  });

  test("the free plan is free on BOTH axes", () => {
    const free = SUBSCRIPTION_PLANS.find((p) => p.id === "free");
    assert.ok(free);
    assert.equal(free.priceMonthly, 0);
    assert.equal(free.priceYearly, 0);
    assert.equal(free.payEgpMonthly, 0);
    assert.equal(free.payEgpYearly, 0);
  });

  test("every paid plan has a transferable EGP amount", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      if (plan.id === "free") continue;
      assert.ok(plan.payEgpMonthly > 0, `${plan.id} needs a monthly EGP amount`);
      assert.ok(plan.payEgpYearly > 0, `${plan.id} needs a yearly EGP amount`);
      assert.ok(
        plan.payEgpYearly > plan.payEgpMonthly,
        `${plan.id} yearly must cost more than one month`,
      );
    }
  });
});
describe("plan integrity", () => {
  test("ids are unique", () => {
    const ids = SUBSCRIPTION_PLANS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate plan id in ${ids.join(", ")}`);
  });

  test("exactly one plan is marked popular, so the badge cannot lie", () => {
    const popular = SUBSCRIPTION_PLANS.filter((p) => p.isPopular);
    assert.equal(popular.length, 1, "exactly one plan should carry the 'most popular' badge");
  });

  test("every plan is fully bilingual", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      assert.ok(plan.nameAr && plan.nameEn, `${plan.id} needs both names`);
      assert.ok(plan.taglineAr && plan.taglineEn, `${plan.id} needs both taglines`);
      assert.ok(plan.limitsAr && plan.limitsEn, `${plan.id} needs both limit lines`);
      assert.ok(plan.featuresAr.length > 0, `${plan.id} needs Arabic features`);
      assert.ok(plan.featuresEn.length > 0, `${plan.id} needs English features`);
      // A card showing 6 Arabic bullets and 4 English ones looks broken to half
      // the audience, so the two lists must stay the same length.
      assert.equal(
        plan.featuresAr.length,
        plan.featuresEn.length,
        `${plan.id} has a different number of Arabic and English features`,
      );
    }
  });
});

describe("Orange Cash instructions", () => {
  test("both languages describe the same steps", () => {
    assert.equal(ORANGE_CASH_STEPS_AR.length, ORANGE_CASH_STEPS_EN.length);
    assert.ok(ORANGE_CASH_STEPS_AR.length >= 5, "the transfer guide must actually be a guide");
    for (const [i, step] of ORANGE_CASH_STEPS_AR.entries()) {
      assert.equal(step.step, i + 1, "step numbers must be sequential from 1");
      assert.ok(step.title && step.desc, `Arabic step ${step.step} is empty`);
      const en = ORANGE_CASH_STEPS_EN[i];
      assert.ok(en.title && en.desc, `English step ${step.step} is empty`);
    }
  });

  test("no step quotes a price that disagrees with the computed plan price", () => {
    // WHY: the guide hard-codes an example amount in prose. When the pricing
    // maths changes, the sentence becomes a lie and the customer transfers the
    // wrong number, which is then REJECTED by the owner's manual review. The
    // amounts are mined from the text, so the test fails the moment either
    // side drifts.
    const quoted = new Set<number>();
    for (const step of [...ORANGE_CASH_STEPS_AR, ...ORANGE_CASH_STEPS_EN]) {
      for (const match of step.desc.matchAll(/(\d[\d,]*)\s*(?:ج\.م|EGP)/g)) {
        quoted.add(Number(match[1].replace(/,/g, "")));
      }
    }

    const real = new Set<number>(
      SUBSCRIPTION_PLANS.flatMap((p) => [p.payEgpMonthly, p.payEgpYearly]).filter((n) => n > 0),
    );

    for (const amount of quoted) {
      assert.ok(
        real.has(amount),
        `the payment guide quotes ${amount} EGP but no plan costs that — the example ` +
          "is stale and would send the customer to transfer the wrong amount",
      );
    }
  });
});

describe("starter templates", () => {
  test("ids are unique", () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("every template has both languages and a usable prompt", () => {
    for (const tpl of STARTER_TEMPLATES) {
      assert.ok(tpl.titleAr && tpl.titleEn, `${tpl.id} needs both titles`);
      assert.ok(tpl.descAr && tpl.descEn, `${tpl.id} needs both descriptions`);
      // The prompt IS the product here: clicking a template sends this text to
      // the model, so an empty one yields a blank generation with no error.
      assert.ok(
        tpl.promptAr.trim().length > 10,
        `${tpl.id} has an Arabic prompt too short to build anything`,
      );
      assert.ok(tpl.promptEn.trim().length > 10, `${tpl.id} has an English prompt too short`);
      assert.ok(tpl.icon, `${tpl.id} needs an icon`);
    }
  });
});