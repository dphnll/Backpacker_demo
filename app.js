const STORAGE_KEY = "backpacker.mvp.v1";
const TRIPS_STORAGE_KEY = "backpacker.trips.v1";
const ACTIVE_TRIP_STORAGE_KEY = "backpacker.activeTrip.v1";
const VIEW_STORAGE_KEY = "backpacker.currentView.v1";
const ONBOARDING_STORAGE_KEY = "backpacker.onboarding.v1";
const ANALYTICS_USER_KEY = "backpacker.analytics.user.v1";
const ANALYTICS_LAST_OPEN_KEY = "backpacker.analytics.lastOpen.v1";
const ANALYTICS_CONFIG = window.BACKPACKER_ANALYTICS || {};
let deferredInstallPrompt = null;

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
  ["fixed", "Забронировано"],
  ["want", "Хочу"],
  ["maybe", "Думаю"],
  ["backup", "Запасной"],
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

function getTripPeriodStatus(trip = state?.trip, todayValue = new Date()) {
  if (!trip?.startDate || !trip?.endDate) return "no_dates";
  const today = new Date(todayValue);
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "invalid_dates";
  if (today < start) return "before_trip";
  if (today > end) return "after_trip";
  return "during_trip";
}

function getAnalyticsContext(extra = {}) {
  const activeTrip = state?.trip || {};
  const trips = Array.isArray(tripStore?.trips) ? tripStore.trips : [];
  const userTrips = trips.filter((entry) => !entry.isDemo);
  const items = Array.isArray(state?.items) ? state.items : [];
  const dates = activeTrip.startDate && activeTrip.endDate ? getTripDates() : [];
  return {
    user_id: getOrCreateAnalyticsUserId(),
    session_id: analyticsSessionId,
    screen: currentScreen,
    view: currentView,
    display_mode: getDisplayMode(),
    trip_count: userTrips.length,
    item_count: items.length,
    days_count: dates.length,
    currency: activeTrip.currency || "RUB",
    has_budget: Boolean(parseMoney(activeTrip.budgetLimit)),
    has_dates: Boolean(activeTrip.startDate && activeTrip.endDate),
    trip_period: getTripPeriodStatus(activeTrip),
    is_demo_trip: activeTrip.id === "trainer-kazan",
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
    distinct_id: payload.user_id,
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
  trackEvent("app_open", {
    is_returning_user: Boolean(lastOpen),
    last_open_days_ago: lastOpen ? Math.round((new Date(today) - new Date(lastOpen)) / 86400000) : null,
  });
  if (lastOpen && lastOpen !== today) trackEvent("return_next_day");
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

function normalizeState(nextState) {
  const normalized = nextState?.trip && Array.isArray(nextState.items) ? nextState : structuredClone(seedState);
  normalized.items = normalized.items.map((item, index) => ({
    order: index,
    ...item,
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
    trackEvent("currency_rates_refresh", { source: "live" });
  } catch {
    ratesSource = "demo";
    ratesUpdatedAt = null;
    renderCurrencyCalculator();
    renderRatesStatus("Не удалось подтянуть реальный курс, пока использую демо-курс.");
    trackEvent("currency_rates_refresh", { source: "demo", failed: true });
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

function getStatusIcon(status) {
  return {
    paid: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M9 9.8h5.2M9 12h4.3M9 14.2h3.5"></path></svg>`,
    fixed: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="9" rx="2"></rect><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"></path></svg>`,
    want: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7.6 3.9 3.9 0 0 1 19 9.9C19 14.6 12 19 12 19z"></path></svg>`,
    maybe: "?",
    backup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M8.2 14.2a6 6 0 1 1 7.6 0c-.8.6-1.3 1.4-1.5 2.3H9.7c-.2-.9-.7-1.7-1.5-2.3z"></path></svg>`,
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
  const paid = state.items.reduce((sum, item) => sum + parseMoney(item.paidAmount), 0);
  const fixed = state.items
    .filter((item) => ["paid", "fixed"].includes(item.status))
    .reduce((sum, item) => sum + parseMoney(item.price), 0);
  const optional = state.items
    .filter((item) => ["want", "maybe"].includes(item.status))
    .reduce((sum, item) => sum + parseMoney(item.price), 0);
  const possible = state.items.filter(isActiveCost).reduce((sum, item) => sum + parseMoney(item.price), 0);
  const remaining = parseMoney(state.trip.budgetLimit) - possible;
  return { paid, fixed, optional, possible, remaining };
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
    ["fixed", "Фикс"],
    ["want", "Хочу"],
    ["maybe", "Думаю"],
    ["backup", "Запас"],
  ];
  $("#filterRow").innerHTML = filters
    .map(([key, label]) => `<button class="chip ${currentFilter === key ? "active" : ""}" data-filter="${key}" type="button">${label}</button>`)
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
      <div class="metric-card"><span>Забронировано</span><strong>${formatMoney(totals.fixed)}</strong></div>
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
  const time = item.startTime || "без времени";
  const duration = item.durationMinutes ? `${item.durationMinutes} мин` : "";
  const price = parseMoney(item.price) ? formatMoney(item.price) : "без цены";
  const date = item.date ? formatDate(item.date) : "без даты";
  const note = item.notes ? `<p class="item-note">${escapeHtml(item.notes)}</p>` : "";
  const link = item.link
    ? `<a class="item-link" href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">открыть ссылку</a>`
    : "";
  return `
    <button class="item-card type-${item.type}" data-edit="${item.id}" data-drag-id="${item.id}" draggable="true" type="button">
      <span class="tile-icon" aria-hidden="true">
        <span>${typeIcons[item.type] || typeIcons.other}</span>
        <small>${getTypeLabel(item.type)}</small>
      </span>
      <div class="item-body">
        <div class="item-top">
          <span class="item-title">${escapeHtml(item.title)}</span>
          <span class="status-icon status-${item.status}" title="${escapeAttr(getStatusLabel(item.status))}" aria-label="${escapeAttr(getStatusLabel(item.status))}">${getStatusIcon(item.status)}</span>
        </div>
        <div class="item-meta">
          <span>${time}</span>
          ${duration ? `<span>${duration}</span>` : ""}
          <span class="price-pill">${price}</span>
          <span>${date}</span>
          ${link ? `<span>${link}</span>` : ""}
        </div>
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
  }
  updateOpenLinkButton();
  openSheet("itemSheet");
  const trackedItem = itemId ? state.items.find((entry) => entry.id === itemId) : null;
  trackEvent("item_sheet_open", {
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
  form.elements.date.innerHTML = `<option value="">Без даты</option>${getTripDates()
    .map((date, index) => `<option value="${date}">День ${index + 1} · ${formatDate(date)}</option>`)
    .join("")}`;
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
  trackEvent(isNew ? "item_create" : "item_update", {
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
  });
}

function getNextOrder(date) {
  const orders = state.items
    .filter((item) => (item.date || "") === (date || ""))
    .map((item) => Number(item.order))
    .filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function moveItem(itemId, targetDate, beforeItemId = null) {
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
  trackEvent("item_drag", {
    item_type: moving.type,
    item_status: moving.status,
    from_bucket: previousDate ? "day" : "undated",
    to_bucket: moving.date ? "day" : "undated",
    reordered_inside_bucket: previousDate === moving.date,
    dropped_before_item: Boolean(beforeItemId),
  });
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
  trackEvent("item_delete", {
    item_type: item?.type || null,
    item_status: item?.status || null,
  });
}

function openTripSheet() {
  const form = $("#tripForm");
  Object.entries(state.trip).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  openSheet("tripSheet");
  trackEvent("trip_sheet_open");
}

function saveTrip(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
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
  trackEvent("trip_save", {
    currency_changed: previousCurrency !== data.currency,
    has_title: Boolean(state.trip.title),
    has_destination: Boolean(state.trip.destination),
    has_preferences: Boolean(state.trip.preferencesText),
  });
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
  trackEvent("trainer_reset");
}

function openShareSheet() {
  renderSharePreview();
  openSheet("shareSheet");
  trackEvent("share_sheet_open");
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

function buildEstimateCsv() {
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
  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(";")).join("\n");
}

function buildPlanCsv() {
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

function downloadEstimate() {
  const name = `${slugifyFileName(state.trip.title)}-estimate.csv`;
  downloadTextFile(name, `\uFEFF${buildEstimateCsv()}`, "text/csv;charset=utf-8");
  showToast("Смета скачана");
  trackEvent("download_estimate", { format: "csv" });
}

function downloadPlan() {
  const name = `${slugifyFileName(state.trip.title)}-plan.csv`;
  downloadTextFile(name, `\uFEFF${buildPlanCsv()}`, "text/csv;charset=utf-8");
  showToast("План скачан");
  trackEvent("download_plan", { format: "csv" });
}

function chooseExportFormat() {
  return window.confirm("Выберите формат:\nОК — CSV для Excel/Google Sheets\nОтмена — PDF") ? "csv" : "pdf";
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

function buildEstimatePdfLines() {
  const lines = [
    { type: "title", text: "Смета поездки" },
    { type: "meta", text: `${state.trip.title} · ${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)}` },
    { type: "gap" },
  ];
  [...state.items]
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || sortItems(a, b))
    .forEach((item) => {
      lines.push({ type: "strong", text: item.title });
      lines.push({
        type: "text",
        text: `${getTypeLabel(item.type)} · ${getStatusLabel(item.status)} · ${item.date ? formatDate(item.date) : "без даты"} ${item.startTime || ""}`,
      });
      lines.push({ type: "text", text: `Цена: ${formatMoney(item.price)} · Оплачено: ${formatMoney(item.paidAmount)}` });
      if (item.link) lines.push({ type: "muted", text: item.link });
      lines.push({ type: "gap" });
    });
  return lines;
}

function buildPlanPdfLines() {
  const lines = [
    { type: "title", text: "План по дням" },
    { type: "meta", text: `${state.trip.title} · ${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)}` },
    { type: "gap" },
  ];
  getTripDates().forEach((date, index) => {
    const items = state.items.filter((item) => item.date === date && item.status !== "skipped").sort(sortItems);
    lines.push({ type: "section", text: `День ${index + 1} · ${formatDate(date)}` });
    if (!items.length) lines.push({ type: "muted", text: "Пока пусто" });
    items.forEach((item) => {
      lines.push({ type: "strong", text: `${item.startTime ? `${item.startTime} · ` : ""}${item.title}` });
      lines.push({ type: "text", text: `${getTypeLabel(item.type)} · ${getStatusLabel(item.status)} · ${formatMoney(item.price)}` });
      if (item.link) lines.push({ type: "muted", text: item.link });
    });
    lines.push({ type: "gap" });
  });
  return lines;
}

async function downloadPdfFile(fileName, lines, previewWindow = null) {
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

  for (const line of lines) {
    if (line.type === "gap") {
      y += 10;
      continue;
    }
    const isTitle = line.type === "title";
    const isSection = line.type === "section";
    const isStrong = line.type === "strong";
    const isMuted = line.type === "muted";
    const fontSize = isTitle ? 22 : isSection ? 17 : 12;
    const lineHeight = isTitle ? 28 : isSection ? 23 : 17;
    ctx.font = `${isTitle || isSection || isStrong ? 700 : 400} ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = isMuted ? "#66716f" : "#1f2423";
    const height = Math.max(lineHeight, drawWrappedText(ctx, line.text, x, y, maxWidth, lineHeight));
    y += height + (isTitle || isSection ? 8 : 3);
    if (y > pageHeight - 56) {
      await commitPage();
      y = startPage();
    }
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
  if (chooseExportFormat() === "csv") {
    downloadEstimate();
  } else {
    const previewWindow = window.open("", "_blank");
    previewWindow?.document.write("<p>Готовим PDF...</p>");
    await downloadPdfFile(`${slugifyFileName(state.trip.title)}-estimate.pdf`, buildEstimatePdfLines(), previewWindow);
    trackEvent("download_estimate", { format: "pdf" });
  }
}

async function chooseAndDownloadPlan() {
  if (chooseExportFormat() === "csv") {
    downloadPlan();
  } else {
    const previewWindow = window.open("", "_blank");
    previewWindow?.document.write("<p>Готовим PDF...</p>");
    await downloadPdfFile(`${slugifyFileName(state.trip.title)}-plan.pdf`, buildPlanPdfLines(), previewWindow);
    trackEvent("download_plan", { format: "pdf" });
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
      trackEvent("share_trip", { method: "web_share" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(`${text}\n\n${window.location.href}`);
  showToast("Ссылка и сводка скопированы");
  trackEvent("share_trip", { method: "copy_fallback" });
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
      trackEvent("share_app", { method: "web_share" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(`${shareData.text}\n${url}`);
  showToast("Ссылка на Backpacker скопирована");
  trackEvent("share_app", { method: "copy_fallback" });
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
  trackEvent("external_link_open");
}

async function installPwa() {
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    showToast("Приложение уже установлено");
    trackEvent("pwa_install_click", { already_installed: true });
    return;
  }

  if (deferredInstallPrompt) {
    trackEvent("pwa_install_click", { prompt_available: true });
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    trackEvent("pwa_install_choice", { outcome: choice?.outcome || "unknown" });
    deferredInstallPrompt = null;
    return;
  }

  showToast("Откройте меню браузера и выберите «Добавить на главный экран»");
  trackEvent("pwa_install_click", { prompt_available: false });
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
  trackEvent("onboarding_slide", { slide_index: index });
}

function hideAppSplash() {
  $("#appSplash")?.classList.add("hidden");
}

function showIntroScreen() {
  currentScreen = "intro";
  $("#introScreen").classList.remove("hidden");
  $("#homeScreen").classList.add("hidden");
  $(".app-shell").classList.add("hidden");
  trackEvent("onboarding_start");
  showIntroSlide(0);
}

function finishIntro() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "seen");
  } catch {
    // The app should still open when storage is unavailable.
  }
  trackEvent("onboarding_done");
  showHomeScreen();
}

function startApp() {
  hideAppSplash();
  trackAppOpen();
  const forceIntro = new URLSearchParams(window.location.search).get("intro") === "1";
  let onboardingSeen = false;
  try {
    onboardingSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "seen";
  } catch {
    onboardingSeen = false;
  }

  if (forceIntro || !onboardingSeen) {
    showIntroScreen();
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
  trackEvent("home_open");
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
  const period = getTripPeriodStatus(state.trip);
  trackEvent(entry.isDemo ? "trainer_open" : "trip_open", {
    trip_period: period,
    has_custom_cover: Boolean(entry.coverDataUrl),
  });
  if (!entry.isDemo && period !== "no_dates" && period !== "invalid_dates") {
    trackEvent(`trip_open_${period}`);
  }
}

function createNewTrip() {
  const entry = createBlankTripEntry();
  tripStore.trips.push(entry);
  persistTripStore(tripStore);
  openTrip(entry.id);
  openTripSheet();
  trackEvent("trip_create", {
    trip_count_after_create: tripStore.trips.filter((trip) => !trip.isDemo).length,
  });
  if (tripStore.trips.filter((trip) => !trip.isDemo).length >= 2) trackEvent("second_trip_create");
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
    trackEvent("trip_cover_update");
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
  trackEvent("trip_delete");
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
  if (previousView !== view) trackEvent("view_change", { from_view: previousView, to_view: view });
}

function getDropDataFromPoint(x, y, fallbackTarget = null) {
  const target = document.elementFromPoint(x, y) || fallbackTarget;
  const zone = target?.closest?.("[data-drop-date]");
  if (!zone) return null;
  const targetCard = target.closest?.("[data-drag-id]");
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

function finishDragClickGuard() {
  dragJustHappened = true;
  window.setTimeout(() => {
    dragJustHappened = false;
  }, 250);
}

function bindDesktopDrag() {
  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-drag-id]");
    if (!card) return;
    draggedItemId = card.dataset.dragId;
    card.classList.add("dragging-source");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedItemId);
  });

  document.addEventListener("dragover", (event) => {
    if (!draggedItemId) return;
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (!data) return;
    event.preventDefault();
    markDropZone(data.zone);
  });

  document.addEventListener("drop", (event) => {
    if (!draggedItemId) return;
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (!data) return;
    event.preventDefault();
    moveItem(draggedItemId, data.date, data.beforeItemId);
    finishDragClickGuard();
  });

  document.addEventListener("dragend", () => {
    $$(".dragging-source").forEach((element) => element.classList.remove("dragging-source"));
    clearDropHighlights();
    draggedItemId = null;
  });
}

function bindPointerDrag() {
  const longPressDelay = 420;
  const cancelDistance = 10;

  function startPointerDrag(event) {
    if (!pointerDrag || pointerDrag.active) return;
    const rect = pointerDrag.card.getBoundingClientRect();
    draggedItemId = pointerDrag.id;
    pointerDrag.active = true;
    pointerDrag.lastX = pointerDrag.startX;
    pointerDrag.lastY = pointerDrag.startY;
    pointerDrag.ghost = pointerDrag.card.cloneNode(true);
    pointerDrag.ghost.classList.add("drag-ghost");
    pointerDrag.ghost.style.width = `${rect.width}px`;
    pointerDrag.ghost.style.left = `${rect.left}px`;
    pointerDrag.ghost.style.top = `${rect.top}px`;
    document.body.appendChild(pointerDrag.ghost);
    document.body.classList.add("mobile-dragging");
    pointerDrag.card.classList.add("dragging-source");
    pointerDrag.card.setPointerCapture?.(event.pointerId);
    updateAutoScroll();
  }

  function stopAutoScroll() {
    if (autoScrollFrame) window.cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }

  function updateAutoScroll() {
    stopAutoScroll();
    const tick = () => {
      if (!pointerDrag?.active) {
        stopAutoScroll();
        return;
      }

      const edge = 72;
      const maxSpeed = 18;
      const { innerHeight, innerWidth } = window;
      const { lastX, lastY } = pointerDrag;
      let scrollY = 0;

      if (lastY < edge) scrollY = -Math.ceil(((edge - lastY) / edge) * maxSpeed);
      else if (lastY > innerHeight - edge) scrollY = Math.ceil(((lastY - (innerHeight - edge)) / edge) * maxSpeed);
      if (scrollY) window.scrollBy(0, scrollY);

      const horizontalZone = document.elementFromPoint(lastX, lastY)?.closest?.(".day-items, .basket-grid-list");
      if (horizontalZone) {
        let scrollX = 0;
        const rect = horizontalZone.getBoundingClientRect();
        if (lastX < rect.left + edge) scrollX = -Math.ceil(((rect.left + edge - lastX) / edge) * maxSpeed);
        else if (lastX > rect.right - edge) scrollX = Math.ceil(((lastX - (rect.right - edge)) / edge) * maxSpeed);
        if (scrollX) horizontalZone.scrollBy(scrollX, 0);
      } else if (lastX < edge) {
        window.scrollBy(-8, 0);
      } else if (lastX > innerWidth - edge) {
        window.scrollBy(8, 0);
      }

      autoScrollFrame = window.requestAnimationFrame(tick);
    };
    autoScrollFrame = window.requestAnimationFrame(tick);
  }

  function cleanupPointerDrag({ drop = false, event = null } = {}) {
    if (!pointerDrag) return;
    const drag = pointerDrag;
    pointerDrag = null;
    window.clearTimeout(drag.timer);

    if (drop && drag.active && event) {
      const data = getDropDataFromPoint(event.clientX, event.clientY);
      if (data) moveItem(drag.id, data.date, data.beforeItemId);
      finishDragClickGuard();
    }

    stopAutoScroll();
    drag.ghost?.remove();
    drag.card.classList.remove("dragging-source");
    if (drag.restoreDraggable) drag.card.setAttribute("draggable", "true");
    drag.card.releasePointerCapture?.(drag.pointerId);
    document.body.classList.remove("mobile-dragging");
    draggedItemId = null;
    clearDropHighlights();
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    const card = event.target.closest("[data-drag-id]");
    if (!card || event.target.closest("a, input, textarea, select, button:not(.item-card)")) return;
    cleanupPointerDrag();
    card.setAttribute("draggable", "false");
    pointerDrag = {
      id: card.dataset.dragId,
      card,
      restoreDraggable: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      active: false,
      ghost: null,
      timer: window.setTimeout(() => startPointerDrag(event), longPressDelay),
    };
  });

  document.addEventListener("pointermove", (event) => {
    if (!pointerDrag) return;
    const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
    if (!pointerDrag.active && distance > cancelDistance) {
      cleanupPointerDrag();
      return;
    }
    if (!pointerDrag.active) return;
    event.preventDefault();
    pointerDrag.lastX = event.clientX;
    pointerDrag.lastY = event.clientY;
    pointerDrag.ghost.style.transform = `translate(${event.clientX - pointerDrag.startX}px, ${event.clientY - pointerDrag.startY}px)`;
    const data = getDropDataFromPoint(event.clientX, event.clientY);
    if (data) markDropZone(data.zone);
  }, { passive: false });

  document.addEventListener("pointerup", (event) => {
    cleanupPointerDrag({ drop: true, event });
  });

  document.addEventListener("pointercancel", () => {
    cleanupPointerDrag();
  });

  document.addEventListener("contextmenu", (event) => {
    if (!pointerDrag?.active) return;
    event.preventDefault();
  });

  document.addEventListener("lostpointercapture", () => {
    if (pointerDrag?.active) cleanupPointerDrag();
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
  $("#homeShareButton").addEventListener("click", shareApp);
  $("#feedbackButton").addEventListener("click", () => trackEvent("telegram_click"));
  $("#homeButton").addEventListener("click", showHomeScreen);
  $("#itemForm").addEventListener("submit", saveItem);
  $("#deleteItemButton").addEventListener("click", deleteCurrentItem);
  $("#itemForm").elements.link.addEventListener("input", updateOpenLinkButton);
  $("#openLinkButton").addEventListener("click", openItemLink);
  $("#editTripButton").addEventListener("click", openTripSheet);
  $("#tripMeta").addEventListener("click", openTripSheet);
  $("#tripBudgetMeta").addEventListener("click", openTripSheet);
  $("#tripForm").addEventListener("submit", saveTrip);
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
});

window.addEventListener("appinstalled", () => {
  trackEvent("pwa_installed");
  deferredInstallPrompt = null;
});

if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
