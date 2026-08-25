const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const core = require("../trip-draft-ai-core.js");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const functionSource = fs.readFileSync(path.join(__dirname, "../supabase/functions/trip-draft-ai/index.ts"), "utf8");

function functionBody(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? appSource.indexOf(`function ${nextName}`, start) : -1;
  return appSource.slice(start, end === -1 ? undefined : end);
}

function item(overrides = {}) {
  return {
    title: "Перелёт Москва — Тбилиси", type: "transport", status: "fixed", priority: "must",
    date: "2026-10-10", startTime: "22:00", durationMinutes: 0,
    price: 0, currency: null, priceKind: null, evidenceText: null,
    sourceFileIndex: [0], sourcePage: 1, locationText: "", notes: "", ...overrides,
  };
}

function run(items, fileIds = ["file-a", "file-b"], questions = []) {
  return core.applyBookingPackEvidenceRules({
    trip: { title: "Тбилиси", destination: "Грузия", currency: "GEL", preferencesText: "" },
    items,
    questions,
  }, { fileIds });
}

// --- price evidence ---

test("a price is admitted only with amount, currency, quote and a real file", () => {
  const ok = run([item({ price: 24500, currency: "RUB", priceKind: "exact", evidenceText: "Итого к оплате 24 500 ₽" })]);
  assert.equal(ok.items[0].price, 24500);
  assert.equal(ok.items[0].priceConfidence, "estimate", "before create it is extracted, never confirmed");
  assert.equal(ok.items[0].priceKind, "exact");
  assert.equal(ok.items[0].evidenceText, "Итого к оплате 24 500 ₽");
});

test("each missing piece of evidence drops the price", () => {
  const cases = [
    ["no currency", { price: 300, currency: null, priceKind: "exact", evidenceText: "300" }],
    ["no quote", { price: 300, currency: "GEL", priceKind: "exact", evidenceText: null }],
    ["no file behind it", { price: 300, currency: "GEL", priceKind: "exact", evidenceText: "300 GEL", sourceFileIndex: [] }],
    ["index points nowhere", { price: 300, currency: "GEL", priceKind: "exact", evidenceText: "300 GEL", sourceFileIndex: [9] }],
  ];
  cases.forEach(([label, overrides]) => {
    const result = run([item(overrides)]);
    assert.equal(result.items[0].price, 0, `${label}: price must be dropped`);
    assert.equal(result.items[0].priceConfidence, "unknown", `${label}: confidence must be unknown`);
    assert.equal(result.items[0].evidenceText, "", `${label}: the quote goes with it`);
  });
});

test("an unproven price raises a question instead of disappearing silently", () => {
  const result = run([item({ title: "Отель", price: 300, currency: null, evidenceText: "300" })]);
  assert.match(result.questions[0], /цена в документе не подтверждена/);
});

test("no price in the document is an ordinary outcome", () => {
  const result = run([item()]);
  assert.equal(result.items[0].price, 0);
  assert.equal(result.items[0].priceConfidence, "unknown");
  assert.equal(result.questions.length, 0);
});

test("pressing create is what confirms an exact price", () => {
  assert.equal(core.resolveConfirmedPriceConfidence({ priceKind: "exact", priceConfidence: "estimate" }), "confirmed");
  assert.equal(core.resolveConfirmedPriceConfidence({ priceKind: "approximate", priceConfidence: "estimate" }), "estimate");
  // A text-path card has no priceKind and keeps whatever Slice 1 decided.
  assert.equal(core.resolveConfirmedPriceConfidence({ priceConfidence: "confirmed" }), "confirmed");
  assert.equal(core.resolveConfirmedPriceConfidence({ priceConfidence: "unknown" }), "unknown");
});

// --- currency of the document ---

test("any ISO code is readable, not only the eight a trip can use", () => {
  // A ticket in GBP used to be indistinguishable from a ticket with no currency at all,
  // which is what hid a real price behind "цена не подтверждена".
  ["GBP", "PLN", "AED", "kzt", " thb "].forEach((code) => {
    assert.equal(core.normalizeDocumentCurrency(code), code.trim().toUpperCase());
  });
  ["", null, "руб", "RUBLES", "R", "12"].forEach((code) => {
    assert.equal(core.normalizeDocumentCurrency(code), "", `${String(code)} is not an ISO code`);
  });
});

