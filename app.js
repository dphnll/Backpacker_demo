const STORAGE_KEY = "backpacker.mvp.v1";
const TRIPS_STORAGE_KEY = "backpacker.trips.v1";
const ACTIVE_TRIP_STORAGE_KEY = "backpacker.activeTrip.v1";
const VIEW_STORAGE_KEY = "backpacker.currentView.v1";
const ONBOARDING_STORAGE_KEY = "backpacker.onboarding.v1";
const ANALYTICS_USER_KEY = "backpacker.analytics.user.v1";
const ANALYTICS_LAST_OPEN_KEY = "backpacker.analytics.lastOpen.v1";
const ANALYTICS_MILESTONES_KEY = "backpacker.analytics.milestones.v1";
const ANALYTICS_CONFIG = window.BACKPACKER_ANALYTICS || {};
const ANALYTICS_SCHEMA_VERSION = "2026-06-25.1";
const ANALYTICS_DEFINITION_VERSION = "2026-06-25.1";
const ONBOARDING_VERSION = "2026-06-25.1";
const ONBOARDING_PREVIEW_PARAM = "onboarding";
const TRAINER_VERSION = "2026-06-25.1";
const APP_VERSION = "analytics-first-layer-2026-06-25";
const DEFAULT_ITEM_STATUS = "want";
const DEFAULT_ITEM_PRIORITY = "nice";
const TRIP_DATE_RANGE_ERROR = "Дата окончания не может быть раньше даты начала";
const PARTICIPANT_COLORS = ["orange", "yellow", "blue", "teal", "purple", "pink"];
const ANALYTICS_MILESTONE_CONFIG = {
  definitionVersion: ANALYTICS_DEFINITION_VERSION,
  firstValue: {
    minItems: 3,
    minScheduledItems: 1,
  },
  workingPlan: {
    minItems: 8,
    minScheduledShare: 0.5,
    minTypes: 3,
  },
};
let deferredInstallPrompt = null;
let participantEditorState = { mode: "", participantId: "", value: "" };

const itemTypes = [
  ["ticket", "Билет"],
  ["stay", "Жильё"],
  ["transport", "Транспорт"],
  ["excursion", "Экскурсия"],
  ["food", "Еда"],
  ["place", "Место"],
  ["spa", "Баня/спа"],
  ["shopping", "Покупки"],
  ["idea", "Идея"],
  ["other", "Другое"],
];

const typeIcons = {
  ticket: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M4 12l6-6M4 12l6 6M14 6l6 6-6 6"></path></svg>`,
  stay: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"></path><path d="M6.5 10.5V20h11V10.5"></path><path d="M10 20v-5h4v5"></path></svg>`,
  transport: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h11l3 4v7H5V7z"></path><path d="M7 18v1.5M17 18v1.5M8 11h8M9 15h1M14 15h1"></path></svg>`,
  excursion: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.5" r="2"></circle><path d="M12 7.5 9.5 12l3 2.2"></path><path d="M10 12l-3 2M12.5 14.2 10 20M13.5 14.2 18 20M14 9.5l3 2.5"></path></svg>`,
  food: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="5"></circle><path d="M4 4v7M6 4v7M8 4v7M6 11v9"></path><path d="M19 4v16M16.5 4c0 4 2.5 4 2.5 7"></path></svg>`,
  place: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11z"></path><circle cx="12" cy="10" r="2"></circle></svg>`,
  spa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14c-1.5-1.4-1.5-3.1 0-4.5M12 14c-1.5-1.4-1.5-3.1 0-4.5M17 14c-1.5-1.4-1.5-3.1 0-4.5"></path><path d="M5 17h14l-1.4 3H6.4L5 17z"></path></svg>`,
  shopping: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg>`,
  idea: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M8.2 14.2a6 6 0 1 1 7.6 0c-.8.6-1.3 1.4-1.5 2.3H9.7c-.2-.9-.7-1.7-1.5-2.3z"></path></svg>`,
  other: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"></circle><path d="M12 8v4l3 2"></path></svg>`,
};

const statuses = [
  ["paid", "Оплачено"],
  ["fixed", "Бронь"],
  ["want", "Хочу"],
  ["maybe", "Думаю"],
  ["backup", "Запас"],
  ["skipped", "Пропущено"],
];

const priorities = [
  ["must", "Обязательно"],
  ["nice", "Желательно"],
  ["optional", "Опционально"],
];

const currencyRatesToRub = {
  RUB: 1,
  EUR: 100,
  SEK: 9,
  USD: 92,
  GEL: 34,
  TRY: 3,
  RSD: 0.85,
  BAM: 51,
};

const seedState = {
  trip: {
    id: "trip-1",
    title: "Казань соло",
    destination: "Казань",
    startDate: "2026-07-12",
    endDate: "2026-07-15",
    currency: "RUB",
    budgetLimit: 45000,
    preferencesText:
      "Еду одна, люблю неспешные утра, локальную еду, баню/спа, одну осмысленную экскурсию в день и время на прогулки без спешки.",
  },
  items: [
    {
      id: "item-1",
      title: "Поезд / самолёт туда",
      type: "ticket",
      status: "paid",
      priority: "must",
      date: "2026-07-12",
      startTime: "09:30",
      durationMinutes: 120,
      price: 7500,
      paidAmount: 7500,
      link: "",
      locationText: "Вокзал / аэропорт",
      notes: "Проверить время прибытия и транспорт до жилья.",
    },
    {
      id: "item-2",
      title: "Жильё в центре",
      type: "stay",
      status: "fixed",
      priority: "must",
      date: "2026-07-12",
      startTime: "14:00",
      durationMinutes: 0,
      price: 18000,
      paidAmount: 9000,
      link: "",
      locationText: "Центр",
      notes: "Можно оставить вещи до заселения.",
    },
    {
      id: "item-3",
      title: "Пешеходная экскурсия",
      type: "excursion",
      status: "fixed",
      priority: "nice",
      date: "2026-07-13",
      startTime: "10:00",
      durationMinutes: 150,
      price: 4000,
      paidAmount: 0,
      link: "",
      locationText: "Старый город",
      notes: "Не ставить слишком рано после позднего ужина.",
    },
    {
      id: "item-4",
      title: "Баня / спа после экскурсии",
      type: "spa",
      status: "want",
      priority: "must",
      date: "2026-07-13",
      startTime: "16:00",
      durationMinutes: 120,
      price: 3500,
      paidAmount: 0,
      link: "",
      locationText: "",
      notes: "Прям мой сценарий: сначала экскурсия, потом баня.",
    },
    {
      id: "item-5",
      title: "Локальный ресторан",
      type: "food",
      status: "want",
      priority: "nice",
      date: "",
      startTime: "",
      durationMinutes: 90,
      price: 2500,
      paidAmount: 0,
      link: "",
      locationText: "",
      notes: "Хочу выбрать по настроению.",
    },
    {
      id: "item-6",
      title: "Музей как запасной вариант",
      type: "place",
      status: "backup",
      priority: "optional",
      date: "",
      startTime: "",
      durationMinutes: 90,
      price: 1200,
      paidAmount: 0,
      link: "",
      locationText: "",
      notes: "Если будет дождь или внезапная дырка в плане.",
    },
  ],
};

let tripStore = loadTripStore();
let state = loadState();
let currentView = loadInitialView();
let currentScreen = "home";
let currentFilter = "all";
let draggedItemId = null;
let dragJustHappened = false;
let pointerDrag = null;
let autoScrollFrame = null;
let ratesUpdatedAt = null;
let ratesSource = "demo";
let coverTargetTripId = null;
let onboardingExitTracked = false;
const analyticsSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function getOrCreateAnalyticsUserId() {
  try {
    const existing = localStorage.getItem(ANALYTICS_USER_KEY);
    if (existing) return existing;
    const next = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ANALYTICS_USER_KEY, next);
    return next;
  } catch {
    return "anon-storage-unavailable";
  }
}

function getDisplayMode() {
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return "pwa";
  return "browser";
}

function getActiveTripEntry(tripId = state?.trip?.id) {
  return tripStore.trips.find((entry) => entry.id === tripId) || null;
}

function getTripOrigin(tripId = state?.trip?.id) {
  return getActiveTripEntry(tripId)?.isDemo ? "demo" : "user_created";
}

function getTripPhase(trip = state?.trip, todayValue = new Date()) {
  if (!trip?.startDate || !trip?.endDate) return "no_dates";
  const today = new Date(todayValue);
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "no_dates";
  if (today < start) return "before";
  if (today > end) return "after";
  return "during";
}

function getDaysUntilTripBucket(trip = state?.trip, todayValue = new Date()) {
  const phase = getTripPhase(trip, todayValue);
  if (phase === "during") return "during";
  if (phase === "after") return "past";
  if (phase === "no_dates") return "unknown";
  const today = new Date(todayValue);
  const start = new Date(`${trip.startDate}T00:00:00`);
  const days = Math.ceil((start - today) / 86400000);
  if (!Number.isFinite(days)) return "unknown";
  if (days <= 3) return "1_3";
  if (days <= 7) return "4_7";
  if (days <= 30) return "8_30";
  return "31_plus";
}

function getAnalyticsEnvironment() {
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" || window.location.protocol === "file:") return "local";
  if (window.location.hostname.includes("github.io")) return "production";
  return "preview";
}

function getAnalyticsFlag(name) {
  const paramName = name === "internal" ? "internal" : "test_user";
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(paramName) === "1") localStorage.setItem(`backpacker.analytics.${paramName}`, "1");
    return localStorage.getItem(`backpacker.analytics.${paramName}`) === "1";
  } catch {
    return false;
  }
}

function getTripAnalyticsContext(trip = state?.trip) {
  const activeTrip = trip || {};
  return {
    trip_id: activeTrip.id || null,
    trip_origin: getTripOrigin(activeTrip.id),
    trip_phase: getTripPhase(activeTrip),
    days_until_trip_bucket: getDaysUntilTripBucket(activeTrip),
  };
}

function getUserTripCount() {
  const trips = Array.isArray(tripStore?.trips) ? tripStore.trips : [];
  return trips.filter((entry) => !entry.isDemo).length;
}

function getAnalyticsContext(extra = {}) {
  return {
    anon_user_id: getOrCreateAnalyticsUserId(),
    session_id: analyticsSessionId,
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    app_version: APP_VERSION,
    environment: getAnalyticsEnvironment(),
    is_internal_user: getAnalyticsFlag("internal"),
    is_test_user: getAnalyticsFlag("test_user"),
    screen: currentScreen,
    display_mode: getDisplayMode(),
    ...extra,
  };
}

function trackEvent(name, props = {}) {
  const payload = getAnalyticsContext(props);
  if (ANALYTICS_CONFIG.debug) {
    console.info("[Backpacker analytics]", name, payload);
  }
  if (window.posthog?.capture) {
    window.posthog.capture(name, payload);
  } else if (ANALYTICS_CONFIG.posthogKey) {
    sendPostHogEvent(name, payload);
  }
}

function sendPostHogEvent(name, payload) {
  const host = (ANALYTICS_CONFIG.posthogHost || "https://eu.i.posthog.com").replace(/\/$/, "");
  const body = JSON.stringify({
    api_key: ANALYTICS_CONFIG.posthogKey,
    event: name,
    distinct_id: payload.anon_user_id,
    properties: payload,
  });
  const url = `${host}/capture/`;
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}

function trackAppOpen() {
  const today = new Date().toISOString().slice(0, 10);
  let lastOpen = "";
  try {
    lastOpen = localStorage.getItem(ANALYTICS_LAST_OPEN_KEY) || "";
    localStorage.setItem(ANALYTICS_LAST_OPEN_KEY, today);
  } catch {
    lastOpen = "";
  }
  trackEvent("app_opened", {
    is_returning_user: Boolean(lastOpen),
    last_open_days_ago: lastOpen ? Math.round((new Date(today) - new Date(lastOpen)) / 86400000) : null,
  });
}

