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

test("every Item editor key referenced by UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](item\.editor\.[a-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 95, "Item editor needs form, enum, link, attachment, validation, and CRUD coverage");
  for (const key of references) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing ru key: ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing en key: ${key}`);
  }
});

test("English Item editor messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("item.editor."));
  assert.ok(messages.length >= 95);
  for (const [key, value] of messages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Item editor fallback leaked into ${key}`);
  }
});

test("Item editor preserves the TripItem form and persistence contracts", () => {
  const formStart = index.indexOf('<form id="itemForm"');
  const formEnd = index.indexOf("</form>", formStart);
  const form = index.slice(formStart, formEnd);
  const fieldNames = [...form.matchAll(/\bname="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(fieldNames, [
    "id",
    "title",
    "type",
    "status",
    "participantId",
    "date",
    "startTime",
    "durationHours",
    "durationRemainder",
    "price",
    "paidAmount",
    "priority",
    "link",
    "locationText",
    "notes",
  ]);
  assert.equal(fieldNames.includes("currency"), false);
  assert.equal(fieldNames.includes("priceKind"), false);

  const save = functionSource("saveItem", "getItemFormChangedFields");
  assert.match(save, /trackEvent\(isNew \? "item_created" : "item_updated"/);
  assert.match(save, /durationMinutes: getDurationFromInput/);
  assert.match(save, /allocations: getSavedItemAllocations/);
  assert.doesNotMatch(save, /\bcurrency\s*:/);
  assert.doesNotMatch(save, /\bpriceKind\s*:/);
});

test("Item editor static and dynamic UI uses the shared locale layer", () => {
  [
    "item.editor.title.create",
    "item.editor.field.title.label",
    "item.editor.field.title.placeholder",
    "item.editor.field.owner.label",
    "item.editor.field.date.label",
    "item.editor.field.duration.label",
    "item.editor.field.link.placeholder",
    "item.editor.field.notes.placeholder",
    "item.editor.attachments.title",
    "item.editor.save",
    "item.editor.reset",
    "item.editor.delete",
  ].forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-placeholder)?="${key.replaceAll(".", "\\.")}"`)));

  const dynamicSources = [
    functionSource("getLinkIntakePriceLabel", "getLinkIntakeDraftWarnings"),
    functionSource("getLinkIntakeDraftWarnings", "renderLinkIntakePanel"),
    functionSource("renderLinkIntakePanel", "getLinkIntakeFormValues"),
    functionSource("previewLinkIntakeFromForm", "resetTripItemAttachmentsState"),
    functionSource("renderTripItemAttachments", "loadTripItemAttachments"),
    functionSource("fillSelects", "renderParticipantOwnerField"),
    functionSource("renderItemAllocationSummary", "getSavedItemAllocations"),
    functionSource("saveItem", "getItemFormChangedFields"),
    functionSource("resetCurrentItemForm", "getNextOrderForItems"),
    functionSource("deleteCurrentItem", "ensureTripContextLabels"),
  ];
  dynamicSources.forEach((source) => assert.doesNotMatch(source, /[А-Яа-яЁё]/));
});

test("Item editor enum terminology is stable while model values stay unchanged", () => {
  assert.deepEqual(
    ["ticket", "stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"],
    [...app.match(/const itemTypes = \[([\s\S]*?)\];/)[1].matchAll(/\["([^"]+)"/g)].map((match) => match[1]),
  );
  assert.deepEqual(
    ["paid", "fixed", "want", "maybe", "backup", "skipped"],
    [...app.match(/const statuses = \[([\s\S]*?)\];/)[1].matchAll(/\["([^"]+)"/g)].map((match) => match[1]),
  );
  assert.deepEqual(
    ["must", "nice", "optional"],
    [...app.match(/const priorities = \[([\s\S]*?)\];/)[1].matchAll(/\["([^"]+)"/g)].map((match) => match[1]),
  );
  assert.equal(dictionaries.en["item.editor.field.owner.label"], "Expense owner");
  assert.equal(dictionaries.en["item.editor.type.excursion"], "Tour or activity");
  assert.equal(dictionaries.en["item.editor.status.fixed"], "Booked");
  assert.equal(dictionaries.en["item.editor.priority.must"], "Must-do");
});

test("Item editor translations interpolate currency, owner, validation, and confirmations", async () => {
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
  assert.equal(ru.t("item.editor.field.price.label", { currency: "GEL" }), "Цена (GEL)");
  assert.equal(ru.t("item.editor.delete.confirm", { title: "Баня" }), "Удалить «Баня»? Это действие нельзя отменить.");

  const en = await create("en");
  assert.equal(en.t("item.editor.field.paid.label", { currency: "EUR" }), "Paid amount (EUR)");
  assert.equal(en.t("item.editor.participant.option.self", { name: "Me", badge: "you" }), "Me (you)");
  assert.equal(en.t("item.editor.validation.date.after", { start: "2026-09-01" }), "Choose 2026-09-01 or a later date");
});

test("Item editor remains included in the current versioned app asset and PWA cache", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(index, /\.\/app\.js\?v=p0-support-info-en-20260830/);
  assert.match(serviceWorker, /backpacker-pwa-v131/);
  assert.match(serviceWorker, /\.\/app\.js\?v=p0-support-info-en-20260830/);
});