test("a price in an unlisted currency is still extracted and shown", () => {
  const result = run([item({ price: 120, currency: "GBP", priceKind: "exact", evidenceText: "Total £120" })]);
  assert.equal(result.items[0].price, 120);
  assert.equal(result.items[0].documentCurrency, "GBP");
  assert.equal(result.questions.length, 0, "an extracted price is not a problem to report");
});

test("only a matching currency may reach the card and the budget", () => {
  const priced = { documentCurrency: "EUR", priceKind: "exact", priceConfidence: "estimate" };
  assert.equal(core.isBookingPackPriceBudgetEligible(priced, "EUR"), true);
  assert.equal(core.isBookingPackPriceBudgetEligible(priced, "GEL"), false);
  assert.equal(core.isBookingPackPriceBudgetEligible({ documentCurrency: "" }, "GEL"), false);
  // The number is dropped rather than converted or written under the wrong currency.
  assert.equal(core.resolveConfirmedPriceConfidence(priced, "GEL"), "unknown");
  assert.equal(core.resolveConfirmedPriceConfidence(priced, "EUR"), "confirmed");
  assert.equal(core.resolveConfirmedPriceConfidence({ ...priced, priceKind: "approximate" }, "EUR"), "estimate");
});

test("a mismatched currency never converts and never enters the budget", () => {
  const convert = functionBody("createTripEntryFromDraft", null).slice(0, 3000);
  assert.match(convert, /resolveConfirmedPriceConfidence\?\.\(item, draft\.trip\.currency\)/);
  assert.match(convert, /const price = priceConfidence === "unknown" \? 0 : item\.price/);
  assert.doesNotMatch(convert, /currencyRatesToRub|convertMoney|exchangeRate/, "no silent conversion belongs here");
});

test("the mismatch is explained in the preview, with the original amount kept", () => {
  const note = functionBody("renderTripDraftPriceNote", "renderTripDraftCurrencyOptions");
  assert.match(note, /isBookingPackPriceBudgetEligible/);
  assert.match(note, /preview\.price\.currency\.mismatch/);
  assert.match(note, /documentCurrency: item\.documentCurrency/);
  assert.match(note, /preview\.price\.currency\.hint/);
  assert.match(appSource, /renderTripDraftPriceNote\(item, draft\.trip\.currency\)/);
});

test("the document currency stays in the draft and out of the card model", () => {
  const convert = functionBody("createTripEntryFromDraft", null).slice(0, 3000);
  assert.doesNotMatch(convert, /documentCurrency/, "the card model gains no per-item currency");
  const guarded = run([item({ price: 120, currency: "GBP", priceKind: "exact", evidenceText: "Total £120" })]);
  assert.ok(Object.hasOwn(guarded.items[0], "documentCurrency"), "the draft keeps it for the preview");
});

test("the prompt asks for an ISO code rather than leaving the symbol to chance", () => {
  const rules = core.BOOKING_PACK_RULES.join("\n");
  assert.match(rules, /ISO 4217/);
  assert.match(rules, /₽ — это RUB/);
  assert.match(rules, /Не подставляй валюту по стране вылета/);
});

// --- sanitization ---

test("sensitive identifiers never reach a card field", () => {
  [
    "Код брони: ABC123", "PNR ABC123", "Booking reference XYZ789",
    "Номер билета 5551234567890", "Паспорт 75 1234567", "Карта 4276 1234 5678 9012",
  ].forEach((input) => {
    assert.equal(core.sanitizeExtractedText(input), "", `must be redacted: ${input}`);
  });
});

test("route identifiers are not sensitive and survive", () => {
  [
    ["Рейс SU 1234 Москва — Тбилиси", /SU 1234/],
    ["Поезд №739А Тбилиси — Батуми", /739А/],
    ["Автобус маршрут 37", /37/],
    ["Итого к оплате 24 500 ₽", /24 500/],
  ].forEach(([input, expected]) => {
    assert.match(core.sanitizeExtractedText(input), expected, `must survive: ${input}`);
  });
});