function loadState() {
  const activeTripId = loadActiveTripId();
  const activeEntry = tripStore.trips.find((entry) => entry.id === activeTripId) || tripStore.trips[0];
  return normalizeState(structuredClone(activeEntry?.state || seedState));
}

function createTripEntry(nextState, overrides = {}) {
  const normalized = normalizeState(structuredClone(nextState));
  const now = new Date().toISOString();
  const id = overrides.id || normalized.trip.id || `trip-${Date.now()}`;
  normalized.trip = {
    ...normalized.trip,
    id,
  };
  return {
    id,
    isDemo: Boolean(overrides.isDemo),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    coverDataUrl: overrides.coverDataUrl || "",
    state: normalized,
  };
}

function createDemoEntry() {
  const demoState = normalizeState(structuredClone(seedState));
  demoState.trip.id = "trainer-kazan";
  demoState.trip.title = "Казань соло";
  return createTripEntry(demoState, {
    id: "trainer-kazan",
    isDemo: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function createBlankTripEntry() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const toDateInput = (date) => date.toISOString().slice(0, 10);
  const id = `trip-${Date.now()}`;
  const blankState = {
    trip: {
      id,
      title: "Новая поездка",
      destination: "",
      startDate: toDateInput(today),
      endDate: toDateInput(tomorrow),
      currency: "RUB",
      budgetLimit: 0,
      preferencesText: "",
    },
    items: [],
  };
  return createTripEntry(blankState, { id });
}

function loadTripStore() {
  try {
    const raw = localStorage.getItem(TRIPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.trips) && parsed.trips.length) {
        return {
          trips: parsed.trips.map((entry) => {
            const normalizedState = normalizeState(entry.state);
            if (entry.id === "trainer-kazan") {
              normalizedState.trip.title = "Казань соло";
            }
            return {
              ...entry,
              state: normalizedState,
            };
          }),
        };
      }
    }
  } catch {
    // Fall through to migration.
  }

  const trips = [createDemoEntry()];
  try {
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      const legacyState = normalizeState(JSON.parse(legacyRaw));
      const legacyEntry = createTripEntry(legacyState, {
        id: legacyState.trip.id && legacyState.trip.id !== "trip-1" ? legacyState.trip.id : `trip-${Date.now()}`,
      });
      if (legacyEntry.id !== "trainer-kazan") trips.push(legacyEntry);
    }
  } catch {
    // Legacy migration is best-effort.
  }
  const store = { trips };
  persistTripStore(store);
  return store;
}

function loadActiveTripId() {
  try {
    return localStorage.getItem(ACTIVE_TRIP_STORAGE_KEY) || tripStore.trips[0]?.id;
  } catch {
    return tripStore.trips[0]?.id;
  }
}

function loadInitialView() {
  try {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    return ["plan", "basket", "budget", "currency"].includes(savedView) ? savedView : "plan";
  } catch {
    return "plan";
  }
}

function normalizeParticipantName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function generateParticipantInitials(name) {
  const normalized = normalizeParticipantName(name);
  const letters = normalized.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return letters || "Я";
}

function createParticipant({ tripId, name, isSelf = false, index = 0, id = "" }) {
  const now = new Date().toISOString();
  const normalizedName = normalizeParticipantName(name) || "Я";
  return {
    id: id || `participant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tripId,
    name: normalizedName,
    initials: generateParticipantInitials(normalizedName),
    colorKey: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
    isSelf,
    createdAt: now,
    updatedAt: now,
  };
}

function createSelfParticipant(tripId) {
  return createParticipant({ tripId, name: "Я", isSelf: true, index: 0, id: `participant-${tripId}-self` });
}

function getSelfParticipant(nextState = state) {
  return nextState.trip.participants.find((participant) => participant.isSelf) || nextState.trip.participants[0];
}

function normalizeState(nextState) {
  const normalized = nextState?.trip && Array.isArray(nextState.items) ? nextState : structuredClone(seedState);
  const tripId = normalized.trip.id || `trip-${Date.now()}`;
  normalized.trip.id = tripId;
  let participants = Array.isArray(normalized.trip.participants) ? normalized.trip.participants : [];
  participants = participants.map((participant, index) => {
    const name = normalizeParticipantName(participant.name) || "Я";
    return {
      ...participant,
      id: participant.id || `participant-${tripId}-${index}`,
      tripId,
      name,
      initials: generateParticipantInitials(name),
      colorKey: participant.colorKey || PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
      isSelf: Boolean(participant.isSelf),
      createdAt: participant.createdAt || new Date().toISOString(),
      updatedAt: participant.updatedAt || new Date().toISOString(),
    };
  });
  if (!participants.some((participant) => participant.isSelf)) {
    participants.unshift(createSelfParticipant(tripId));
  }
  let selfSeen = false;
  participants = participants.map((participant) => {
    if (!participant.isSelf) return participant;
    if (selfSeen) return { ...participant, isSelf: false };
    selfSeen = true;
    return participant;
  });
  normalized.trip.participants = participants;
  const selfParticipant = getSelfParticipant(normalized);
  const participantIds = new Set(participants.map((participant) => participant.id));
  normalized.items = normalized.items.map((item, index) => ({
    order: index,
    ...item,
    participantId: participantIds.has(item.participantId) ? item.participantId : selfParticipant.id,
  }));
  return normalized;
}

function saveState() {
  const currentId = state.trip.id;
  const now = new Date().toISOString();
  const entryIndex = tripStore.trips.findIndex((entry) => entry.id === currentId);
  const nextEntry = createTripEntry(state, {
    id: currentId,
    isDemo: tripStore.trips[entryIndex]?.isDemo,
    createdAt: tripStore.trips[entryIndex]?.createdAt,
    updatedAt: now,
    coverDataUrl: tripStore.trips[entryIndex]?.coverDataUrl,
  });
  if (entryIndex >= 0) tripStore.trips[entryIndex] = nextEntry;
  else tripStore.trips.push(nextEntry);
  persistTripStore(tripStore);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, currentId);
}

function persistTripStore(store = tripStore) {
  localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(store));
}

function formatMoney(value = 0) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString("ru-RU")} ${currencySymbol(state.trip.currency)}`;
}

function currencySymbol(currency) {
  return { RUB: "₽", EUR: "€", SEK: "kr", USD: "$", GEL: "₾", TRY: "₺", RSD: "дин", BAM: "KM" }[currency] || currency;
}

function convertMoney(value, fromCurrency, toCurrency) {
  const amount = parseMoney(value);
  const fromRate = currencyRatesToRub[fromCurrency] || 1;
  const toRate = currencyRatesToRub[toCurrency] || 1;
  return Math.round((amount * fromRate) / toRate);
}

function convertTripCurrency(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return;
  state.trip.budgetLimit = convertMoney(state.trip.budgetLimit, fromCurrency, toCurrency);
  state.items = state.items.map((item) => ({
    ...item,
    price: convertMoney(item.price, fromCurrency, toCurrency),
    paidAmount: convertMoney(item.paidAmount, fromCurrency, toCurrency),
  }));
}

function getSupportedCurrencies() {
  return ["RUB", "EUR", "SEK", "USD", "GEL", "TRY", "RSD", "BAM"];
}

function formatCurrencyAmount(value, currency) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currencySymbol(currency)}`;
}

function convertCurrencyAmount(value, fromCurrency, toCurrency) {
  const amount = parseMoney(value);
  const fromRate = currencyRatesToRub[fromCurrency] || 1;
  const toRate = currencyRatesToRub[toCurrency] || 1;
  return (amount * fromRate) / toRate;
}

function renderCurrencyCalculator() {
  const amountInput = $("#currencyAmount");
  const fromSelect = $("#currencyFrom");
  const toSelect = $("#currencyTo");
  const result = $("#currencyResult");
  if (!amountInput || !fromSelect || !toSelect || !result) return;

  const converted = convertCurrencyAmount(amountInput.value, fromSelect.value, toSelect.value);
  result.textContent = formatCurrencyAmount(converted, toSelect.value);
  renderRatesStatus();
}

function renderRatesStatus(message = null) {
  const status = $("#ratesStatus");
  if (!status) return;
  if (message) {
    status.textContent = message;
    return;
  }
  const source = ratesSource === "live" ? "реальный курс" : "демо-курс";
  const updated = ratesUpdatedAt ? ` · обновлено ${ratesUpdatedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "";
  status.textContent = `Используется ${source}${updated}. RUB / EUR / SEK / USD / GEL / TRY / RSD / BAM.`;
}

async function refreshExchangeRates() {
  renderRatesStatus("Обновляю курс...");
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/RUB");
    if (!response.ok) throw new Error("rates request failed");
    const data = await response.json();
    const rates = data?.rates || {};
    const nextRates = {};
    getSupportedCurrencies().forEach((currency) => {
      if (currency === "RUB") nextRates.RUB = 1;
      else if (Number(rates[currency])) nextRates[currency] = 1 / Number(rates[currency]);
    });
    if (!getSupportedCurrencies().every((currency) => nextRates[currency])) throw new Error("missing rates");
    Object.assign(currencyRatesToRub, nextRates);
    ratesSource = "live";
    ratesUpdatedAt = new Date();
    renderCurrencyCalculator();
    trackEvent("currency_rates_refreshed", { source: "live" });
  } catch {
    ratesSource = "demo";
    ratesUpdatedAt = null;
    renderCurrencyCalculator();
    renderRatesStatus("Не удалось подтянуть реальный курс, пока использую демо-курс.");
    trackEvent("currency_rates_refreshed", { source: "demo", failed: true });
  }
}

function parseMoney(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function formatDate(dateString, options = {}) {
  if (!dateString) return "без даты";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...options,
  });
}

function formatDurationText(minutes) {
  const total = parseMoney(minutes);
  if (!total) return "--";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours && rest) return `${hours} ч ${rest} мин`;
  if (hours) return `${hours} ч`;
  return `${rest} мин`;
}

function splitTimeSlots(time) {
  if (!time) return ["–", "–"];
  const [hours, minutes] = String(time).split(":");
  return [hours || "–", minutes || "–"];
}

function getEndTime(startTime, durationMinutes) {
  const duration = parseMoney(durationMinutes);
  if (!startTime || !duration) return "";
  const [hours, minutes] = splitTimeSlots(startTime).map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";
  const date = new Date(2000, 0, 1, hours, minutes + duration);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getItemDateSlots(dateString) {
  if (!dateString) return ["–", "–", "––"];
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return ["–", "–", "––"];
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getFullYear()),
  ];
}

function renderTimeSlot(value) {
  return `<span class="item-slot">${escapeHtml(value)}</span>`;
}

function renderItemTimeSlots(item) {
  const start = splitTimeSlots(item.startTime);
  const end = splitTimeSlots(getEndTime(item.startTime, item.durationMinutes));
  return `
    ${renderTimeSlot(start[0])}
    ${renderTimeSlot(start[1])}
    <span class="item-slot-dash">-</span>
    ${renderTimeSlot(end[0])}
    ${renderTimeSlot(end[1])}
  `;
}

function renderItemDateSlots(item) {
  const [day, month, year] = getItemDateSlots(item.date);
  return `
    ${renderTimeSlot(day)}
    <span class="item-slot-separator">.</span>
    ${renderTimeSlot(month)}
    <span class="item-slot-separator">.</span>
    ${renderTimeSlot(year)}
  `;
}

