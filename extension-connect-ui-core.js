(function initExtensionConnectUiCore(root) {
  "use strict";

  const CONNECT_QUERY_PARAM = "extensionConnect";
  const CONNECT_MESSAGE_TYPE = "BACKPACKER_EXTENSION_CONNECT_CREDENTIAL_V1";

  class ExtensionConnectUiError extends TypeError {
    constructor(code, field) {
      super(`${code}: ${field}`);
      this.name = "ExtensionConnectUiError";
      this.code = code;
      this.field = field;
    }
  }

  function fail(code, field) {
    throw new ExtensionConnectUiError(code, field);
  }

  function trim(value, field) {
    if (typeof value !== "string") fail("invalid_string", field);
    const text = value.trim();
    if (!text) fail("required_field", field);
    return text;
  }

  function normalizeExtensionId(value) {
    const text = trim(value, "extensionId");
    if (!/^[a-p]{32}$/.test(text)) fail("invalid_extension_id", "extensionId");
    return text;
  }

  function normalizeClientKey(value) {
    const text = trim(value, "clientKey").toLowerCase();
    if (!/^[a-z0-9._:-]{8,80}$/.test(text)) fail("invalid_client_key", "clientKey");
    return text;
  }

  function normalizeNonce(value) {
    const text = trim(value, "nonce");
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(text)) fail("invalid_nonce", "nonce");
    return text;
  }

  function normalizeAccountEmail(value) {
    if (typeof value !== "string") return "";
    const text = value.trim().toLowerCase();
    if (!text || text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "";
    return text;
  }

  function parseExtensionConnectRequest(href) {
    const url = new URL(href);
    if (url.searchParams.get(CONNECT_QUERY_PARAM) !== "1") return null;
    return {
      extensionId: normalizeExtensionId(url.searchParams.get("extensionId") || ""),
      clientKey: normalizeClientKey(url.searchParams.get("clientKey") || ""),
      nonce: normalizeNonce(url.searchParams.get("nonce") || ""),
    };
  }

  function stripExtensionConnectParams(href) {
    const url = new URL(href);
    [
      CONNECT_QUERY_PARAM,
      "extensionId",
      "clientKey",
      "nonce",
    ].forEach((param) => url.searchParams.delete(param));
    return url.toString();
  }

  function assertNoCredentialInUrl(href) {
    const text = String(href || "");
    if (/bpxc_v1_/i.test(text) || /credential=/i.test(text)) {
      fail("credential_url_leak", "url");
    }
    return true;
  }

  function normalizeBaseUrl(value, field) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    if (!text) return "";
    try {
      const parsed = new URL(text);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return "";
      return parsed.href.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  function normalizeLocalExtensionConnectFunctionUrl(value) {
    const normalized = normalizeBaseUrl(value, "extensionConnectFunctionUrl");
    if (!normalized) return "";
    try {
      const parsed = new URL(normalized);
      if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) return "";
      if (parsed.pathname.replace(/\/+$/, "") !== "/functions/v1/extension-connect") return "";
      return parsed.href.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  function resolveExtensionConnectFunctionUrl(config) {
    const localOverride = normalizeLocalExtensionConnectFunctionUrl(config?.extensionConnectFunctionUrl);
    if (localOverride) return localOverride;
    const baseUrl = normalizeBaseUrl(config?.url, "url");
    return baseUrl ? `${baseUrl}/functions/v1/extension-connect` : "";
  }

  function buildCredentialBridgeMessage({ request, credential, connection, account }) {
    const token = trim(credential, "credential");
    if (!/^bpxc_v1_[a-f0-9]{64}$/i.test(token)) fail("invalid_credential", "credential");
    const email = normalizeAccountEmail(account?.email);
    if (!email) fail("invalid_account", "account.email");
    return {
      type: CONNECT_MESSAGE_TYPE,
      schemaVersion: 1,
      nonce: normalizeNonce(request?.nonce || ""),
      clientKey: normalizeClientKey(request?.clientKey || ""),
      credential: token,
      connection: {
        clientKey: normalizeClientKey(connection?.clientKey || request?.clientKey || ""),
        expiresAt: trim(connection?.expiresAt || "", "expiresAt"),
      },
      account: { email },
    };
  }

  const api = {
    CONNECT_MESSAGE_TYPE,
    CONNECT_QUERY_PARAM,
    ExtensionConnectUiError,
    assertNoCredentialInUrl,
    buildCredentialBridgeMessage,
    normalizeClientKey,
    normalizeAccountEmail,
    normalizeExtensionId,
    normalizeLocalExtensionConnectFunctionUrl,
    normalizeNonce,
    parseExtensionConnectRequest,
    resolveExtensionConnectFunctionUrl,
    stripExtensionConnectParams,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerExtensionConnectUI = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
