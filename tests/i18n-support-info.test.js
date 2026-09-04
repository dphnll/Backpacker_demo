const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { LOCALE_STORAGE_KEY, createI18n } = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return source.slice(start, end);
}

function createStorage(savedPreference) {
  const values = new Map([[LOCALE_STORAGE_KEY, savedPreference]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createFetch() {
  return async (url) => {
    const locale = String(url).match(/locales\/(ru|en)\.json$/)?.[1];
    const payload = locale ? dictionaries[locale] : null;
    return { ok: Boolean(payload), json: async () => ({ ...payload }) };
  };
}

const supportKeys = [
  "home.support.product",
  "home.support.howto",
  "home.support.close",
  "home.support.product.body.origin",
  "home.support.product.body.planning",
  "home.support.product.body.ideas",
  "home.support.product.body.extension",
  "home.support.product.body.sync",
  "home.support.product.version",
  "home.support.product.release",
  ...["body1", "body2", "body3", "body4", "body5", "body6"].map((name) => `home.support.howto.devices.${name}`),
  "home.support.howto.devices.title",
  "home.support.howto.overview.title",
  "home.support.howto.overview.body",
  "home.support.howto.ideas.title",
  "home.support.howto.ideas.intro",
  ...[1, 2, 3, 4, 5].map((number) => `home.support.howto.ideas.item${number}`),
  "home.support.howto.ideas.outro",
  "home.support.howto.extension.title",
  "home.support.howto.extension.body",
  ...[1, 2, 3, 4].map((number) => `home.support.howto.extension.step${number}`),
  "home.support.howto.extension.note",
  "home.support.howto.extension.cta",
  "home.support.howto.ai.title",
  ...[1, 2, 3, 4].map((number) => `home.support.howto.ai.item${number}`),
  "home.support.howto.ai.warning",
  "home.support.howto.trainer.title",
  "home.support.howto.trainer.body",
  "home.trainer.settings.hide",
  "home.support.howto.cards.title",
  "home.support.howto.cards.body",
  "home.support.howto.attachments.title",
  "home.support.howto.attachments.intro",
  ...[1, 2, 3, 4].map((number) => `home.support.howto.attachments.item${number}`),
  "home.support.howto.sharing.title",
  ...[1, 2, 3, 4, 5, 6].map((number) => `home.support.howto.sharing.item${number}`),
  "home.support.howto.iphone.title",
  "home.support.howto.iphone.body1",
  "home.support.howto.iphone.body2",
];

test("Product Info keeps its sheet contract and binds every visible string", () => {
  const index = read("index.html");
  const section = sectionBetween(index, '<div class="sheet" id="productInfoSheet"', '<div class="sheet" id="howToSheet"');

  assert.match(section, /id="productInfoSheet" aria-hidden="true"/);
  assert.match(section, /aria-labelledby="productInfoSheetTitle"/);
  assert.match(section, /id="productInfoSheetTitle" data-i18n="home\.support\.product"/);
  assert.match(section, /data-close="productInfo"[^>]*data-i18n-aria-label="home\.support\.close"/);
  assert.equal((section.match(/<p data-i18n="home\.support\.product\.body\.[^"]+"/g) || []).length, 5);
  assert.match(section, /<p id="productVersionInfo"><\/p>/);
  assert.equal((section.match(/<p/g) || []).length, 6);
});

test("How-to keeps ten sections, two defaults open, and binds all copy", () => {
  const index = read("index.html");
  const section = sectionBetween(index, '<div class="sheet" id="howToSheet"', '<div class="sheet" id="homeShareSheet"');

  assert.match(section, /id="howToSheet" aria-hidden="true"/);
  assert.match(section, /aria-labelledby="howToSheetTitle"/);
  assert.match(section, /id="howToSheetTitle" data-i18n="home\.support\.howto"/);
  assert.match(section, /data-close="howTo"[^>]*data-i18n-aria-label="home\.support\.close"/);
  assert.equal((section.match(/<details(?:\s|>)/g) || []).length, 10);
  assert.equal((section.match(/<details open>/g) || []).length, 2);
  assert.equal((section.match(/<summary data-i18n=/g) || []).length, 10);
  assert.equal((section.match(/<p data-i18n=/g) || []).length, 17);
  assert.equal((section.match(/<li data-i18n=/g) || []).length, 23);
  assert.equal((section.match(/<button[^>]*data-i18n="home\.trainer\.settings\.hide"/g) || []).length, 1);
  assert.equal((section.match(/<a[^>]*data-i18n="home\.support\.howto\.extension\.cta"/g) || []).length, 1);
  assert.doesNotMatch(section, /<(?:summary|p|li)(?![^>]*data-i18n=)[^>]*>/);
});

test("RU and EN dictionaries contain the complete support-sheet contract", () => {
  assert.equal(new Set(supportKeys).size, 62);
  for (const key of supportKeys) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing RU ${key}`);
    assert.ok(dictionaries.ru[key].trim(), `empty RU ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing EN ${key}`);
    assert.ok(dictionaries.en[key].trim(), `empty EN ${key}`);
  }

  assert.equal(dictionaries.ru["home.support.product.version"], "Версия {version}: {summary}");
  assert.equal(dictionaries.en["home.support.product.version"], "Version {version}: {summary}");
  assert.equal(dictionaries.en["home.support.product.release"], "Organizer Mode now includes program information, freshness, and participant materials.");
  for (const key of supportKeys.filter((key) => key !== "home.support.howto")) {
    assert.doesNotMatch(dictionaries.en[key], /[А-ЯЁа-яё]/, key);
  }
});

test("saved EN resolves every support key without RU fallback", async () => {
  const english = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "ru-RU" },
    storage: createStorage("en"),
  });

  assert.equal(await english.init(), "en");
  for (const key of supportKeys) {
    assert.equal(english.t(key), dictionaries.en[key], key);
    if (dictionaries.en[key] !== dictionaries.ru[key]) assert.notEqual(english.t(key), dictionaries.ru[key], key);
  }
});

test("Product Info version and release summary render through the active locale", async () => {
  const app = read("app.js");
  const constants = ["APP_VERSION", "APP_RELEASE_SUMMARY"].map((name) => {
    const match = app.match(new RegExp(`const ${name} = [^;]+;`));
    assert.ok(match, `missing ${name}`);
    return match[0];
  }).join("\n");
  const render = sectionBetween(app, "function renderProductVersionInfo()", "function toggleHomeSupportPanel");
  assert.match(render, /window\.t\("home\.support\.product\.release"\)/);
  assert.match(render, /window\.t\("home\.support\.product\.version"/);

  const english = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "ru-RU" },
    storage: createStorage("en"),
  });
  await english.init();
  const target = { textContent: "" };
  vm.runInNewContext(`${constants}\n${render}\nrenderProductVersionInfo();`, {
    $: (selector) => selector === "#productVersionInfo" ? target : null,
    window: { t: english.t },
  });

  assert.equal(target.textContent, "Version 1.1.2.85: Organizer Mode now includes program information, freshness, and participant materials.");
});
