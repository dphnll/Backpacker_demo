const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { LOCALE_STORAGE_KEY, createI18n } = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const app = read("app.js");
const index = read("index.html");
const serviceWorker = read("service-worker.js");
const styles = read("styles.css");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

function functionSource(name, nextName) {
  const start = app.indexOf("function " + name + "(");
  const end = app.indexOf("function " + nextName + "(", start + 1);
  assert.notEqual(start, -1, name + " must exist");
  assert.notEqual(end, -1, nextName + " must follow " + name);
  return app.slice(start, end);
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function createFetch() {
  return async (url) => {
    const match = String(url).match(/locales\/(ru|en)\.json$/);
    const payload = match ? dictionaries[match[1]] : null;
    return { ok: Boolean(payload), json: async () => ({ ...payload }) };
  };
}

async function createRuntime(locale) {
  const i18n = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "ru-RU" },
    storage: {
      getItem: (key) => key === LOCALE_STORAGE_KEY ? locale : null,
      setItem() {},
    },
  });
  await i18n.init();

  const participants = [
    { id: "self", name: "Ирина", isSelf: true },
    { id: "friend", name: "Alex" },
  ];
  const state = {
    trip: {
      title: "Поездка в Tbilisi",
      destination: "თბილისი",
      currency: "EUR",
      participants,
    },
    items: [
      {
        id: "dated",
        date: "2026-08-20",
        startTime: "09:30",
        title: "Мой отель",
        type: "stay",
        status: "paid",
        price: 1500.5,
        link: "https://example.test/hotel",
        allocations: [
          { participantId: "self", amount: 1000 },
          { participantId: "friend", amount: 500.5 },
        ],
      },
      {
        id: "undated",
        date: "",
        startTime: "",
        title: "Café Déjà Vu",
        type: "food",
        status: "want",
        price: 200,
        link: "",
        allocations: [{ participantId: "self", amount: 200 }],
      },
    ],
  };
  const exportT = (key, params = {}) => i18n.t("export." + key, params);
  const formatExportDate = (dateString) => {
    if (!dateString) return exportT("unscheduled");
    const date = new Date(String(dateString) + "T12:00:00");
    return i18n.formatDate(date, { day: "numeric", month: "long" });
  };
  const getItemAllocations = (item) => item.allocations;
  const context = {
    result: null,
    state,
    window: { t: i18n.t, BackpackerI18n: i18n },
    exportT,
    formatExportDate,
    getExportTypeLabel: (type) => i18n.t("item.editor.type." + type),
    getExportStatusLabel: (status) => i18n.t("item.editor.status." + status),
    getTripDates: () => ["2026-08-20", "2026-08-21"],
    sortItems: () => 0,
    parseMoney: (value) => Number(value) || 0,
    isActiveCost: (item) => item.status !== "skipped" && item.status !== "backup",
    getItemAllocations,
    getItemAllocationTotal: (item) => getItemAllocations(item).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0),
    escapeHtml: (value) => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;"),
  };
  vm.createContext(context);
  return { context, exportT };
}

function runFunction(context, name, nextName, expression) {
  vm.runInContext(functionSource(name, nextName) + "\nresult = " + expression + ";", context);
  return context.result;
}

test("Export dictionaries have RU/EN parity and English system copy has no Cyrillic", () => {
  const ruKeys = Object.keys(dictionaries.ru).filter((key) => key.startsWith("export.")).sort();
  const enKeys = Object.keys(dictionaries.en).filter((key) => key.startsWith("export.")).sort();
  assert.ok(ruKeys.length >= 40);
  assert.deepEqual(enKeys, ruKeys);
  enKeys.forEach((key) => assert.doesNotMatch(dictionaries.en[key], /[А-Яа-яЁё]/, "Cyrillic leaked into " + key));
});