function getTripDates() {
  const dates = [];
  const start = new Date(`${state.trip.startDate}T12:00:00`);
  const end = new Date(`${state.trip.endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getTypeLabel(type) {
  return itemTypes.find(([key]) => key === type)?.[1] || "Идея";
}

function getStatusLabel(status) {
  return statuses.find(([key]) => key === status)?.[1] || "Хочу";
}

function getParticipantById(participantId) {
  return state.trip.participants.find((participant) => participant.id === participantId) || getSelfParticipant();
}

function renderParticipantAvatar(participant) {
  return `<span class="participant-avatar participant-${escapeAttr(participant.colorKey)}">${escapeHtml(participant.initials)}</span>`;
}

function getParticipantTotals() {
  const totals = new Map(state.trip.participants.map((participant) => [participant.id, 0]));
  state.items.filter(isActiveCost).forEach((item) => {
    const participant = getParticipantById(item.participantId);
    totals.set(participant.id, (totals.get(participant.id) || 0) + parseMoney(item.price));
  });
  return state.trip.participants.map((participant) => ({
    participant,
    total: totals.get(participant.id) || 0,
  }));
}

function getStatusIcon(status) {
  return {
    paid: `<img src="./assets/status-paid.png" alt="" aria-hidden="true">`,
    fixed: `<img src="./assets/status-fixed.png" alt="" aria-hidden="true">`,
    want: `<img src="./assets/status-want.png" alt="" aria-hidden="true">`,
    maybe: `<img src="./assets/status-maybe.png" alt="" aria-hidden="true">`,
    backup: `<img src="./assets/status-backup.png" alt="" aria-hidden="true">`,
    skipped: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"></path></svg>`,
  }[status] || `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle></svg>`;
}

function getPriorityLabel(priority) {
  return priorities.find(([key]) => key === priority)?.[1] || "Желательно";
}

function isActiveCost(item) {
  return item.status !== "skipped" && item.status !== "backup";
}

function getTotals() {
  const paid = state.items
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + parseMoney(item.price), 0);
  const fixed = state.items
    .filter((item) => item.status === "fixed")
    .reduce((sum, item) => sum + parseMoney(item.price), 0);
  const optional = state.items
    .filter((item) => ["want", "maybe"].includes(item.status))
    .reduce((sum, item) => sum + parseMoney(item.price), 0);
  const possible = state.items.filter(isActiveCost).reduce((sum, item) => sum + parseMoney(item.price), 0);
  const remaining = parseMoney(state.trip.budgetLimit) - possible;
  return { paid, fixed, optional, possible, remaining };
}

function getAnalyticsMilestones() {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_MILESTONES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAnalyticsMilestones(milestones) {
  try {
    localStorage.setItem(ANALYTICS_MILESTONES_KEY, JSON.stringify(milestones));
  } catch {
    // Milestones are best-effort analytics state.
  }
}

function hasMeaningfulField(item) {
  return Boolean(
    parseMoney(item.price) ||
    parseMoney(item.paidAmount) ||
    item.link ||
    item.startTime ||
    item.notes ||
    item.priority !== DEFAULT_ITEM_PRIORITY,
  );
}

function hasPlanningSignal(item) {
  return Boolean(
    parseMoney(item.price) ||
    parseMoney(item.paidAmount) ||
    item.status !== DEFAULT_ITEM_STATUS ||
    item.priority !== DEFAULT_ITEM_PRIORITY,
  );
}

function getMilestoneStats() {
  const activeItems = state.items.filter((item) => item.status !== "skipped");
  const scheduledItems = activeItems.filter((item) => item.date);
  const scheduledDays = new Set(scheduledItems.map((item) => item.date));
  const typeCount = new Set(activeItems.map((item) => item.type)).size;
  const meaningfulFieldCount = activeItems.filter(hasMeaningfulField).length;
  const hasBudget = parseMoney(state.trip.budgetLimit) > 0;
  const hasCosts = activeItems.some((item) => parseMoney(item.price) > 0);
  const hasPaidAmounts = activeItems.some((item) => parseMoney(item.paidAmount) > 0);
  const hasStatuses = activeItems.some((item) => item.status !== DEFAULT_ITEM_STATUS);
  const hasPriorities = activeItems.some((item) => item.priority !== DEFAULT_ITEM_PRIORITY);
  return {
    itemCount: activeItems.length,
    scheduledItemCount: scheduledItems.length,
    scheduledDayCount: scheduledDays.size,
    scheduledShare: activeItems.length ? scheduledItems.length / activeItems.length : 0,
    typeCount,
    meaningfulFieldCount,
    hasBudget,
    hasCosts,
    hasPaidAmounts,
    hasStatuses,
    hasPriorities,
    hasPlanningSignal: hasBudget || activeItems.some(hasPlanningSignal),
    tripDaysCount: getTripDates().length || 1,
  };
}

function scheduledShareBucket(value) {
  if (value >= 0.75) return "75_100";
  if (value >= 0.5) return "50_74";
  if (value > 0) return "1_49";
  return "0";
}

function trackMilestoneOnce(name, key, properties = {}) {
  if (getTripOrigin() !== "user_created") return;
  const tripId = state.trip.id;
  if (!tripId) return;
  const milestones = getAnalyticsMilestones();
  const tripMilestones = milestones[tripId] || {};
  if (tripMilestones[key] === ANALYTICS_DEFINITION_VERSION) return;
  trackEvent(name, {
    ...getTripAnalyticsContext(),
    definition_version: ANALYTICS_DEFINITION_VERSION,
    ...properties,
  });
  milestones[tripId] = {
    ...tripMilestones,
    [key]: ANALYTICS_DEFINITION_VERSION,
  };
  saveAnalyticsMilestones(milestones);
}

function checkTripMilestones() {
  if (getTripOrigin() !== "user_created") return;
  const stats = getMilestoneStats();
  const firstValueReached =
    stats.itemCount >= ANALYTICS_MILESTONE_CONFIG.firstValue.minItems &&
    stats.scheduledItemCount >= ANALYTICS_MILESTONE_CONFIG.firstValue.minScheduledItems &&
    stats.meaningfulFieldCount >= 1;

  if (firstValueReached) {
    trackMilestoneOnce("trip_first_value_reached", "firstValue", {
      item_count: stats.itemCount,
      scheduled_item_count: stats.scheduledItemCount,
      meaningful_field_count: stats.meaningfulFieldCount,
    });
  }

  const minScheduledDays = Math.min(2, stats.tripDaysCount);
  const workingPlanReached =
    stats.itemCount >= ANALYTICS_MILESTONE_CONFIG.workingPlan.minItems &&
    stats.scheduledShare >= ANALYTICS_MILESTONE_CONFIG.workingPlan.minScheduledShare &&
    stats.scheduledDayCount >= minScheduledDays &&
    stats.typeCount >= ANALYTICS_MILESTONE_CONFIG.workingPlan.minTypes &&
    stats.hasPlanningSignal;

  if (workingPlanReached) {
    trackMilestoneOnce("trip_working_plan_reached", "workingPlan", {
      item_count: stats.itemCount,
      scheduled_item_count: stats.scheduledItemCount,
      scheduled_day_count: stats.scheduledDayCount,
      scheduled_share_bucket: scheduledShareBucket(stats.scheduledShare),
      type_count: stats.typeCount,
      has_budget: stats.hasBudget,
      has_costs: stats.hasCosts,
      has_paid_amounts: stats.hasPaidAmounts,
      has_statuses: stats.hasStatuses,
      has_priorities: stats.hasPriorities,
    });
  }
}

function render() {
  renderHome();
  renderHeader();
  renderPlan();
  renderBasket();
  renderBudget();
  renderEstimateTable();
  renderCurrencyCalculator();
  renderSharePreview();
}

function getEntryTotals(entry) {
  const entryState = normalizeState(entry.state);
  const paid = entryState.items.reduce((sum, item) => sum + parseMoney(item.paidAmount), 0);
  const possible = entryState.items
    .filter((item) => item.status !== "skipped" && item.status !== "backup")
    .reduce((sum, item) => sum + parseMoney(item.price), 0);
  return { paid, possible };
}

function renderHome() {
  const list = $("#tripList");
  if (!list) return;
  const trips = tripStore.trips
    .filter((entry) => !entry.isDemo)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  if (!trips.length) {
    list.innerHTML = `
      <p class="empty-trips">
        <span>Здесь будут ваши поездки</span>
        <span>Начните с тренажера 👆🏻 или создайте новую поездку</span>
      </p>
    `;
    return;
  }

  list.innerHTML = trips.map((entry) => {
    const trip = entry.state.trip;
    const totals = getEntryTotals(entry);
    const style = entry.coverDataUrl ? ` style="background-image: linear-gradient(145deg, rgba(18,54,61,.66), rgba(18,54,61,.12)), url('${escapeAttr(entry.coverDataUrl)}')"` : "";
    return `
      <article class="home-card trip-list-card"${style}>
        <button class="trip-card-open" data-open-trip="${escapeAttr(entry.id)}" type="button">
          <span class="home-card-kicker">${formatDate(trip.startDate)}-${formatDate(trip.endDate)}</span>
          <strong>${escapeHtml(trip.title || "Новая поездка")}</strong>
          <span>${escapeHtml(trip.destination || "Направление не задано")}</span>
          <div class="home-card-meta">
            <span>${formatCurrencyAmount(trip.budgetLimit, trip.currency)}</span>
            <span>план ${formatCurrencyAmount(totals.possible, trip.currency)}</span>
          </div>
        </button>
        <button class="cover-trip-button" data-cover-trip="${escapeAttr(entry.id)}" type="button" aria-label="Добавить обложку">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h4l1.8-2h4.4L16 8h4v11H4V8z"></path>
            <circle cx="12" cy="13.5" r="3"></circle>
            <path d="M18 5v4M16 7h4"></path>
          </svg>
        </button>
        <button class="delete-trip-button" data-delete-trip="${escapeAttr(entry.id)}" type="button">Удалить</button>
      </article>
    `;
  }).join("");
}

function renderHeader() {
  const dates = getTripDates();
  const totals = getTotals();
  $("#tripTitle").textContent = state.trip.title || "Новая поездка";
  $("#tripMeta").textContent = `${state.trip.destination || "Направление"} · ${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)} · ${dates.length || 1} дня`;
  $("#tripBudgetMeta").textContent = `Бюджет ${formatMoney(state.trip.budgetLimit)}`;
  $("#paidTotal").textContent = formatMoney(totals.paid);
  $("#plannedTotal").textContent = formatMoney(totals.possible);
  $("#remainingTotal").textContent = formatMoney(totals.remaining);
  $("#remainingTotal").style.color = totals.remaining < 0 ? "var(--danger)" : "";
}

function renderPlan() {
  const dates = getTripDates();
  const daysList = $("#daysList");
  daysList.innerHTML = "";
  dates.forEach((date, index) => {
    const items = getItemsForDate(date);
    const total = items.filter(isActiveCost).reduce((sum, item) => sum + parseMoney(item.price), 0);
    const card = document.createElement("article");
    card.className = "day-card";
    card.innerHTML = `
      <header class="day-header">
        <div class="card-title-row">
          <h3>День ${index + 1}</h3>
          <span class="day-date">${formatDate(date, { weekday: "short" })}</span>
          <span class="day-total">${formatMoney(total)}</span>
        </div>
      </header>
      <div class="day-items" data-drop-date="${date}">
        ${items.length ? items.map(renderItemCard).join("") : `<p class="empty-state">Пока пусто. Можно добавить идею или перетащить сюда карточку из раздела хотелок "Без даты".</p>`}
      </div>
    `;
    daysList.appendChild(card);
  });

  const unscheduled = getItemsForDate("");
  $("#unscheduledCount").textContent = unscheduled.length;
  const unscheduledPreview = $("#unscheduledPreview");
  unscheduledPreview.dataset.dropDate = "";
  unscheduledPreview.innerHTML = unscheduled.length
    ? unscheduled.slice(0, 8).map(renderItemCard).join("")
    : `<p class="empty-state">Все идеи уже пристроены по дням.</p>`;
  resetDayScrollPositions();
}

function resetDayScrollPositions() {
  requestAnimationFrame(() => {
    $$(".day-items").forEach((list) => {
      list.scrollLeft = 0;
    });
  });
}

function renderBasket() {
  const filters = [
    ["all", "Все"],
    ["nodate", "Без даты"],
    ["paid", "Оплачено"],
    ["fixed", "Бронь"],
    ["want", "Хочу"],
    ["maybe", "Думаю"],
    ["backup", "Запас"],
  ];
  $("#filterRow").innerHTML = filters
    .map(([key, label]) => {
      const icon = ["paid", "fixed", "want", "maybe", "backup"].includes(key)
        ? `<span class="filter-status-icon">${getStatusIcon(key)}</span>`
        : "";
      return `<button class="chip filter-chip ${currentFilter === key ? "active" : ""}" data-filter="${key}" type="button">${icon}<span>${label}</span></button>`;
    })
    .join("");

  let items = [...state.items];
  if (currentFilter === "nodate") items = items.filter((item) => !item.date);
  if (!["all", "nodate"].includes(currentFilter)) items = items.filter((item) => item.status === currentFilter);

  const groups = statuses
    .map(([status, label]) => {
      const groupItems = items.filter((item) => item.status === status).sort(sortItems);
      if (!groupItems.length) return "";
      return `
        <section class="basket-group">
          <div class="card-title-row">
            <h3>${label}</h3>
            <span class="muted">${groupItems.length}</span>
          </div>
          <div class="basket-grid-list">
            ${groupItems.map(renderItemCard).join("")}
          </div>
        </section>
      `;
    })
    .join("");
  $("#basketList").innerHTML = groups || `<p class="empty-state card">Ничего не найдено по фильтру.</p>`;
}

function renderBudget() {
  const totals = getTotals();
  const dates = getTripDates();
  const participantTotals = getParticipantTotals()
    .map(({ participant, total }) => `
      <div class="participant-total-row">
        <span>${renderParticipantAvatar(participant)}<span>${escapeHtml(participant.name)}</span>${participant.isSelf ? `<em>Это я</em>` : ""}</span>
        <strong>${formatMoney(total)}</strong>
      </div>
    `)
    .join("");
  const byDay = dates
    .map((date, index) => {
      const total = state.items
        .filter((item) => item.date === date && isActiveCost(item))
        .reduce((sum, item) => sum + parseMoney(item.price), 0);
      return `<div class="budget-row"><span>День ${index + 1} · ${formatDate(date)}</span><strong>${formatMoney(total)}</strong></div>`;
    })
    .join("");
  $("#budgetPage").innerHTML = `
    <section class="budget-grid">
      <div class="metric-card"><span>Бюджет поездки</span><strong>${formatMoney(state.trip.budgetLimit)}</strong></div>
      <div class="metric-card"><span>Уже оплачено</span><strong>${formatMoney(totals.paid)}</strong></div>
      <div class="metric-card"><span>Бронь</span><strong>${formatMoney(totals.fixed)}</strong></div>
      <div class="metric-card"><span>Опционально</span><strong>${formatMoney(totals.optional)}</strong></div>
      <div class="metric-card service-total"><span>Возможный итог</span><strong>${formatMoney(totals.possible)}</strong></div>
      <div class="metric-card"><span>Остаток</span><strong style="color:${totals.remaining < 0 ? "var(--danger)" : "var(--green)"}">${formatMoney(totals.remaining)}</strong></div>
    </section>
    <section class="card budget-days-card">
      <div class="card-title-row">
        <h3>По дням</h3>
        <div class="title-actions">
          <span class="muted">${dates.length}</span>
          <button class="ghost-button compact" id="copyDaysButton" type="button">Скачать</button>
        </div>
      </div>
      ${byDay}
    </section>
    <section class="card participant-totals-card">
      <div class="card-title-row">
        <h3>По участникам</h3>
        <span class="muted">${state.trip.participants.length}</span>
      </div>
      ${participantTotals}
    </section>
  `;
  $("#copyDaysButton")?.addEventListener("click", chooseAndDownloadPlan);
}

function renderEstimateTable() {
  const table = $("#estimateTable");
  if (!table) return;
  const rows = [...state.items]
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || sortItems(a, b))
    .map((item) => {
      const link = item.link
        ? `<a href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer">открыть</a>`
        : `<span class="muted">нет</span>`;
      return `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${getTypeLabel(item.type)}</td>
          <td>${getStatusLabel(item.status)}</td>
          <td>${item.date ? formatDate(item.date) : "без даты"}</td>
          <td>${item.startTime || ""}</td>
          <td>${formatMoney(item.price)}</td>
          <td>${formatMoney(item.paidAmount)}</td>
          <td>${link}</td>
        </tr>
      `;
    })
    .join("");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Событие</th>
        <th>Тип</th>
        <th>Статус</th>
        <th>День</th>
        <th>Время</th>
        <th>Цена</th>
        <th>Оплачено</th>
        <th>Ссылка</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function renderItemCard(item) {
  const price = parseMoney(item.price) ? formatMoney(item.price) : "--";
  const participant = getParticipantById(item.participantId);
  const participantBadge = state.trip.participants.length > 1
    ? `<span class="item-side-badge item-participant-badge participant-${escapeAttr(participant.colorKey)}" aria-label="Расход назначен участнику ${escapeAttr(participant.name)}">${escapeHtml(participant.initials)}</span>`
    : "";
  const note = item.notes ? `<p class="item-note">${escapeHtml(item.notes)}</p>` : "";
  const link = item.link
    ? `<a class="item-link" href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">открыть ссылку</a>`
    : "";
  return `
    <button class="item-card type-${item.type}" data-edit="${item.id}" data-drag-id="${item.id}" draggable="false" type="button">
      <span class="tile-icon" aria-hidden="true">
        <span>${typeIcons[item.type] || typeIcons.other}</span>
        <small>${getTypeLabel(item.type)}</small>
      </span>
      <div class="item-body">
        <div class="item-top">
          <span class="item-title">${escapeHtml(item.title)}</span>
          <span class="price-pill">${price}</span>
        </div>
        <div class="item-content-grid">
          <div class="item-main-flow">
            <p class="item-duration">${formatDurationText(item.durationMinutes)}</p>
            <div class="item-time-slots" aria-label="Время события">${renderItemTimeSlots(item)}</div>
            <p class="item-date-label">Дата</p>
            <div class="item-date-slots" aria-label="Дата события">${renderItemDateSlots(item)}</div>
          </div>
          <div class="item-side-badges">
            <span class="item-side-badge status-icon status-${item.status}" title="${escapeAttr(getStatusLabel(item.status))}" aria-label="${escapeAttr(getStatusLabel(item.status))}">${getStatusIcon(item.status)}</span>
            ${participantBadge}
          </div>
        </div>
        ${link ? `<div class="item-link-row">${link}</div>` : ""}
        ${note}
      </div>
    </button>
  `;
}

function getItemsForDate(date) {
  return state.items.filter((item) => (item.date || "") === date && item.status !== "skipped").sort(sortItems);
}

function sortItems(a, b) {
  const timeCompare = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
  if (timeCompare) return timeCompare;
  const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  return orderA - orderB || a.title.localeCompare(b.title);
}

function openItemSheet(itemId = null) {
  const form = $("#itemForm");
  form.reset();
  fillSelects();
  renderParticipantOwnerField();
  $("#deleteItemButton").style.display = itemId ? "inline-flex" : "none";
  $("#itemSheetTitle").textContent = itemId ? "Редактировать элемент" : "Добавить в поездку";
  if (itemId) {
    const item = state.items.find((entry) => entry.id === itemId);
    Object.entries(item).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value ?? "";
    });
  } else {
    form.elements.id.value = "";
    form.elements.type.value = "idea";
    form.elements.status.value = "want";
    form.elements.priority.value = "nice";
    form.elements.date.value = "";
    form.elements.participantId.value = getSelfParticipant().id;
  }
  updateOpenLinkButton();
  openSheet("itemSheet");
  const trackedItem = itemId ? state.items.find((entry) => entry.id === itemId) : null;
  trackEvent("item_form_opened", {
    ...getTripAnalyticsContext(),
    item_id: trackedItem?.id || null,
    mode: itemId ? "edit" : "create",
    item_type: trackedItem?.type || null,
    item_status: trackedItem?.status || null,
  });
}

