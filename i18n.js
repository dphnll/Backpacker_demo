(function initBackpackerI18n(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (root?.document) {
    const instance = api.createI18n({ root });
    root.BackpackerI18n = instance;
    root.t = instance.t;
  }
})(typeof window !== "undefined" ? window : globalThis, function createBackpackerI18nModule() {
  "use strict";

  const SUPPORTED_LOCALES = Object.freeze(["ru", "en", "fr", "ka", "de", "hy"]);
  const DEFAULT_LOCALE = "en";
  const AUTO_LOCALE = "auto";
  const LOCALE_STORAGE_KEY = "backpacker.locale.v1";
  const LOCALE_TAGS = Object.freeze({
    ru: "ru-RU",
    en: "en-GB",
    fr: "fr-FR",
    ka: "ka-GE",
    de: "de-DE",
    hy: "hy-AM",
  });

  function normalizeLocale(value) {
    const locale = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LOCALES.includes(locale) ? locale : "";
  }

  function detectLocale(navigatorLike = {}) {
    const candidates = [
      ...(Array.isArray(navigatorLike.languages) ? navigatorLike.languages : []),
      navigatorLike.language,
    ];
    for (const candidate of candidates) {
      const locale = normalizeLocale(candidate);
      if (locale) return locale;
    }
    return "en";
  }

  function getLanguageHint(locationLike = {}) {
    try {
      return normalizeLocale(new URLSearchParams(String(locationLike.search || "")).get("lang"));
    } catch {
      return "";
    }
  }

  function getScriptBaseUrl(documentLike) {
    const source = documentLike?.currentScript?.src;
    if (!source) return "./";
    try {
      return new URL(".", source).href;
    } catch {
      return "./";
    }
  }

  function isMessagesObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function createI18n(options = {}) {
    const environmentRoot = options.root || globalThis;
    const documentLike = options.documentLike || environmentRoot?.document || null;
    const navigatorLike = options.navigatorLike || environmentRoot?.navigator || {};
    const locationLike = options.locationLike || environmentRoot?.location || {};
    const fetchImpl = options.fetchImpl || environmentRoot?.fetch?.bind(environmentRoot);
    const baseUrl = options.baseUrl || getScriptBaseUrl(documentLike);
    let storage = options.storage;
    if (storage === undefined) {
      try {
        storage = environmentRoot?.localStorage || null;
      } catch {
        storage = null;
      }
    }

    let preference = AUTO_LOCALE;
    let locale = DEFAULT_LOCALE;
    let messages = {};
    let fallbackMessages = {};
    let initialized = false;

    function readPreference() {
      try {
        const saved = String(storage?.getItem?.(LOCALE_STORAGE_KEY) || "").trim().toLowerCase();
        if (saved === AUTO_LOCALE || SUPPORTED_LOCALES.includes(saved)) return saved;
      } catch {
        // Storage is optional. Browser detection remains available without it.
      }
      return AUTO_LOCALE;
    }

    async function loadLocaleMessages(targetLocale) {
      if (typeof fetchImpl !== "function") throw new Error("i18n_fetch_unavailable");
      const localeUrl = new URL(`locales/${targetLocale}.json`, baseUrl).href;
      const response = await fetchImpl(localeUrl, { cache: "no-cache" });
      if (!response?.ok) throw new Error(`i18n_locale_load_failed:${targetLocale}`);
      const payload = await response.json();
      if (!isMessagesObject(payload)) throw new Error(`i18n_locale_invalid:${targetLocale}`);
      return payload;
    }

    function resolveMessage(key, params = {}) {
      const candidates = [];
      if (Number.isFinite(Number(params.count))) {
        const category = new Intl.PluralRules(LOCALE_TAGS[locale] || locale).select(Number(params.count));
        candidates.push(`${key}.${category}`, `${key}.other`);
      }
      candidates.push(key);

      for (const candidate of candidates) {
        const activeValue = messages[candidate];
        if (typeof activeValue === "string" && activeValue) return activeValue;
        const fallbackValue = fallbackMessages[candidate];
        if (typeof fallbackValue === "string" && fallbackValue) return fallbackValue;
      }
      return key;
    }

    function interpolate(template, params = {}) {
      return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
      ));
    }

    function t(key, params = {}) {
      return interpolate(resolveMessage(String(key || ""), params), params);
    }

    function applyTranslations(scope = documentLike) {
      if (!scope?.querySelectorAll) return;
      const textBindings = [
        ["[data-i18n]", "i18n", "textContent"],
        ["[data-i18n-placeholder]", "i18nPlaceholder", "placeholder"],
        ["[data-i18n-aria-label]", "i18nAriaLabel", "aria-label"],
        ["[data-i18n-title]", "i18nTitle", "title"],
      ];

      textBindings.forEach(([selector, dataKey, target]) => {
        scope.querySelectorAll(selector).forEach((element) => {
          const key = element.dataset?.[dataKey];
          if (!key) return;
          const value = t(key);
          if (target === "textContent") element.textContent = value;
          else element.setAttribute?.(target, value);
        });
      });
    }

    async function init() {
      preference = readPreference();
      const languageHint = preference === AUTO_LOCALE ? getLanguageHint(locationLike) : "";
      locale = preference === AUTO_LOCALE ? (languageHint || detectLocale(navigatorLike)) : preference;

      let activeMessages = null;
      let englishMessages = null;
      try {
        activeMessages = await loadLocaleMessages(locale);
      } catch {
        activeMessages = null;
      }

      if (locale === DEFAULT_LOCALE) {
        englishMessages = activeMessages;
      } else {
        try {
          englishMessages = await loadLocaleMessages(DEFAULT_LOCALE);
        } catch {
          englishMessages = null;
        }
      }

      if (!activeMessages) {
        locale = DEFAULT_LOCALE;
        activeMessages = englishMessages || {};
      }

      messages = isMessagesObject(activeMessages) ? activeMessages : {};
      fallbackMessages = isMessagesObject(englishMessages) ? englishMessages : messages;
      initialized = true;

      documentLike?.documentElement?.setAttribute?.("lang", locale);
      applyTranslations(documentLike);
      return locale;
    }

    function setLocalePreference(nextPreference) {
      const normalized = String(nextPreference || "").trim().toLowerCase();
      if (normalized !== AUTO_LOCALE && !SUPPORTED_LOCALES.includes(normalized)) return false;
      if (typeof storage?.setItem !== "function") return false;
      try {
        storage.setItem(LOCALE_STORAGE_KEY, normalized);
        preference = normalized;
        return true;
      } catch {
        return false;
      }
    }

    function formatNumber(value, formatOptions = {}) {
      return new Intl.NumberFormat(LOCALE_TAGS[locale] || locale, formatOptions).format(Number(value) || 0);
    }

    function formatDate(value, formatOptions = {}) {
      const date = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat(LOCALE_TAGS[locale] || locale, formatOptions).format(date);
    }

    return Object.freeze({
      applyTranslations,
      formatDate,
      formatNumber,
      getLocale: () => locale,
      getLocaleTag: () => LOCALE_TAGS[locale] || locale,
      getPreference: () => preference,
      init,
      isInitialized: () => initialized,
      setLocalePreference,
      t,
    });
  }

  return Object.freeze({
    AUTO_LOCALE,
    DEFAULT_LOCALE,
    LOCALE_STORAGE_KEY,
    LOCALE_TAGS,
    SUPPORTED_LOCALES,
    createI18n,
    detectLocale,
    getLanguageHint,
    normalizeLocale,
  });
});
