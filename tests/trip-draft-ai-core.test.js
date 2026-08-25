const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const core = require("../trip-draft-ai-core.js");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const functionSource = fs.readFileSync(path.join(__dirname, "../supabase/functions/trip-draft-ai/index.ts"), "utf8");

function draft(overrides = {}) {
  return {
    trip: {
      title: "Грузия", destination: "Грузия", startDate: "", endDate: "", dayCount: 5,
      datePrecision: "none", dateSourceText: null, currency: "GEL",
      budgetLimit: 0, budgetLevel: "unknown", budgetSourceText: null, preferencesText: "",
      ...(overrides.trip || {}),
    },
    items: overrides.items || [],
    questions: overrides.questions || [],
  };
}

function item(overrides = {}) {
  return {
    title: "Винодельня", type: "excursion", status: "want", priority: "nice",
    date: "", dayIndex: 1, startTime: "", durationMinutes: 0,
    price: 0, priceConfidence: "unknown", priceSourceText: null,
    link: "", locationText: "", notes: "", ...overrides,
  };
}

// --- date grounding ---

test("the prompt states today instead of leaving the model to guess", () => {
  const prompt = core.buildTripDraftPrompt({ today: "2026-08-04", timezone: "Europe/Moscow" });
  assert.match(prompt, /Сегодняшняя дата: 2026-08-04\./);
  assert.match(prompt, /Часовой пояс пользователя: Europe\/Moscow\./);
  assert.match(prompt, /не полагайся на собственные представления о текущем дне/);
});

test("without a supplied date the prompt forbids inferring a year at all", () => {
  const prompt = core.buildTripDraftPrompt({});
  assert.match(prompt, /Сегодняшняя дата не передана/);
  assert.doesNotMatch(prompt, /Сегодняшняя дата: /);
});

test("the client sends its own local calendar day, not a UTC one", () => {
  assert.match(appSource, /today: getClientTodayIsoDate\(\)/);
  const start = appSource.indexOf("function getClientTodayIsoDate");
  const body = appSource.slice(start, appSource.indexOf("\n}", start));
  // toISOString would report the previous day for anyone east of UTC late in the evening.
  assert.doesNotMatch(body, /toISOString/);
  assert.match(body, /getFullYear\(\)/);
});

test("the edge function forwards today, timezone, and locale into the prompt", () => {
  assert.match(functionSource, /const today = safeString\(body\.today, 10\)/);
  assert.match(functionSource, /const timezone = safeString\(body\.timezone, 80\)/);
  assert.match(functionSource, /buildTripDraftPrompt\(\{ today, timezone, locale \}\)/);
});

// --- schema version ---

test("only the supported schema version is accepted", () => {
  assert.equal(core.assertSupportedSchemaVersion("trip_draft_ai.v1"), "trip_draft_ai.v1");
  assert.throws(() => core.assertSupportedSchemaVersion("trip_draft_ai.v2"), /trip_draft_schema_version_unsupported/);
  assert.throws(() => core.assertSupportedSchemaVersion(""), /trip_draft_schema_version_missing/);
  assert.throws(() => core.assertSupportedSchemaVersion(undefined), /trip_draft_schema_version_missing/);
});

test("the edge function rejects an incompatible contract before calling the model", () => {
  const start = functionSource.indexOf("async function parseDraft");
  const body = functionSource.slice(start, functionSource.indexOf("const response = await fetch", start));
  assert.match(body, /assertSupportedSchemaVersion\(body\.schemaVersion\)/);
});

// --- link guardrail ---

test("a URL the traveller never wrote is dropped", () => {
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ link: "https://invented-winery.ge/tour" })] }),
    "Хочу 5 дней в Грузии, люблю вино",
  );
  assert.equal(result.items[0].link, "");
});

test("a URL the traveller wrote themselves survives", () => {
  const url = "https://winery.ge/tour";
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ link: url })] }),
    `Хочу в Грузию, вот ссылка ${url} посмотри`,
  );
  assert.equal(result.items[0].link, url);
});

// --- price guardrail ---

test("a price the traveller never named is dropped to unknown", () => {
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ price: 4500, priceConfidence: "confirmed", priceSourceText: "4500 рублей" })] }),
    "Хочу 5 дней в Грузии, люблю вино",
  );
  assert.deepEqual(
    { price: result.items[0].price, confidence: result.items[0].priceConfidence, source: result.items[0].priceSourceText },
    { price: 0, confidence: "unknown", source: "" },
  );
});

test("a price the traveller stated exactly stays confirmed", () => {
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ price: 4500, priceConfidence: "confirmed", priceSourceText: "4500 рублей" })] }),
    "Экскурсия стоит 4500 рублей",
  );
  assert.equal(result.items[0].price, 4500);
  assert.equal(result.items[0].priceConfidence, "confirmed");
});

test("a spaced amount matches the model's unspaced number", () => {
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ price: 25000, priceConfidence: "confirmed", priceSourceText: "25000" })] }),
    "Бюджет на экскурсию 25 000 рублей",
  );
  assert.equal(result.items[0].price, 25000);
});

