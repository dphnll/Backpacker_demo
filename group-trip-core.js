(function initGroupTripCore(root) {
  "use strict";

  const PENDING_INTENT_SCHEMA_VERSION = 1;
  const DEFAULT_PENDING_INTENT_TTL_MS = 15 * 60 * 1000;
  const ACTIONS = new Set(["join", "publish_group"]);
  const AUTH_FLOWS = new Set(["upgrade", "login"]);
  const FORBIDDEN_KEY_PATTERN = /token|email|name|title|destination|text|secret|credential|authorization|apikey/i;
  const FORBIDDEN_VALUE_PATTERN = /bpxc_v1_|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization|credential|secret|apikey/i;
  const GROUP_MATERIAL_SCOPE_ID = "group-materials";
  const PROGRAM_TEXT_LIMIT = 4000;
  const MATERIAL_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  class GroupTripIntentError extends TypeError {
    constructor(code, field) {
      super(`${code}: ${field}`);
      this.name = "GroupTripIntentError";
      this.code = code;
      this.field = field;
    }
  }

  function fail(code, field) {
    throw new GroupTripIntentError(code, field);
  }

  function normalizeShareId(value) {
    const id = String(value || "").trim().toLowerCase();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) {
      fail("invalid_share_id", "shareId");
    }
    return id;
  }

  function normalizeTripId(value) {
    const id = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) fail("invalid_trip_id", "tripId");
    return id;
  }

  function normalizeUserId(value, { required = false } = {}) {
    const id = String(value || "").trim().toLowerCase();
    if (!id && !required) return "";
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) {
      fail("invalid_user_id", "expectedUserId");
    }
    return id;
  }

  function isGroupTripState(state) {
    return state?.trip?.isGroupTrip === true;
  }

  function normalizeProgramText(value) {
    return String(value || "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, PROGRAM_TEXT_LIMIT);
  }

  function normalizeProgramInfo(value = {}, fallbackCurrency = "RUB") {
    const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const rawAmount = input.priceAmount;
    const amount = rawAmount === "" || rawAmount === null || rawAmount === undefined ? 0 : Number(rawAmount);
    const fallback = /^[A-Z]{3}$/.test(String(fallbackCurrency || "").toUpperCase())
      ? String(fallbackCurrency).toUpperCase()
      : "RUB";
    const currency = String(input.priceCurrency || fallback).trim().toUpperCase();
    return {
      priceAmount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0,
      priceCurrency: /^[A-Z]{3}$/.test(currency) ? currency : fallback,
      includedText: normalizeProgramText(input.includedText),
      notIncludedText: normalizeProgramText(input.notIncludedText),
      importantInfoText: normalizeProgramText(input.importantInfoText),
    };
  }

  function hasProgramInfo(value = {}) {
    const programInfo = normalizeProgramInfo(value);
    return Boolean(
      programInfo.priceAmount
      || programInfo.includedText
      || programInfo.notIncludedText
      || programInfo.importantInfoText,
    );
  }

  function normalizeGroupMaterialDescriptor(value = {}) {
    const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const id = String(input.id || "").trim().toLowerCase();
    const fileName = String(input.fileName || input.file_name || "").trim();
    const mimeType = String(input.mimeType || input.mime_type || "").trim().toLowerCase();
    const fileSizeBytes = Number(input.fileSizeBytes ?? input.file_size_bytes);
    const createdAtValue = String(input.createdAt || input.created_at || "");
    const createdAt = new Date(createdAtValue);
    if (!UUID_PATTERN.test(id) || !fileName || fileName.length > 255 || /[\u0000-\u001F\u007F]/.test(fileName)) return null;
    if (!MATERIAL_MIME_TYPES.has(mimeType)) return null;
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > 10 * 1024 * 1024) return null;
    if (!Number.isFinite(createdAt.getTime())) return null;
    return { id, fileName, mimeType, fileSizeBytes, createdAt: createdAt.toISOString() };
  }

  function normalizeGroupMaterials(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0, 40).reduce((materials, entry) => {
      const material = normalizeGroupMaterialDescriptor(entry);
      if (!material || seen.has(material.id)) return materials;
      seen.add(material.id);
      materials.push(material);
      return materials;
    }, []);
  }

  function normalizeOrganizerTripFields(trip = {}) {
    const next = trip && typeof trip === "object" && !Array.isArray(trip) ? trip : {};
    next.programInfo = normalizeProgramInfo(next.programInfo, next.currency);
    next.groupMaterials = normalizeGroupMaterials(next.groupMaterials);
    const updatedAt = new Date(String(next.programUpdatedAt || ""));
    next.programUpdatedAt = Number.isFinite(updatedAt.getTime()) ? updatedAt.toISOString() : "";
    return next;
  }

  function stripOrganizerFields(state) {
    if (!state?.trip) return state;
    delete state.trip.programInfo;
    delete state.trip.groupMaterials;
    delete state.trip.programUpdatedAt;
    return state;
  }

  function getProgramComparableState(state) {
    const comparable = JSON.parse(JSON.stringify(state || {}));
    if (comparable?.trip) delete comparable.trip.programUpdatedAt;
    return comparable;
  }

  function stampPublishedProgramState(state, previousState = null, now = new Date()) {
    if (!state?.trip) return state;
    if (!isGroupTripState(state)) return stripOrganizerFields(state);
    normalizeOrganizerTripFields(state.trip);
    const previousTimestamp = String(previousState?.trip?.programUpdatedAt || "");
    const unchanged = isGroupTripState(previousState)
      && JSON.stringify(getProgramComparableState(previousState)) === JSON.stringify(getProgramComparableState(state));
    const nextTimestamp = unchanged && Number.isFinite(Date.parse(previousTimestamp))
      ? new Date(previousTimestamp)
      : (now instanceof Date ? now : new Date(now));
    state.trip.programUpdatedAt = nextTimestamp.toISOString();
    return state;
  }

  function hasDurableEmailIdentity(user = null) {
    const providers = Array.isArray(user?.providers)
      ? user.providers
      : Array.isArray(user?.identities)
        ? user.identities.map((identity) => identity?.provider)
        : [];
    return Boolean(
      user?.id
      && user?.isAnonymous !== true
      && user?.is_anonymous !== true
      && (user?.hasEmailIdentity === true || providers.includes("email")),
    );
  }

  function assertIntentShape(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("invalid_intent", "pendingIntent");
    const allowed = new Set(["schemaVersion", "action", "shareId", "tripId", "authFlow", "expectedUserId", "switchFrom", "createdAt"]);
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key) || FORBIDDEN_KEY_PATTERN.test(key)) fail("unsafe_intent_field", key);
    }
    const text = JSON.stringify(payload);
    if (FORBIDDEN_VALUE_PATTERN.test(text) || /[a-f0-9]{64}/i.test(text)) fail("secret_in_pending_intent", "pendingIntent");
  }

  function normalizePendingGroupTripIntent(payload) {
    assertIntentShape(payload);
    if (payload.schemaVersion !== PENDING_INTENT_SCHEMA_VERSION) fail("invalid_schema_version", "schemaVersion");
    const action = String(payload.action || "");
    if (!ACTIONS.has(action)) fail("invalid_action", "action");
    const authFlow = String(payload.authFlow || "");
    if (!AUTH_FLOWS.has(authFlow)) fail("invalid_auth_flow", "authFlow");
    const createdAt = new Date(payload.createdAt || 0);
    if (!Number.isFinite(createdAt.getTime())) fail("invalid_created_at", "createdAt");
    const expectedUserId = authFlow === "upgrade"
      ? normalizeUserId(payload.expectedUserId, { required: true })
      : "";
    const switchFrom = payload.switchFrom === "ordinary" && action === "publish_group" ? "ordinary" : "";
    return {
      schemaVersion: PENDING_INTENT_SCHEMA_VERSION,
      action,
      ...(action === "join" ? { shareId: normalizeShareId(payload.shareId) } : { tripId: normalizeTripId(payload.tripId) }),
      authFlow,
      ...(expectedUserId ? { expectedUserId } : {}),
      ...(switchFrom ? { switchFrom } : {}),
      createdAt: createdAt.toISOString(),
    };
  }

  function createPendingGroupTripIntent({ action, shareId, tripId, authFlow = "upgrade", expectedUserId = "", switchFrom = "", createdAt = new Date().toISOString() } = {}) {
    return normalizePendingGroupTripIntent({
      schemaVersion: PENDING_INTENT_SCHEMA_VERSION,
      action,
      ...(action === "join" ? { shareId } : { tripId }),
      authFlow,
      ...(authFlow === "upgrade" ? { expectedUserId } : {}),
      ...(switchFrom ? { switchFrom } : {}),
      createdAt,
    });
  }

  function serializePendingGroupTripIntent(input) {
    return JSON.stringify(normalizePendingGroupTripIntent(input));
  }

  function restorePendingGroupTripIntent(serialized, { now = new Date(), ttlMs = DEFAULT_PENDING_INTENT_TTL_MS } = {}) {
    if (!serialized) return null;
    let payload;
    try {
      payload = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
      const intent = normalizePendingGroupTripIntent(payload);
      const nowTime = now instanceof Date ? now.getTime() : new Date(now || 0).getTime();
      if (!Number.isFinite(nowTime)) return null;
      if (ttlMs >= 0 && nowTime - new Date(intent.createdAt).getTime() > ttlMs) return null;
      return intent;
    } catch {
      return null;
    }
  }

  function withPendingGroupTripAuthFlow(intent, authFlow, expectedUserId = "") {
    return normalizePendingGroupTripIntent({
      ...intent,
      authFlow,
      expectedUserId: authFlow === "upgrade" ? expectedUserId : undefined,
    });
  }

  function getPendingGroupTripResumeDecision(intent, user) {
    if (!intent) return { status: "no_intent", resumeAllowed: false };
    if (!hasDurableEmailIdentity(user)) return { status: "identity_required", resumeAllowed: false };
    if (intent.authFlow === "upgrade" && intent.expectedUserId !== String(user.id || "").toLowerCase()) {
      return { status: "uid_mismatch", resumeAllowed: false };
    }
    return { status: "resume_allowed", resumeAllowed: true };
  }

  const api = {
    DEFAULT_PENDING_INTENT_TTL_MS,
    GROUP_MATERIAL_SCOPE_ID,
    GroupTripIntentError,
    PENDING_INTENT_SCHEMA_VERSION,
    createPendingGroupTripIntent,
    getPendingGroupTripResumeDecision,
    hasDurableEmailIdentity,
    hasProgramInfo,
    isGroupTripState,
    normalizeGroupMaterialDescriptor,
    normalizeGroupMaterials,
    normalizeOrganizerTripFields,
    normalizePendingGroupTripIntent,
    normalizeProgramInfo,
    restorePendingGroupTripIntent,
    serializePendingGroupTripIntent,
    stampPublishedProgramState,
    stripOrganizerFields,
    withPendingGroupTripAuthFlow,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BackpackerGroupTrips = api;
})(typeof window !== "undefined" ? window : globalThis);
