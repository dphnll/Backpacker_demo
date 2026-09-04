const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const app = read("app.js");
const index = read("index.html");
const styles = read("styles.css");
const serviceWorker = read("service-worker.js");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

const STORE_URL = "https://chromewebstore.google.com/detail/backpacker-travel-capture/okpfmpplfciccfddgibkcoliemfimifc";
const expectedCopy = {
  "ideas.extension.title": ["Собирайте идеи прямо в браузере", "Save ideas right in your browser"],
  "ideas.extension.body": ["Нашли ресторан, экскурсию, отель или интересное место?\nРасширение Backpacker для Chrome сохранит находку со страницы и отправит её прямо в «Идеи» в приложении.", "Found a restaurant, tour, hotel, or interesting place?\nThe Backpacker Chrome extension will save it from the page and send it straight to Ideas in the app."],
  "ideas.extension.secondary": ["Ссылка, название, изображение и цена будут в карточке, если они доступны на найденной странице.", "The link, title, image, and price will be included in the card when they are available on that page."],
  "ideas.extension.device": ["Расширение работает в Chrome на компьютере", "The extension works in Chrome on desktop"],
  "ideas.extension.cta": ["Открыть расширение", "Get the extension"],
  "home.support.product.body.extension": ["Идеи можно добавлять вручную или собирать прямо из браузера с помощью расширения Backpacker для Chrome.", "You can add ideas manually or collect them straight from the browser with the Backpacker Chrome extension."],
  "home.support.howto.extension.title": ["Как собирать идеи из браузера", "How to collect ideas from your browser"],
  "home.support.howto.extension.body": ["У Backpacker есть расширение для Chrome на компьютере. Оно помогает сохранять находки во время поиска поездки, не копируя ссылки и данные вручную.", "Backpacker has a Chrome extension for desktop. It lets you save useful finds while researching a trip instead of copying links and details by hand."],
  "home.support.howto.extension.step1": ["Установите Backpacker Travel Capture из Chrome Web Store.", "Install Backpacker Travel Capture from the Chrome Web Store."],
  "home.support.howto.extension.step2": ["Подключите расширение к своему Backpacker.", "Connect the extension to your Backpacker."],
  "home.support.howto.extension.step3": ["На интересной странице откройте расширение, проверьте собранную карточку и отправьте её в Backpacker.", "On a page you want to keep, open the extension, review the captured card and send it to Backpacker."],
  "home.support.howto.extension.step4": ["Находка появится в разделе «Идеи», откуда её потом можно добавить в нужную поездку.", "The find appears in Ideas, where you can later add it to any trip."],
  "home.support.howto.extension.note": ["Расширение сохраняет только то, что вы явно решили сохранить. Найденные на странице ссылка, название, изображение и цена могут быть перенесены в карточку и остаются редактируемыми.", "The extension saves only what you explicitly choose to save. A source link, title, image and detected price can be carried into the card when available, and remain editable."],
  "home.support.howto.extension.cta": ["Установить расширение", "Get the extension"],
};

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `missing ${name}`);
  assert.notEqual(end, -1, `missing ${nextName}`);
  return app.slice(start, end);
}

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return source.slice(start, end);
}

function renderIdeasState(kind, locale) {
  const render = functionSource("renderIdeasStateCard", "renderIdeasScreen");
  const result = { html: "" };
  vm.runInNewContext(`${app.match(/const CHROME_EXTENSION_STORE_URL = [^;]+;/)[0]}\n${render}\nresult.html = renderIdeasStateCard(kind);`, {
    escapeAttr: (value) => String(value),
    escapeHtml: (value) => String(value),
    getCurrentIdeaCollectionTitle: () => "Collection",
    ideasState: { error: "Error" },
    kind,
    result,
    window: { t: (key) => dictionaries[locale][key] || key },
  });
  return result.html;
}

test("the true Ideas empty state keeps primary actions and adds the compact Extension promo", () => {
  const source = functionSource("renderIdeasStateCard", "renderIdeasScreen");
  const russian = renderIdeasState("empty-all", "ru");
  const english = renderIdeasState("empty-all", "en");

  assert.equal((source.match(/ideas-extension-promo/g) || []).length, 1);
  for (const html of [russian, english]) {
    assert.match(html, /data-open-idea-form/);
    assert.match(html, /data-open-idea-collection-form/);
    assert.match(html, /class="ideas-state-card ideas-extension-promo"/);
    assert.match(html, /class="ghost-button ideas-extension-cta"/);
  }
  assert.match(russian, />Добавить идею</);
  assert.match(russian, />Создать подборку</);
  assert.match(english, />Add idea</);
  assert.match(english, />Create collection</);
});

