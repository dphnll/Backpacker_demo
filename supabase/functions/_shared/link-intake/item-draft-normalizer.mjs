"use strict";

const ITEM_DRAFT_SCHEMA_VERSION = 1;

const ITEM_DRAFT_TYPES = Object.freeze([
  "stay",
  "transport",
  "excursion",
  "food",
  "place",
  "spa",
  "shopping",
  "idea",
  "other",
]);

const SUPPORTED_CURRENCIES = Object.freeze([
  "RUB",
  "EUR",
  "USD",
  "SEK",
  "GEL",
  "TRY",
  "RSD",
  "BAM",
]);

const PRICE_KINDS = Object.freeze(["exact", "from", "range", "unknown"]);

const ITEM_DRAFT_AI_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "type",
    "description",
    "price",
    "currency",
    "priceKind",
    "locationText",
    "warnings",
  ],
  properties: {
    title: { type: ["string", "null"], maxLength: 140 },
    type: { type: "string", enum: ITEM_DRAFT_TYPES },
    description: { type: ["string", "null"], maxLength: 500 },
    price: { type: ["number", "null"], minimum: 0 },
    currency: { type: ["string", "null"], enum: [...SUPPORTED_CURRENCIES, null] },
    priceKind: { type: "string", enum: PRICE_KINDS },
    locationText: { type: ["string", "null"], maxLength: 240 },
    warnings: {
      type: "array",
      maxItems: 8,
      items: { type: "string", maxLength: 160 },
    },
  },
});

function cleanText(value, limit = 500) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function uniqueStrings(values, limit = 8) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, 160);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeSourceType(value) {
  return cleanText(value, 80) || "link_intake";
}

