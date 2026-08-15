(function initPlatformFileBoundaryCore(root) {
  "use strict";

  // A native shell may install `globalThis.BackpackerPlatformFiles` with any of
  // three methods. The web core never imports it, never checks which platform is
  // running, and never learns anything about the shell: it only asks whether a
  // method is there and hands it the smallest possible payload — a URL, or a file
  // name and a Blob. Nothing about a Trip, a TripItem, a path or a permission
  // crosses this line.
  //
  // Absent boundary, or absent method, means the browser/PWA path stays in
  // charge. That is the default, not a fallback bolted on afterwards.
  const PLATFORM_FILES_GLOBAL = "BackpackerPlatformFiles";
  const PLATFORM_FILE_ACTIONS = Object.freeze(["openRemoteDocument", "savePdf", "sharePdf"]);

  // Failure codes the web side produces on its own. A shell may return its own
  // code instead; it is sanitised before it is allowed anywhere near analytics.
  const INVALID_RESULT_CODE = "invalid_result";
  const NATIVE_ERROR_CODE = "native_error";
  const UNSPECIFIED_FAILURE_CODE = "unspecified";
  const SAFE_CODE_PATTERN = /^[a-z0-9_]{1,40}$/;

  function getPlatformFileBoundary(scope) {
    const host = scope || (typeof globalThis !== "undefined" ? globalThis : root);
    const boundary = host?.[PLATFORM_FILES_GLOBAL];
    return boundary && typeof boundary === "object" ? boundary : null;
  }

  function isPlatformFileActionAvailable(action, scope) {
    if (!PLATFORM_FILE_ACTIONS.includes(action)) return false;
    return typeof getPlatformFileBoundary(scope)?.[action] === "function";
  }

  function normalizeFailureCode(value) {
    const code = String(value ?? "").trim().toLowerCase();
    return SAFE_CODE_PATTERN.test(code) ? code : UNSPECIFIED_FAILURE_CODE;
  }

  /**
   * Every answer from the boundary becomes one of three shapes, whatever the
   * shell actually returned. A shell that answers with nothing, a string, a
   * promise of a promise, or a status nobody recognises is not trusted into a
   * success path — it is a failure, and it says so with a code the caller can
   * report without leaking anything.
   */
  function normalizePlatformFileResult(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { status: "failure", code: INVALID_RESULT_CODE };
    }
    if (value.status === "success") return { status: "success" };
    if (value.status === "cancelled") return { status: "cancelled" };
    if (value.status === "failure") {
      return { status: "failure", code: normalizeFailureCode(value.code) };
    }
    return { status: "failure", code: INVALID_RESULT_CODE };
  }

  /**
   * Calls a boundary method and always resolves — never rejects. A shell that
   * throws, or rejects, is reported as a failure rather than taking the caller's
   * error path with it, because the caller's job at that point is to reset its
   * own loading state and tell the user something useful.
   *
   * Callers are expected to have checked `isPlatformFileActionAvailable` first;
   * calling an absent method is itself a failure, not a silent success.
   */
  async function callPlatformFileAction(action, args = [], scope) {
    const method = getPlatformFileBoundary(scope)?.[action];
    if (typeof method !== "function") {
      return { status: "failure", code: INVALID_RESULT_CODE };
    }
    try {
      return normalizePlatformFileResult(await method(...args));
    } catch {
      return { status: "failure", code: NATIVE_ERROR_CODE };
    }
  }

  const api = {
    PLATFORM_FILE_ACTIONS,
    PLATFORM_FILES_GLOBAL,
    callPlatformFileAction,
    getPlatformFileBoundary,
    isPlatformFileActionAvailable,
    normalizePlatformFileResult,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.BackpackerPlatformFileBoundary = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
