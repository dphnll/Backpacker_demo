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

test("every Share key referenced by UI exists in both locales", () => {
  const references = new Set(
    [...`${index}\n${app}`.matchAll(/["'](share\.[a-z0-9.]+)["']/g)].map((match) => match[1]),
  );
  assert.ok(references.size >= 145, "Share needs link, read-only, received, profile, PDF, and proposal coverage");
  for (const key of references) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing ru key: ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing en key: ${key}`);
  }
});

test("English Share messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("share."));
  assert.ok(messages.length >= 160);
  for (const [key, value] of messages) {
    assert.doesNotMatch(value, /[А-Яа-яЁё]/, `English Share fallback leaked into ${key}`);
  }
});

test("Share, proposal, received, and profile sheets use the shared locale layer", () => {
  [
    "share.received.save",
    "share.proposal.mine.title",
    "share.proposal.inbox.aria",
    "share.proposal.expense.title",
    "share.proposal.item.title",
    "share.app.title",
    "share.sheet.title",
    "share.text.action",
    "share.link.open",
    "share.link.include.budget",
    "share.link.input.aria",
    "share.link.revoke",
    "share.pdf.include.notes",
    "share.pdf.include.unscheduled",
    "share.profile.title",
    "share.profile.email.title",
  ].forEach((key) => assert.match(index, new RegExp(`data-i18n(?:-aria-label|-placeholder)?="${key.replaceAll(".", "\\.")}"`)));
});

test("dynamic Share presentation uses locale keys", () => {
  const sources = [
    functionSource("formatProposalStatus", "resetExpenseProposalDraft"),
    functionSource("renderExpenseProposalSheet", "submitExpenseProposal"),
    functionSource("renderItemProposalSheet", "getItemProposalFormData"),
    functionSource("renderMyItemProposals", "renderProposalInbox"),
    functionSource("renderProposalInbox", "renderShareRoleBanner"),
    functionSource("renderShareRoleBanner", "refreshAuthorExpenseProposals"),
    functionSource("renderTripLinkOptions", "showTripLinkOptions"),
    functionSource("buildShareText", "buildEstimateText"),
    functionSource("setTripPdfButtonsBusy", "prepareTripPdfExport"),
  ];
  sources.forEach((source) => assert.doesNotMatch(withoutComments(source), /[А-Яа-яЁё]/));
});

test("Share model, permissions, hidden-budget, and Supabase actions remain unchanged", () => {
  const published = functionSource("buildPublishedTripState", "publishTripShare");
  assert.match(published, /includeBudget \? published : window\.BackpackerFinancial\.stripFinancialFields\(published\)/);
  assert.match(published, /delete published\.trip\.aiSourceText/);

  const publish = functionSource("publishTripShare", "updatePublishedTripShare");
  assert.match(publish, /callTripShareFunction\("publish"/);
  assert.match(publish, /schemaVersion: TRIP_SHARE_SCHEMA_VERSION/);
  assert.match(publish, /state: buildPublishedTripState\(\{ includeBudget \}\)/);

  const update = functionSource("updatePublishedTripShare", "ensureTripSharePublished");
  assert.match(update, /callTripShareFunction\("update"/);
  assert.match(update, /schemaVersion: TRIP_SHARE_SCHEMA_VERSION/);

  const revoke = functionSource("revokeTripShareLink", "buildShareText");
  assert.match(revoke, /callTripShareFunction\("revoke", \{ tripId: state\.trip\.id \}/);

  const received = functionSource("saveReceivedTrip", "openReceivedTrip");
  assert.match(received, /callTripShareFunction\("save_received", \{ shareId: readOnlyShare\.shareId \}/);
  assert.match(received, /readOnlyShare\.isSaved = true/);
});

test("read-only and received flows keep their existing access gates", () => {
  const load = functionSource("loadReadOnlyShareFromUrl", "isReadOnlyMode");
  assert.match(load, /callTripShareFunction\("read", \{ token \}, \{ useExistingSession: true \}\)/);
  assert.match(load, /includeBudget: payload\.includeBudget !== false/);

  const button = functionSource("renderSaveReceivedTripButton", "saveReceivedTrip");
  assert.match(button, /!readOnlyShare\.isOwner/);
  assert.match(button, /!readOnlyShare\.isSaved/);
  assert.match(button, /readOnlyShare\.source === "public_link"/);

  const proposals = functionSource("openItemProposalSheet", "renderItemProposalSheet");
  assert.match(proposals, /readOnlyShare\?\.isOwner/);
  assert.match(proposals, /readOnlyShare\?\.isAuthor/);
});

test("Share preserves approved English terminology", () => {
  assert.deepEqual(
    ["Paid", "Booked", "Want to do", "Considering", "Backup option", "Skipped"],
    ["paid", "fixed", "want", "maybe", "backup", "skipped"].map((key) => dictionaries.en[`item.editor.status.${key}`]),
  );
  assert.equal(dictionaries.en["plan.unscheduled.title"], "Unscheduled");
  assert.equal(dictionaries.en["plan.unscheduled.subtitle"], "Ideas to schedule");
  assert.equal(dictionaries.en["share.text.unscheduled"], "Unscheduled:");
});

test("Share translations interpolate author, link, and proposal UI", async () => {
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
  assert.equal(ru.t("share.role.author", { name: "Ирина" }), "Автор — Ирина");
  assert.equal(ru.t("share.proposal.inbox.title", { count: 2 }), "Предложения · 2");

  const en = await create("en");
  assert.equal(en.t("share.role.author", { name: "Alex" }), "Author — Alex");
  assert.equal(en.t("share.text.day", { day: 2, date: "25/08/2026" }), "Day 2 · 25/08/2026");
  assert.equal(en.t("share.proposal.expense.share", { amount: "$40", status: "Accepted" }), "Your share: $40 · Accepted");
});

test("Share release uses a fresh versioned app asset and PWA cache", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(index, /\.\/app\.js\?v=i18n-export-20260825/);
  assert.match(serviceWorker, /backpacker-pwa-v123/);
  assert.match(serviceWorker, /\.\/app\.js\?v=i18n-export-20260825/);
});

test("Share copy and proposal edge errors use locale keys", () => {
  const copy = functionSource("copyText", "openSheet");
  assert.doesNotMatch(copy, /[А-Яа-яЁё]/);
  assert.match(copy, /window\.t\("share\.copy\.done"\)/);
  assert.doesNotMatch(app, /showToast\("Не удалось открыть форму идеи"\)/);
  assert.doesNotMatch(app, /showToast\("Введите имя"\)/);
  assert.match(app, /window\.t\("share\.proposal\.item\.open\.error"\)/);
  assert.match(app, /window\.t\("share\.proposal\.expense\.name\.required"\)/);
});
