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

test("every Home key referenced by static or dynamic UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](home\.[a-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 60, "Home needs complete screen and state coverage");
  for (const key of references) {
    const hasKey = (dictionary) => typeof dictionary[key] === "string"
      || Object.keys(dictionary).some((candidate) => candidate.startsWith(`${key}.`));
    assert.equal(hasKey(dictionaries.ru), true, `missing ru key: ${key}`);
    assert.equal(hasKey(dictionaries.en), true, `missing en key: ${key}`);
  }
});

test("English Home messages contain no Russian fallback copy", () => {
  const homeMessages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("home."));
  assert.ok(homeMessages.length >= 60);
  for (const [key, value] of homeMessages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Home fallback leaked into ${key}`);
  }
});

test("Home dynamic renderers use locale keys instead of hardcoded Russian", () => {
  const sources = [
    functionSource("getHomeProfileLabel", "getHomeTripStatusLabel"),
    functionSource("getHomeTripStatusLabel", "renderProfileSheet"),
    functionSource("renderHomeSupport", "renderSyncConflictNotice"),
    functionSource("renderSyncConflictNotice", "renderProductVersionInfo"),
    functionSource("renderHome", "renderReceivedTrips"),
    functionSource("renderReceivedTrips", "refreshReceivedTrips"),
  ];
  sources.forEach((source) => assert.doesNotMatch(source, /[А-Яа-яЁё]/));
});

test("Home plural and interpolation resolve independently in ru and en", async () => {
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
  assert.equal(ru.t("home.trip.days", { count: 1 }), "1 день");
  assert.equal(ru.t("home.trip.days", { count: 4 }), "4 дня");
  assert.equal(ru.t("home.trip.days", { count: 12 }), "12 дней");

  const en = await create("en");
  assert.equal(en.t("home.trip.days", { count: 1 }), "1 day");
  assert.equal(en.t("home.trip.days", { count: 4 }), "4 days");
  assert.equal(en.t("home.received.author.named", { name: "Mira" }), "Author: Mira");
  assert.equal(en.t("home.date.range", { start: "12 July", end: "15 July" }), "12 July–15 July");
});

test("Home static P0 controls are bound declaratively", () => {
  const requiredKeys = [
    "home.screen.aria",
    "home.share.action",
    "home.trainer.hide",
    "home.trainer.title",
    "home.trip.create",
    "home.ideas.title",
    "home.feed.title",
    "home.received.title",
    "home.ios.install.title",
    "home.support.aria",
  ];
  requiredKeys.forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-aria-label|-title)?="${key.replaceAll(".", "\\.")}"`)));
});

test("Home auth callback, sync, and install edge states use locale keys", () => {
  const sources = [
    functionSource("handleRecoverableAuthCallback", "closeRecoverableAuthSheetAfterSuccess"),
    functionSource("syncPrivateTripsWithCloud", "getIdeaCollectionIdFromKey"),
    functionSource("installPwa", "copyText"),
  ];
  sources.forEach((source) => assert.doesNotMatch(source, /[А-Яа-яЁё]/));
  assert.match(app, /window\.t\("home\.sync\.toast\.conflict"\)/);
  assert.match(app, /window\.t\("share\.profile\.email\.callback\.restore\.error"\)/);
  assert.match(app, /window\.t\("home\.install\.browser\.hint"\)/);
});
