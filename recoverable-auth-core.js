(function initRecoverableAuthCore(root) {
  "use strict";

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const EMAIL_OTP_LENGTH = 6;
  const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
  const AUTH_QUERY_PARAMS = new Set(["code", "error", "error_code", "error_description", "error_uri", "type"]);

  function normalizeEmail(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function getEmailError(value = "") {
    const email = normalizeEmail(value);
    if (!email) return "Введите email";
    if (!EMAIL_PATTERN.test(email)) return "Введите корректный email";
    return "";
  }

  function normalizeEmailOtp(value = "") {
    return String(value || "").replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH);
  }

  function isCompleteEmailOtp(value = "") {
    return new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(normalizeEmailOtp(value));
  }

  function getEmailOtpErrorCode(error) {
    const code = String(error?.code || error?.error_code || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    const status = Number(error?.status || 0);
    if (status === 429 || code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many")) {
      return "rate_limit";
    }
    if (code === "otp_expired" || message.includes("expired")) return "expired";
    if (["otp_disabled", "invalid_credentials", "validation_failed"].includes(code)
      || message.includes("invalid token")
      || message.includes("invalid otp")
      || message.includes("one-time token not found")) {
      return "invalid";
    }
    if (code === "identity_changed" || message.includes("identity_changed")) return "identity_changed";
    return "unknown";
  }

  function getEmailOtpRetryAfterSeconds(error, fallback = EMAIL_OTP_RESEND_COOLDOWN_SECONDS) {
    const explicit = [error?.retry_after, error?.retryAfter, error?.retry_after_seconds]
      .map(Number)
      .find((value) => Number.isFinite(value) && value > 0);
    const message = String(error?.message || "");
    const parsed = Number(message.match(/(\d+)\s*(?:seconds?|secs?|s)\b/i)?.[1] || 0);
    const seconds = explicit || parsed || Number(fallback) || EMAIL_OTP_RESEND_COOLDOWN_SECONDS;
    return Math.min(600, Math.max(1, Math.ceil(seconds)));
  }

  function createRecoverableAuthError(code, cause = null) {
    const error = new Error(code);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function requireAuthResult(result) {
    if (result?.error) throw result.error;
    return result?.data || {};
  }

  async function beginEmailOtpUpgrade(auth, { email, redirectTo = "" } = {}) {
    if (!auth?.updateUser) throw createRecoverableAuthError("auth_unavailable");
    return requireAuthResult(await auth.updateUser(
      { email: normalizeEmail(email) },
      redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    ));
  }

  async function beginEmailOtpLogin(auth, { email, redirectTo = "" } = {}) {
    if (!auth?.signInWithOtp) throw createRecoverableAuthError("auth_unavailable");
    return requireAuthResult(await auth.signInWithOtp({
      email: normalizeEmail(email),
      options: {
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        shouldCreateUser: false,
      },
    }));
  }

  async function resendEmailOtp(auth, { email, flow, redirectTo = "" } = {}) {
    if (flow === "upgrade") {
      if (!auth?.resend) throw createRecoverableAuthError("auth_unavailable");
      return requireAuthResult(await auth.resend({
        type: "email_change",
        email: normalizeEmail(email),
        ...(redirectTo ? { options: { emailRedirectTo: redirectTo } } : {}),
      }));
    }
    if (flow === "login") return beginEmailOtpLogin(auth, { email, redirectTo });
    throw createRecoverableAuthError("invalid_otp_flow");
  }

  function summarizeVerifiedOtpUser(data) {
    return summarizeAuthUser(data?.user || data?.session?.user || null);
  }

  function requireDurableOtpUser(data) {
    const user = summarizeVerifiedOtpUser(data);
    if (!user.id || user.isAnonymous || !user.hasEmailIdentity) {
      throw createRecoverableAuthError("otp_verification_failed");
    }
    return user;
  }

  async function verifyEmailOtp(auth, { email, expectedUserId = "", flow, token } = {}) {
    if (!auth?.verifyOtp) throw createRecoverableAuthError("auth_unavailable");
    const type = flow === "upgrade" ? "email_change" : flow === "login" ? "email" : "";
    if (!type) throw createRecoverableAuthError("invalid_otp_flow");
    const data = requireAuthResult(await auth.verifyOtp({
      email: normalizeEmail(email),
      token: normalizeEmailOtp(token),
      type,
    }));
    const verified = requireDurableOtpUser(data);
    if (flow === "login") return verified;
    if (!expectedUserId || verified.id !== expectedUserId) {
      throw createRecoverableAuthError("identity_changed");
    }
    if (!auth?.refreshSession) throw createRecoverableAuthError("otp_verification_failed");
    const refreshed = requireAuthResult(await auth.refreshSession());
    const durable = requireDurableOtpUser(refreshed);
    if (durable.id !== expectedUserId) throw createRecoverableAuthError("identity_changed");
    return durable;
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

  function isSameAppBaseUrl(current, expected) {
    if (!expected || current.origin !== expected.origin) return false;
    const currentPathname = current.pathname.endsWith("/index.html")
      ? current.pathname.slice(0, -"index.html".length)
      : current.pathname;
    return currentPathname === expected.pathname;
  }

  function resolveRecoverableAuthRedirectUrl({
    href = "",
    configuredUrl = "",
    preservedUrls = [],
    legacyUrl = "",
  } = {}) {
    const configured = normalizeRedirectBaseUrl(configuredUrl);
    const legacy = normalizeRedirectBaseUrl(legacyUrl);
    const preserved = Array.isArray(preservedUrls)
      ? preservedUrls.map(normalizeRedirectBaseUrl).filter(Boolean)
      : [];
    const current = new URL(href || configured || legacy || "http://localhost/");
    current.search = "";
    current.hash = "";
    if (isLocalAppUrl(current)) return current.toString();

    const recognizedBases = [configured, ...preserved, legacy]
      .filter(Boolean)
      .map((value) => new URL(value));
    const recognizedBase = recognizedBases.find((base) => isSameAppBaseUrl(current, base));
    if (recognizedBase) return recognizedBase.toString();

    if (configured && !isLocalAppUrl(new URL(configured))) return configured;
    if (current.protocol === "http:" || current.protocol === "https:") return current.toString();
    return legacy;
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
    EMAIL_OTP_LENGTH,
    EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
    beginEmailOtpLogin,
    beginEmailOtpUpgrade,
    getAuthCallbackInfo,
    getCleanAuthCallbackUrl,
    getEmailError,
    getEmailOtpErrorCode,
    getEmailOtpRetryAfterSeconds,
    isCompleteEmailOtp,
    normalizeEmail,
    normalizeEmailOtp,
    resendEmailOtp,
    resolveRecoverableAuthRedirectUrl,
    summarizeAuthUser,
    verifyEmailOtp,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerRecoverableAuth = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