test("Russian labels are matched despite JavaScript word boundaries", () => {
  // \w does not cover Cyrillic, which silently disabled every Russian rule once.
  const source = fs.readFileSync(path.join(__dirname, "../trip-draft-ai-core.js"), "utf8");
  const start = source.indexOf("const SENSITIVE_LABELLED_PATTERNS");
  const block = source.slice(start, source.indexOf("];", start));
  assert.doesNotMatch(block, /брон\\w|паспорт\\w|карт\[[^\]]*\]\\w/, "Cyrillic labels must not rely on \\w");
});

test("sanitization also applies to the quote and to every free-text field", () => {
  const result = run([item({
    title: "Перелёт SU 1234, код брони: ABC123",
    notes: "Паспорт 75 1234567",
    locationText: "Карта 4276 1234 5678 9012",
    price: 100, currency: "RUB", priceKind: "exact", evidenceText: "Цена 100 RUB, номер билета 5551234567890",
  })]);
  assert.match(result.items[0].title, /SU 1234/);
  assert.doesNotMatch(result.items[0].title, /ABC123/);
  assert.equal(result.items[0].notes, "");
  assert.equal(result.items[0].locationText, "");
  assert.doesNotMatch(result.items[0].evidenceText, /5551234567890/);
});

test("the quote is clamped so it cannot become a paragraph", () => {
  assert.equal(core.BOOKING_PACK_MAX_EVIDENCE_CHARS, 160);
  const long = `Цена 100 RUB ${"я".repeat(400)}`;
  const result = run([item({ price: 100, currency: "RUB", priceKind: "exact", evidenceText: long })]);
  assert.ok(result.items[0].evidenceText.length <= 160);
});

// --- one document, several cards ---

test("a return ticket in one PDF gives two cards backed by the same file", () => {
  const result = run([
    item({ title: "Перелёт туда", date: "2026-10-10", sourceFileIndex: [0] }),
    item({ title: "Перелёт обратно", date: "2026-10-14", sourceFileIndex: [0] }),
  ]);
  assert.deepEqual(result.items.map((entry) => entry.sourceFileIds), [["file-a"], ["file-a"]]);
});

test("one card can be backed by several documents", () => {
  const result = run([item({ sourceFileIndex: [0, 1] })]);
  assert.deepEqual(result.items[0].sourceFileIds, ["file-a", "file-b"]);
});

test("trip dates are derived from the documents, never asked of the model", () => {
  const result = run([
    item({ date: "2026-10-14" }),
    item({ date: "2026-10-10" }),
    item({ date: "" }),
  ]);
  assert.equal(result.trip.startDate, "2026-10-10");
  assert.equal(result.trip.endDate, "2026-10-14");
  assert.equal(result.trip.datePrecision, "exact");
  assert.deepEqual(core.deriveBookingPackTripDates([{ date: "" }]), { startDate: "", endDate: "" });
});

// --- file matching after a reload ---

test("files are matched back by name, size and type", () => {
  const descriptors = [
    { sourceFileId: "a", fileName: "ticket.pdf", fileSize: 100, mimeType: "application/pdf" },
    { sourceFileId: "b", fileName: "hotel.pdf", fileSize: 200, mimeType: "application/pdf" },
  ];
  const picked = [
    { name: "hotel.pdf", size: 200, type: "application/pdf" },
    { name: "ticket.pdf", size: 100, type: "application/pdf" },
  ];
  const { matched, missing } = core.matchBookingPackFiles(descriptors, picked);
  // Picking them back in a different order must still bind each card to its own file.
  assert.equal(matched.a.name, "ticket.pdf");
  assert.equal(matched.b.name, "hotel.pdf");
  assert.equal(missing.length, 0);
});

test("an unmatched file is reported, never guessed", () => {
  const descriptors = [
    { sourceFileId: "a", fileName: "ticket.pdf", fileSize: 100, mimeType: "application/pdf" },
    { sourceFileId: "b", fileName: "hotel.pdf", fileSize: 200, mimeType: "application/pdf" },
  ];
  const { matched, missing } = core.matchBookingPackFiles(descriptors, [{ name: "ticket.pdf", size: 100, type: "application/pdf" }]);
  assert.equal(Object.keys(matched).length, 1);
  assert.deepEqual(missing.map((entry) => entry.sourceFileId), ["b"]);
});

