const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const core = require("../trip-draft-ai-core.js");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const functionSource = fs.readFileSync(path.join(__dirname, "../supabase/functions/trip-draft-ai/index.ts"), "utf8");

const OCTOBER = { startDate: "2026-10-10", endDate: "2026-10-14", dayCount: 5 };
const NO_DATES = { startDate: "", endDate: "", dayCount: 5 };

function item(overrides = {}) {
  return { title: "Музей", type: "place", date: "", dayIndex: 0, startTime: "", ...overrides };
}

function run(items, trip = OCTOBER, questions = []) {
  return core.applyTripChronology({ trip, items, questions });
}

// --- R1: explicit date ---

test("a date inside the trip is used as given", () => {
  const result = run([item({ title: "Ужин", date: "2026-10-12" })]);
  assert.equal(result.items[0].date, "2026-10-12");
  assert.equal(result.questions.length, 0);
});

test("arrival on the first day and the return on the last day keep their dates", () => {
  const result = run([
    item({ title: "Перелёт в Тбилиси", type: "transport", date: "2026-10-10" }),
    item({ title: "Обратный рейс", type: "transport", date: "2026-10-14" }),
  ]);
  assert.deepEqual(result.items.map((entry) => entry.date), ["2026-10-10", "2026-10-14"]);
  assert.equal(result.questions.length, 0);
});

test("a date outside the trip is never clamped to the first or last day", () => {
  const result = run([item({ title: "Музей", date: "2026-10-20" })]);
  assert.equal(result.items[0].date, "", "the card waits without a day instead of moving silently");
  assert.notEqual(result.items[0].date, OCTOBER.startDate);
  assert.notEqual(result.items[0].date, OCTOBER.endDate);
  assert.match(result.questions[0], /вне дат поездки/);
});

test("a calendar date cannot be placed on a trip that has no dates", () => {
  // Keeping it would hide the card: numbered days and ISO dates never match.
  const result = run([item({ title: "Ужин", date: "2026-10-12" })], NO_DATES);
  assert.equal(result.items[0].date, "");
  assert.match(result.questions[0], /не заданы даты/);
});

// --- R2: dayIndex ---

test("a museum on the third day lands on the third calendar day", () => {
  const result = run([item({ title: "Музей", dayIndex: 3 })]);
  assert.equal(result.items[0].date, "2026-10-12");
  assert.equal(result.questions.length, 0);
});

test("a numbered day without calendar dates stays a numbered day", () => {
  const result = run([item({ dayIndex: 3 })], NO_DATES);
  assert.equal(result.items[0].date, "day-3");
});

test("a day beyond the trip is not invented into range", () => {
  const result = run([item({ title: "Музей", dayIndex: 9 })]);
  assert.equal(result.items[0].date, "");
  assert.match(result.questions[0], /которого нет в поездке/);
});

// --- R3: conflict ---

test("a contradicting date and day keeps the date and says so", () => {
  const result = run([item({ title: "Ужин", date: "2026-10-13", dayIndex: 1 })]);
  assert.equal(result.items[0].date, "2026-10-13");
  assert.match(result.questions[0], /дата и день не совпали/);
});

test("a contradiction can never survive into the card", () => {
  const result = run([item({ date: "2026-10-13", dayIndex: 1 })]);
  assert.equal(Object.hasOwn(result.items[0], "dayIndex"), false, "the resolved day is the only remaining truth");
});

test("an agreeing date and day raise no question", () => {
  const result = run([item({ date: "2026-10-12", dayIndex: 3 })]);
  assert.equal(result.items[0].date, "2026-10-12");
  assert.equal(result.questions.length, 0);
});

// --- R4: no guessing, no positional inference ---

test("transport with no date and no day is never guessed onto a day", () => {
  const result = run([item({ title: "Перелёт", type: "transport" })]);
  assert.equal(result.items[0].date, "");
  assert.equal(result.questions.length, 0, "a missing day is an ordinary outcome, not a problem to report");
});

test("array position never decides a day", () => {
  const items = [
    item({ title: "Перелёт", type: "transport", date: "2026-10-10" }),
    item({ title: "Музей", dayIndex: 3 }),
    item({ title: "Обратный рейс", type: "transport", date: "2026-10-14" }),
    item({ title: "Прогулка" }),
  ];
  const straight = run(items);
  const reversed = run([...items].reverse());
  const byTitle = (result) => Object.fromEntries(result.items.map((entry) => [entry.title, entry.date]));
  assert.deepEqual(byTitle(reversed), byTitle(straight), "shuffling the model output must not move any card");
});

