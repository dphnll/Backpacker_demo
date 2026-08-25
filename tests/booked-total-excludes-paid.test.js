const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { getFinancialSummary } = require("../financial-core.js");

const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

const MONEY_CALL = /format(?:Budget|Export)?Money\(\s*totals\.([a-zA-Z]+)\s*\)/g;

// Lines that both carry the «Бронь» label and format a number out of `totals`.
// The status-label maps (["fixed", "Бронь"]) carry no money and are not sites.
function bookedRenderSites() {
  return appSource
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => (
      line.includes("Бронь")
      || line.includes('window.t("budget.metric.booked")')
      || line.includes('window.t("share.text.budget.booked",')
      || line.includes('exportT("financial.booked")')
    ) && /format(?:Budget|Export)?Money\(/.test(line));
}

test("the trip header, the budget screen, the estimate and the PDF all render Бронь as outstanding", () => {
  const sites = bookedRenderSites();
  // The localized budget screen, the copied estimate and two PDF sites. If a new one appears,
  // this count is meant to fail so the new site gets checked too.
  assert.equal(sites.length, 4, `expected four Бронь money sites, found ${sites.length}`);

  sites.forEach(({ line, number }) => {
    const fields = [...line.matchAll(MONEY_CALL)].map((match) => match[1]);
    assert.ok(
      fields.includes("confirmedOutstanding"),
      `app.js:${number} renders Бронь from ${fields.join(", ") || "no totals field"}; ` +
        "Бронь is what is booked and not yet paid, so it must come from confirmedOutstanding",
    );
    assert.ok(
      !fields.includes("confirmedTotal"),
      `app.js:${number} renders Бронь from confirmedTotal, which still contains the paid items ` +
        "and therefore counts them twice",
    );
  });
});

test("the Бронь tile in the trip header is filled from outstanding, not from the confirmed total", () => {
  // The label lives in index.html next to the element, the number is assigned in app.js.
  const labelStart = htmlSource.lastIndexOf('data-i18n="plan.budget.booked"');
  assert.notEqual(labelStart, -1, "the localized Бронь label must remain bound to plan.budget.booked");
  const labelBlock = htmlSource.slice(labelStart, htmlSource.indexOf("</strong>", labelStart));
  assert.match(labelBlock, /id="plannedTotal"/, "the Бронь tile must still be #plannedTotal");

  const assignment = appSource
    .split("\n")
    .find((line) => line.includes('$("#plannedTotal").textContent'));
  assert.ok(assignment, "#plannedTotal must be assigned in app.js");
  assert.match(
    assignment,
    /totals\.confirmedOutstanding/,
    "the Бронь tile counted paid items as booked, so a paid ticket showed up in both tiles",
  );
});

test("a paid item leaves the booked total entirely", () => {
  const summary = getFinancialSummary({
    trip: { budgetLimit: 30000 },
    items: [
      { status: "paid", price: 7155.4, paidAmount: 0 },
      { status: "fixed", price: 2000, paidAmount: 0 },
    ],
  });

  assert.equal(summary.paidTotal, 7155.4);
  assert.equal(summary.confirmedOutstanding, 2000, "only the unpaid booking is still outstanding");
});

test("paid, booked and free add up to the budget", () => {
  // The three tiles of the trip header partition the budget. They stopped doing so once
  // the middle one started reading the confirmed total.
  const summary = getFinancialSummary({
    trip: { budgetLimit: 30000 },
    items: [
      { status: "paid", price: 7155.4, paidAmount: 0 },
      { status: "fixed", price: 2000, paidAmount: 500 },
    ],
  });

  const shown = summary.paidTotal + summary.confirmedOutstanding + summary.remainingConfirmed;
  assert.equal(Math.round(shown * 100) / 100, 30000);
});