function normalizeUrl(value) {
  const text = cleanText(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeType(value) {
  return ITEM_DRAFT_TYPES.includes(value) ? value : "other";
}

function normalizeCurrency(value) {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(upper) ? upper : null;
}

function normalizePriceKind(value) {
  return PRICE_KINDS.includes(value) ? value : "unknown";
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function candidatePrice(candidate) {
  const price = candidate?.fields?.price;
  if (!price || typeof price !== "object") return {
    amount: null,
    currency: null,
    kind: "unknown",
  };
  return {
    amount: normalizePrice(price.amount),
    currency: normalizeCurrency(price.currency),
    kind: normalizePriceKind(price.kind),
  };
}

function buildNormalizerInput(candidate) {
  const fields = candidate?.fields || {};
  const price = candidatePrice(candidate);
  return {
    schemaVersion: ITEM_DRAFT_SCHEMA_VERSION,
    sourceType: normalizeSourceType(candidate?.sourceType),
    facts: {
      title: cleanText(fields.title, 180),
      description: cleanText(fields.description, 700),
      price,
      locationText: cleanText(fields.location, 260),
    },
    provenance: candidate?.provenance || {},
    confidence: candidate?.confidence || {},
    warnings: uniqueStrings(candidate?.warnings),
    constraints: {
      allowedTypes: [...ITEM_DRAFT_TYPES],
      supportedCurrencies: [...SUPPORTED_CURRENCIES],
      allowedPriceKinds: [...PRICE_KINDS],
      aiMustNotInventPrice: true,
      aiMustNotPromotePriceKindToExact: true,
      unknownValuesStayNull: true,
    },
  };
}

function buildBaseDraftFromCandidate(candidate) {
  const fields = candidate?.fields || {};
  const price = candidatePrice(candidate);
  return {
    sourceType: normalizeSourceType(candidate?.sourceType),
    sourceUrl: normalizeUrl(fields.sourceUrl),
    title: cleanText(fields.title, 140),
    type: "other",
    imageUrl: normalizeUrl(fields.image),
    description: cleanText(fields.description, 500),
    price: price.amount,
    currency: price.currency,
    priceKind: price.kind,
    locationText: cleanText(fields.location, 240),
    notes: null,
    warnings: uniqueStrings(candidate?.warnings),
  };
}

function validateAiOutputShape(output) {
  const errors = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return ["AI_OUTPUT_NOT_OBJECT"];
  }
  const allowed = new Set(ITEM_DRAFT_AI_OUTPUT_SCHEMA.required);
  for (const key of Object.keys(output)) {
    if (!allowed.has(key)) errors.push(`UNEXPECTED_FIELD:${key}`);
  }
  for (const key of ITEM_DRAFT_AI_OUTPUT_SCHEMA.required) {
    if (!Object.hasOwn(output, key)) errors.push(`MISSING_FIELD:${key}`);
  }
  if (output.title !== null && typeof output.title !== "string") errors.push("INVALID_TITLE");
  if (!ITEM_DRAFT_TYPES.includes(output.type)) errors.push("INVALID_TYPE");
  if (output.description !== null && typeof output.description !== "string") errors.push("INVALID_DESCRIPTION");
  if (output.price !== null && (typeof output.price !== "number" || !Number.isFinite(output.price) || output.price < 0)) {
    errors.push("INVALID_PRICE");
  }
  if (output.currency !== null && !SUPPORTED_CURRENCIES.includes(output.currency)) errors.push("INVALID_CURRENCY");
  if (!PRICE_KINDS.includes(output.priceKind)) errors.push("INVALID_PRICE_KIND");
  if (output.locationText !== null && typeof output.locationText !== "string") errors.push("INVALID_LOCATION");
  if (!Array.isArray(output.warnings) || output.warnings.some((warning) => typeof warning !== "string")) {
    errors.push("INVALID_WARNINGS");
  }
  return errors;
}

function canUseAiPrice(candidatePriceData, aiPrice, aiPriceKind) {
  if (aiPrice === null) return true;
  if (candidatePriceData.amount === null) return false;
  if (normalizePrice(aiPrice) !== candidatePriceData.amount) return false;
  if (candidatePriceData.kind !== "exact" && aiPriceKind === "exact") return false;
  return true;
}

function mergeAiOutputIntoItemDraft(candidate, aiOutput = {}) {
  const base = buildBaseDraftFromCandidate(candidate);
  const shapeErrors = validateAiOutputShape(aiOutput);
  const warnings = [...base.warnings];
  for (const error of shapeErrors) warnings.push(error);
  if (shapeErrors.length > 0) {
    return {
      draft: { ...base, warnings: uniqueStrings(warnings) },
      internalMeta: buildInternalMeta(candidate, shapeErrors),
    };
  }

  const price = candidatePrice(candidate);
  const aiPriceKind = normalizePriceKind(aiOutput.priceKind);
  const aiPrice = normalizePrice(aiOutput.price);
  const safePrice = canUseAiPrice(price, aiPrice, aiPriceKind) ? aiPrice : base.price;
  const safePriceKind = price.kind !== "exact" && aiPriceKind === "exact" ? price.kind : aiPriceKind;
  if (!canUseAiPrice(price, aiPrice, aiPriceKind)) warnings.push("AI_PRICE_REJECTED");
  if (price.kind !== "exact" && aiPriceKind === "exact") warnings.push("AI_PRICE_KIND_REJECTED");
  const aiCurrency = normalizeCurrency(aiOutput.currency);
  const safeCurrency = price.currency || null;
  if (aiOutput.currency && (!aiCurrency || aiCurrency !== price.currency)) warnings.push("AI_CURRENCY_REJECTED");

  const draft = {
    sourceType: base.sourceType,
    sourceUrl: base.sourceUrl,
    title: cleanText(aiOutput.title, 140),
    type: normalizeType(aiOutput.type),
    imageUrl: base.imageUrl,
    description: cleanText(aiOutput.description, 500),
    price: safePrice,
    currency: safeCurrency,
    priceKind: safePrice === null ? "unknown" : safePriceKind,
    locationText: cleanText(aiOutput.locationText, 240),
    notes: null,
    warnings: uniqueStrings([...warnings, ...aiOutput.warnings]),
  };

  return {
    draft,
    internalMeta: buildInternalMeta(candidate, shapeErrors),
  };
}

function buildInternalMeta(candidate, validationErrors = []) {
  return {
    schemaVersion: ITEM_DRAFT_SCHEMA_VERSION,
    provenance: candidate?.provenance || {},
    confidence: candidate?.confidence || {},
    validationErrors: [...validationErrors],
  };
}

export {
  ITEM_DRAFT_AI_OUTPUT_SCHEMA,
  ITEM_DRAFT_SCHEMA_VERSION,
  ITEM_DRAFT_TYPES,
  PRICE_KINDS,
  SUPPORTED_CURRENCIES,
  buildBaseDraftFromCandidate,
  buildNormalizerInput,
  mergeAiOutputIntoItemDraft,
  validateAiOutputShape,
};
