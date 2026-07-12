(function initLinkIntakeUiCore(root) {
  "use strict";

  const LINK_INTAKE_HINT = "Вставьте ссылку и нажмите «Собрать по ссылке».";
  const LINK_INTAKE_INVALID_URL_MESSAGE = "Вставьте корректную ссылку";
  const LINK_INTAKE_AUTOFILL_FIELDS = ["link", "title", "type", "locationText", "price"];

  function toFieldValue(value) {
    return value == null ? "" : String(value);
  }

  function createLinkIntakeButtonState(state = {}) {
    const isLoading = Boolean(state.isLoading);
    return {
      disabled: isLoading,
      text: isLoading ? "Собираю..." : "Собрать по ссылке",
    };
  }

  function createLinkIntakePreviewRequest(normalizedUrl) {
    const url = toFieldValue(normalizedUrl).trim();
    if (!url) {
      return {
        shouldCallBackend: false,
        error: LINK_INTAKE_INVALID_URL_MESSAGE,
      };
    }
    return {
      shouldCallBackend: true,
      url,
      error: "",
    };
  }

  function createLinkIntakeAppliedSnapshot(beforeValues = {}, afterValues = {}, fields = LINK_INTAKE_AUTOFILL_FIELDS) {
    const snapshot = {};
    fields.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(afterValues, field)) return;
      const before = toFieldValue(beforeValues[field]);
      const after = toFieldValue(afterValues[field]);
      if (before === after) return;
      snapshot[field] = { before, after };
    });
    return Object.keys(snapshot).length ? snapshot : null;
  }

  function clearStaleLinkIntakeValues(currentValues = {}, snapshot = null) {
    const nextValues = { ...currentValues };
    const clearedFields = [];
    if (!snapshot || typeof snapshot !== "object") {
      return { values: nextValues, clearedFields };
    }

    LINK_INTAKE_AUTOFILL_FIELDS.forEach((field) => {
      const entry = snapshot[field];
      if (!entry || typeof entry !== "object") return;
      if (toFieldValue(currentValues[field]) !== toFieldValue(entry.after)) return;
      nextValues[field] = toFieldValue(entry.before);
      clearedFields.push(field);
    });

    return { values: nextValues, clearedFields };
  }

  const api = {
    LINK_INTAKE_HINT,
    LINK_INTAKE_INVALID_URL_MESSAGE,
    LINK_INTAKE_AUTOFILL_FIELDS,
    createLinkIntakeButtonState,
    createLinkIntakePreviewRequest,
    createLinkIntakeAppliedSnapshot,
    clearStaleLinkIntakeValues,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.BackpackerLinkIntakeUiCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
