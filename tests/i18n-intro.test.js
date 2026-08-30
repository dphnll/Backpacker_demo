const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createI18n } = require("../i18n.js");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

const expected = {
  "intro.screen.aria": ["Добро пожаловать в Backpacker", "Welcome to Backpacker"],
  "intro.slide1.line1": ["Билеты, жилье, заметки,", "Tickets, stays, notes,"],
  "intro.slide1.line2": ["ссылки и бюджет -", "links and budget —"],
  "intro.slide1.line3": ["в персональном \"рюкзаке\"!", "all in your personal “backpack”!"],
  "intro.slide1.line4": ["Добавляйте варианты,", "Add options,"],
  "intro.slide1.line5": ["двигайте карточки по дням,", "move cards between days,"],
  "intro.slide1.line6": ["вбрасывайте новые идеи.", "throw in new ideas."],
  "intro.slide2.line1": ["Тренажер - готовый пример,", "The Trainer is a ready-made example"],
  "intro.slide2.line2": ["который пояснит, что к чему.", "that shows you how everything works."],
  "intro.slide2.line3": ["Разобрались?", "Got it?"],
  "intro.slide2.line4": ["Скорее создавайте свою поездку!", "Create your own trip!"],
  "intro.slide3.line1": ["Настройте даты, валюту, бюджет,", "Set dates, currency and budget,"],
  "intro.slide3.line2": ["добавляйте в карточки", "add ticket, tour and place links,"],
  "intro.slide3.line3": ["ссылки на билеты, экскурсии и локации,", "write notes and share"],
  "intro.slide3.line4": ["пишите заметки, делитесь", "the plan and budget"],
  "intro.slide3.line5": ["с попутчиками планом и сметой.", "with your travel companions."],
  "intro.action.next": ["Дальше", "Next"],
  "intro.action.start": ["Погнали!", "Let's go!"],
};

function introMarkup() {
  const index = read("index.html");
  const start = index.indexOf('<section class="intro-screen"');
  const end = index.indexOf("</section>", start);
  assert.notEqual(start, -1, "missing #introScreen");
  assert.notEqual(end, -1, "unterminated #introScreen");
  return index.slice(start, end + "</section>".length);
}

function createEnglishI18n() {
  return createI18n({
    baseUrl: "https://example.test/app/",
    fetchImpl: async (url) => {
      const locale = String(url).match(/locales\/(ru|en)\.json$/)?.[1];
      const payload = locale ? dictionaries[locale] : null;
      return { ok: Boolean(payload), json: async () => ({ ...payload }) };
    },
    navigatorLike: { language: "en-US" },
    storage: { getItem: () => null, setItem: () => {} },
  });
}

test("intro markup binds its aria label and every visible non-brand fragment", () => {
  const intro = introMarkup();
  assert.match(intro, /id="introScreen"[^>]*data-i18n-aria-label="intro\.screen\.aria"/);

  const cards = [...intro.matchAll(/<div class="intro-card[^>]*>[\s\S]*?<\/div>/g)].map((match) => match[0]);
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.match(card, /<h1 class="intro-title-brand">HEY, BACKPACKER!<\/h1>/);
    assert.doesNotMatch(card, /<h1 class="intro-title-brand"[^>]*data-i18n/);
    for (const match of card.matchAll(/<(span|button)\b([^>]*)>([^<]+)<\/\1>/g)) {
      assert.match(match[2], /data-i18n="intro\.[^"]+"/, `unbound intro copy: ${match[3].trim()}`);
    }
  }

  const boundKeys = [...intro.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(new Set(boundKeys), new Set(Object.keys(expected)));
  assert.equal(boundKeys.filter((key) => key === "intro.action.next").length, 2);
});

test("intro dictionaries preserve exact Russian copy and approved English copy", () => {
  for (const [key, [russian, english]] of Object.entries(expected)) {
    assert.equal(dictionaries.ru[key], russian, `unexpected ru value: ${key}`);
    assert.equal(dictionaries.en[key], english, `unexpected en value: ${key}`);
  }
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.ru).sort());
});

test("English intro keys resolve without Russian fallback", async () => {
  const i18n = createEnglishI18n();
  assert.equal(await i18n.init(), "en");
  for (const [key, [, english]] of Object.entries(expected)) {
    assert.equal(i18n.t(key), english, `English intro key fell back: ${key}`);
  }
});
