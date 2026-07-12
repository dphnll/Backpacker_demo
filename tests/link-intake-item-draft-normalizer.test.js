const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  return import(pathToFileURL(path.join(
    __dirname,
    "../supabase/functions/_shared/link-intake/item-draft-normalizer.mjs",
  )));
}

function candidate(overrides = {}) {
  return {
    schemaVersion: 1,
    sourceType: "link_intake",
    source: { fetchedAt: "2026-07-12T12:00:00.000Z" },
    fields: {
      title: "Museum pass",
      description: "Access to the main museum collection.",
      image: "https://images.example/museum.jpg",
      price: { amount: 20, currency: "EUR", kind: "from", text: "from 20 EUR" },
      location: "1 Museum Square",
      geo: { latitude: 48.86, longitude: 2.33 },
      sourceUrl: "https://source.example/museum",
      canonicalUrl: "https://canonical.example/museum",
    },
    provenance: {
      title: { source: "json_ld", confidence: 0.9 },
      price: { source: "json_ld", confidence: 0.65 },
      location: { source: "text_signal", confidence: 0.35 },
    },
    confidence: { overall: 0.9, title: 0.9, price: 0.65, location: 0.35 },
    warnings: ["CONTROLLED_PAGE_TRUNCATED"],
    ...overrides,
  };
}

const validAiOutput = {
  title: "Museum Pass",
  type: "place",
  description: "Access to the main museum collection.",
  price: 20,
  currency: "EUR",
  priceKind: "from",
  locationText: "1 Museum Square",
  warnings: ["Check details before booking."],
};

test("builds provider-neutral normalizer input without raw content or URLs for AI", async () => {
  const { buildNormalizerInput } = await loadModule();
  const input = buildNormalizerInput(candidate());

  assert.equal(input.sourceType, "link_intake");
  assert.deepEqual(input.facts, {
    title: "Museum pass",
    description: "Access to the main museum collection.",
    price: { amount: 20, currency: "EUR", kind: "from" },
    locationText: "1 Museum Square",
  });
  assert.equal(Object.hasOwn(input.facts, "sourceUrl"), false);
  assert.equal(Object.hasOwn(input.facts, "imageUrl"), false);
  assert.equal(Object.hasOwn(input.facts, "markdown"), false);
  assert.equal(Object.hasOwn(input.facts, "htmlForExtraction"), false);
  assert.equal(input.constraints.aiMustNotInventPrice, true);
});

test("creates a base ItemDraft by wrapper mapping sourceUrl and imageUrl from TravelCandidate", async () => {
  const { buildBaseDraftFromCandidate } = await loadModule();
  const draft = buildBaseDraftFromCandidate(candidate());

  assert.deepEqual(draft, {
    sourceType: "link_intake",
    sourceUrl: "https://source.example/museum",
    title: "Museum pass",
    type: "other",
    imageUrl: "https://images.example/museum.jpg",
    description: "Access to the main museum collection.",
    price: 20,
    currency: "EUR",
    priceKind: "from",
    locationText: "1 Museum Square",
    notes: null,
    warnings: ["CONTROLLED_PAGE_TRUNCATED"],
  });
});

test("merges valid AI normalization while preserving wrapper-controlled sourceUrl and imageUrl", async () => {
  const { mergeAiOutputIntoItemDraft } = await loadModule();
  const result = mergeAiOutputIntoItemDraft(candidate(), {
    ...validAiOutput,
    title: "Normalized title",
  });

  assert.equal(result.draft.title, "Normalized title");
  assert.equal(result.draft.type, "place");
  assert.equal(result.draft.sourceUrl, "https://source.example/museum");
  assert.equal(result.draft.imageUrl, "https://images.example/museum.jpg");
  assert.equal(result.draft.price, 20);
  assert.equal(result.draft.priceKind, "from");
  assert.equal(result.draft.notes, null);
  assert.equal(result.internalMeta.confidence.overall, 0.9);
  assert.deepEqual(result.internalMeta.validationErrors, []);
});

test("rejects AI-invented price when candidate has no price fact", async () => {
  const { mergeAiOutputIntoItemDraft } = await loadModule();
  const result = mergeAiOutputIntoItemDraft(candidate({
    fields: {
      ...candidate().fields,
      price: null,
    },
  }), {
    ...validAiOutput,
    price: 99,
    priceKind: "exact",
  });

  assert.equal(result.draft.price, null);
  assert.equal(result.draft.priceKind, "unknown");
  assert.equal(result.draft.warnings.includes("AI_PRICE_REJECTED"), true);
});