function fillSelects() {
  const form = $("#itemForm");
  form.elements.type.innerHTML = itemTypes.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  form.elements.status.innerHTML = statuses.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  form.elements.priority.innerHTML = priorities.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  form.elements.participantId.innerHTML = state.trip.participants
    .map((participant) => `<option value="${escapeAttr(participant.id)}">${escapeHtml(participant.name)}${participant.isSelf ? " · Это я" : ""}</option>`)
    .join("");
  form.elements.date.innerHTML = `<option value="">Без даты</option>${getTripDates()
    .map((date, index) => `<option value="${date}">День ${index + 1} · ${formatDate(date)}</option>`)
    .join("")}`;
}

function renderParticipantOwnerField() {
  $("#participantOwnerField").hidden = state.trip.participants.length <= 1;
}

function saveItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = state.items.find((entry) => entry.id === data.id);
  const isNew = !existing;
  const item = {
    id: data.id || `item-${Date.now()}`,
    title: data.title.trim(),
    type: data.type || "idea",
    status: data.status || "want",
    priority: data.priority || "nice",
    date: data.date || "",
    startTime: data.startTime || "",
    durationMinutes: parseMoney(data.durationMinutes),
    price: parseMoney(data.price),
    paidAmount: parseMoney(data.paidAmount),
    participantId: state.trip.participants.some((participant) => participant.id === data.participantId)
      ? data.participantId
      : getSelfParticipant().id,
    link: data.link.trim(),
    locationText: data.locationText.trim(),
    notes: data.notes.trim(),
    order: existing && (existing.date || "") === (data.date || "") ? existing.order : getNextOrder(data.date || ""),
  };
  if (!item.title) return;
  const existingIndex = state.items.findIndex((entry) => entry.id === item.id);
  if (existingIndex >= 0) state.items[existingIndex] = item;
  else state.items.push(item);
  saveState();
  closeSheet("itemSheet");
  render();
  showToast("Сохранено");
  const changedFields = existing
    ? ["type", "status", "priority", "date", "startTime", "durationMinutes", "price", "paidAmount", "link", "locationText", "notes"]
        .filter((field) => String(existing[field] ?? "") !== String(item[field] ?? ""))
    : [];
  trackEvent(isNew ? "item_created" : "item_updated", {
    ...getTripAnalyticsContext(),
    item_id: item.id,
    item_type: item.type,
    item_status: item.status,
    item_priority: item.priority,
    has_date: Boolean(item.date),
    has_time: Boolean(item.startTime),
    has_price: Boolean(item.price),
    has_paid_amount: Boolean(item.paidAmount),
    has_link: Boolean(item.link),
    has_location: Boolean(item.locationText),
    has_note: Boolean(item.notes),
    ...(isNew ? {} : { changed_fields: changedFields }),
  });
  if (getTripOrigin() === "demo" && !isNew) {
    trackEvent("trainer_action_completed", {
      ...getTripAnalyticsContext(),
      action_type: "item_updated",
      trainer_version: TRAINER_VERSION,
    });
  }
  checkTripMilestones();
}