test("RU and EN Plan rows localize headers, days, Unscheduled, types, and statuses while preserving user data", async () => {
  for (const locale of ["ru", "en"]) {
    const { context } = await createRuntime(locale);
    const table = runFunction(context, "buildPlanRows", "buildPlanCsv", "buildPlanRows()");
    const expectedHeader = locale === "ru"
      ? ["День", "Дата", "Время", "Событие", "Тип", "Статус", "Цена", "Ссылка"]
      : ["Day", "Date", "Time", "Item", "Type", "Status", "Price", "Link"];
    assert.deepEqual(Array.from(table.header), expectedHeader);
    assert.equal(table.rows[0][0], locale === "ru" ? "День 1" : "Day 1");
    assert.equal(table.rows[0][3], "Мой отель");
    assert.equal(table.rows[0][4], locale === "ru" ? "Жильё" : "Accommodation");
    assert.equal(table.rows[0][5], locale === "ru" ? "Оплачено" : "Paid");
    assert.equal(table.rows[0][6], 1500.5);
    assert.equal(table.rows[0][7], "https://example.test/hotel");
    assert.equal(table.rows[1][0], locale === "ru" ? "Без даты" : "Unscheduled");
    assert.equal(table.rows[1][3], "Café Déjà Vu");
    assert.deepEqual(Array.from(table.columnWeights), [1.4, 1, 0.8, 1.7, 1.7, 1.3, 1, 0.75]);
  }
});

test("RU and EN estimate rows localize generated labels but preserve participant names and numeric allocations", async () => {
  for (const locale of ["ru", "en"]) {
    const { context } = await createRuntime(locale);
    const table = runFunction(context, "buildEstimateRows", "buildEstimateCsv", "buildEstimateRows()");
    assert.deepEqual(
      Array.from(table.header),
      locale === "ru"
        ? ["День", "Статья", "Категория", "Всего", "Ирина", "Alex"]
        : ["Day", "Item", "Category", "Total", "Ирина", "Alex"],
    );
    assert.equal(table.rows[0][1], "Мой отель");
    assert.equal(table.rows[0][2], locale === "ru" ? "Жильё" : "Accommodation");
    assert.deepEqual(Array.from(table.rows[0].slice(3)), [1500.5, 1000, 500.5]);
    assert.equal(table.rows.at(-1)[0], locale === "ru" ? "Итого" : "Total");
  }
});

test("default self participant is localized in exports while a renamed participant stays user data", async () => {
  for (const locale of ["ru", "en"]) {
    const { context } = await createRuntime(locale);
    context.state.trip.participants[0].name = "Я";
    let table = runFunction(context, "buildEstimateRows", "buildEstimateCsv", "buildEstimateRows()");
    assert.equal(table.header[4], locale === "ru" ? "Я" : "Me");

    context.state.trip.participants[0].name = "Ирина";
    table = runFunction(context, "buildEstimateRows", "buildEstimateCsv", "buildEstimateRows()");
    assert.equal(table.header[4], "Ирина");
  }
});

test("XLS HTML localizes document and worksheet names without changing the one-table workbook contract", async () => {
  for (const locale of ["ru", "en"]) {
    const { context, exportT } = await createRuntime(locale);
    const table = runFunction(context, "buildPlanRows", "buildPlanCsv", "buildPlanRows()");
    Object.assign(context, {
      inputTitle: exportT("itinerary.title"),
      inputTable: table,
      inputSheetName: exportT("itinerary.sheet"),
    });
    vm.runInContext(
      functionSource("escapeSpreadsheetValue", "buildSpreadsheetHtml")
        + "\n"
        + functionSource("buildSpreadsheetHtml", "downloadSpreadsheet")
        + "\nresult = buildSpreadsheetHtml(inputTitle, inputTable, inputSheetName);",
      context,
    );
    const html = context.result;
    assert.match(html, new RegExp("<h1>" + (locale === "ru" ? "План по дням" : "Day plan") + "</h1>"));
    assert.match(html, new RegExp("<x:Name>" + (locale === "ru" ? "План" : "Plan") + "</x:Name>"));
    assert.match(html, /<table>/);
    assert.match(html, /class="spreadsheet-text">09:30<\/td>/);
    if (locale === "en") {
      const systemOnly = [
        exportT("itinerary.title"),
        exportT("itinerary.sheet"),
        ...Array.from(table.header),
        table.rows[0][0],
        table.rows[0][4],
        table.rows[0][5],
        table.rows[1][0],
      ].join(" ");
      assert.doesNotMatch(systemOnly, /[А-Яа-яЁё]/);
    }
  }
});

