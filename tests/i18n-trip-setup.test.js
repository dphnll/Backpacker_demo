const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { LOCALE_STORAGE_KEY, createI18n } = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const app = read("app.js");
const index = read("index.html");
const styles = read("styles.css");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

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

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return app.slice(start, end);
}

test("every Trip setup key referenced by UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](trip\.setup\.[a-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 45, "Trip setup needs form, participant, validation, and state coverage");
  for (const key of references) {
    const hasKey = (dictionary) => typeof dictionary[key] === "string"
      || Object.keys(dictionary).some((candidate) => candidate.startsWith(`${key}.`));
    assert.equal(hasKey(dictionaries.ru), true, `missing ru key: ${key}`);
    assert.equal(hasKey(dictionaries.en), true, `missing en key: ${key}`);
  }
});

test("English Trip setup messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("trip.setup."));
  assert.ok(messages.length >= 45);
  for (const [key, value] of messages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Trip setup fallback leaked into ${key}`);
  }
});

test("Trip setup keeps the existing form model and binds all visible fields", () => {
  const formStart = index.indexOf('<form id="tripForm"');
  const formEnd = index.indexOf("</form>", formStart);
  const form = index.slice(formStart, formEnd);
  const fieldNames = [...form.matchAll(/\bname="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(fieldNames, [
    "title",
    "destination",
    "aiSourceText",
    "startDate",
    "endDate",
    "currency",
    "budgetLimit",
    "preferencesText",
  ]);
  [
    "trip.setup.title",
    "trip.setup.field.title.label",
    "trip.setup.field.title.placeholder",
    "trip.setup.field.destination.label",
    "trip.setup.field.destination.placeholder",
    "trip.setup.field.start.label",
    "trip.setup.field.end.label",
    "trip.setup.field.currency.label",
    "trip.setup.field.budget.label",
    "trip.setup.field.preferences.label",
    "trip.setup.participants.title",
    "trip.setup.save",
  ].forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-placeholder)?="${key.replaceAll(".", "\\.")}"`)));
  assert.match(styles, /\.sheet-form > \.field > input,[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
});

test("Trip setup dynamic UI and validations resolve through locale keys", () => {
  const participantsSource = functionSource("renderParticipantsList", "renderParticipantEditor");
  const dynamicSources = [
    functionSource("ensureTripContextLabels", "renderAiSourceTextField"),
    participantsSource,
    functionSource("renderParticipantEditor", "focusParticipantEditor"),
    functionSource("readAddParticipantName", "saveAddParticipant"),
    functionSource("openAddParticipantDialog", "readParticipantEditorName"),
    functionSource("readParticipantEditorName", "isParticipantNameDuplicate"),
    functionSource("deleteParticipant", "validateTripRequiredInputs"),
    functionSource("validateTripRequiredInputs", "validateTripBudgetInput"),
    functionSource("validateTripBudgetInput", "getTripDateInputs"),
    functionSource("validateTripDateInputs", "handleTripStartDateChange"),
    functionSource("saveTrip", "resetDemo"),
  ];
  dynamicSources.forEach((source) => {
    const withoutModelSentinel = source.replaceAll('"Я"', '""');
    assert.doesNotMatch(withoutModelSentinel, /[А-Яа-яЁё]/);
  });
  assert.match(participantsSource, /initials: displayName\.slice\(0, 1\)\.toUpperCase\(\)/);
});

test("manual creation localizes only UI defaults and keeps analytics contract", () => {
  const create = functionSource("createNewTrip", "selectTripCover");
  assert.match(create, /entry\.state\.trip\.title = window\.t\("trip\.setup\.default\.title"\)/);
  assert.match(create, /creation_source: creationSource/);
  assert.doesNotMatch(create, /participants\s*=/, "Trip participant model must not be rewritten by localization");

  const renderDraft = functionSource("renderTripDraftAiSheet", "createEmptyTripDraftAiState");
  assert.match(renderDraft, /trip\.setup\.create\.title/);
  assert.match(renderDraft, /tripDraftT\("title"\)/, "AI Draft now owns its separate localized namespace");
});

test("Trip setup plural confirmations and save states work in ru and en", async () => {
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
  assert.equal(ru.t("trip.setup.saved.moved", { count: 1 }), "1 событие перенесено в «Без даты»");
  assert.equal(ru.t("trip.setup.saved.moved", { count: 5 }), "5 событий перенесено в «Без даты»");

  const en = await create("en");
  assert.equal(en.t("trip.setup.saved.moved", { count: 1 }), "1 event moved to Unscheduled");
  assert.equal(en.t("trip.setup.saved.moved", { count: 3 }), "3 events moved to Unscheduled");
  assert.equal(en.t("trip.setup.validation.destination.required"), "Enter a destination");
});
