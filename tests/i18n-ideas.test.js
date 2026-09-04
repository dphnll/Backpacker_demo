const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { LOCALE_STORAGE_KEY, createI18n } = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const app = read("app.js");
const index = read("index.html");
const core = read("travel-idea-core.js");
const client = read("travel-ideas-client.js");
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

function createStorage(locale) {
  return {
    getItem: (key) => key === LOCALE_STORAGE_KEY ? locale : null,
    setItem() {},
  };
}

test("every Backpacker Ideas key referenced by UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](ideas\.[A-Za-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 55, "Ideas needs screen, collection, form, state, error, archive, and destination coverage");
  for (const key of references) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing ru key: ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing en key: ${key}`);
  }
});

test("English Ideas messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("ideas."));
  assert.ok(messages.length >= 55);
  for (const [key, value] of messages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Ideas fallback leaked into ${key}`);
  }
});

test("Ideas screen and forms use the shared locale bindings", () => {
  [
    "ideas.screen.aria",
    "ideas.back",
    "ideas.title",
    "ideas.description",
    "ideas.collections.aria",
    "ideas.add.aria",
    "ideas.form.title.create",
    "ideas.form.close",
    "ideas.form.field.title",
    "ideas.form.field.title.placeholder",
    "ideas.form.field.type",
    "ideas.form.field.collection",
    "ideas.form.field.url",
    "ideas.form.field.location",
    "ideas.form.field.price",
    "ideas.form.field.currency",
    "ideas.form.field.notes",
    "ideas.form.save",
    "ideas.form.add.to.trip",
    "ideas.form.archive",
    "ideas.collection.form.title",
    "ideas.collection.form.close",
    "ideas.collection.form.field.title",
    "ideas.collection.form.create",
  ].forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-aria-label|-placeholder)?="${key.replaceAll(".", "\\.")}"`)));
});

test("dynamic Ideas UI routes user copy through locale keys", () => {
  const sources = [
    functionSource("getCurrentIdeaCollectionTitle", "getCurrentSupabaseUserForIdeas"),
    functionSource("getTravelIdeasErrorCopy", "getExtensionConnectErrorCopy"),
    functionSource("loadTravelIdeas", "renderIdeaCollectionChips"),
    functionSource("renderIdeaCollectionChips", "formatIdeaCardPrice"),
    functionSource("formatIdeaCardPrice", "renderIdeaCard"),
    functionSource("renderIdeaCard", "renderIdeasStateCard"),
    functionSource("renderIdeasStateCard", "renderIdeasScreen"),
    functionSource("renderIdeaFormSelects", "openIdeaSheet"),
    functionSource("openIdeaSheet", "readIdeaFormInput"),
    functionSource("submitIdeaForm", "archiveCurrentIdea"),
    functionSource("archiveCurrentIdea", "openIdeaCollectionSheet"),
    functionSource("submitIdeaCollectionForm", "normalizeDisplayName"),
    functionSource("openTravelIdeaDestinationPicker", "dismissCardCopySheet"),
  ];
  sources.forEach((source) => assert.doesNotMatch(withoutComments(source), /[А-Яа-яЁё]/));
});

test("Ideas reuses the approved TripItem semantic type vocabulary", () => {
  assert.match(functionSource("renderIdeaFormSelects", "openIdeaSheet"), /getPlanTypeLabel\(key\)/);
  assert.match(functionSource("renderIdeaCard", "renderIdeasStateCard"), /getPlanTypeLabel\(viewModel\.semanticType\)/);
  assert.deepEqual(
    ["Ticket", "Accommodation", "Transport", "Activity", "Food", "Place", "Spa", "Shopping", "Idea", "Other"],
    ["ticket", "stay", "transport", "excursion", "food", "place", "spa", "shopping", "idea", "other"]
      .map((key) => dictionaries.en[`item.editor.type.${key}`]),
  );
  assert.equal(Object.keys(dictionaries.en).filter((key) => key.startsWith("ideas.type.")).length, 0);
});

test("TravelIdea models, client actions, and Add to trip lifecycle remain unchanged", () => {
  assert.match(core, /TRAVEL_IDEA_STATUSES = Object\.freeze\(\["inbox", "archived"\]\)/);
  assert.match(core, /function mapTravelIdeaToTripItemDraft/);
  assert.doesNotMatch(core, /window\.t|BackpackerI18n/);
  assert.match(client, /\.from\(IDEAS_TABLE\)[\s\S]*\.update\(patch\)/);
  assert.match(client, /return updateTravelIdea\(client, ideaId, \{ status: "archived" \}\)/);
  assert.doesNotMatch(client, /window\.t|BackpackerI18n/);

  const open = functionSource("openTravelIdeaDestinationPicker", "dismissCardCopySheet");
  const draft = functionSource("openTravelIdeaItemDraft", "confirmCardCopy");
  assert.match(open, /sourceKind: "travel_idea"/);
  assert.match(draft, /mapTravelIdeaToTripItemDraft\(sourceIdea, targetState\.trip\.currency\)/);
  assert.match(draft, /openItemSheet\(null,\s*\{/);
  assert.match(draft, /returnScreenOnCancel: "ideas"/);
  assert.doesNotMatch(draft, /state\.items\.push|persistTripStore|archiveTravelIdea|updateTravelIdea/);
});

test("Ideas destination keeps Unscheduled and currency-warning terminology", () => {
  assert.equal(dictionaries.en["plan.unscheduled.title"], "Unscheduled");
  assert.equal(dictionaries.en["plan.unscheduled.subtitle"], "Ideas to schedule");
  assert.equal(dictionaries.en["plan.copy.title.idea"], "Where should this idea be added?");
  assert.equal(dictionaries.en["item.editor.draft.warning.currency.mismatch"], "The idea uses a different currency, so the price was not copied to the trip card.");
  assert.match(functionSource("renderCardCopyWarning", "renderCardCopyActions"), /localizeItemDraftWarning\(draft\?\.priceWarning/);
});

test("Ideas translations interpolate collection and accessible card labels", async () => {
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
  assert.equal(ru.t("ideas.state.empty.filter.title", { collection: "Грузия" }), "В «Грузия» пока пусто");

  const en = await create("en");
  assert.equal(en.t("ideas.state.empty.filter.title", { collection: "Georgia" }), "Nothing in “Georgia” yet");
  assert.equal(en.t("ideas.card.open", { title: "Museum" }), "Open idea “Museum”");
});

test("Ideas release uses a fresh versioned app asset and PWA cache", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(index, /\.\/app\.js\?v=organizer-mode-20260904/);
  assert.match(serviceWorker, /backpacker-pwa-v132/);
  assert.match(serviceWorker, /\.\/app\.js\?v=organizer-mode-20260904/);
});