test("a price range is kept as an estimate and never collapses into a fact", () => {
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ price: 2000, priceConfidence: "estimate", priceSourceText: "2000-3000 рублей" })] }),
    "Билет стоит 2000-3000 рублей",
  );
  const kept = result.items[0];
  assert.equal(kept.priceConfidence, "estimate", "a range must never become confirmed");
  assert.equal(kept.price, 2000, "the lower bound is stored so the trip never overstates a commitment");
  assert.equal(kept.priceSourceText, "2000-3000 рублей", "the full range survives so the UI can show it verbatim");
});

test("an estimate without the traveller's wording behind it collapses to unknown", () => {
  const result = core.applyDraftGuardrails(
    draft({ items: [item({ price: 3000, priceConfidence: "estimate", priceSourceText: "" })] }),
    "Поездка в Грузию на 3000 километров",
  );
  assert.equal(result.items[0].priceConfidence, "unknown");
  assert.equal(result.items[0].price, 0);
});

// --- budget model ---

test("a qualitative level is kept only when the traveller said it", () => {
  const said = core.applyDraftGuardrails(
    draft({ trip: { budgetLevel: "medium", budgetSourceText: "бюджет средний" } }),
    "Хочу 5 дней в Грузии, бюджет средний",
  );
  assert.equal(said.trip.budgetLevel, "medium");

  const invented = core.applyDraftGuardrails(
    draft({ trip: { budgetLevel: "medium", budgetSourceText: "бюджет средний" } }),
    "Хочу 5 дней в Грузии, люблю вино",
  );
  assert.equal(invented.trip.budgetLevel, "unknown");
});

test("a stated sum never produces a level, and a level never produces a sum", () => {
  const onlySum = core.applyDraftGuardrails(
    draft({ trip: { budgetLimit: 100000, budgetLevel: "high", budgetSourceText: "100000 рублей" } }),
    "Бюджет 100000 рублей",
  );
  assert.equal(onlySum.trip.budgetLimit, 100000);
  assert.equal(onlySum.trip.budgetLevel, "high", "the level survives only because its wording is grounded");

  const derived = core.applyDraftGuardrails(
    draft({ trip: { budgetLimit: 100000, budgetLevel: "high", budgetSourceText: "дорого" } }),
    "Бюджет 100000 рублей",
  );
  assert.equal(derived.trip.budgetLimit, 100000);
  assert.equal(derived.trip.budgetLevel, "unknown", "a level with no wording in the text must not be inferred from the sum");

  const onlyLevel = core.applyDraftGuardrails(
    draft({ trip: { budgetLimit: 80000, budgetLevel: "low", budgetSourceText: "бюджетно" } }),
    "Хочу бюджетно",
  );
  assert.equal(onlyLevel.trip.budgetLevel, "low");
  assert.equal(onlyLevel.trip.budgetLimit, 0, "a sum must not be invented from a level");
});

test("both survive when the traveller named both", () => {
  const result = core.applyDraftGuardrails(
    draft({ trip: { budgetLimit: 90000, budgetLevel: "medium", budgetSourceText: "средний бюджет" } }),
    "Средний бюджет, примерно 90000 рублей на всё",
  );
  assert.equal(result.trip.budgetLevel, "medium");
  assert.equal(result.trip.budgetLimit, 90000);
});

// --- single prompt source ---

test("the rules live in exactly one place", () => {
  assert.ok(core.TRIP_DRAFT_RULES.length > 20, "the shared module owns the rule set");
  // The edge function used to carry an English list and a Russian list that drifted apart.
  assert.doesNotMatch(functionSource, /tripDraftSystemPrompt/);
  assert.doesNotMatch(functionSource, /const prompt = \[/);
  assert.match(functionSource, /import "\.\.\/\.\.\/\.\.\/trip-draft-ai-core\.js"/);
  assert.match(functionSource, /schema: draftCore\.tripDraftSchema/);
});

test("the guardrails also run server-side, not only in the browser", () => {
  assert.match(functionSource, /draftCore\.applyDraftGuardrails\(JSON\.parse\(outputText\), text\)/);
});

// --- draft to trip conversion ---

test("an unknown price reaches the trip without an allocation", () => {
  const start = appSource.indexOf("function createTripEntryFromDraft");
  const body = appSource.slice(start, appSource.indexOf("\n}", start));
  assert.match(body, /priceConfidence !== "unknown" && price > 0/);
  // Confirmation is where a document-extracted value may become confirmed, and only when the
  // document speaks the trip's currency; a text-path value keeps the confidence it had.
  assert.match(body, /resolveConfirmedPriceConfidence\?\.\(item, draft\.trip\.currency\)/);
  assert.match(body, /const price = priceConfidence === "unknown" \? 0 : item\.price/);
});

test("editing the preview does not erase the traveller's own numbers", () => {
  // Guardrails ground values against the original description; preview edits are not in it.
  assert.match(appSource, /\}, sourceTextForPreview, \{ applyGuardrails: false \}\)/);
  assert.match(appSource, /applyGuardrails = true/);
});

test("a hand-typed price becomes the traveller's confirmed number", () => {
  const start = appSource.indexOf("function collectTripDraftPreviewForm");
  const body = appSource.slice(start, appSource.indexOf("\n}", start));
  assert.match(body, /!nextPrice \? "unknown" : priceChanged \? "confirmed"/);
});
