// Backpacker Analytics Contract v0.2 source-event boundary.
(function initBackpackerAnalyticsSource(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BackpackerAnalyticsSource = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ANALYTICS_SCHEMA_VERSION = "2026-08-26.1";
  const EVENT_CONTRACT_VERSION = "0.2";

  const CONTRACT_COMMON_PROPERTIES = Object.freeze([
    "anon_user_id", "session_id", "analytics_schema_version", "event_contract_version",
    "app_version", "release_id", "environment", "is_internal_user", "is_test_user", "identity_type",
    "source_event_timestamp", "$geoip_disable",
  ]);

  const CONTRACT_EVENT_PROPERTIES = Object.freeze({
    app_shared: [],
    trip_created: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket",
      "creation_source", "trip_count_after_create", "is_second_user_trip",
    ],
    trip_first_value_reached: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket",
      "definition_version", "item_count", "scheduled_item_count", "meaningful_field_count",
    ],
    item_created: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket", "item_id",
      "item_type", "item_status", "item_priority", "has_date", "has_time", "has_price",
      "has_paid_amount", "has_link", "has_location", "has_note", "creation_source",
      "source_idea_id", "copy_destination_type",
    ],
    item_updated: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket", "item_id",
      "item_type", "item_status", "item_priority", "has_date", "has_time", "has_price",
      "has_paid_amount", "has_link", "has_location", "has_note", "changed_fields",
    ],
    item_day_changed: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket", "item_id",
      "item_type", "item_status", "from_bucket", "to_bucket", "method", "dropped_before_item",
    ],
    trip_settings_updated: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket", "changed_fields",
      "currency_changed", "has_budget", "has_dates",
    ],
    trip_working_plan_reached: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket", "definition_version",
      "item_count", "scheduled_item_count", "scheduled_day_count", "scheduled_share_bucket",
      "type_count", "has_budget", "has_costs", "has_paid_amounts", "has_statuses", "has_priorities",
    ],
    trip_share_created: [
      "trip_id", "trip_origin", "trip_phase", "days_until_trip_bucket", "collaboration_id",
      "actor_role", "access_mode", "share_source",
    ],
    shared_trip_opened: [
      "trip_id", "trip_origin", "collaboration_id", "actor_role", "access_mode",
    ],
    idea_saved: ["idea_id", "capture_source"],
    idea_add_to_trip_started: ["idea_id", "capture_source"],
  });

  const REQUIRED_EVENT_PROPERTIES = Object.freeze({
    app_shared: [],
    trip_created: ["trip_id", "trip_origin", "creation_source"],
    trip_first_value_reached: ["trip_id", "trip_origin", "definition_version"],
    item_created: ["trip_id", "trip_origin", "item_id", "creation_source"],
    item_updated: ["trip_id", "trip_origin", "item_id", "changed_fields"],
    item_day_changed: ["trip_id", "trip_origin", "item_id", "from_bucket", "to_bucket"],
    trip_settings_updated: ["trip_id", "trip_origin", "changed_fields"],
    trip_working_plan_reached: ["trip_id", "trip_origin", "definition_version"],
    trip_share_created: ["trip_id", "collaboration_id", "actor_role", "access_mode", "share_source"],
    shared_trip_opened: ["trip_id", "collaboration_id", "actor_role", "access_mode"],
    idea_saved: ["idea_id", "capture_source"],
    idea_add_to_trip_started: ["idea_id", "capture_source"],
  });

  const CONTROLLED_CHANGED_FIELDS = new Set([
    "type", "status", "priority", "date", "startTime", "durationMinutes", "price", "paidAmount",
    "link", "locationText", "notes", "participantId", "allocations", "title", "destination",
    "startDate", "endDate", "currency", "budgetLimit", "preferencesText",
  ]);
  const OPAQUE_ID_KEYS = new Set(["trip_id", "item_id", "collaboration_id", "idea_id", "source_idea_id"]);
  const FORBIDDEN_PROPERTY_NAMES = new Set([
    "tripname", "triptitle", "destination", "location", "locationtext", "itemtitle", "title",
    "notes", "url", "link", "shareurl", "sharetoken", "token", "startdate", "enddate", "date",
    "day", "image", "imagedata", "file", "filename", "attachment", "aisourcetext", "generatedtext",
    "voicetranscript", "transcript", "preferences", "preferencestext", "email", "phone", "displayname",
    "username", "query", "prompt", "content", "description", "message",
  ]);

  function normalizePropertyName(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  }

  function normalizeOpaqueId(value) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized.length > 160 || !/^[a-z0-9._:-]+$/i.test(normalized)) return "";
    return normalized;
  }

  function normalizeEnum(value, allowed, fallback = "other") {
    const normalized = String(value || "").trim().toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
  }

  function normalizeCreationSource(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["manual", "home", "home_manual"].includes(normalized)) return "manual";
    if (["idea", "travel_idea"].includes(normalized)) return "idea";
    if (normalized === "copy") return "copy";
    if (["proposal", "accepted_proposal"].includes(normalized)) return "proposal";
    if (normalized === "ai_draft") return "ai_draft";
    return "other";
  }

  function normalizeCaptureSource(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["extension", "browser_extension"].includes(normalized)) return "extension";
    return normalizeEnum(normalized, ["manual", "other"]);
  }

  function sanitizeValue(key, value) {
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (key === "changed_fields") {
      return [...new Set((Array.isArray(value) ? value : []).filter((field) => CONTROLLED_CHANGED_FIELDS.has(field)))];
    }
    if (Array.isArray(value)) {
      return value.filter((entry) => ["string", "number", "boolean"].includes(typeof entry)).slice(0, 32);
    }
    if (typeof value === "string") return value.slice(0, 160);
    return undefined;
  }

  function normalizeControlledProperty(key, value) {
    if (OPAQUE_ID_KEYS.has(key)) return normalizeOpaqueId(value) || undefined;
    if (key === "trip_origin") return normalizeEnum(value, ["demo", "user_created"], "user_created");
    if (key === "creation_source") return normalizeCreationSource(value);
    if (key === "capture_source") return normalizeCaptureSource(value);
    if (key === "actor_role") return normalizeEnum(value, ["owner", "recipient"]);
    if (key === "access_mode") return normalizeEnum(value, ["view", "propose", "edit"]);
    if (key === "share_source") return normalizeEnum(value, ["link", "direct", "in_app", "other"]);
    if (key === "identity_type") return normalizeEnum(value, ["anonymous_browser", "authenticated_account"], "anonymous_browser");
    if (key === "environment") return normalizeEnum(value, ["production", "local", "preview"], "preview");
    return sanitizeValue(key, value);
  }

  function sanitizeEventProperties(eventName, properties = {}) {
    const allowlist = CONTRACT_EVENT_PROPERTIES[eventName];
    const entries = Object.entries(properties || {}).filter(([key]) => !FORBIDDEN_PROPERTY_NAMES.has(normalizePropertyName(key)));
    const selected = allowlist ? entries.filter(([key]) => allowlist.includes(key)) : entries;
    const safe = {};
    selected.forEach(([key, value]) => {
      const normalized = normalizeControlledProperty(key, value);
      if (normalized !== undefined) safe[key] = normalized;
    });
    if (eventName === "item_created" && safe.creation_source !== "idea") delete safe.source_idea_id;
    return safe;
  }

  function sanitizeContractEventPayload(eventName, payload = {}) {
    if (!CONTRACT_EVENT_PROPERTIES[eventName]) return payload;
    const safe = {};
    CONTRACT_COMMON_PROPERTIES.forEach((key) => {
      if (!(key in payload)) return;
      const normalized = normalizeControlledProperty(key, payload[key]);
      if (normalized !== undefined) safe[key] = normalized;
    });
    return Object.assign(safe, sanitizeEventProperties(eventName, payload));
  }

  function getMissingRequiredProperties(eventName, properties = {}) {
    const required = REQUIRED_EVENT_PROPERTIES[eventName] || [];
    return required.filter((key) => {
      const value = properties[key];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length);
    });
  }

  return Object.freeze({
    ANALYTICS_SCHEMA_VERSION,
    EVENT_CONTRACT_VERSION,
    CONTRACT_COMMON_PROPERTIES,
    CONTRACT_EVENT_PROPERTIES,
    REQUIRED_EVENT_PROPERTIES,
    normalizeCaptureSource,
    normalizeCreationSource,
    sanitizeEventProperties,
    sanitizeContractEventPayload,
    getMissingRequiredProperties,
  });
});
