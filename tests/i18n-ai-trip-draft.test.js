const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const core = require("../trip-draft-ai-core.js");
const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const app = read("app.js");
const index = read("index.html");
const edge = read("supabase/functions/trip-draft-ai/index.ts");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

function functionSource(name, nextName) {
  const candidates = [`function ${name}(`, `async function ${name}(`];
  const start = candidates.map((candidate) => app.indexOf(candidate)).find((position) => position >= 0);
  assert.notEqual(start, undefined, `${name} must exist`);
  if (!nextName) return app.slice(start);
  const nextCandidates = [`function ${nextName}(`, `async function ${nextName}(`];
  const end = nextCandidates.map((candidate) => app.indexOf(candidate, start + 1)).find((position) => position >= 0);
  assert.notEqual(end, undefined, `${nextName} must follow ${name}`);
  return app.slice(start, end);
}

test("AI Draft UI references a complete ru/en locale namespace", () => {
  const direct = [...`${index}\n${app}`.matchAll(/["'](ai\.draft\.[a-z0-9.]+)["']/g)].map((match) => match[1]);
  const helper = [...app.matchAll(/tripDraftT\("([a-z0-9.]+)"/g)].map((match) => `ai.draft.${match[1]}`);
  const references = new Set([...direct, ...helper]);
  assert.ok(references.size >= 95, "AI Draft needs entry, voice, documents, preview, validation, and confirmation coverage");
  for (const key of references) {
    assert.equal(typeof dictionaries.ru[key], "string", `missing ru key: ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `missing en key: ${key}`);
  }
  assert.deepEqual(
    Object.keys(dictionaries.ru).filter((key) => key.startsWith("ai.draft.")).sort(),
    Object.keys(dictionaries.en).filter((key) => key.startsWith("ai.draft.")).sort(),
  );
});

test("English AI Draft messages contain no Russian fallback copy", () => {
  const messages = Object.entries(dictionaries.en).filter(([key]) => key.startsWith("ai.draft."));
  assert.ok(messages.length >= 95);
  messages.forEach(([key, value]) => assert.doesNotMatch(value, /[А-Яа-яЁё]/, `Russian fallback leaked into ${key}`));
});

test("static AI Draft sheet copy and accessibility labels use i18n bindings", () => {
  const start = index.indexOf('id="tripDraftAiSheet"');
  const end = index.indexOf('<section class="trip-list-section">', start);
  const sheet = index.slice(start, end);
  [
    "ai.draft.resume.aria",
    "ai.draft.input.copy.title",
    "ai.draft.input.aria",
    "ai.draft.input.placeholder",
    "ai.draft.voice.record",
    "ai.draft.documents.aria",
    "ai.draft.documents.comment.placeholder",
    "ai.draft.preview.intro",
    "ai.draft.preview.create",
  ].forEach((key) => assert.match(sheet, new RegExp(`data-i18n(?:-aria-label|-placeholder)?="${key.replaceAll(".", "\\.")}"`)));
});

test("dynamic AI Draft UI uses locale keys instead of hardcoded Russian copy", () => {
  const sources = [
    functionSource("renderTripDraftAiSheet", "createEmptyTripDraftAiState"),
    functionSource("addBookingPackFiles", "reconcileBookingPackFiles"),
    functionSource("renderTripDraftDocumentsStep", "handleTripDraftDocumentsSelection"),
    functionSource("parseBookingPackDocuments", "getTripDraftPendingKey"),
    functionSource("restoreTripDraftPending", "continueTripDraftPending"),
    functionSource("restartTripDraftPending", "openTripDraftAiSheet"),
    functionSource("startTripDraftTextMode", "cleanupTripDraftAiRecording"),
    functionSource("toggleTripDraftRecording", "normalizeTripDraftItemType"),
    functionSource("getTripDraftAiCore", "collectTripDraftPreviewForm"),
    functionSource("handleTripDraftPreviewAction", "parseTripDraftText"),
    functionSource("parseTripDraftText", "createTripEntryFromDraft"),
    functionSource("attachBookingPackDocuments", "createNewTrip"),
  ];
  sources.forEach((source) => assert.doesNotMatch(source, /[А-Яа-яЁё]/));
});

test("locale is explicit from UI through text, voice, and document Edge Function actions", () => {
  const client = functionSource("callTripDraftAiFunction", "callLinkIntakeFunction");
  assert.match(client, /JSON\.stringify\(\{ action, \.\.\.payload, locale: getTripDraftLocale\(\) \}\)/);
  assert.doesNotMatch(functionSource("parseTripDraftText", "createTripEntryFromDraft"), /locale:\s*"ru-RU"/);
  assert.match(edge, /const locale = draftCore\.normalizeAiDraftLocale\(body\.locale\)/);
  assert.match(edge, /form\.append\("language", draftCore\.normalizeAiDraftLocale\(body\.locale\)\)/);
  assert.match(edge, /buildTripDraftPrompt\(\{ today, timezone, locale \}\)/);
  assert.match(edge, /buildBookingPackPrompt\(\{[\s\S]*?locale \}\)/);
  assert.match(edge, /applyBookingPackEvidenceRules\(JSON\.parse\(outputText\), \{ fileIds, locale \}\)/);
});

test("ru and en prompt contracts keep the same grounding and safety boundaries", () => {
  const ru = core.buildTripDraftPrompt({ today: "2026-08-24", timezone: "Europe/Moscow", locale: "ru" });
  const en = core.buildTripDraftPrompt({ today: "2026-08-24", timezone: "Europe/London", locale: "en" });
  assert.match(ru, /Пиши все создаваемые человекочитаемые поля по-русски/);
  assert.match(ru, /Не изменяй исходный текст пользователя/);
  assert.match(en, /Write all generated human-readable fields in English/);
  assert.match(en, /Do not alter the traveller's original source text/);
  assert.match(en, /Never invent a URL/);
  assert.match(en, /Never invent a price/);
  assert.match(en, /Default status is want\. Default priority is nice/);
  assert.match(en, /• Must-have:/);
  assert.doesNotMatch(en, /[А-Яа-яЁё]/);
  assert.equal(core.normalizeAiDraftLocale("en-GB"), "en");
  assert.equal(core.normalizeAiDraftLocale("ru-RU"), "ru");
  assert.equal(core.normalizeAiDraftLocale("ka-GE"), "ru");
});

test("Booking Pack prompt and deterministic fallbacks follow locale", () => {
  const enPrompt = core.buildBookingPackPrompt({ today: "2026-08-24", locale: "en" });
  assert.match(enPrompt, /Write all generated human-readable fields in English/);
  assert.match(enPrompt, /Do not copy booking codes or PNRs/);
  assert.doesNotMatch(enPrompt, /[А-Яа-яЁё]/);

  const result = core.applyBookingPackEvidenceRules({
    trip: { title: "", destination: "", currency: "EUR", preferencesText: "" },
    items: [{ title: "Museum", price: 50, currency: "EUR", evidenceText: "", sourceFileIndex: [], notes: "" }],
    questions: [],
  }, { fileIds: [], locale: "en" });
  assert.equal(result.trip.title, "Trip from documents");
  assert.match(result.questions[0], /does not confirm a price/);
  assert.doesNotMatch(result.questions.join(" "), /[А-Яа-яЁё]/);
});

test("client chronology questions follow the selected preview locale", () => {
  const result = core.applyTripChronology({
    locale: "en",
    trip: { startDate: "2026-09-01", endDate: "2026-09-03", dayCount: 3 },
    items: [{ title: "Museum", date: "2026-09-10", dayIndex: 0 }],
    questions: [],
  });
  assert.match(result.questions[0], /falls outside the trip dates/);
  assert.doesNotMatch(result.questions[0], /[А-Яа-яЁё]/);
});

test("source text and preferences semantics survive the confirmation boundary", () => {
  const parse = functionSource("parseTripDraftText", "createTripEntryFromDraft");
  const create = functionSource("createTripEntryFromDraft", "attachBookingPackDocuments");
  assert.match(parse, /const text = input\?\.value\.trim\(\) \|\| ""/);
  assert.match(parse, /callTripDraftAiFunction\("parse", \{\s*text,/);
  assert.doesNotMatch(parse, /persistTripStore/);
  assert.match(create, /preferencesText: draft\.trip\.preferencesText/);
  assert.match(create, /aiSourceText: String\(tripDraftAiState\.sourceText \|\| ""\)\.trim\(\)/);
  const confirm = functionSource("createTripFromAiDraft", "createNewTrip");
  assert.ok(confirm.indexOf("syncTripDraftPreviewStateFromForm()") < confirm.indexOf("persistTripStore(tripStore)"));
});

test("AI Draft ships in a fresh versioned app shell", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(index, /\.\/trip-draft-ai-core\.js\?v=i18n-ai-draft-20260824/);
  assert.match(index, /\.\/app\.js\?v=p0-language-access-20260830/);
  assert.match(serviceWorker, /backpacker-pwa-v130/);
  assert.match(serviceWorker, /\.\/trip-draft-ai-core\.js\?v=i18n-ai-draft-20260824/);
  assert.match(serviceWorker, /\.\/app\.js\?v=p0-language-access-20260830/);
});

test("Booking Pack recovery controls are localized declaratively", () => {
  assert.match(index, /id="bookingPackUploadRetryButton"[^>]+data-i18n="ai\.draft\.attachments\.retry"/);
  assert.match(index, /id="bookingPackUploadDismissButton"[^>]+data-i18n="ai\.draft\.attachments\.dismiss"/);
  assert.doesNotMatch(dictionaries.en["ai.draft.attachments.retry"], /[А-Яа-яЁё]/);
  assert.doesNotMatch(dictionaries.en["ai.draft.attachments.dismiss"], /[А-Яа-яЁё]/);
});
