const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getFinancialSummary,
  isValidMoney,
  normalizeAllocations,
  normalizeMoneyText,
  parseMoney,
  stripFinancialFields,
} = require("../financial-core.js");

function state(items, budgetLimit = 100000) {
  return { trip: { budgetLimit, currency: "RUB" }, items };
}

test("safe money parser accepts spaces and decimal separators", () => {
  assert.equal(parseMoney("10 000"), 10000);
  assert.equal(parseMoney("10,000"), 10000);
  assert.equal(parseMoney("10.000"), 10000);
  assert.equal(parseMoney("10,50"), 10.5);
  assert.equal(parseMoney("10.50"), 10.5);
  assert.equal(parseMoney("10 000,50"), 10000.5);
  assert.equal(parseMoney("10,000.50"), 10000.5);
  assert.equal(parseMoney("10.000,50"), 10000.5);
  assert.equal(parseMoney("1,234,567.89"), 1234567.89);
  assert.equal(parseMoney("1.234.567,89"), 1234567.89);
  assert.equal(normalizeMoneyText("1 234,56 ₽"), "1234.56");
});

test("safe money parser exposes ambiguous long fractions as invalid", () => {
  assert.equal(parseMoney("10,0000"), 0);
  assert.equal(parseMoney("10.0000"), 0);
  assert.equal(isValidMoney("10,0000"), false);
  assert.equal(isValidMoney("10.0000"), false);
  assert.equal(isValidMoney(""), true);
  assert.equal(isValidMoney("", { allowEmpty: false }), false);
});

test("safe money parser rejects negative and malformed values", () => {
  assert.equal(parseMoney(-1000), 0);
  assert.equal(parseMoney("-500"), 0);
  assert.equal(parseMoney(null), 0);
  assert.equal(parseMoney(undefined), 0);
  assert.equal(parseMoney(""), 0);
  assert.equal(parseMoney("неизвестно"), 0);
});

test("hidden share payload strips financial fields recursively", () => {
  assert.deepEqual(stripFinancialFields({
    trip: { title: "Trip", budgetLimit: 50000 },
    items: [{ title: "Hotel", price: 20000, paidAmount: 5000, allocations: [{ amount: 20000 }] }],
  }), {
    trip: { title: "Trip" },
    items: [{ title: "Hotel" }],
  });
});

test("partial fixed payment is split into paid and outstanding", () => {
  const summary = getFinancialSummary(state([
    { price: 30000, paidAmount: 10000, status: "fixed" },
  ]));
  assert.deepEqual(summary, {
    budgetLimit: 100000,
    paidTotal: 10000,
    confirmedTotal: 30000,
    confirmedOutstanding: 20000,
    additionalTotal: 0,
    possibleTotal: 30000,
    remainingConfirmed: 70000,
    remainingAll: 70000,
  });
});

test("legacy paid without paidAmount is treated as fully paid", () => {
  const summary = getFinancialSummary(state([
    { price: 20000, status: "paid" },
  ]));
  assert.equal(summary.paidTotal, 20000);
  assert.equal(summary.confirmedTotal, 20000);
  assert.equal(summary.confirmedOutstanding, 0);
});

test("paidAmount is clamped to price", () => {
  const summary = getFinancialSummary(state([
    { price: 10000, paidAmount: 15000, status: "paid" },
    { price: 0, paidAmount: 5000, status: "fixed" },
  ]));
  assert.equal(summary.paidTotal, 10000);
  assert.equal(summary.confirmedTotal, 10000);
  assert.equal(summary.confirmedOutstanding, 0);
});

test("confirmed and additional buckets use the approved statuses", () => {
  const summary = getFinancialSummary(state([
    { price: 20000, paidAmount: 20000, status: "paid" },
    { price: 30000, paidAmount: 10000, status: "fixed" },
    { price: 8000, status: "want" },
    { price: 6000, status: "maybe" },
    { price: 12000, status: "backup" },
    { price: 5000, status: "skipped" },
    { price: 4000 },
    { price: 3000, status: "booked" },
  ]));
  assert.deepEqual(summary, {
    budgetLimit: 100000,
    paidTotal: 30000,
    confirmedTotal: 50000,
    confirmedOutstanding: 20000,
    additionalTotal: 14000,
    possibleTotal: 64000,
    remainingConfirmed: 50000,
    remainingAll: 36000,
  });
});

test("paid amounts on additional plans count as paid without double counting price", () => {
  const summary = getFinancialSummary(state([
    { price: 8000, paidAmount: 2000, status: "want" },
  ]));
  assert.equal(summary.paidTotal, 2000);
  assert.equal(summary.additionalTotal, 8000);
  assert.equal(summary.possibleTotal, 8000);
});