function getNextOrder(date) {
  const orders = state.items
    .filter((item) => (item.date || "") === (date || ""))
    .map((item) => Number(item.order))
    .filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function moveItem(itemId, targetDate, beforeItemId = null, method = "drag_desktop") {
  const moving = state.items.find((item) => item.id === itemId);
  if (!moving) return;
  const previousDate = moving.date || "";
  moving.date = targetDate || "";

  const siblings = state.items
    .filter((item) => item.id !== itemId && (item.date || "") === moving.date && item.status !== "skipped")
    .sort(sortItems);
  const beforeIndex = beforeItemId ? siblings.findIndex((item) => item.id === beforeItemId) : -1;
  const ordered = beforeIndex >= 0
    ? [...siblings.slice(0, beforeIndex), moving, ...siblings.slice(beforeIndex)]
    : [...siblings, moving];
  ordered.forEach((item, index) => {
    item.order = index;
  });
  saveState();
  render();
  trackEvent("item_day_changed", {
    ...getTripAnalyticsContext(),
    item_id: moving.id,
    item_type: moving.type,
    item_status: moving.status,
    from: previousDate ? "day" : "undated",
    to: moving.date ? "day" : "undated",
    method,
    reordered_inside_bucket: previousDate === moving.date,
    dropped_before_item: Boolean(beforeItemId),
  });
  if (getTripOrigin() === "demo") {
    trackEvent("trainer_action_completed", { ...getTripAnalyticsContext(), action_type: "item_day_changed", trainer_version: TRAINER_VERSION });
  }
  checkTripMilestones();
}

function deleteCurrentItem() {
  const id = $("#itemForm").elements.id.value;
  if (!id) return;
  const item = state.items.find((entry) => entry.id === id);
  state.items = state.items.filter((item) => item.id !== id);
  saveState();
  closeSheet("itemSheet");
  render();
  showToast("Удалено");
  trackEvent("item_deleted", {
    ...getTripAnalyticsContext(),
    item_id: id,
    item_type: item?.type || null,
    item_status: item?.status || null,
  });
}

function openTripSheet() {
  const form = $("#tripForm");
  Object.entries(state.trip).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  syncTripDateInputs();
  renderParticipantsList();
  openSheet("tripSheet");
  trackEvent("trip_settings_opened", getTripAnalyticsContext());
}

function renderParticipantsList() {
  const list = $("#participantsList");
  if (!list) return;
  list.innerHTML = state.trip.participants.map((participant) => `
    <div class="participant-row">
      ${renderParticipantAvatar(participant)}
      <div class="participant-row-text">
        <strong>${escapeHtml(participant.name)}${participant.isSelf ? ` <span>(это я)</span>` : ""}</strong>
      </div>
      <div class="participant-row-actions">
        <button class="ghost-button compact" type="button" data-rename-participant="${escapeAttr(participant.id)}">Переименовать</button>
        ${participant.isSelf ? "" : `<button class="danger-button compact participant-delete-button" type="button" data-delete-participant="${escapeAttr(participant.id)}">Удалить</button>`}
      </div>
    </div>
    ${participantEditorState.mode === "rename" && participantEditorState.participantId === participant.id ? renderParticipantEditor() : ""}
  `).join("") + (participantEditorState.mode === "add" ? renderParticipantEditor() : "");
}

function renderParticipantEditor() {
  const label = participantEditorState.mode === "add" ? "Имя участника" : "Новое имя";
  return `
    <div class="participant-editor-row">
      <label class="field participant-editor-field">
        ${label}
        <input id="participantEditorInput" value="${escapeAttr(participantEditorState.value)}" maxlength="40" />
      </label>
      <button class="ghost-button compact" type="button" data-save-participant>Сохранить</button>
      <button class="ghost-button compact" type="button" data-cancel-participant>Отмена</button>
    </div>
  `;
}

function focusParticipantEditor() {
  window.setTimeout(() => {
    const input = $("#participantEditorInput");
    if (!input) return;
    input.focus();
    input.select();
  }, 0);
}

function openParticipantEditor(mode, participantId = "") {
  const participant = participantId ? state.trip.participants.find((entry) => entry.id === participantId) : null;
  participantEditorState = {
    mode,
    participantId,
    value: participant ? participant.name : "",
  };
  renderParticipantsList();
  focusParticipantEditor();
}

function closeParticipantEditor() {
  participantEditorState = { mode: "", participantId: "", value: "" };
  renderParticipantsList();
}

function closeAddParticipantDialog(dialog) {
  dialog?.remove();
}

function readAddParticipantName(dialog) {
  const input = dialog.querySelector("[data-add-participant-name]");
  const name = normalizeParticipantName(input ? input.value : "");
  if (!name) {
    showToast("Введите имя участника");
    return "";
  }
  if (name.length > 40) {
    showToast("Имя слишком длинное");
    return "";
  }
  if (isParticipantNameDuplicate(name)) {
    showToast("Участник с таким именем уже добавлен");
    return "";
  }
  return name;
}

function saveAddParticipant(dialog) {
  const name = readAddParticipantName(dialog);
  if (!name) return;
  state.trip.participants.push(createParticipant({
    tripId: state.trip.id,
    name,
    index: state.trip.participants.length,
  }));
  saveState();
  closeAddParticipantDialog(dialog);
  renderParticipantsList();
  render();
  showToast("Участник добавлен");
}

function openAddParticipantDialog() {
  closeParticipantEditor();
  const dialog = document.createElement("div");
  dialog.className = "add-participant-dialog";
  dialog.innerHTML = `
    <div class="add-participant-backdrop" data-add-participant-cancel></div>
    <section class="add-participant-panel" role="dialog" aria-modal="true" aria-labelledby="addParticipantTitle">
      <h2 id="addParticipantTitle">Добавить участника</h2>
      <label class="field">
        Имя участника
        <input data-add-participant-name maxlength="40" />
      </label>
      <div class="add-participant-actions">
        <button class="primary-button" type="button" data-add-participant-save>Сохранить</button>
        <button class="ghost-button" type="button" data-add-participant-cancel>Отмена</button>
      </div>
    </section>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-add-participant-save]")) {
      saveAddParticipant(dialog);
      return;
    }
    if (event.target.closest("[data-add-participant-cancel]")) {
      closeAddParticipantDialog(dialog);
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveAddParticipant(dialog);
    }
    if (event.key === "Escape") {
      closeAddParticipantDialog(dialog);
    }
  });
  window.setTimeout(() => dialog.querySelector("[data-add-participant-name]")?.focus(), 0);
}

function readParticipantEditorName() {
  const input = $("#participantEditorInput");
  const name = normalizeParticipantName(input ? input.value : "");
  if (!name) {
    showToast("Введите имя участника");
    return "";
  }
  if (name.length > 40) {
    showToast("Имя слишком длинное");
    return "";
  }
  return name;
}

function isParticipantNameDuplicate(name, participantId = "") {
  const normalizedName = normalizeParticipantName(name).toLowerCase();
  return state.trip.participants.some((participant) => participant.id !== participantId && participant.name.toLowerCase() === normalizedName);
}

function requestParticipantName(initialName = "") {
  const name = normalizeParticipantName(window.prompt("Имя участника", initialName) || "");
  if (!name) {
    showToast("Введите имя участника");
    return "";
  }
  if (name.length > 40) {
    showToast("Имя слишком длинное");
    return "";
  }
  return name;
}

function addParticipant() {
  openAddParticipantDialog();
}

function saveParticipantEditor() {
  const name = readParticipantEditorName();
  if (!name) return;

  const participant = participantEditorState.participantId
    ? state.trip.participants.find((entry) => entry.id === participantEditorState.participantId)
    : null;
  const duplicateId = participant ? participant.id : "";
  if (isParticipantNameDuplicate(name, duplicateId)) {
    showToast("Участник с таким именем уже добавлен");
    return;
  }

  if (participantEditorState.mode === "add") {
    state.trip.participants.push(createParticipant({
      tripId: state.trip.id,
      name,
      index: state.trip.participants.length,
    }));
    showToast("Участник добавлен");
  } else if (participant) {
    participant.name = name;
    participant.initials = generateParticipantInitials(name);
    participant.updatedAt = new Date().toISOString();
  }

  participantEditorState = { mode: "", participantId: "", value: "" };
  saveState();
  renderParticipantsList();
  render();
}

function renameParticipant(participantId) {
  openParticipantEditor("rename", participantId);
}

function deleteParticipant(participantId) {
  const participant = state.trip.participants.find((entry) => entry.id === participantId);
  const selfParticipant = getSelfParticipant();
  if (!participant || participant.isSelf || !selfParticipant) return;
  const assignedItems = state.items.filter((item) => item.participantId === participant.id);
  const total = assignedItems.filter(isActiveCost).reduce((sum, item) => sum + parseMoney(item.price), 0);
  const message = assignedItems.length
    ? `На ${participant.name} находится ${assignedItems.length} расход(ов) на сумму ${formatMoney(total)}. Перенести их на вас и удалить участника?`
    : `Участник "${participant.name}" будет удален из этой поездки.`;
  if (!window.confirm(message)) return;
  state.items = state.items.map((item) => item.participantId === participant.id ? { ...item, participantId: selfParticipant.id } : item);
  state.trip.participants = state.trip.participants.filter((entry) => entry.id !== participant.id);
  saveState();
  renderParticipantsList();
  render();
  showToast(assignedItems.length ? "Расходы перенесены на вас" : "Участник удален");
}

function getTripDateInputs() {
  const form = $("#tripForm");
  return {
    startInput: form.elements.startDate,
    endInput: form.elements.endDate,
  };
}

function syncTripDateInputs({ focusEnd = false } = {}) {
  const { startInput, endInput } = getTripDateInputs();
  const previousEndDate = endInput.value;
  endInput.min = startInput.value || "";
  endInput.disabled = !startInput.value;
  if (startInput.value && endInput.value && endInput.value < startInput.value) {
    endInput.value = "";
  }
  validateTripDateInputs();
  if (focusEnd && startInput.value && (!previousEndDate || previousEndDate !== endInput.value)) {
    window.setTimeout(() => endInput.focus(), 0);
  }
}

function validateTripDateInputs() {
  const { startInput, endInput } = getTripDateInputs();
  endInput.setCustomValidity("");
  if (startInput.value && endInput.value && endInput.value < startInput.value) {
    endInput.setCustomValidity(TRIP_DATE_RANGE_ERROR);
  }
  return !endInput.validationMessage;
}

function handleTripStartDateChange() {
  syncTripDateInputs({ focusEnd: true });
}

function handleTripEndDateChange() {
  validateTripDateInputs();
}

function saveTrip(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  syncTripDateInputs();
  if (!validateTripDateInputs()) {
    event.currentTarget.reportValidity();
    showToast(TRIP_DATE_RANGE_ERROR);
    return;
  }
  const previousTrip = { ...state.trip };
  const previousCurrency = state.trip.currency;
  if (previousCurrency !== data.currency) {
    convertTripCurrency(previousCurrency, data.currency);
  }
  state.trip = {
    ...state.trip,
    title: data.title.trim(),
    destination: data.destination.trim(),
    startDate: data.startDate,
    endDate: data.endDate,
    currency: data.currency,
    budgetLimit: previousCurrency === data.currency ? parseMoney(data.budgetLimit) : state.trip.budgetLimit,
    preferencesText: data.preferencesText.trim(),
  };
  saveState();
  closeSheet("tripSheet");
  render();
  showToast("Поездка сохранена");
  const changedFields = ["title", "destination", "startDate", "endDate", "currency", "budgetLimit", "preferencesText"]
    .filter((field) => String(previousTrip[field] ?? "") !== String(state.trip[field] ?? ""));
  trackEvent("trip_settings_updated", {
    ...getTripAnalyticsContext(),
    changed_fields: changedFields,
    currency_changed: previousCurrency !== data.currency,
    has_budget: Boolean(parseMoney(state.trip.budgetLimit)),
    has_dates: Boolean(state.trip.startDate && state.trip.endDate),
  });
  checkTripMilestones();
}

function resetDemo() {
  const currentId = state.trip.id;
  const currentTitle = state.trip.title;
  state = normalizeState(structuredClone(seedState));
  state.trip.id = currentId;
  state.trip.title = currentTitle || state.trip.title;
  saveState();
  closeSheet("tripSheet");
  render();
  showToast("Демо сброшено");
}

function openHomeShareSheet() {
  openSheet("homeShareSheet");
  trackEvent("share_opened", { share_target: "app" });
}

function openShareSheet() {
  renderSharePreview();
  openSheet("shareSheet");
  trackEvent("share_opened", getTripAnalyticsContext());
}

function renderSharePreview() {
  const target = $("#sharePreview");
  if (target) target.textContent = buildShareText(false);
}

function buildShareText(compact = false) {
  const totals = getTotals();
  const lines = [
    `Backpacker: ${state.trip.title}`,
    `${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)} · ${state.trip.destination}`,
    "",
    "Бюджет:",
    `Оплачено: ${formatMoney(totals.paid)}`,
    `План: ${formatMoney(totals.possible)}`,
    `Остаток: ${formatMoney(totals.remaining)}`,
    "",
  ];
  getTripDates().forEach((date, index) => {
    const items = state.items.filter((item) => item.date === date && item.status !== "skipped").sort(sortItems);
    lines.push(`День ${index + 1} · ${formatDate(date)}`);
    if (!items.length) lines.push("- пока пусто");
    items.forEach((item) => {
      lines.push(`- ${item.startTime ? `${item.startTime} ` : ""}${item.title} · ${getStatusLabel(item.status)} · ${formatMoney(item.price)}`);
    });
    lines.push("");
  });
  const unscheduled = state.items.filter((item) => !item.date && item.status !== "skipped");
  if (unscheduled.length) {
    lines.push("Без даты:");
    unscheduled.forEach((item) => lines.push(`- ${item.title} · ${getStatusLabel(item.status)} · ${formatMoney(item.price)}`));
  }
  return compact ? lines.filter(Boolean).join("\n") : lines.join("\n");
}

function buildEstimateText() {
  const header = ["Событие", "Тип", "Статус", "День", "Время", "Цена", "Оплачено", "Ссылка"].join("\t");
  const rows = [...state.items]
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || sortItems(a, b))
    .map((item) =>
      [
        item.title,
        getTypeLabel(item.type),
        getStatusLabel(item.status),
        item.date ? formatDate(item.date) : "без даты",
        item.startTime || "",
        parseMoney(item.price),
        parseMoney(item.paidAmount),
        item.link || "",
      ].join("\t"),
    );
  return [header, ...rows].join("\n");
}

function buildDaysText() {
  const rows = getTripDates().map((date, index) => {
    const total = state.items
      .filter((item) => item.date === date && isActiveCost(item))
      .reduce((sum, item) => sum + parseMoney(item.price), 0);
    return `День ${index + 1}\t${formatDate(date)}\t${formatMoney(total)}`;
  });
  return ["День\tДата\tСумма", ...rows].join("\n");
}

function escapeCsvValue(value = "") {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildEstimateRows() {
  const header = ["Событие", "Тип", "Статус", "День", "Время", "Цена", "Оплачено", "Ссылка"];
  const rows = [...state.items]
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || sortItems(a, b))
    .map((item) => [
      item.title,
      getTypeLabel(item.type),
      getStatusLabel(item.status),
      item.date ? formatDate(item.date) : "без даты",
      item.startTime || "",
      parseMoney(item.price),
      parseMoney(item.paidAmount),
      item.link || "",
    ]);
  return { header, rows };
}

function buildEstimateCsv() {
  const { header, rows } = buildEstimateRows();
  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(";")).join("\n");
}

function buildPlanRows() {
  const header = ["День", "Дата", "Время", "Событие", "Тип", "Статус", "Цена", "Ссылка"];
  const rows = [];
  getTripDates().forEach((date, index) => {
    state.items
      .filter((item) => item.date === date && item.status !== "skipped")
      .sort(sortItems)
      .forEach((item) => {
        rows.push([
          `День ${index + 1}`,
          formatDate(date),
          item.startTime || "",
          item.title,
          getTypeLabel(item.type),
          getStatusLabel(item.status),
          parseMoney(item.price),
          item.link || "",
        ]);
      });
  });
  state.items
    .filter((item) => !item.date && item.status !== "skipped")
    .sort(sortItems)
    .forEach((item) => {
      rows.push([
        "Без даты",
        "",
        item.startTime || "",
        item.title,
        getTypeLabel(item.type),
        getStatusLabel(item.status),
        parseMoney(item.price),
        item.link || "",
      ]);
    });
  return { header, rows };
}

function buildPlanCsv() {
  const { header, rows } = buildPlanRows();
  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(";")).join("\n");
}

function slugifyFileName(value = "backpacker") {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "backpacker";
}

function downloadTextFile(fileName, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeSpreadsheetValue(value = "") {
  return escapeHtml(String(value ?? ""));
}

function buildSpreadsheetHtml(title, table) {
  const headerHtml = table.header.map((cell) => `<th>${escapeSpreadsheetValue(cell)}</th>`).join("");
  const rowsHtml = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeSpreadsheetValue(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 18px; }
    table { border-collapse: collapse; }
    th, td { border: 1px solid #9aa6a3; padding: 6px 8px; vertical-align: top; }
    th { background: #dfe9e5; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeSpreadsheetValue(title)}</h1>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}

function downloadSpreadsheet(fileName, title, table) {
  downloadTextFile(
    fileName,
    `\uFEFF${buildSpreadsheetHtml(title, table)}`,
    "application/vnd.ms-excel;charset=utf-8",
  );
}

function downloadEstimate() {
  const name = `${slugifyFileName(state.trip.title)}-estimate.xls`;
  downloadSpreadsheet(name, "Смета поездки", buildEstimateRows());
  showToast("Смета скачана");
  trackEvent("export_completed", { ...getTripAnalyticsContext(), export_type: "estimate", format: "xls" });
}

function downloadPlan() {
  const name = `${slugifyFileName(state.trip.title)}-plan.xls`;
  downloadSpreadsheet(name, "План по дням", buildPlanRows());
  showToast("План скачан");
  trackEvent("export_completed", { ...getTripAnalyticsContext(), export_type: "plan", format: "xls" });
}

function closeExportFormatDialog(dialog, resolve, value = null) {
  dialog.remove();
  resolve(value);
}

function chooseExportFormat() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "export-format-dialog";
    dialog.innerHTML = `
      <div class="export-format-backdrop" data-export-cancel></div>
      <section class="export-format-panel" role="dialog" aria-modal="true" aria-labelledby="exportFormatTitle">
        <h2 id="exportFormatTitle">Выберите удобный формат:</h2>
        <div class="export-format-actions">
          <button class="export-format-button" type="button" data-export-format="pdf">PDF</button>
          <button class="export-format-button" type="button" data-export-format="xls">XLS</button>
        </div>
        <button class="export-format-cancel" type="button" data-export-cancel>Отмена</button>
      </section>
    `;
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (event) => {
      const formatButton = event.target.closest("[data-export-format]");
      if (formatButton) {
        closeExportFormatDialog(dialog, resolve, formatButton.dataset.exportFormat);
        return;
      }
      if (event.target.closest("[data-export-cancel]")) {
        closeExportFormatDialog(dialog, resolve, null);
      }
    });
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

async function downloadPdfFile(fileName, title, table, previewWindow = null) {
  if (!window.PDFLib?.PDFDocument) {
    previewWindow?.close();
    showToast("PDF-модуль не загрузился");
    return;
  }

  const { PDFDocument } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 595;
  const pageHeight = 842;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = pageWidth * scale;
  canvas.height = pageHeight * scale;
  const ctx = canvas.getContext("2d");
  const pages = [];

  function startPage() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, pageWidth, pageHeight);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    return 42;
  }

  async function commitPage() {
    const pngBytes = await new Promise((resolve) => canvas.toBlob((blob) => blob.arrayBuffer().then(resolve), "image/png"));
    pages.push(pngBytes);
  }

  let y = startPage();
  const x = 42;
  const maxWidth = pageWidth - x * 2;

  const columnCount = table.header.length;
  const columnWidth = maxWidth / columnCount;
  const lineHeight = 14;
  const cellPadding = 5;
  const rowFont = "400 10px Arial, sans-serif";
  const headerFont = "700 10px Arial, sans-serif";

  function wrapCellText(text, width) {
    const words = String(text ?? "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function getRowHeight(row, font) {
    ctx.font = font;
    const linesCount = Math.max(
      1,
      ...row.map((cell) => wrapCellText(cell, columnWidth - cellPadding * 2).length),
    );
    return Math.max(26, linesCount * lineHeight + cellPadding * 2);
  }

  function drawRow(row, rowY, rowHeight, font, fillStyle = "#ffffff") {
    ctx.font = font;
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, rowY, maxWidth, rowHeight);
    row.forEach((cell, index) => {
      const cellX = x + index * columnWidth;
      ctx.strokeStyle = "#9aa6a3";
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, rowY, columnWidth, rowHeight);
      ctx.fillStyle = "#1f2423";
      wrapCellText(cell, columnWidth - cellPadding * 2).forEach((line, lineIndex) => {
        ctx.fillText(line, cellX + cellPadding, rowY + cellPadding + 10 + lineIndex * lineHeight);
      });
    });
  }

  function drawPageTitle() {
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillStyle = "#1f2423";
    ctx.fillText(title, x, y);
    y += 28;
    ctx.font = "400 12px Arial, sans-serif";
    ctx.fillStyle = "#66716f";
    ctx.fillText(`${state.trip.title} · ${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)}`, x, y);
    y += 24;
  }

  function drawHeader() {
    const headerHeight = getRowHeight(table.header, headerFont);
    drawRow(table.header, y, headerHeight, headerFont, "#dfe9e5");
    y += headerHeight;
  }

  drawPageTitle();
  drawHeader();

  for (const row of table.rows) {
    const rowHeight = getRowHeight(row, rowFont);
    if (y + rowHeight > pageHeight - 42) {
      await commitPage();
      y = startPage();
      drawHeader();
    }
    drawRow(row, y, rowHeight, rowFont);
    y += rowHeight;
  }
  await commitPage();

  for (const pngBytes of pages) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const image = await pdfDoc.embedPng(pngBytes);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (previewWindow) {
    previewWindow.location.href = url;
  } else {
    window.open(url, "_blank");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast("PDF скачан");
}

async function chooseAndDownloadEstimate() {
  const format = await chooseExportFormat();
  if (!format) return;
  if (format === "xls") {
    downloadEstimate();
  } else {
    const previewWindow = window.open("", "_blank");
    previewWindow?.document.write("<p>Готовим PDF...</p>");
    await downloadPdfFile(`${slugifyFileName(state.trip.title)}-estimate.pdf`, "Смета поездки", buildEstimateRows(), previewWindow);
    trackEvent("export_completed", { ...getTripAnalyticsContext(), export_type: "estimate", format: "pdf" });
  }
}

async function chooseAndDownloadPlan() {
  const format = await chooseExportFormat();
  if (!format) return;
  if (format === "xls") {
    downloadPlan();
  } else {
    const previewWindow = window.open("", "_blank");
    previewWindow?.document.write("<p>Готовим PDF...</p>");
    await downloadPdfFile(`${slugifyFileName(state.trip.title)}-plan.pdf`, "План по дням", buildPlanRows(), previewWindow);
    trackEvent("export_completed", { ...getTripAnalyticsContext(), export_type: "plan", format: "pdf" });
  }
}

async function shareTrip() {
  const text = buildShareText(true);
  const shareData = {
    title: `Backpacker: ${state.trip.title}`,
    text,
    url: window.location.href,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      trackEvent("share_completed", { ...getTripAnalyticsContext(), method: "web_share", result: "success" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(`${text}\n\n${window.location.href}`);
  showToast("Ссылка и сводка скопированы");
  trackEvent("share_completed", { ...getTripAnalyticsContext(), method: "copy_fallback", result: "fallback" });
}

async function shareApp() {
  const url = window.location.origin && window.location.protocol !== "file:"
    ? `${window.location.origin}${window.location.pathname}`
    : "https://dphnll.github.io/Backpacker_demo/";
  const shareData = {
    title: "Backpacker",
    text: "Backpacker — план поездки, корзина идей, бюджет и ссылки в одном месте.",
    url,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      trackEvent("share_completed", { method: "web_share", result: "success", share_target: "app" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(`${shareData.text}\n${url}`);
  showToast("Ссылка на Backpacker скопирована");
  trackEvent("share_completed", { method: "copy_fallback", result: "fallback", share_target: "app" });
}

function getItemFormLink() {
  return $("#itemForm").elements.link.value.trim();
}

function normalizeExternalUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function updateOpenLinkButton() {
  $("#openLinkButton").disabled = !getItemFormLink();
}

function openItemLink() {
  const url = normalizeExternalUrl(getItemFormLink());
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
  trackEvent("external_link_opened", getTripAnalyticsContext());
}

async function installPwa() {
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    showToast("Приложение уже установлено");
    trackEvent("pwa_install_clicked", { already_installed: true });
    return;
  }

  if (deferredInstallPrompt) {
    trackEvent("pwa_install_clicked", { prompt_available: true });
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    trackEvent("pwa_install_prompt_result", { outcome: choice?.outcome || "unknown" });
    deferredInstallPrompt = null;
    return;
  }

  showToast("Откройте меню браузера и выберите «Добавить на главный экран»");
  trackEvent("pwa_install_clicked", { prompt_available: false });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Скопировано");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("Скопировано");
  }
}

function openSheet(id) {
  $(`#${id}`).classList.add("open");
  $(`#${id}`).setAttribute("aria-hidden", "false");
}