test("a file of the same name but a different size does not match", () => {
  const { missing } = core.matchBookingPackFiles(
    [{ sourceFileId: "a", fileName: "ticket.pdf", fileSize: 100, mimeType: "application/pdf" }],
    [{ name: "ticket.pdf", size: 999, type: "application/pdf" }],
  );
  assert.equal(missing.length, 1);
});

// --- persistence ---

test("only descriptors are persisted, never file contents", () => {
  const save = functionBody("saveTripDraftPending", "scheduleTripDraftPendingSave");
  assert.match(save, /bookingPackFiles: tripDraftAiState\.bookingPackFiles\.map\(describeBookingPackFile\)/);
  const describe = functionBody("describeBookingPackFile", "addBookingPackFiles");
  ["dataUrl", "base64", "file:"].forEach((field) => {
    assert.doesNotMatch(describe, new RegExp(field), `${field} must not be persisted`);
  });
  assert.match(describe, /sourceFileId[\s\S]*fileName[\s\S]*fileSize[\s\S]*mimeType/);
});

test("a booking pack with an empty comment is still protected", () => {
  const save = functionBody("saveTripDraftPending", "scheduleTripDraftPendingSave");
  assert.match(save, /hasBookingPackWork/);
  assert.match(save, /if \(!sourceText\.trim\(\) && !hasBookingPackWork\) return/);
});

test("a restored pack knows its files are gone", () => {
  const restore = functionBody("restoreTripDraftPending", "continueTripDraftPending");
  assert.match(restore, /bookingPackFiles: \(pending\.bookingPackFiles \|\| \[\]\)\.map\(\(entry\) => \(\{ \.\.\.entry, file: null \}\)\)/);
});

// --- creation with missing files ---

test("missing files ask for a decision instead of blocking forever", () => {
  const create = functionBody("createTripFromAiDraft", null).slice(0, 2600);
  assert.match(create, /getBookingPackMissingFiles\(\)/);
  assert.match(create, /preview\.confirm\.missing\.files/);
  assert.match(create, /count: missingFiles\.length, names/);
  // Cancelling returns to the file step; confirming proceeds to create the trip.
  assert.match(create, /mode: "documents"/);
  assert.ok(create.indexOf("window.confirm") < create.indexOf("createTripEntryFromDraft"));
});

