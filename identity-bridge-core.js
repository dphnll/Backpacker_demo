(function initIdentityBridgeCore(root) {
  "use strict";

  const PENDING_INTENT_SCHEMA_VERSION = 1;
  const DEFAULT_PENDING_INTENT_TTL_MS = 15 * 60 * 1000;
  const SECRET_PATTERN = /bpxc_v1_|access[_-]?token|refresh[_-]?token|authorization|service[_-]?role|credential|secret|anon[_-]?key|apikey/i;

  class IdentityBridgeError extends TypeError {
    constructor(code, field) {
      super(`${code}: ${field}`);
      this.name = "IdentityBridgeError";
      this.code = code;
      this.field = field;
    }
  }

  function fail(code, field) {
    throw new IdentityBridgeError(code, field);
  }

  function normalizeUserSummary(user = null) {
    const providers = Array.isArray(user?.providers)
      ? user.providers.map((provider) => String(provider || "")).filter(Boolean)
      : [];
    const hasEmailIdentity = user?.hasEmailIdentity === true || providers.includes("email");
    const id = String(user?.id || "").trim();
    return {
      email: String(user?.email || "").trim(),
      hasEmailIdentity,
      id,
      isAnonymous: user?.isAnonymous === true || user?.is_anonymous === true,
      providers,
    };
  }

  function normalizeExtensionId(value) {
    const text = String(value || "").trim();
    if (!/^[a-p]{32}$/.test(text)) fail("invalid_extension_id", "extensionId");
    return text;
  }

  function normalizeClientKey(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!/^[a-z0-9._:-]{8,80}$/.test(text)) fail("invalid_client_key", "clientKey");
    return text;
  }

  function normalizeNonce(value) {
    const text = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(text)) fail("invalid_nonce", "nonce");
    return text;
  }

  function normalizeExtensionConnectRequest(request = null) {
    if (!request || typeof request !== "object" || Array.isArray(request)) return null;
    return {
      extensionId: normalizeExtensionId(request.extensionId),
      clientKey: normalizeClientKey(request.clientKey),
      nonce: normalizeNonce(request.nonce),
    };
  }

  function getIdentityBridgeState({ user = null, extensionConnectRequest = null } = {}) {
    const request = normalizeExtensionConnectRequest(extensionConnectRequest);
    if (!request) {
      return {
        status: "no_extension_connect_request",
        connectAllowed: false,
        identityRequired: false,
        user: normalizeUserSummary(user),
      };
    }

    const summary = normalizeUserSummary(user);
    if (!summary.id) {
      return {
        status: "identity_required",
        reason: "missing_owner_session",
        connectAllowed: false,
        identityRequired: true,
        request,
        user: summary,
      };
    }

    if (!summary.hasEmailIdentity) {
      return {
        status: "identity_required",
        reason: summary.isAnonymous ? "anonymous_owner" : "email_identity_missing",
        connectAllowed: false,
        identityRequired: true,
        request,
        user: summary,
      };
    }

    return {
      status: "connect_allowed",
      connectAllowed: true,
      identityRequired: false,
      request,
      user: summary,
    };
  }

  function assertNoSecretsInPendingIntent(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value || {});
    if (SECRET_PATTERN.test(text)) fail("secret_in_pending_intent", "pendingIntent");
    return true;
  }

  function serializePendingExtensionConnectIntent(request, { createdAt = new Date().toISOString() } = {}) {
    const normalized = normalizeExtensionConnectRequest(request);
    const payload = {
      schemaVersion: PENDING_INTENT_SCHEMA_VERSION,
      createdAt: String(createdAt || ""),
      request: normalized,
    };
    assertNoSecretsInPendingIntent(payload);
    return JSON.stringify(payload);
  }

  function restorePendingExtensionConnectIntent(serialized, {
    now = new Date(),
    ttlMs = DEFAULT_PENDING_INTENT_TTL_MS,
  } = {}) {
    if (!serialized) return null;
    let payload;
    try {
      payload = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    } catch {
      return null;
    }
    assertNoSecretsInPendingIntent(payload);
    if (payload?.schemaVersion !== PENDING_INTENT_SCHEMA_VERSION) return null;
    const createdAt = new Date(payload.createdAt || 0);
    if (!Number.isFinite(createdAt.getTime())) return null;
    const nowTime = now instanceof Date ? now.getTime() : new Date(now || 0).getTime();
    if (!Number.isFinite(nowTime)) return null;
    if (ttlMs >= 0 && nowTime - createdAt.getTime() > ttlMs) return null;
    return {
      schemaVersion: PENDING_INTENT_SCHEMA_VERSION,
      createdAt: createdAt.toISOString(),
      request: normalizeExtensionConnectRequest(payload.request),
    };
  }

  const api = {
    DEFAULT_PENDING_INTENT_TTL_MS,
    IdentityBridgeError,
    PENDING_INTENT_SCHEMA_VERSION,
    assertNoSecretsInPendingIntent,
    getIdentityBridgeState,
    normalizeExtensionConnectRequest,
    normalizeUserSummary,
    restorePendingExtensionConnectIntent,
    serializePendingExtensionConnectIntent,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerIdentityBridge = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