function closeSheet(id) {
  $(`#${id}`).classList.remove("open");
  $(`#${id}`).setAttribute("aria-hidden", "true");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

function showIntroSlide(index) {
  $$("[data-intro-slide]").forEach((slide) => {
    slide.classList.toggle("hidden", slide.dataset.introSlide !== String(index));
  });
  trackEvent("onboarding_slide_viewed", { onboarding_version: ONBOARDING_VERSION, slide_index: index });
}

function hideAppSplash() {
  $("#appSplash")?.classList.add("hidden");
}

function showIntroScreen(trigger = "first_open") {
  currentScreen = "intro";
  onboardingExitTracked = false;
  $("#introScreen").classList.remove("hidden");
  $("#homeScreen").classList.add("hidden");
  $(".app-shell").classList.add("hidden");
  trackEvent("onboarding_started", { onboarding_version: ONBOARDING_VERSION, trigger });
  showIntroSlide(0);
}

function finishIntro() {
  const previewOnboarding = new URLSearchParams(window.location.search).get(ONBOARDING_PREVIEW_PARAM) === "1";
  if (!previewOnboarding) {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
    } catch {
      // The app should still open when storage is unavailable.
    }
  }
  onboardingExitTracked = true;
  trackEvent("onboarding_finished", { onboarding_version: ONBOARDING_VERSION, outcome: "completed" });
  showHomeScreen();
}