test("filtered and filled Ideas states do not render the large Extension promo", () => {
  const screen = functionSource("renderIdeasScreen", "scrollIdeasScreenToTopAfterSave");
  assert.doesNotMatch(renderIdeasState("empty-filter", "en"), /ideas-extension-promo/);
  assert.match(screen, /if \(!inboxIdeas\.length\) \{[\s\S]*renderIdeasStateCard\("empty-all"\)[\s\S]*return;/);
  assert.match(screen, /if \(!filteredIdeas\.length\) \{[\s\S]*renderIdeasStateCard\("empty-filter"\)[\s\S]*return;/);
  assert.match(screen, /list\.innerHTML = filteredIdeas\.map\(renderIdeaCard\)\.join\(""\);/);
  assert.doesNotMatch(index, /ideas-extension-promo/);
});

test("About and How-to extend the released localized support surfaces", () => {
  const product = sectionBetween(index, '<div class="sheet" id="productInfoSheet"', '<div class="sheet" id="howToSheet"');
  const howTo = sectionBetween(index, '<div class="sheet" id="howToSheet"', '<div class="sheet" id="homeShareSheet"');

  assert.match(product, /<p data-i18n="home\.support\.product\.body\.extension">/);
  assert.match(howTo, /<summary data-i18n="home\.support\.howto\.extension\.title">/);
  assert.equal((howTo.match(/data-i18n="home\.support\.howto\.extension\.step[1-4]"/g) || []).length, 4);
  assert.match(howTo, /data-i18n="home\.support\.howto\.extension\.note"/);
  assert.match(howTo, /data-i18n="home\.support\.howto\.extension\.cta"/);
  assert.match(styles, /\.ideas-state-card\s*\{[\s\S]*?border:\s*1px dashed rgba\(18, 54, 61, 0\.22\);[\s\S]*?box-shadow:\s*5px 5px 0 rgba\(18, 54, 61, 0\.07\);/);
  assert.match(styles, /\.ideas-extension-promo \.ideas-extension-cta\s*\{[\s\S]*?min-height:\s*40px;[\s\S]*?background:\s*var\(--active-button-gradient\);[\s\S]*?box-shadow:\s*var\(--active-button-shadow\);[\s\S]*?font-size:\s*16px;[\s\S]*?font-weight:\s*700;/);
});

test("approved RU and EN Extension discovery copy is exact and parity-safe", () => {
  assert.equal(Object.keys(expectedCopy).length, 14);
  for (const [key, [ru, en]] of Object.entries(expectedCopy)) {
    assert.equal(dictionaries.ru[key], ru, `RU ${key}`);
    assert.equal(dictionaries.en[key], en, `EN ${key}`);
    assert.doesNotMatch(en, /[А-ЯЁа-яё]/, key);
  }
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.ru).sort());
});

test("both Extension CTAs resolve to the exact safe Chrome Web Store listing", () => {
  const russian = renderIdeasState("empty-all", "ru");
  const howTo = sectionBetween(index, '<div class="sheet" id="howToSheet"', '<div class="sheet" id="homeShareSheet"');
  const runtimeUrl = app.match(/const CHROME_EXTENSION_STORE_URL = "([^"]+)";/)?.[1];
  const staticUrl = howTo.match(/<a[^>]+href="([^"]+)"[^>]+data-i18n="home\.support\.howto\.extension\.cta"/)?.[1];

  assert.equal(runtimeUrl, STORE_URL);
  assert.equal(staticUrl, STORE_URL);
  assert.match(russian, new RegExp(`href="${STORE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(russian, /target="_blank" rel="noopener noreferrer"/);
  assert.match(howTo, /target="_blank" rel="noopener noreferrer"[^>]*data-i18n="home\.support\.howto\.extension\.cta"/);
  assert.doesNotMatch(`${runtimeUrl}\n${staticUrl}`, /[?&](?:hl|utm_source)=/);
});

test("release and Extension integration boundaries remain unchanged", () => {
  assert.match(app, /const APP_VERSION = "1\.1\.2\.84";/);
  assert.match(serviceWorker, /const CACHE_NAME = "backpacker-pwa-v132";/);
  assert.doesNotMatch(`${app}\n${index}`, /extension_(?:install|store)_clicked/);
  assert.doesNotMatch(app, /chrome\.management|chrome\.runtime\.getManifest|chromewebstore\.install/);
  assert.equal((app.match(/CHROME_EXTENSION_STORE_URL/g) || []).length, 2);
});
