const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { LOCALE_STORAGE_KEY, createI18n, detectLocale } = require("../i18n.js");

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
  return source.slice(start, end + endMarker.length);
}

function createStorage(savedPreference) {
  const values = new Map(savedPreference ? [[LOCALE_STORAGE_KEY, savedPreference]] : []);
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

function bindLanguageControl(savedPreference) {
  const app = read("app.js");
  const start = app.indexOf("function bindLanguageSelector()");
  const end = app.indexOf("\nfunction bindEvents()", start);
  assert.notEqual(start, -1, "missing bindLanguageSelector");
  assert.notEqual(end, -1, "unterminated bindLanguageSelector");

  const writes = [];
  let reloads = 0;
  const buttons = ["auto", "ru", "en"].map((preference) => {
    const attributes = {};
    const classes = new Set();
    const listeners = {};
    return {
      attributes,
      classes,
      dataset: { languagePreference: preference },
      listeners,
      addEventListener: (name, listener) => { listeners[name] = listener; },
      classList: {
        toggle(name, enabled) {
          if (enabled) classes.add(name);
          else classes.delete(name);
        },
      },
      setAttribute: (name, value) => { attributes[name] = String(value); },
    };
  });
  const context = {
    document: { querySelectorAll: (selector) => selector === "[data-language-preference]" ? buttons : [] },
    window: {
      BackpackerI18n: {
        getPreference: () => savedPreference,
        setLocalePreference: (preference) => { writes.push(preference); return true; },
      },
      location: { reload: () => { reloads += 1; } },
    },
  };

  vm.runInNewContext(`${app.slice(start, end)}\nbindLanguageSelector();`, context);
  return { buttons, reloads: () => reloads, writes };
}

test("the single segmented language control sits below the restored Home header", () => {
  const index = read("index.html");
  const homeHeader = sectionBetween(index, '<header class="home-header">', "</header>");
  const homeSupport = sectionBetween(index, '<section class="home-support"', "</section>");

  assert.equal((index.match(/class="home-language-switch"/g) || []).length, 1);
  assert.doesNotMatch(index, /id="languageSelect"/);
  assert.doesNotMatch(homeHeader, /home-language-switch|data-language-preference/);
  assert.match(homeHeader, /class="home-brand"/);
  assert.match(homeHeader, /id="homeProfileButton"/);
  assert.match(homeHeader, /id="homeShareButton"/);
  assert.doesNotMatch(homeSupport, /home-language-switch|data-language-preference/);
  assert.ok(index.indexOf('class="home-language-switch"') > index.indexOf("</header>"));
  assert.ok(index.indexOf('class="home-language-switch"') < index.indexOf('data-i18n="home.feed.title"'));

  const preferences = [...index.matchAll(/data-language-preference="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(preferences, ["auto", "ru", "en"]);
  assert.match(index, /data-language-preference="auto"[^>]*data-i18n-aria-label="language\.auto"[^>]*>[\s\S]*?<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>[\s\S]*?<\/button>/);
  assert.match(index, /data-language-preference="ru"[^>]*data-i18n-aria-label="language\.ru"[^>]*>RU<\/button>/);
  assert.match(index, /data-language-preference="en"[^>]*data-i18n-aria-label="language\.en"[^>]*>EN<\/button>/);
});

test("the language switch is lightweight, compact, and visibly marks one preference", () => {
  const styles = read("styles.css");
  assert.match(styles, /\.home-header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 40px;/);
  assert.match(styles, /\.home-language-switch\s*\{[\s\S]*?width:\s*max-content;[\s\S]*?margin:\s*var\(--a-gap\) 16px 4px auto;/);
  assert.match(styles, /\.home-language-option\s*\{[\s\S]*?min-width:\s*40px;[\s\S]*?min-height:\s*38px;[\s\S]*?background:\s*transparent;/);
  assert.match(styles, /\.home-language-option:first-child\[aria-pressed="false"\]\s*\{[\s\S]*?color:\s*var\(--blue\);/);
  assert.match(styles, /\.home-language-option svg\s*\{[\s\S]*?stroke:\s*currentColor;/);
  assert.match(styles, /\.home-language-option\[aria-pressed="true"\]\s*\{[\s\S]*?background:\s*var\(--a-brand\);[\s\S]*?color:\s*#fff;/);
  assert.match(styles, /\.home-screen \.trip-list-section\s*\{[\s\S]*?margin-top:\s*0;/);
  assert.doesNotMatch(styles, /\.home-header-actions|\.home-language-control/);
});

test("saved preference selects one segment and every other segment writes through the canonical API", () => {
  const selected = bindLanguageControl("ru");
  assert.deepEqual(selected.buttons.map((button) => button.attributes["aria-pressed"]), ["false", "true", "false"]);
  assert.deepEqual(selected.buttons.map((button) => button.classes.has("selected")), [false, true, false]);

  for (const target of ["auto", "ru", "en"]) {
    const current = target === "auto" ? "ru" : "auto";
    const bound = bindLanguageControl(current);
    bound.buttons.find((button) => button.dataset.languagePreference === target).listeners.click();
    assert.deepEqual(bound.writes, [target]);
    assert.equal(bound.reloads(), 1);
  }
});

test("AUTO honors supported browser languages and otherwise resolves to English", () => {
  assert.equal(detectLocale({ language: "ru-RU" }), "ru");
  assert.equal(detectLocale({ language: "en-US" }), "en");
  for (const language of ["ka-GE", "fr-FR", "es-ES"]) {
    assert.equal(detectLocale({ language }), "en", language);
  }
  assert.equal(detectLocale({ languages: ["ka-GE", "en-GB"] }), "en");
  assert.equal(detectLocale({ languages: ["ka-GE", "ru-RU"] }), "ru");
});

test("saved RU and EN preferences still override browser detection", async () => {
  const russian = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "en-US" },
    storage: createStorage("ru"),
  });
  const english = createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: createFetch(),
    navigatorLike: { language: "ru-RU" },
    storage: createStorage("en"),
  });

  assert.equal(await russian.init(), "ru");
  assert.equal(await english.init(), "en");
});