test("negative values are clamped and decimals are rounded to cents", () => {
  const summary = getFinancialSummary(state([
    { price: -1000, paidAmount: -500, status: "fixed" },
    { price: "10,000.505", paidAmount: "1.000,255", status: "fixed" },
  ], -500));
  assert.equal(summary.budgetLimit, 0);
  assert.equal(summary.confirmedTotal, 10000.51);
  assert.equal(summary.paidTotal, 1000.26);
  assert.equal(summary.confirmedOutstanding, 9000.25);
});

test("allocations never duplicate the item price in trip totals", () => {
  const summary = getFinancialSummary(state([
    {
      price: 10000,
      paidAmount: 0,
      status: "fixed",
      allocations: [
        { participantId: "self", amount: 6000 },
        { participantId: "guest", amount: 4000 },
        { participantId: "guest", amount: 4000 },
      ],
    },
  ]));
  assert.equal(summary.confirmedTotal, 10000);
  assert.equal(summary.possibleTotal, 10000);
});

test("allocations remove invalid entries, merge duplicates and fall back to owner", () => {
  assert.deepEqual(normalizeAllocations([
    { participantId: "self", amount: "2 000" },
    { participantId: "guest", amount: "1 000,50" },
    { participantId: "guest", amount: 499.5 },
    { participantId: "missing", amount: 1000 },
    { participantId: "self", amount: -500 },
  ], {
    price: 4000,
    participantIds: ["self", "guest"],
    ownerId: "self",
  }), [
    { participantId: "self", amount: 2000 },
    { participantId: "guest", amount: 1500 },
  ]);
  assert.deepEqual(normalizeAllocations([], {
    price: 4000,
    participantIds: ["self"],
    ownerId: "self",
  }), [{ participantId: "self", amount: 4000 }]);
});

test("UX-02A single-item matrix", async (t) => {
  const cases = [
    ["paid full", { price: 20000, paidAmount: 20000, status: "paid" }, [20000, 20000, 0, 20000]],
    ["fixed partial", { price: 30000, paidAmount: 10000, status: "fixed" }, [10000, 30000, 0, 30000]],
    ["fixed unpaid", { price: 15000, paidAmount: 0, status: "fixed" }, [0, 15000, 0, 15000]],
    ["want", { price: 8000, paidAmount: 0, status: "want" }, [0, 0, 8000, 8000]],
    ["maybe", { price: 6000, paidAmount: 0, status: "maybe" }, [0, 0, 6000, 6000]],
    ["backup", { price: 12000, paidAmount: 0, status: "backup" }, [0, 0, 0, 0]],
    ["skipped", { price: 5000, paidAmount: 0, status: "skipped" }, [0, 0, 0, 0]],
    ["zero", { price: 0, paidAmount: 0, status: "want" }, [0, 0, 0, 0]],
    ["empty", { price: "", paidAmount: "", status: "want" }, [0, 0, 0, 0]],
    ["paid over price", { price: 10000, paidAmount: 15000, status: "paid" }, [10000, 10000, 0, 10000]],
    ["paid without price", { price: 0, paidAmount: 5000, status: "paid" }, [0, 0, 0, 0]],
    ["negative price", { price: -1000, paidAmount: 0, status: "fixed" }, [0, 0, 0, 0]],
    ["negative paid", { price: 1000, paidAmount: -500, status: "fixed" }, [0, 1000, 0, 1000]],
    ["spaced string", { price: "10 000", paidAmount: 0, status: "want" }, [0, 0, 10000, 10000]],
    ["decimal string", { price: "10000.50", paidAmount: 0, status: "want" }, [0, 0, 10000.5, 10000.5]],
    ["missing status", { price: 1000, paidAmount: 0 }, [0, 0, 0, 0]],
    ["unknown status", { price: 1000, paidAmount: 0, status: "booked" }, [0, 0, 0, 0]],
    ["undated", { price: 1000, paidAmount: 0, status: "want", date: "" }, [0, 0, 1000, 1000]],
    ["out of range remains financially unchanged", { price: 1000, paidAmount: 0, status: "fixed", date: "2030-01-01" }, [0, 1000, 0, 1000]],
  ];

  for (const [name, item, expected] of cases) {
    await t.test(name, () => {
      const summary = getFinancialSummary(state([item]));
      assert.deepEqual(
        [summary.paidTotal, summary.confirmedTotal, summary.additionalTotal, summary.possibleTotal],
        expected,
      );
    });
  }
});
