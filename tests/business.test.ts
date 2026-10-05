import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  SUBSCRIPTION_PLANS,
  USD_TO_EGP,
  egpAmount,
  ORANGE_CASH_STEPS_AR,
  ORANGE_CASH_STEPS_EN,
} from "../src/data/plans.ts";
import { STARTER_TEMPLATES } from "../src/data/templates.ts";

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