function trackOnboardingExit() {
  if (currentScreen !== "intro" || onboardingExitTracked) return;
  onboardingExitTracked = true;
  trackEvent("onboarding_finished", { onboarding_version: ONBOARDING_VERSION, outcome: "exited" });
}

function startApp() {
  hideAppSplash();
  trackAppOpen();
  const params = new URLSearchParams(window.location.search);
  const forceIntro = params.get("intro") === "1" || params.get(ONBOARDING_PREVIEW_PARAM) === "1";
  let onboardingSeen = false;
  try {
    onboardingSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "seen";
  } catch {
    onboardingSeen = false;
  }

  if (forceIntro || !onboardingSeen) {
    showIntroScreen(forceIntro ? "forced" : "first_open");
    return;
  }

  showHomeScreen();
}

function showHomeScreen() {
  currentScreen = "home";
  $("#introScreen").classList.add("hidden");
  $("#homeScreen").classList.remove("hidden");
  $(".app-shell").classList.add("hidden");
  renderHome();
  trackEvent("home_opened", { trip_count: getUserTripCount() });
}

function showTripScreen() {
  currentScreen = "trip";
  $("#introScreen").classList.add("hidden");
  $("#homeScreen").classList.add("hidden");
  $(".app-shell").classList.remove("hidden");
  render();
}

function openTrip(tripId) {
  const entry = tripStore.trips.find((trip) => trip.id === tripId);
  if (!entry) return;
  state = normalizeState(structuredClone(entry.state));
  try {
    localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, tripId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Opening still works even without persistence.
  }
  switchView(currentView);
  showTripScreen();
  if (entry.isDemo) {
    trackEvent("trainer_opened", {
      ...getTripAnalyticsContext(),
      trainer_version: TRAINER_VERSION,
      has_custom_cover: Boolean(entry.coverDataUrl),
    });
  } else {
    trackEvent("trip_opened", {
      ...getTripAnalyticsContext(),
      has_custom_cover: Boolean(entry.coverDataUrl),
    });
  }
}

function createNewTrip(creationSource = "home") {
  const entry = createBlankTripEntry();
  tripStore.trips.push(entry);
  persistTripStore(tripStore);
  openTrip(entry.id);
  openTripSheet();
  trackEvent("trip_created", {
    ...getTripAnalyticsContext(entry.state.trip),
    trip_id: entry.id,
    trip_origin: "user_created",
    creation_source: creationSource,
    trip_count_after_create: getUserTripCount(),
    is_second_user_trip: getUserTripCount() >= 2,
  });
}

function selectTripCover(tripId) {
  coverTargetTripId = tripId;
  const input = $("#coverInput");
  input.value = "";
  input.click();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function makeCoverDataUrl(file) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const size = 900;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size * 0.62);
  const context = canvas.getContext("2d");
  const ratio = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  context.drawImage(image, x, y, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

async function saveSelectedCover(event) {
  const file = event.target.files?.[0];
  const entry = tripStore.trips.find((trip) => trip.id === coverTargetTripId);
  if (!file || !entry) return;
  try {
    entry.coverDataUrl = await makeCoverDataUrl(file);
    entry.updatedAt = new Date().toISOString();
    persistTripStore(tripStore);
    renderHome();
    showToast("Обложка обновлена");
    trackEvent("trip_cover_updated", getTripAnalyticsContext(entry.state.trip));
  } catch {
    showToast("Не удалось загрузить обложку");
  }
}

function deleteTrip(tripId) {
  const entry = tripStore.trips.find((trip) => trip.id === tripId);
  if (!entry || entry.isDemo) return;
  const title = entry.state.trip.title || "поездку";
  if (!window.confirm(`Удалить «${title}»? Это действие нельзя отменить.`)) return;

  tripStore.trips = tripStore.trips.filter((trip) => trip.id !== tripId);
  persistTripStore(tripStore);
  if (state.trip.id === tripId) {
    const fallback = tripStore.trips.find((trip) => trip.isDemo) || tripStore.trips[0] || createDemoEntry();
    if (!tripStore.trips.some((trip) => trip.id === fallback.id)) {
      tripStore.trips.unshift(fallback);
      persistTripStore(tripStore);
    }
    state = normalizeState(structuredClone(fallback.state));
    localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, fallback.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  renderHome();
  showToast("Поездка удалена");
  trackEvent("trip_deleted", { trip_id: tripId, trip_origin: "user_created" });
}

function switchView(view) {
  const previousView = currentView;
  currentView = view;
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // View persistence is a comfort feature; the app should work without it.
  }
  $$(".view").forEach((element) => element.classList.toggle("active", element.id === `${view}View`));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (previousView !== view) {
    trackEvent("trip_section_opened", {
      ...getTripAnalyticsContext(),
      section: view,
      from_section: previousView,
    });
    if (getTripOrigin() === "demo") {
      trackEvent("trainer_action_completed", { ...getTripAnalyticsContext(), action_type: "section_opened", trainer_version: TRAINER_VERSION });
    }
  }
}

function getDropZoneFromPoint(x, y, fallbackTarget = null) {
  const target = document.elementFromPoint(x, y) || fallbackTarget;
  const directZone = target?.closest?.("[data-drop-date]");
  if (directZone) return directZone;

  const candidates = [...$$("[data-drop-date]")]
    .map((candidate) => {
    const rect = candidate.getBoundingClientRect();
      const insideExpanded =
        y >= rect.top - 72 &&
        y <= rect.bottom + 72 &&
        x >= rect.left - 80 &&
        x <= rect.right + 80;
      if (!insideExpanded) return null;
      const clampedX = Math.max(rect.left, Math.min(x, rect.right));
      const clampedY = Math.max(rect.top, Math.min(y, rect.bottom));
      return {
        candidate,
        distance: Math.hypot(x - clampedX, y - clampedY),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

  return candidates[0]?.candidate || null;
}

function getDropDataFromPoint(x, y, fallbackTarget = null) {
  const target = document.elementFromPoint(x, y) || fallbackTarget;
  const zone = getDropZoneFromPoint(x, y, fallbackTarget);
  if (!zone) return null;
  const targetCard = zone.contains(target) ? target.closest?.("[data-drag-id]") : null;
  const beforeItemId = targetCard && targetCard.dataset.dragId !== draggedItemId ? targetCard.dataset.dragId : null;
  return {
    date: zone.dataset.dropDate || "",
    beforeItemId,
    zone,
  };
}

function clearDropHighlights() {
  $$(".drop-target-active").forEach((element) => element.classList.remove("drop-target-active"));
}

function markDropZone(zone) {
  clearDropHighlights();
  zone?.classList.add("drop-target-active");
}

function stopAutoScroll() {
  if (autoScrollFrame) window.cancelAnimationFrame(autoScrollFrame);
  autoScrollFrame = null;
}

function getHorizontalScrollZone(x, y) {
  const directZone = document.elementFromPoint(x, y)?.closest?.(".day-items, .basket-grid-list");
  if (directZone) return directZone;
  return [...$$(".day-items, .basket-grid-list")].find((zone) => {
    const rect = zone.getBoundingClientRect();
    return y >= rect.top - 24 && y <= rect.bottom + 24 && x >= rect.left - 96 && x <= rect.right + 96;
  });
}

function updateAutoScroll(getPoint) {
  stopAutoScroll();
  const tick = () => {
    const point = getPoint();
    if (!point) {
      stopAutoScroll();
      return;
    }

    const edge = 96;
    const maxSpeed = 22;
    const { innerHeight } = window;
    const { x, y } = point;
    let scrollY = 0;

    if (y < edge) scrollY = -Math.ceil(((edge - y) / edge) * maxSpeed);
    else if (y > innerHeight - edge) scrollY = Math.ceil(((y - (innerHeight - edge)) / edge) * maxSpeed);
    if (scrollY) window.scrollBy(0, scrollY);

    const horizontalZone = getHorizontalScrollZone(x, y);
    if (horizontalZone) {
      let scrollX = 0;
      const rect = horizontalZone.getBoundingClientRect();
      if (x < rect.left + edge) scrollX = -Math.ceil(((rect.left + edge - x) / edge) * maxSpeed);
      else if (x > rect.right - edge) scrollX = Math.ceil(((x - (rect.right - edge)) / edge) * maxSpeed);
      if (scrollX) horizontalZone.scrollBy(scrollX, 0);
    }

    autoScrollFrame = window.requestAnimationFrame(tick);
  };
  autoScrollFrame = window.requestAnimationFrame(tick);
}

function finishDragClickGuard() {
  dragJustHappened = true;
  window.setTimeout(() => {
    dragJustHappened = false;
  }, 250);
}

function bindDesktopDrag() {
  let desktopDragPoint = null;

  function cleanupDesktopDrag() {
    $$(".dragging-source").forEach((element) => element.classList.remove("dragging-source"));
    clearDropHighlights();
    stopAutoScroll();
    desktopDragPoint = null;
    draggedItemId = null;
  }

  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-drag-id]");
    if (!card) return;
    if (card.getAttribute("draggable") === "false") {
      event.preventDefault();
      return;
    }
    draggedItemId = card.dataset.dragId;
    desktopDragPoint = { x: event.clientX, y: event.clientY };
    card.classList.add("dragging-source");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedItemId);
    updateAutoScroll(() => (draggedItemId ? desktopDragPoint : null));
  });

  document.addEventListener("dragover", (event) => {
    if (!draggedItemId) return;
    desktopDragPoint = { x: event.clientX, y: event.clientY };
    event.preventDefault();
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (data) markDropZone(data.zone);
  });

  document.addEventListener("dragenter", (event) => {
    if (!draggedItemId) return;
    event.preventDefault();
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (data) markDropZone(data.zone);
  });

  document.addEventListener("drop", (event) => {
    if (!draggedItemId) return;
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (!data) return;
    event.preventDefault();
    moveItem(draggedItemId, data.date, data.beforeItemId, "drag_desktop");
    finishDragClickGuard();
    cleanupDesktopDrag();
  });

  document.addEventListener("dragend", () => {
    cleanupDesktopDrag();
  });
}

