(function initGroupTripCore(root) {
  "use strict";

  const PENDING_INTENT_SCHEMA_VERSION = 1;
  const DEFAULT_PENDING_INTENT_TTL_MS = 15 * 60 * 1000;
  const ACTIONS = new Set(["join", "publish_group"]);
  const AUTH_FLOWS = new Set(["upgrade", "login"]);
  const FORBIDDEN_KEY_PATTERN = /token|email|name|title|destination|text|secret|credential|authorization|apikey/i;
  const FORBIDDEN_VALUE_PATTERN = /bpxc_v1_|access[_-]?token|refresh[_-]?token|service[_-]?role|authorization|credential|secret|apikey/i;

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
    GroupTripIntentError,
    PENDING_INTENT_SCHEMA_VERSION,
    createPendingGroupTripIntent,
    getPendingGroupTripResumeDecision,
    hasDurableEmailIdentity,
    isGroupTripState,
    normalizePendingGroupTripIntent,
    restorePendingGroupTripIntent,
    serializePendingGroupTripIntent,
    withPendingGroupTripAuthFlow,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BackpackerGroupTrips = api;
})(typeof window !== "undefined" ? window : globalThis);
