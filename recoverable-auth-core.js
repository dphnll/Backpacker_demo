(function initRecoverableAuthCore(root) {
  "use strict";

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const AUTH_QUERY_PARAMS = new Set(["code", "error", "error_code", "error_description", "error_uri", "type"]);
  const DEFAULT_PUBLIC_APP_URL = "https://dphnll.github.io/Backpacker_demo/";

  function normalizeEmail(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function getEmailError(value = "") {
    const email = normalizeEmail(value);
    if (!email) return "Введите email";
    if (!EMAIL_PATTERN.test(email)) return "Введите корректный email";
    return "";
  }

  function getAuthCallbackInfo(href = "") {
    const url = new URL(href || "https://example.com/");
    const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));
    const queryHasAuth = Array.from(url.searchParams.keys()).some((key) => AUTH_QUERY_PARAMS.has(key));
    const hashHasAuth = hashParams.has("access_token") || hashParams.has("refresh_token") || hashParams.has("error") || hashParams.has("error_description");
    const error = url.searchParams.get("error") || hashParams.get("error") || "";
    const errorDescription = url.searchParams.get("error_description") || hashParams.get("error_description") || "";
    const code = url.searchParams.get("code") || "";
    return {
      code,
      error,
      errorDescription,
      hasAuthParams: queryHasAuth || hashHasAuth,
      hasCode: Boolean(code),
      hasError: Boolean(error || errorDescription),
      hasHashTokens: hashParams.has("access_token") || hashParams.has("refresh_token"),
    };
  }

  function getCleanAuthCallbackUrl(href = "") {
    const url = new URL(href || "https://example.com/");
    for (const key of AUTH_QUERY_PARAMS) url.searchParams.delete(key);
    const hash = url.hash || "";
    if (hash && !hash.startsWith("#share=")) url.hash = "";
    return url.toString();
  }

  function normalizeRedirectBaseUrl(value = "") {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  }

  function isLocalAppUrl(url) {
    return url.protocol === "file:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  }

  function resolveRecoverableAuthRedirectUrl({
    href = "",
    configuredUrl = "",
    defaultUrl = DEFAULT_PUBLIC_APP_URL,
  } = {}) {
    const current = new URL(href || defaultUrl);
    current.search = "";
    current.hash = "";
    if (isLocalAppUrl(current)) return current.toString();

    const configured = normalizeRedirectBaseUrl(configuredUrl);
    if (configured) {
      const configuredParsed = new URL(configured);
      if (!isLocalAppUrl(configuredParsed)) return configured;
    }

    if (current.protocol === "http:" || current.protocol === "https:") return current.toString();
    return normalizeRedirectBaseUrl(defaultUrl) || DEFAULT_PUBLIC_APP_URL;
  }

  function summarizeAuthUser(user = null) {
    const identities = Array.isArray(user?.identities) ? user.identities : [];
    const providers = identities
      .map((identity) => String(identity?.provider || ""))
      .filter(Boolean);
    return {
      email: user?.email || "",
      hasEmailIdentity: providers.includes("email"),
      id: user?.id || "",
      isAnonymous: user?.is_anonymous === true,
      providers,
    };
  }

  const api = {
    getAuthCallbackInfo,
    getCleanAuthCallbackUrl,
    getEmailError,
    normalizeEmail,
    resolveRecoverableAuthRedirectUrl,
    summarizeAuthUser,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerRecoverableAuth = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