test("PDF builders use locale output contract and preserve current inclusion rules", () => {
  const tablePdf = functionSource("downloadPdfFile", "chooseAndDownloadEstimate");
  assert.match(tablePdf, /formatExportTripDateRange/);
  assert.match(tablePdf, /formatExportTableCell/);
  assert.match(tablePdf, /splitLongWord/);
  assert.match(tablePdf, /table\.columnWeights/);

  const tripPdf = withoutComments(functionSource("buildTripPdfBlob", "drawPdfMeasureLines"));
  [
    "trip.title.fallback",
    "trip.destination.missing",
    "financial.summary",
    "financial.title",
    "financial.limit",
    "financial.paid",
    "financial.booked",
    "financial.available",
    "financial.backup",
    "financial.possible",
    "financial.remaining",
    "participants",
    "item.date",
    "day.label",
    "day.empty",
    "unscheduled",
    "unscheduled.subtitle",
  ].forEach((key) => assert.match(tripPdf, new RegExp('exportT\\("' + key.replaceAll(".", "\\.") + '"')));
  assert.match(tripPdf, /getExportTypeLabel\(item\.type\)/);
  assert.match(tripPdf, /maxTypeLabelWidth/);
  assert.match(tripPdf, /typeLabelFontSize > 11/);
  assert.match(tripPdf, /formatExportDuration\(item\.durationMinutes\)/);
  assert.match(tripPdf, /status\.mark\.(?:paid|fixed|want|maybe|backup|skipped)/);
  assert.match(tripPdf, /if \(!options\.includeBudget\) return/);
  assert.match(tripPdf, /if \(options\.includeNotes && item\.notes\)/);
  assert.match(tripPdf, /if \(options\.includeUndated && undated\.length\)/);
  assert.doesNotMatch(tripPdf, /[А-Яа-яЁё]/);
});

test("Export keeps raw user fields, financial calculations, workbook structure, and delivery analytics unchanged", () => {
  const estimate = functionSource("buildEstimateRows", "buildEstimateCsv");
  assert.match(estimate, /item\.title/);
  assert.match(estimate, /getItemAllocations\(item\)/);
  assert.match(estimate, /getItemAllocationTotal\(item\)/);
  assert.match(estimate, /allocationByParticipant\.get\(participant\.id\) \|\| 0/);
  assert.doesNotMatch(estimate, /convertMoney|currencyRatesToRub/);

  const plan = functionSource("buildPlanRows", "buildPlanCsv");
  assert.match(plan, /item\.title/);
  assert.match(plan, /item\.link \|\| ""/);
  assert.match(plan, /parseMoney\(item\.price\)/);

  const downloads = functionSource("downloadSpreadsheet", "downloadEstimate");
  assert.match(downloads, /application\/vnd\.ms-excel;charset=utf-8/);
  const analytics = app.slice(app.indexOf("function downloadEstimate("), app.indexOf("function closeExportFormatDialog("));
  assert.match(analytics, /export_type: "estimate", format: "xls"/);
  assert.match(analytics, /export_type: "plan", format: "xls"/);
});

test("Legacy text and CSV builders plus formatters follow active export locale", () => {
  const helpers = functionSource("getExportLocale", "buildEstimateText");
  assert.match(helpers, /BackpackerI18n\?\.getLocale/);
  assert.match(helpers, /BackpackerI18n\.formatDate/);
  assert.match(helpers, /BackpackerI18n\.formatNumber/);
  assert.match(helpers, /getPlanTypeLabel/);
  assert.match(helpers, /getPlanStatusLabel/);
  assert.match(helpers, /item\.editor\.priority/);

  const days = functionSource("buildDaysText", "escapeCsvValue");
  assert.match(days, /exportT\("column\.day"\)/);
  assert.match(days, /formatExportDate/);
  assert.match(days, /formatExportMoney/);
  assert.doesNotMatch(days, /[А-Яа-яЁё]/);
});

test("Export localization ships through a fresh app asset and cache", () => {
  assert.match(app, /const APP_VERSION = "1\.1\.2\.84"/);
  assert.match(index, /\.\/styles\.css\?v=organizer-mode-20260904/);
  assert.match(index, /\.\/app\.js\?v=organizer-mode-20260904/);
  assert.match(serviceWorker, /backpacker-pwa-v132/);
  assert.match(serviceWorker, /\.\/styles\.css\?v=organizer-mode-20260904/);
  assert.match(serviceWorker, /\.\/app\.js\?v=organizer-mode-20260904/);
});

test("Share export format dialog stays above the Share sheet", () => {
  const sheetZ = Number(styles.match(/\.sheet\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const exportDialogZ = Number(styles.match(/\.export-format-dialog\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);

  assert.ok(Number.isFinite(sheetZ), "Share sheet z-index must stay explicit");
  assert.ok(Number.isFinite(exportDialogZ), "export format dialog z-index must stay explicit");
  assert.ok(exportDialogZ > sheetZ, "PDF/XLS choice must receive clicks above Share sheet");
});
