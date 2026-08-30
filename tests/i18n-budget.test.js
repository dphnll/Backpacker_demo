const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { LOCALE_STORAGE_KEY, createI18n } = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const app = read("app.js");
const index = read("index.html");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return app.slice(start, end);
}

function createFetch() {
  return async (url) => {
    const match = String(url).match(/locales\/(ru|en)\.json$/);
    const payload = match ? dictionaries[match[1]] : null;
    return { ok: Boolean(payload), json: async () => ({ ...payload }) };
  };
}

function createStorage(locale) {
  return {
    getItem: (key) => key === LOCALE_STORAGE_KEY ? locale : null,
    setItem() {},
  };
}

test("every Budget key referenced by UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](budget\.[a-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 45, "Budget needs summary, estimate, participants, export, and currency coverage");
  for (const key of references) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing ru key: ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing en key: ${key}`);
  }
});

test("English Budget messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("budget."));
  assert.ok(messages.length >= 50);
  for (const [key, value] of messages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Budget fallback leaked into ${key}`);
  }
});

test("Budget and currency static UI use the shared locale layer", () => {
  [
    "budget.aria",
    "budget.title",
    "budget.estimate.title",
    "budget.export.download",
    "budget.currency.aria",
    "budget.currency.title",
    "budget.currency.refresh",
    "budget.currency.amount",
    "budget.currency.from",
    "budget.currency.to",
    "budget.currency.swap",
    "budget.currency.status.loading",
  ].forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-aria-label|-title)?="${key.replaceAll(".", "\\.")}"`)));
});

test("Budget dynamic screen, allocations, and currency UI contain no hardcoded Russian", () => {
  const dynamicSources = [
    functionSource("formatBudgetMoney", "formatBudgetDate"),
    functionSource("formatBudgetDate", "currencySymbol"),
    functionSource("formatCurrencyAmount", "convertCurrencyAmount"),
    functionSource("renderRatesStatus", "refreshExchangeRates"),
    functionSource("refreshExchangeRates", "parseMoney"),
    functionSource("renderEstimateProposalControls", "resolveAcceptedExpenseProposal"),
    functionSource("renderBudget", "renderEstimateTable"),
    functionSource("renderEstimateTable", "renderItemCard"),
    functionSource("chooseExportFormat", "drawWrappedText"),
  ];
  dynamicSources.forEach((source) => assert.doesNotMatch(source, /[А-Яа-яЁё]/));
});

test("Budget keeps financial formulas and allocation contracts unchanged", () => {
  const budget = functionSource("renderBudget", "renderEstimateTable");
  assert.match(budget, /const totals = getTotals\(\)/);
  assert.match(budget, /totals\.budgetLimit/);
  assert.match(budget, /totals\.paidTotal/);
  assert.match(budget, /totals\.confirmedOutstanding/);
  assert.match(budget, /totals\.remainingConfirmed/);
  assert.match(budget, /totals\.additionalTotal/);
  assert.match(budget, /totals\.possibleTotal/);
  assert.match(budget, /totals\.remainingAll/);
  assert.doesNotMatch(budget, /paidAmount\s*=/);

  const estimate = functionSource("buildEstimateRows", "buildEstimateCsv");
  assert.match(estimate, /getItemAllocations\(item\)/);
  assert.match(estimate, /getItemAllocationTotal\(item\)/);
  assert.match(estimate, /allocationByParticipant\.get\(participant\.id\) \|\| 0/);
  assert.match(estimate, /rows\.reduce\(\(sum, row\) => sum \+ parseMoney\(row\[3\]\), 0\)/);
  assert.doesNotMatch(estimate, /convertMoney|currencyRatesToRub/);
});

test("screen and export presentations are localized without changing estimate rows", () => {
  const estimate = functionSource("buildEstimateRows", "buildEstimateCsv");
  assert.match(estimate, /dayLabel = exportT\("column\.day"\)/);
  assert.match(estimate, /dateFormatter = formatExportDate/);
  assert.match(estimate, /typeFormatter = getExportTypeLabel/);
  assert.match(estimate, /participant\.isSelf && participant\.name === "Я"/);
  assert.match(estimate, /window\.t\("item\.editor\.participant\.self"\)/);
  assert.match(estimate, /: participant\.name/);

  const screen = functionSource("renderEstimateTable", "renderItemCard");
  assert.match(screen, /dateFormatter: formatBudgetDate/);
  assert.match(screen, /typeFormatter: getPlanTypeLabel/);
  assert.match(screen, /participantFormatter: getItemEditorParticipantDisplayName/);

  const estimateDownload = functionSource("downloadEstimate", "downloadPlan");
  assert.match(estimateDownload, /exportT\("estimate\.title"\)/);
  assert.match(estimateDownload, /buildEstimateRows\(\)/);
  const estimatePdf = functionSource("chooseAndDownloadEstimate", "chooseAndDownloadPlan");
  assert.match(estimatePdf, /exportT\("estimate\.title"\)/);
  assert.match(estimatePdf, /buildEstimateRows\(\)/);
});

test("Budget preserves approved status and priority terminology", () => {
  assert.deepEqual(
    ["Paid", "Booked", "Want to do", "Considering", "Backup option", "Skipped"],
    ["paid", "fixed", "want", "maybe", "backup", "skipped"].map((key) => dictionaries.en[`item.editor.status.${key}`]),
  );
  assert.deepEqual(
    ["Must-do", "Nice-to-have", "Optional"],
    ["must", "nice", "optional"].map((key) => dictionaries.en[`item.editor.priority.${key}`]),
  );
  assert.equal(dictionaries.en["budget.metric.paid"], "Paid");
  assert.equal(dictionaries.en["budget.metric.booked"], "Booked");
});

test("Budget translations interpolate days, rates, and participant UI", async () => {
  const create = async (locale) => {
    const i18n = createI18n({
      baseUrl: "https://example.test/app/",
      fetchImpl: createFetch(),
      navigatorLike: { language: "ru-RU" },
      storage: createStorage(locale),
    });
    await i18n.init();
    return i18n;
  };

  const ru = await create("ru");
  assert.equal(ru.t("budget.day.label", { number: 2 }), "День 2");
  assert.equal(ru.t("budget.currency.status.updated", { time: "18:30" }), " · обновлено в 18:30");

  const en = await create("en");
  assert.equal(en.t("budget.day.label", { number: 2 }), "Day 2");
  assert.equal(en.t("budget.currency.status.summary", { source: "live rates", updated: "" }), "Using live rates. RUB / EUR / SEK / USD / GEL / TRY / RSD / BAM.");
  assert.equal(en.t("budget.estimate.proposal.your.share"), "Your share");
});

test("Budget release uses a fresh versioned app asset and PWA cache", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(index, /\.\/app\.js\?v=p0-support-info-en-20260830/);
  assert.match(serviceWorker, /backpacker-pwa-v131/);
  assert.match(serviceWorker, /\.\/app\.js\?v=p0-support-info-en-20260830/);
});
