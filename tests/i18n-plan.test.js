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

test("every Plan key referenced by UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](plan\.[a-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 45, "Plan needs shell, day, card, navigation, and copy coverage");
  for (const key of references) {
    const hasKey = (dictionary) => typeof dictionary[key] === "string"
      || Object.keys(dictionary).some((candidate) => candidate.startsWith(`${key}.`));
    assert.equal(hasKey(dictionaries.ru), true, `missing ru key: ${key}`);
    assert.equal(hasKey(dictionaries.en), true, `missing en key: ${key}`);
  }
});

test("English Plan messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("plan."));
  assert.ok(messages.length >= 50);
  for (const [key, value] of messages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Plan fallback leaked into ${key}`);
  }
});

test("Plan shell and copy UI use the shared locale layer", () => {
  [
    "plan.shell.home",
    "plan.shell.settings",
    "plan.shell.share",
    "plan.budget.aria",
    "plan.budget.paid",
    "plan.aria",
    "plan.title",
    "plan.unscheduled.title",
    "plan.unscheduled.subtitle",
    "plan.fab.add",
    "plan.navigation.aria",
    "plan.navigation.plan",
    "plan.navigation.events",
    "plan.navigation.budget",
    "plan.copy.title.card",
    "plan.copy.close",
    "plan.copy.back",
    "plan.copy.confirm.card",
  ].forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-aria-label|-title)?="${key.replaceAll(".", "\\.")}"`)));

  const dynamicSources = [
    functionSource("formatPlanDate", "formatPlanTripDateRange"),
    functionSource("formatPlanTripDateRange", "formatPlanDayCount"),
    functionSource("formatPlanDayCount", "formatPlanMoney"),
    functionSource("formatPlanMoney", "formatPlanDurationText"),
    functionSource("formatPlanDurationText", "getPlanTypeLabel"),
    functionSource("getPlanTypeLabel", "getPlanStatusLabel"),
    functionSource("getPlanStatusLabel", "formatDateForInput"),
    functionSource("renderItemParticipantBadges", "renderParticipantAvatar"),
    functionSource("renderHeader", "renderPlan"),
    functionSource("renderPlan", "resetDayScrollPositions"),
    functionSource("renderItemCard", "getItemsForDate"),
    functionSource("getCardCopyDateOptions", "openCardCopySheet"),
    functionSource("renderCardCopySheet", "renderCardCopyScopeStep"),
    functionSource("renderCardCopyScopeStep", "renderCardCopyTripStep"),
    functionSource("renderCardCopyTripStep", "renderCardCopyDateStep"),
    functionSource("renderCardCopyDateStep", "renderCardCopyWarning"),
    functionSource("renderCardCopyWarning", "renderCardCopyActions"),
    functionSource("confirmCardCopy", "moveItem"),
  ];
  dynamicSources.forEach((source) => assert.doesNotMatch(source, /[А-Яа-яЁё]/));
});

test("Plan preserves approved English status and priority terminology", () => {
  assert.deepEqual(
    ["Paid", "Booked", "Want to do", "Considering", "Backup option", "Skipped"],
    ["paid", "fixed", "want", "maybe", "backup", "skipped"].map((key) => dictionaries.en[`item.editor.status.${key}`]),
  );
  assert.deepEqual(
    ["Must-do", "Nice-to-have", "Optional"],
    ["must", "nice", "optional"].map((key) => dictionaries.en[`item.editor.priority.${key}`]),
  );
  assert.equal(dictionaries.en["plan.unscheduled.title"], "Unscheduled");
  assert.equal(dictionaries.en["plan.unscheduled.subtitle"], "Ideas to schedule");
});

test("Plan card, day order, copy, and drag contracts stay unchanged", () => {
  const card = functionSource("renderItemCard", "getItemsForDate");
  assert.match(card, /class="item-card type-\$\{item\.type\}"/);
  assert.match(card, /data-edit="\$\{item\.id\}"/);
  assert.match(card, /data-drag-id="\$\{item\.id\}"/);
  assert.match(card, /draggable="false"/);
  assert.match(card, /getPlanStatusLabel\(item\.status\)/);

  const plan = functionSource("renderPlan", "resetDayScrollPositions");
  assert.match(plan, /getItemsForDate\(date\)/);
  assert.match(plan, /data-drop-date="\$\{date\}"/);
  assert.match(plan, /unscheduled\.slice\(0, 8\)\.map\(renderItemCard\)/);

  const move = functionSource("moveItem", "deleteCurrentItem");
  assert.match(move, /moving\.date = targetDate \|\| ""/);
  assert.match(move, /\.sort\(sortItems\)/);
  assert.match(move, /item\.order = index/);
  assert.match(move, /trackEvent\("item_day_changed"/);
  assert.doesNotMatch(move, /window\.t\(/);

  const insertion = functionSource("getInsertionReference", "getDropDataFromPoint");
  assert.match(insertion, /child\.dataset\.dragId !== draggedItemId/);
  const origin = functionSource("ensureOriginSlot", "previewDropPosition");
  assert.match(origin, /drag\.card\.cloneNode\(false\)/);
  assert.match(origin, /slot\.classList\.add\("drag-origin-slot"\)/);
  const preview = functionSource("previewDropPosition", "clearOriginSlot");
  assert.match(preview, /data\.beforeItemId/);
  assert.match(preview, /data\.zone\.appendChild\(card\)/);
});

test("Plan formatters do not leak into Budget or export paths", () => {
  const budget = functionSource("renderBudget", "renderEstimateTable");
  assert.doesNotMatch(budget, /formatPlan(?:Date|Money|DurationText)/);
  const exportsStart = app.indexOf("function buildEstimateRows(");
  assert.notEqual(exportsStart, -1);
  const exportsSource = app.slice(exportsStart);
  assert.doesNotMatch(exportsSource, /formatPlan(?:Date|Money|DurationText)/);
});

test("Plan translations interpolate days, dates, duration, and copy confirmation", async () => {
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
  assert.equal(ru.t("plan.day.label", { number: 3 }), "День 3");
  assert.equal(ru.t("plan.trip.days", { count: 5 }), "5 дней");
  assert.equal(ru.t("plan.trip.days", { count: 4 }), "4 дня");
  assert.equal(ru.t("plan.copy.toast", { target: "«Без даты»" }), "Карточка скопирована в «Без даты»");

  const en = await create("en");
  assert.equal(en.t("plan.day.label", { number: 3 }), "Day 3");
  assert.equal(en.t("plan.trip.days", { count: 1 }), "1 day");
  assert.equal(en.t("plan.item.duration.hours", { count: 2 }), "2h");
  assert.equal(en.t("plan.copy.toast", { target: "Unscheduled" }), "Card copied to Unscheduled");
});

test("Plan remains included in the current versioned app asset and PWA cache", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(index, /\.\/app\.js\?v=share-export-layer-20260825/);
  assert.match(serviceWorker, /backpacker-pwa-v124/);
  assert.match(serviceWorker, /\.\/app\.js\?v=share-export-layer-20260825/);
});

test("All events filters and empty state stay localized", () => {
  const basket = functionSource("renderBasket", "renderBudget");
  assert.doesNotMatch(basket, /[А-Яа-яЁё]/);
  assert.match(basket, /window\.t\("plan\.filter\.all"\)/);
  assert.match(basket, /getPlanStatusLabel\(status\)/);
  assert.match(index, /data-i18n-aria-label="plan\.events\.aria"/);
  assert.match(index, /data-i18n="plan\.events\.title"/);
});