test("uploads never abort the batch and failures stay retryable", () => {
  const attach = functionBody("attachBookingPackDocuments", "retryBookingPackUploads");
  // A single failure must not swallow the remaining files.
  assert.match(attach, /catch \{\s*failed\.push\(job\)/);
  assert.match(attach, /bookingPackFailedUploads = failed/);
  assert.match(attach, /toast\.attachments\.failed/);
  assert.match(functionBody("retryBookingPackUploads", "renderBookingPackUploadNotice"), /uploadTripItemAttachment/);
  assert.match(htmlSource, /id="bookingPackUploadRetryButton"/);
});

test("the same document is attached to every card it backs", () => {
  const attach = functionBody("attachBookingPackDocuments", "retryBookingPackUploads");
  assert.match(attach, /\(item\.sourceFileIds \|\| \[\]\)\.forEach/);
});

// --- draft-only fields never persist into a trip ---

test("the quote and provenance never reach a TripItem", () => {
  const convert = functionBody("createTripEntryFromDraft", null).slice(0, 3000);
  ["evidenceText", "sourceFileIds", "sourcePage", "priceKind:"].forEach((field) => {
    assert.doesNotMatch(convert, new RegExp(`${field}`), `${field} must stay in the draft`);
  });
  assert.match(convert, /priceSourceText: item\.priceKind \? "" : item\.priceSourceText/);
});

test("the new money fields are stripped from a share with the budget hidden", () => {
  const financial = fs.readFileSync(path.join(__dirname, "../financial-core.js"), "utf8");
  ["price", "priceConfidence", "priceSourceText", "budgetLevel"].forEach((field) => {
    assert.match(financial, new RegExp(`"${field}"`), `${field} must be stripped`);
  });
});

// --- pipeline wiring ---

test("the quote and file binding survive normalization into the preview", () => {
  // The mapping rebuilds each item from an explicit field list, so anything not listed is
  // silently lost; that once dropped the quote and left the price looking unexplained.
  const start = appSource.indexOf("function normalizeTripDraftResponse");
  const body = appSource.slice(start, appSource.indexOf("const TRIP_DRAFT_BUDGET_LEVEL_LABELS", start));
  ["evidenceText:", "priceKind:", "sourceFileIds:", "sourcePage:"].forEach((field) => {
    assert.match(body, new RegExp(field.replace(":", ":")), `${field} must survive normalization`);
  });
});

test("Slice 1 guardrails do not run on documents, chronology still does", () => {
  const parse = functionBody("parseBookingPackDocuments", "getTripDraftPendingKey");
  assert.match(parse, /\{ applyGuardrails: false, applyChronology: true \}/);
  // The text path keeps its guardrails untouched.
  assert.match(functionBody("parseTripDraftText", "createTripEntryFromDraft"), /normalizeTripDraftResponse\(payload, text\)/);
});

test("the edge function validates the booking contract and reuses the same endpoint", () => {
  assert.match(functionSource, /body\.action === "parse_documents"/);
  assert.match(functionSource, /assertSupportedSchemaVersion\(body\.schemaVersion, draftCore\.BOOKING_PACK_SCHEMA_VERSION\)/);
  assert.match(functionSource, /type: "input_file"/);
  assert.match(functionSource, /type: "input_image"/);
  assert.match(functionSource, /schema: draftCore\.bookingPackSchema/);
  // Evidence rules run server-side too.
  assert.match(functionSource, /applyBookingPackEvidenceRules\(JSON\.parse\(outputText\), \{ fileIds, locale \}\)/);
  // The text contract is untouched.
  assert.match(functionSource, /schema: draftCore\.tripDraftSchema/);
});

test("limits are enforced before anything is sent", () => {
  assert.equal(core.BOOKING_PACK_MAX_FILES, 8);
  assert.equal(core.BOOKING_PACK_MAX_FILE_BYTES, 10 * 1024 * 1024);
  assert.equal(core.BOOKING_PACK_MAX_TOTAL_BYTES, 30 * 1024 * 1024);
  const add = functionBody("addBookingPackFiles", "reconcileBookingPackFiles");
  assert.match(add, /BOOKING_PACK_MAX_FILE_BYTES/);
  assert.match(add, /BOOKING_PACK_MAX_FILES/);
  assert.match(add, /BOOKING_PACK_MAX_TOTAL_BYTES/);
  assert.match(add, /seen\.has\(core\.getBookingPackFileKey\(descriptor\)\)/, "duplicates are dropped before upload");
});

// --- UX surface ---

test("the document step lives inside the existing sheet", () => {
  assert.match(htmlSource, /data-trip-draft-mode="documents"/);
  assert.match(htmlSource, /id="tripDraftDocumentsStep"/);
  assert.match(htmlSource, /id="tripDraftDocumentsInput"/);
  assert.match(htmlSource, /accept="application\/pdf,image\/jpeg,image\/png,image\/webp/);
  assert.match(appSource, /tripDraftAiState\.mode !== "documents"/);
});

test("an extracted price is labelled for checking, not presented as a fact", () => {
  const note = functionBody("renderTripDraftPriceNote", "renderTripDraftCurrencyOptions");
  assert.match(note, /item\.evidenceText/);
  assert.match(note, /preview\.price\.document/);
  assert.match(note, /preview\.price\.document\.source/);
});

test("no analytics event carries document content", () => {
  const events = appSource.match(/trackEvent\("trip_draft[^"]*"[^)]*\)/g) || [];
  events.forEach((call) => {
    assert.doesNotMatch(call, /evidenceText|dataUrl|fileName|files/, `analytics must stay clean: ${call}`);
  });
});