function bindPointerDrag() {
  const longPressDelay = 420;
  const mouseDragDistance = 4;
  const touchScrollDistance = 22;

  function startPointerDrag(event) {
    if (!pointerDrag || pointerDrag.active) return;
    const rect = pointerDrag.card.getBoundingClientRect();
    const cardStyles = getComputedStyle(pointerDrag.card);
    const cardZoom = Number.parseFloat(cardStyles.getPropertyValue("--item-card-scale")) || Number.parseFloat(cardStyles.zoom) || 1;
    const layoutWidth = pointerDrag.card.offsetWidth || rect.width / cardZoom;
    const layoutHeight = pointerDrag.card.offsetHeight || rect.height / cardZoom;
    draggedItemId = pointerDrag.id;
    pointerDrag.active = true;
    pointerDrag.lastX = pointerDrag.currentX;
    pointerDrag.lastY = pointerDrag.currentY;
    pointerDrag.ghost = pointerDrag.card.cloneNode(true);
    pointerDrag.ghost.classList.add("drag-ghost");
    pointerDrag.ghost.style.width = `${layoutWidth}px`;
    pointerDrag.ghost.style.height = `${layoutHeight}px`;
    pointerDrag.ghost.style.left = `${rect.left}px`;
    pointerDrag.ghost.style.top = `${rect.top}px`;
    pointerDrag.ghost.style.transform = `translate(${pointerDrag.currentX - pointerDrag.startX}px, ${pointerDrag.currentY - pointerDrag.startY}px)`;
    document.body.appendChild(pointerDrag.ghost);
    document.body.classList.add("mobile-dragging");
    pointerDrag.card.classList.add("dragging-source");
    pointerDrag.card.setPointerCapture?.(event.pointerId);
    updateAutoScroll(() => (pointerDrag?.active ? { x: pointerDrag.lastX, y: pointerDrag.lastY } : null));
  }

  function cleanupPointerDrag({ drop = false, event = null } = {}) {
    if (!pointerDrag) return;
    const drag = pointerDrag;
    pointerDrag = null;
    window.clearTimeout(drag.timer);

    if (drop && drag.active && event) {
      const data = getDropDataFromPoint(event.clientX, event.clientY);
      if (data) moveItem(drag.id, data.date, data.beforeItemId, "drag_touch");
      finishDragClickGuard();
    }

    stopAutoScroll();
    drag.ghost?.remove();
    drag.card.classList.remove("dragging-source");
    if (drag.previousDraggable === null) {
      drag.card.removeAttribute("draggable");
    } else {
      drag.card.setAttribute("draggable", drag.previousDraggable);
    }
    drag.card.releasePointerCapture?.(drag.pointerId);
    document.body.classList.remove("mobile-dragging");
    draggedItemId = null;
    clearDropHighlights();
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const card = event.target.closest("[data-drag-id]");
    if (!card || event.target.closest("a, input, textarea, select, button:not(.item-card)")) return;
    cleanupPointerDrag();
    const previousDraggable = card.getAttribute("draggable");
    card.setAttribute("draggable", "false");
    card.setPointerCapture?.(event.pointerId);
    pointerDrag = {
      id: card.dataset.dragId,
      card,
      previousDraggable,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now(),
      currentX: event.clientX,
      currentY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      active: false,
      ghost: null,
      pointerType: event.pointerType,
      timer: event.pointerType === "mouse" ? null : window.setTimeout(() => startPointerDrag(event), longPressDelay),
    };
  });

  document.addEventListener("pointermove", (event) => {
    if (!pointerDrag) return;
    pointerDrag.currentX = event.clientX;
    pointerDrag.currentY = event.clientY;
    const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
    if (!pointerDrag.active && pointerDrag.pointerType !== "mouse" && Date.now() - pointerDrag.startTime >= longPressDelay) {
      startPointerDrag(event);
    }
    if (!pointerDrag.active && pointerDrag.pointerType !== "mouse" && distance > touchScrollDistance) {
      cleanupPointerDrag();
      return;
    }
    if (!pointerDrag.active && pointerDrag.pointerType === "mouse" && distance > mouseDragDistance) {
      startPointerDrag(event);
    }
    if (!pointerDrag.active) return;
    if (pointerDrag.pointerType !== "mouse") event.preventDefault();
    pointerDrag.lastX = event.clientX;
    pointerDrag.lastY = event.clientY;
    pointerDrag.ghost.style.transform = `translate(${event.clientX - pointerDrag.startX}px, ${event.clientY - pointerDrag.startY}px)`;
    const data = getDropDataFromPoint(event.clientX, event.clientY);
    if (data) markDropZone(data.zone);
  }, { passive: false });

  document.addEventListener("pointerup", (event) => {
    cleanupPointerDrag({ drop: true, event });
  });

  document.addEventListener("pointercancel", (event) => {
    if (pointerDrag?.active) {
      event.preventDefault?.();
      return;
    }
    cleanupPointerDrag();
  });

  document.addEventListener("contextmenu", (event) => {
    if (!pointerDrag?.active) return;
    event.preventDefault();
  });

  document.addEventListener("lostpointercapture", () => {
    if (!pointerDrag?.active) cleanupPointerDrag();
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("'", "&#039;");
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (dragJustHappened) {
      event.preventDefault();
      return;
    }

    const addButton = event.target.closest("[data-action='add']");
    if (addButton) openItemSheet();

    const editButton = event.target.closest("[data-edit]");
    if (editButton) openItemSheet(editButton.dataset.edit);

    const navButton = event.target.closest(".nav-button");
    if (navButton) switchView(navButton.dataset.view);

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      currentFilter = filterButton.dataset.filter;
      renderBasket();
    }

    const closeTarget = event.target.closest("[data-close]");
    if (closeTarget) closeSheet(`${closeTarget.dataset.close}Sheet`);

    const openTripButton = event.target.closest("[data-open-trip]");
    if (openTripButton) openTrip(openTripButton.dataset.openTrip);

    const deleteTripButton = event.target.closest("[data-delete-trip]");
    if (deleteTripButton) deleteTrip(deleteTripButton.dataset.deleteTrip);

    const coverTripButton = event.target.closest("[data-cover-trip]");
    if (coverTripButton) selectTripCover(coverTripButton.dataset.coverTrip);

    const renameParticipantButton = event.target.closest("[data-rename-participant]");
    if (renameParticipantButton) renameParticipant(renameParticipantButton.dataset.renameParticipant);

    const deleteParticipantButton = event.target.closest("[data-delete-participant]");
    if (deleteParticipantButton) deleteParticipant(deleteParticipantButton.dataset.deleteParticipant);

    const saveParticipantButton = event.target.closest("[data-save-participant]");
    if (saveParticipantButton) saveParticipantEditor();

    const cancelParticipantButton = event.target.closest("[data-cancel-participant]");
    if (cancelParticipantButton) closeParticipantEditor();
  });

  document.addEventListener("keydown", (event) => {
    if (!event.target.closest("#participantEditorInput")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      saveParticipantEditor();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeParticipantEditor();
    }
  });

  $("#trainerTripCard").addEventListener("click", () => openTrip("trainer-kazan"));
  $("#trainerTripCard").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTrip("trainer-kazan");
    }
  });
  $("#createTripButton").addEventListener("click", createNewTrip);
  $("#introNextButton").addEventListener("click", () => showIntroSlide(1));
  $("#introSecondNextButton").addEventListener("click", () => showIntroSlide(2));
  $("#introStartButton").addEventListener("click", finishIntro);
  $("#coverInput").addEventListener("change", saveSelectedCover);
  $("#homeShareButton").addEventListener("click", openHomeShareSheet);
  $("#homeInstallAppButton").addEventListener("click", installPwa);
  $("#shareAppButton").addEventListener("click", shareApp);
  $("#feedbackButton").addEventListener("click", () => trackEvent("feedback_channel_opened", { channel: "telegram" }));
  $("#homeButton").addEventListener("click", showHomeScreen);
  $("#itemForm").addEventListener("submit", saveItem);
  $("#deleteItemButton").addEventListener("click", deleteCurrentItem);
  $("#itemForm").elements.link.addEventListener("input", updateOpenLinkButton);
  $("#openLinkButton").addEventListener("click", openItemLink);
  $("#editTripButton").addEventListener("click", openTripSheet);
  $("#tripMeta").addEventListener("click", openTripSheet);
  $("#tripBudgetMeta").addEventListener("click", openTripSheet);
  $("#tripForm").addEventListener("submit", saveTrip);
  $("#tripForm").elements.startDate.addEventListener("change", handleTripStartDateChange);
  $("#tripForm").elements.startDate.addEventListener("input", handleTripStartDateChange);
  $("#tripForm").elements.endDate.addEventListener("change", handleTripEndDateChange);
  $("#tripForm").elements.endDate.addEventListener("input", handleTripEndDateChange);
  $("#addParticipantButton")?.addEventListener("click", addParticipant);
  $("#resetDemoButton").addEventListener("click", resetDemo);
  $("#shareButton").addEventListener("click", openShareSheet);
  $("#installAppButton").addEventListener("click", installPwa);
  $("#downloadEstimateButton").addEventListener("click", downloadEstimate);
  $("#downloadPlanButton").addEventListener("click", downloadPlan);
  $("#shareTripButton").addEventListener("click", shareTrip);
  $("#copyEstimateButton").addEventListener("click", chooseAndDownloadEstimate);
  $("#refreshRatesButton").addEventListener("click", refreshExchangeRates);
  ["currencyAmount", "currencyFrom", "currencyTo"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderCurrencyCalculator);
    $(`#${id}`).addEventListener("change", renderCurrencyCalculator);
  });
  bindDesktopDrag();
  bindPointerDrag();
}

bindEvents();
switchView(currentView);
render();
window.setTimeout(startApp, 520);
refreshExchangeRates();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  trackEvent("pwa_install_prompt_shown");
});

window.addEventListener("appinstalled", () => {
  trackEvent("pwa_installed");
  deferredInstallPrompt = null;
});

window.addEventListener("pagehide", trackOnboardingExit);

if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
