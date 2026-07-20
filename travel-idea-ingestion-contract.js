(function initTravelIdeaIngestionContract(root) {
  "use strict";

  const INGESTION_SCHEMA_VERSION = 1;
  const INGESTION_SOURCE = "browser_extension";
  const SEMANTIC_TYPES = Object.freeze([
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
  const COLLECTION_PAYLOAD_FIELDS = Object.freeze([
    "source",
    "sourceCollectionId",
    "sourceCollectionTitle",
  ]);
  const IDEA_PAYLOAD_FIELDS = Object.freeze([
    "schemaVersion",
    "source",
    "sourceIdeaId",
    "sourceCollectionId",
    "sourceCollectionTitle",
    "title",
    "url",
    "notes",
    "excerpt",
    "locationText",
    "priceAmount",
    "priceCurrency",
    "semanticType",
    "imageUrl",
    "imageAlt",
    "imageSource",
  ]);
  const FORBIDDEN_FIELDS = Object.freeze([
    "id",
    "ideaId",
    "idea_id",
    "databaseId",
    "database_id",
    "ownerId",
    "owner_id",
    "ownerUserId",
    "owner_user_id",
    "collectionId",
    "collection_id",
    "status",
    "archived",
    "isArchived",
    "is_archived",
    "lifecycle",
    "tripId",
    "trip_id",
    "tripItemId",
    "trip_item_id",
    "addedToTripId",
    "added_to_trip_id",
    "addedToTripItemId",
    "added_to_trip_item_id",
    "destinationTripId",
    "destination_trip_id",
    "destinationType",
    "destination_type",
    "moveToTrip",
    "move_to_trip",
    "addToTrip",
    "add_to_trip",
    "command",
    "action",
  ]);

  class IngestionContractError extends TypeError {
    constructor(code, field) {
      super(`${code}: ${field}`);
      this.name = "IngestionContractError";
      this.code = code;
      this.field = field;
    }
  }

  function fail(code, field) {
    throw new IngestionContractError(code, field);
  }

  function trimString(value, field, { required = false } = {}) {
    if (value === null || value === undefined) {
      if (required) fail("required_field", field);
      return null;
    }
    if (typeof value !== "string") fail("invalid_string", field);
    const normalized = value.trim();
    if (!normalized) {
      if (required) fail("required_field", field);
      return null;
    }
    return normalized;
  }

  function normalizeUrl(value, field) {
    const normalized = trimString(value, field);
    if (normalized === null) return null;
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") fail("invalid_url", field);
      return parsed.href;
    } catch (error) {
      if (error instanceof IngestionContractError) throw error;
      fail("invalid_url", field);
    }
  }

  function normalizePrice(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      fail("invalid_price", "priceAmount");
    }
    return value;
  }

  function normalizeCurrency(value) {
    const normalized = trimString(value, "priceCurrency");
    if (normalized === null) return null;
    const uppercase = normalized.toUpperCase();
    if (!/^[A-Z]{3}$/.test(uppercase)) fail("invalid_currency", "priceCurrency");
    return uppercase;
  }

  function normalizeSemanticType(value) {
    const normalized = trimString(value, "semanticType");
    if (normalized === null) return "idea";
    const lowercase = normalized.toLowerCase();
    return SEMANTIC_TYPES.includes(lowercase) ? lowercase : "idea";
  }

  function assignOptional(target, field, value) {
    if (value !== null) target[field] = value;
  }

  function normalizeBackpackerIdeaIngestionPayloadV1(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      fail("invalid_payload", "payload");
    }
    if (input.schemaVersion !== INGESTION_SCHEMA_VERSION) {
      fail("unsupported_schema_version", "schemaVersion");
    }
    if (input.source !== INGESTION_SOURCE) fail("unsupported_source", "source");

    const forbiddenField = FORBIDDEN_FIELDS.find((field) => Object.prototype.hasOwnProperty.call(input, field));
    if (forbiddenField) fail("forbidden_field", forbiddenField);
    const unsupportedField = Object.keys(input).find((field) => !IDEA_PAYLOAD_FIELDS.includes(field));
    if (unsupportedField) fail("unsupported_field", unsupportedField);

    const sourceIdeaId = trimString(input.sourceIdeaId, "sourceIdeaId", { required: true });
    const sourceCollectionId = trimString(input.sourceCollectionId, "sourceCollectionId");
    const sourceCollectionTitle = trimString(input.sourceCollectionTitle, "sourceCollectionTitle");
    if (sourceCollectionId && !sourceCollectionTitle) {
      fail("required_field", "sourceCollectionTitle");
    }

    const normalized = {
      schemaVersion: INGESTION_SCHEMA_VERSION,
      source: INGESTION_SOURCE,
      sourceIdeaId,
      title: trimString(input.title, "title", { required: true }),
      semanticType: normalizeSemanticType(input.semanticType),
    };
    assignOptional(normalized, "sourceCollectionId", sourceCollectionId);
    assignOptional(normalized, "sourceCollectionTitle", sourceCollectionTitle);
    assignOptional(normalized, "url", normalizeUrl(input.url, "url"));
    assignOptional(normalized, "notes", trimString(input.notes, "notes"));
    assignOptional(normalized, "excerpt", trimString(input.excerpt, "excerpt"));
    assignOptional(normalized, "locationText", trimString(input.locationText, "locationText"));
    assignOptional(normalized, "priceAmount", normalizePrice(input.priceAmount));
    assignOptional(normalized, "priceCurrency", normalizeCurrency(input.priceCurrency));
    assignOptional(normalized, "imageUrl", normalizeUrl(input.imageUrl, "imageUrl"));
    assignOptional(normalized, "imageAlt", trimString(input.imageAlt, "imageAlt"));
    assignOptional(normalized, "imageSource", trimString(input.imageSource, "imageSource"));
    return normalized;
  }

  const api = {
    COLLECTION_PAYLOAD_FIELDS,
    FORBIDDEN_FIELDS,
    IDEA_PAYLOAD_FIELDS,
    INGESTION_SCHEMA_VERSION,
    INGESTION_SOURCE,
    IngestionContractError,
    SEMANTIC_TYPES,
    normalizeBackpackerIdeaIngestionPayloadV1,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerIdeaIngestionContract = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
