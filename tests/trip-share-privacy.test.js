const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { getFinancialSummary } = require("../financial-core.js");

async function loadPrivacyModule() {
  return import(pathToFileURL(path.join(__dirname, "../supabase/functions/trip-share/privacy.mjs")));
}

test("hidden-budget payload removes every financial field recursively", async () => {
  const { stripBudget } = await loadPrivacyModule();
  const hidden = stripBudget({
    trip: { title: "Legacy trip", budgetLimit: 50000, currency: "RUB" },
    items: [{
      title: "Hotel",
      price: 20000,
      paidAmount: 10000,
      allocations: [{ participantId: "self", amount: 20000 }],
    }],
  });
  assert.deepEqual(hidden, {
    trip: { title: "Legacy trip", currency: "RUB" },
    items: [{ title: "Hotel" }],
  });
});

test("received trip card omits budgetLimit when budget is hidden", async () => {
  const { getVisibleBudgetFields } = await loadPrivacyModule();
  assert.deepEqual(getVisibleBudgetFields({ budgetLimit: 50000 }, false), {});
  assert.deepEqual(getVisibleBudgetFields({ budgetLimit: 50000 }, true), { budgetLimit: 50000 });
});

test("old read-only snapshot uses legacy-compatible paid totals when budget is open", () => {
  const summary = getFinancialSummary({
    trip: { budgetLimit: 50000, currency: "RUB" },
    items: [
      { status: "paid", price: 20000 },
      { status: "fixed", price: 15000, paidAmount: 5000 },
      { status: "want", price: 3000 },
    ],
  });
  assert.deepEqual(summary, {
    budgetLimit: 50000,
    paidTotal: 25000,
    confirmedTotal: 35000,
    confirmedOutstanding: 10000,
    additionalTotal: 3000,
    possibleTotal: 38000,
    remainingConfirmed: 15000,
    remainingAll: 12000,
  });
});

test("old hidden read-only snapshot is stripped before financial rendering", async () => {
  const { stripBudget } = await loadPrivacyModule();
  const hiddenState = stripBudget({
    trip: { budgetLimit: 50000, currency: "RUB" },
    items: [{ status: "paid", price: 20000, paidAmount: 20000 }],
  });
  assert.deepEqual(getFinancialSummary(hiddenState), {
    budgetLimit: 0,
    paidTotal: 0,
    confirmedTotal: 0,
    confirmedOutstanding: 0,
    additionalTotal: 0,
    possibleTotal: 0,
    remainingConfirmed: 0,
    remainingAll: 0,
  });
});