test("does not allow AI to promote from or range price to exact", async () => {
  const { mergeAiOutputIntoItemDraft } = await loadModule();
  const result = mergeAiOutputIntoItemDraft(candidate(), {
    ...validAiOutput,
    price: 20,
    priceKind: "exact",
  });

  assert.equal(result.draft.price, 20);
  assert.equal(result.draft.priceKind, "from");
  assert.equal(result.draft.warnings.includes("AI_PRICE_KIND_REJECTED"), true);
});

test("keeps unknown values null instead of guessing", async () => {
  const { buildBaseDraftFromCandidate, mergeAiOutputIntoItemDraft } = await loadModule();
  const sparse = candidate({
    fields: {
      title: null,
      description: null,
      image: null,
      price: null,
      location: null,
      sourceUrl: "https://source.example/unknown",
    },
    warnings: [],
  });

  assert.deepEqual(buildBaseDraftFromCandidate(sparse), {
    sourceType: "link_intake",
    sourceUrl: "https://source.example/unknown",
    title: null,
    type: "other",
    imageUrl: null,
    description: null,
    price: null,
    currency: null,
    priceKind: "unknown",
    locationText: null,
    notes: null,
    warnings: [],
  });

  const result = mergeAiOutputIntoItemDraft(sparse, {
    title: null,
    type: "other",
    description: null,
    price: null,
    currency: null,
    priceKind: "unknown",
    locationText: null,
    notes: null,
    warnings: [],
  });

  assert.equal(result.draft.title, null);
  assert.equal(result.draft.description, null);
  assert.equal(result.draft.locationText, null);
});

test("validates schema strictly and ignores unexpected AI fields", async () => {
  const { mergeAiOutputIntoItemDraft, validateAiOutputShape } = await loadModule();
  const aiOutput = {
    ...validAiOutput,
    sourceUrl: "https://evil.example/changed",
    imageUrl: "https://evil.example/changed.jpg",
    notes: "AI must not write user notes.",
  };

  const errors = validateAiOutputShape(aiOutput);
  assert.deepEqual(errors, [
    "UNEXPECTED_FIELD:sourceUrl",
    "UNEXPECTED_FIELD:imageUrl",
    "UNEXPECTED_FIELD:notes",
  ]);

  const result = mergeAiOutputIntoItemDraft(candidate(), aiOutput);
  assert.equal(result.draft.sourceUrl, "https://source.example/museum");
  assert.equal(result.draft.imageUrl, "https://images.example/museum.jpg");
  assert.equal(result.draft.title, "Museum pass");
  assert.equal(result.draft.warnings.includes("UNEXPECTED_FIELD:sourceUrl"), true);
});

test("rejects unsupported currency and keeps candidate currency when available", async () => {
  const { mergeAiOutputIntoItemDraft } = await loadModule();
  const result = mergeAiOutputIntoItemDraft(candidate(), {
    ...validAiOutput,
    currency: "GBP",
  });

  assert.equal(result.draft.currency, "EUR");
  assert.equal(result.draft.warnings.includes("INVALID_CURRENCY"), true);
});

test("rejects AI-invented currency when candidate has no deterministic currency", async () => {
  const { mergeAiOutputIntoItemDraft } = await loadModule();
  const result = mergeAiOutputIntoItemDraft(candidate({
    fields: {
      ...candidate().fields,
      price: { amount: 20, currency: null, kind: "from", text: "from 20" },
    },
  }), {
    ...validAiOutput,
    currency: "USD",
  });

  assert.equal(result.draft.price, 20);
  assert.equal(result.draft.currency, null);
  assert.equal(result.draft.warnings.includes("AI_CURRENCY_REJECTED"), true);
});

test("exports strict AI output schema with only user-facing normalizable fields", async () => {
  const { ITEM_DRAFT_AI_OUTPUT_SCHEMA } = await loadModule();
  const keys = Object.keys(ITEM_DRAFT_AI_OUTPUT_SCHEMA.properties).sort();

  assert.deepEqual(keys, [
    "currency",
    "description",
    "locationText",
    "price",
    "priceKind",
    "title",
    "type",
    "warnings",
  ]);
  assert.equal(ITEM_DRAFT_AI_OUTPUT_SCHEMA.additionalProperties, false);
});