test("a boat tour is left alone by chronology and keeps its own type", () => {
  const result = run([item({ title: "Прогулка на теплоходе", type: "excursion", dayIndex: 2 })]);
  assert.equal(result.items[0].type, "excursion", "chronology never retypes a card");
  assert.equal(result.items[0].date, "2026-10-11");
});

// --- R6: nothing invented ---

test("a card with no signal at all stays without a day", () => {
  const result = run([item({ title: "Кофейня" })]);
  assert.equal(result.items[0].date, "");
  assert.equal(result.questions.length, 0);
});

test("no time is ever created or altered", () => {
  const result = run([item({ dayIndex: 2, startTime: "" }), item({ dayIndex: 2, startTime: "19:30" })]);
  assert.equal(result.items[0].startTime, "");
  assert.equal(result.items[1].startTime, "19:30");
});

test("arrival and departure times are deliberately not interpreted in this slice", () => {
  // startTime on a transport card cannot tell departure from arrival, so no rule reads it.
  const source = fs.readFileSync(path.join(__dirname, "../trip-draft-ai-core.js"), "utf8");
  const start = source.indexOf("function resolveTripItemDay");
  const body = source.slice(start, source.indexOf("\n  }", start));
  assert.doesNotMatch(body, /startTime/, "no arrival or departure inference belongs here yet");
});

// --- questions ---

test("questions are deduplicated, generated first, and capped", () => {
  const result = run(
    [item({ title: "Музей", date: "2026-10-20" }), item({ title: "Музей", date: "2026-10-21" })],
    OCTOBER,
    ["Уточните бюджет?", "Уточните бюджет?", "Нужен ли трансфер?", "Есть ли ограничения?", "Сколько человек?", "Нужна ли виза?"],
  );
  assert.equal(new Set(result.questions).size, result.questions.length, "no duplicates survive");
  assert.ok(result.questions.length <= core.MAX_QUESTIONS);
  assert.match(result.questions[0], /вне дат поездки/, "a concrete fixable problem is listed first");
});

test("questions never leak internal terms", () => {
  const result = run([
    item({ title: "A", date: "2026-10-20" }),
    item({ title: "B", dayIndex: 9 }),
    item({ title: "C", date: "2026-10-13", dayIndex: 1 }),
    item({ title: "D", date: "2026-10-12" }, NO_DATES),
  ]);
  const all = [...result.questions, ...run([item({ title: "D", date: "2026-10-12" })], NO_DATES).questions].join(" ");
  ["dayIndex", "date", "datePrecision", "schemaVersion", "null", "undefined", "парковк"].forEach((term) => {
    assert.doesNotMatch(all, new RegExp(term, "i"), `"${term}" must not reach the traveller`);
  });
});

test("merging keeps order and honours the cap", () => {
  const merged = core.mergeTripChronologyQuestions(["A", "a ", "B"], ["B", "C", "D", "E", "F"], 5);
  assert.deepEqual(merged, ["A", "B", "C", "D", "E"]);
});

// --- integration points ---

test("chronology runs on the model output but not on preview edits", () => {
  assert.match(appSource, /applyChronology = applyGuardrails/);
  assert.match(appSource, /applyChronology && core\?\.applyTripChronology/);
  // Preview edits are the traveller's own choice of day and must not be re-decided.
  assert.match(appSource, /\}, sourceTextForPreview, \{ applyGuardrails: false \}\)/);
});

test("the resolved day is what the mapping stores", () => {
  const start = appSource.indexOf("function normalizeTripDraftResponse");
  const body = appSource.slice(start, appSource.indexOf("function renderTripDraftOptionList", start));
  assert.match(body, /date: normalizeTripDraftItemDate\(item\.date, \{ startDate, endDate, dayCount \}\)/);
  // The old inline resolution is gone, so there is exactly one place deciding a day.
  assert.doesNotMatch(body, /explicitDate \|\| indexedDate \|\| virtualDate/);
});

test("the edge function keeps its behaviour: chronology is client-side only", () => {
  assert.doesNotMatch(functionSource, /applyTripChronology/);
  // The server contract this slice must not touch.
  assert.match(functionSource, /schema: draftCore\.tripDraftSchema/);
  assert.match(functionSource, /buildTripDraftPrompt\(\{ today, timezone, locale \}\)/);
  assert.match(functionSource, /draftCore\.applyDraftGuardrails\(JSON\.parse\(outputText\), text\)/);
  assert.match(functionSource, /assertSupportedSchemaVersion\(body\.schemaVersion\)/);
});
