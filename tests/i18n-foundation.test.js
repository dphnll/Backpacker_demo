const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  LOCALE_STORAGE_KEY,
  createI18n,
  detectLocale,
  normalizeLocale,
} = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    value: (key) => values.get(key),
  };
}

function createFetch(messages = dictionaries) {
  return async (url) => {
    const match = String(url).match(/locales\/(ru|en)\.json$/);
    const payload = match ? messages[match[1]] : null;
    return {
      ok: Boolean(payload),
      json: async () => ({ ...payload }),
    };
  };
}

function createDocument(bindings = {}) {
  let htmlLanguage = "";
  return {
    documentElement: {
      setAttribute(name, value) {
        if (name === "lang") htmlLanguage = value;
      },
    },
    querySelectorAll(selector) {
      return bindings[selector] || [];
    },
    getHtmlLanguage: () => htmlLanguage,
  };
}

test("locale files have the same non-empty key contract", () => {
  const russianKeys = Object.keys(dictionaries.ru).sort();
  const englishKeys = Object.keys(dictionaries.en).sort();
  assert.deepEqual(englishKeys, russianKeys);
  for (const locale of ["ru", "en"]) {
    for (const [key, value] of Object.entries(dictionaries[locale])) {
      assert.match(key, /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/);
      assert.equal(typeof value, "string");
      assert.notEqual(value.trim(), "");
    }
  }
});

test("browser locale detection supports ru and en and falls back to ru", () => {
  assert.equal(normalizeLocale("EN_us"), "en");
  assert.equal(detectLocale({ language: "en-US" }), "en");
  assert.equal(detectLocale({ language: "ru-RU" }), "ru");
  assert.equal(detectLocale({ languages: ["ka-GE", "en-GB"] }), "en");
  assert.equal(detectLocale({ language: "ka-GE" }), "ru");
});

test("saved preference overrides the browser and auto follows it", async () => {
  const manual = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "ru-RU" },
    storage: createStorage({ [LOCALE_STORAGE_KEY]: "en" }),
  });
  assert.equal(await manual.init(), "en");
  assert.equal(manual.getLocaleTag(), "en-GB");

  const automatic = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "en-US" },
    storage: createStorage({ [LOCALE_STORAGE_KEY]: "auto" }),
  });
  assert.equal(await automatic.init(), "en");
  assert.equal(automatic.getPreference(), "auto");
});

test("t interpolates values and falls back to Russian keys", async () => {
  const messages = {
    ru: { "test.greeting": "Привет, {name}", "test.count.one": "{count} идея", "test.count.other": "{count} идей" },
    en: { "test.greeting": "Hello, {name}" },
  };
  const i18n = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(messages),
    navigatorLike: { language: "en-US" },
    storage: createStorage(),
  });
  await i18n.init();
  assert.equal(i18n.t("test.greeting", { name: "Mira" }), "Hello, Mira");
  assert.equal(i18n.t("test.count", { count: 2 }), "2 идей");
  assert.equal(i18n.t("test.missing"), "test.missing");
});

test("failed locale loading keeps the Russian DOM fallback truthful", async () => {
  const documentLike = createDocument();
  const i18n = createI18n({
    baseUrl: "https://example.test/app/",
    documentLike,
    fetchImpl: createFetch({}),
    navigatorLike: { language: "en-US" },
    storage: createStorage(),
  });

  assert.equal(await i18n.init(), "ru");
  assert.equal(documentLike.getHtmlLanguage(), "ru");
  assert.equal(i18n.t("app.loading.status"), "app.loading.status");
});

test("init applies static bindings before app bootstrap", async () => {
  const status = { dataset: { i18n: "app.loading.status" }, textContent: "Собираем рюкзак..." };
  const splash = {
    dataset: { i18nAriaLabel: "app.loading.aria" },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const documentLike = createDocument({
    "[data-i18n]": [status],
    "[data-i18n-placeholder]": [],
    "[data-i18n-aria-label]": [splash],
    "[data-i18n-title]": [],
  });
  const i18n = createI18n({
    baseUrl: "https://example.test/app/",
    documentLike,
    fetchImpl: createFetch(),
    navigatorLike: { language: "en-US" },
    storage: createStorage(),
  });

  await i18n.init();
  assert.equal(documentLike.getHtmlLanguage(), "en");
  assert.equal(status.textContent, "Packing your backpack...");
  assert.equal(splash.attributes["aria-label"], "Backpacker is loading");
});

test("language preference is validated and persisted", () => {
  const storage = createStorage();
  const i18n = createI18n({ storage });
  assert.equal(i18n.setLocalePreference("en"), true);
  assert.equal(storage.value(LOCALE_STORAGE_KEY), "en");
  assert.equal(i18n.setLocalePreference("ka"), false);
  assert.equal(storage.value(LOCALE_STORAGE_KEY), "en");
  assert.equal(createI18n({ storage: null }).setLocalePreference("en"), false);
});

test("index, app bootstrap, and PWA cache are wired to the same foundation", () => {
  const index = read("index.html");
  const app = read("app.js");
  const serviceWorker = read("service-worker.js");

  assert.match(index, /id="languageSelect"/);
  assert.ok(index.indexOf("./i18n.js?v=i18n-foundation-20260820") < index.indexOf("./app.js?"));
  assert.ok(app.indexOf("await window.BackpackerI18n?.init()") < app.indexOf("bindEvents();", app.indexOf("async function bootstrapApp")));
  assert.match(serviceWorker, /backpacker-pwa-v123/);
  assert.match(index, /\.\/styles\.css\?v=i18n-trip-setup-20260820/);
  assert.match(serviceWorker, /\.\/styles\.css\?v=i18n-trip-setup-20260820/);
  assert.match(index, /\.\/app\.js\?v=i18n-export-20260825/);
  assert.match(serviceWorker, /\.\/app\.js\?v=i18n-export-20260825/);
  assert.match(serviceWorker, /\.\/locales\/ru\.json/);
  assert.match(serviceWorker, /\.\/locales\/en\.json/);

  const boundKeys = [...index.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="([^"]+)"/g)].map((match) => match[1]);
  for (const key of boundKeys) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing ru key: ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing en key: ${key}`);
  }
});
