(function initTravelIdeaCore(root) {
  "use strict";

  // TravelIdea remains an independent cloud source. Future Ideas UI maps it into
  // the existing generic card copy/create flow. Copying to one or several trips
  // does not mutate or delete the TravelIdea.
  const TRAVEL_IDEA_STATUSES = Object.freeze(["inbox", "archived"]);
  const TRAVEL_IDEA_SOURCES = Object.freeze(["manual", "link_intake", "browser_extension", "ai_recommendation"]);
  const TRAVEL_IDEA_SEMANTIC_TYPES = Object.freeze([
    "ticket",
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
  const SUPPORTED_CURRENCIES = Object.freeze(["RUB", "EUR", "USD", "SEK", "GEL", "TRY", "RSD", "BAM"]);

  function cleanTravelIdeaText(value, limit = 500) {
    if (value === null || value === undefined) return "";
    const text = String(value)
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text ? text.slice(0, limit) : "";
  }

  function optionalText(value, limit = 500) {
    return cleanTravelIdeaText(value, limit) || null;
  }

  function normalizeTravelIdeaStatus(value = "") {
    const normalized = cleanTravelIdeaText(value, 40).toLowerCase();
    return TRAVEL_IDEA_STATUSES.includes(normalized) ? normalized : "inbox";
  }

  function normalizeTravelIdeaSource(value = "", fallback = "manual") {
    const normalized = cleanTravelIdeaText(value, 80).toLowerCase();
    if (TRAVEL_IDEA_SOURCES.includes(normalized)) return normalized;
    return TRAVEL_IDEA_SOURCES.includes(fallback) ? fallback : "manual";
  }

  function normalizeTravelIdeaType(value = "") {
    const normalized = cleanTravelIdeaText(value, 80).toLowerCase();
    return TRAVEL_IDEA_SEMANTIC_TYPES.includes(normalized) ? normalized : "idea";
  }

  function normalizeTravelIdeaUrl(value = "") {
    const text = cleanTravelIdeaText(value, 2000);
    if (!text) return null;
    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function normalizeTravelIdeaPriceAmount(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100) / 100;
  }

  function normalizeTravelIdeaCurrency(value = "") {
    const normalized = cleanTravelIdeaText(value, 12).toUpperCase();
    return SUPPORTED_CURRENCIES.includes(normalized) ? normalized : null;
  }

  function normalizeTravelIdeaCollectionId(value = "") {
    const text = cleanTravelIdeaText(value, 80).toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text)
      ? text
      : null;
  }

  function normalizeTravelIdeaSortOrder(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : 0;
  }

  function withoutNullValues(payload) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== null && value !== undefined),
    );
  }

  function readCandidateField(candidate, fieldName) {
    return candidate?.fields && Object.prototype.hasOwnProperty.call(candidate.fields, fieldName)
      ? candidate.fields[fieldName]
      : null;
  }

  function readCandidatePrice(candidate) {
    const price = readCandidateField(candidate, "price");
    if (!price || typeof price !== "object") {
      return { amount: null, currency: null };
    }
    return {
      amount: normalizeTravelIdeaPriceAmount(price.amount),
      currency: normalizeTravelIdeaCurrency(price.currency),
    };
  }

  function readCandidateImageSource(candidate) {
    return optionalText(candidate?.provenance?.image?.source, 80);
  }

  function mapManualIdeaToTravelIdea(input = {}) {
    return withoutNullValues({
      title: cleanTravelIdeaText(input.title, 160),
      collection_id: normalizeTravelIdeaCollectionId(input.collectionId ?? input.collection_id),
      url: normalizeTravelIdeaUrl(input.url),
      excerpt: optionalText(input.excerpt, 700),
      notes: optionalText(input.notes, 1000),
      location_text: optionalText(input.locationText ?? input.location_text, 240),
      price_amount: normalizeTravelIdeaPriceAmount(input.priceAmount ?? input.price_amount),
      price_currency: normalizeTravelIdeaCurrency(input.priceCurrency ?? input.price_currency),
      semantic_type: normalizeTravelIdeaType(input.semanticType ?? input.semantic_type ?? input.type),
      source: normalizeTravelIdeaSource(input.source, "manual"),
      status: normalizeTravelIdeaStatus(input.status),
      image_url: normalizeTravelIdeaUrl(input.imageUrl ?? input.image_url),
      image_alt: optionalText(input.imageAlt ?? input.image_alt, 160),
      image_source: optionalText(input.imageSource ?? input.image_source, 80),
    });
  }

  function mapTravelCandidateToTravelIdea(candidate = {}, options = {}) {
    const price = readCandidatePrice(candidate);
    const source = normalizeTravelIdeaSource(candidate.sourceType, "link_intake");
    return withoutNullValues({
      title: cleanTravelIdeaText(readCandidateField(candidate, "title"), 160),
      collection_id: normalizeTravelIdeaCollectionId(options.collectionId ?? options.collection_id),
      url: normalizeTravelIdeaUrl(readCandidateField(candidate, "sourceUrl")),
      excerpt: optionalText(readCandidateField(candidate, "description"), 700),
      location_text: optionalText(readCandidateField(candidate, "location"), 240),
      price_amount: price.amount,
      price_currency: price.currency,
      semantic_type: normalizeTravelIdeaType(readCandidateField(candidate, "semanticType") || readCandidateField(candidate, "type")),
      source,
      status: "inbox",
      image_url: normalizeTravelIdeaUrl(readCandidateField(candidate, "image")),
      image_alt: optionalText(readCandidateField(candidate, "imageAlt") || readCandidateField(candidate, "imageTitle"), 160),
      image_source: readCandidateImageSource(candidate),
    });
  }

  function buildTravelIdeaCollectionInsertPayload(input = {}, currentUserId = "") {
    const ownerUserId = cleanTravelIdeaText(currentUserId || input.owner_user_id || input.ownerUserId, 80);
    const title = cleanTravelIdeaText(input.title, 120);
    if (!ownerUserId || !title) return null;
    return {
      owner_user_id: ownerUserId,
      title,
      sort_order: normalizeTravelIdeaSortOrder(input.sortOrder ?? input.sort_order),
    };
  }

  function buildTravelIdeaInsertPayload(input = {}, currentUserId = "") {
    const ownerUserId = cleanTravelIdeaText(currentUserId || input.owner_user_id || input.ownerUserId, 80);
    const mapped = mapManualIdeaToTravelIdea(input);
    const title = cleanTravelIdeaText(mapped.title, 160);
    if (!ownerUserId || !title) return null;
    return {
      owner_user_id: ownerUserId,
      ...mapped,
      title,
      semantic_type: normalizeTravelIdeaType(mapped.semantic_type),
      source: normalizeTravelIdeaSource(mapped.source, "manual"),
      status: normalizeTravelIdeaStatus(mapped.status),
    };
  }

  function buildTravelIdeaArchivePatch() {
    return { status: "archived" };
  }

  const api = {
    SUPPORTED_CURRENCIES,
    TRAVEL_IDEA_SEMANTIC_TYPES,
    TRAVEL_IDEA_SOURCES,
    TRAVEL_IDEA_STATUSES,
    buildTravelIdeaArchivePatch,
    buildTravelIdeaCollectionInsertPayload,
    buildTravelIdeaInsertPayload,
    cleanTravelIdeaText,
    mapManualIdeaToTravelIdea,
    mapTravelCandidateToTravelIdea,
    normalizeTravelIdeaCollectionId,
    normalizeTravelIdeaCurrency,
    normalizeTravelIdeaPriceAmount,
    normalizeTravelIdeaSource,
    normalizeTravelIdeaSortOrder,
    normalizeTravelIdeaStatus,
    normalizeTravelIdeaType,
    normalizeTravelIdeaUrl,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerTravelIdeas = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
