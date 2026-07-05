const STORAGE_KEY = "backpacker.mvp.v1";
const TRIPS_STORAGE_KEY = "backpacker.trips.v1";
const ACTIVE_TRIP_STORAGE_KEY = "backpacker.activeTrip.v1";
const VIEW_STORAGE_KEY = "backpacker.currentView.v1";
const SHARE_RECORDS_STORAGE_KEY = "backpacker.shareRecords.v1";
const ONBOARDING_STORAGE_KEY = "backpacker.onboarding.v1";
const HOME_TRAINER_VISIBILITY_KEY = "backpacker.home.trainer.hidden.v1";
const ANALYTICS_USER_KEY = "backpacker.analytics.user.v1";
const ANALYTICS_LAST_OPEN_KEY = "backpacker.analytics.lastOpen.v1";
const ANALYTICS_MILESTONES_KEY = "backpacker.analytics.milestones.v1";
const DONATION_STATE_KEY = "backpacker.donation.state.v1";
const ANALYTICS_CONFIG = window.BACKPACKER_ANALYTICS || {};
const ANALYTICS_SCHEMA_VERSION = "2026-07-01.1";
const ANALYTICS_DEFINITION_VERSION = "2026-06-25.1";
const ONBOARDING_VERSION = "2026-06-25.1";
const ONBOARDING_PREVIEW_PARAM = "onboarding";
const TRAINER_VERSION = "2026-06-25.1";
const APP_VERSION = "1.1.2.19";
const APP_RELEASE_SUMMARY = "появился AI-черновик поездки из текста или голоса: Backpacker раскладывает идеи по дням и парковке.";
const IOS_INSTALL_DISMISS_KEY = `backpacker.iosInstall.dismissed.${APP_VERSION}`;
const TRIP_SHARE_SCHEMA_VERSION = "trip_share.v1";
const TRIP_SHARE_SYNC_DEBOUNCE_MS = 1200;
const TRIP_DRAFT_AI_SCHEMA_VERSION = "trip_draft_ai.v1";
const DONATION_FLOW_ENABLED = false;
const DONATION_URL = ANALYTICS_CONFIG.donationUrl || "https://t.me/bckpckrbot?start=donate";
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
let donationState = loadDonationState();
let donationPromptTimer = null;
let donationSheetHistoryArmed = false;
let donationIgnoreNextPop = false;
let donationDragStartY = 0;
let donationDragCurrentY = 0;
let cardCopySheetHistoryArmed = false;
let cardCopyIgnoreNextPop = false;
let itemFormOpenedAt = 0;
let analyticsIsReturningUser = false;
let cardCopyState = {
  sourceItemId: "",
  scope: "",
  targetTripId: "",
  targetDate: null,
  isSubmitting: false,
};
let tripPdfGenerating = false;
let shareProposalContext = null;
let expenseProposalDraft = { itemId: "", participantMode: "", participantId: "", proposedParticipantName: "", amount: 0 };
let itemProposalDraft = { title: "", itemType: "idea", link: "", price: "", notes: "" };
let authorExpenseProposals = [];
let authorItemProposals = [];
let userProfile = { loaded: false, loading: false, displayName: "", error: "" };
let tripDraftAiState = { mode: "choice", inputMode: "text", isBusy: false, isRecording: false, draft: null, mediaRecorder: null, chunks: [] };
let pendingProfileAction = null;
let profileSaving = false;
const resolvingExpenseProposalIds = new Set();
const resolvingItemProposalIds = new Set();
let itemProposalSubmitting = false;

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
let shareRecords = loadShareRecords();
let receivedShareCards = [];
let receivedSharesLoaded = false;
let receivedSharesLoading = false;
let readOnlyShare = null;
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
let supabaseClient = null;
let tripShareSyncTimer = null;
let tripShareSyncInFlight = false;
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

function isAppleMobileBrowser() {
  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  return /iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function shouldShowIosInstallOnboarding() {
  if (!isAppleMobileBrowser() || getDisplayMode() !== "browser") return false;
  try {
    return localStorage.getItem(IOS_INSTALL_DISMISS_KEY) !== "true";
  } catch {
    return true;
  }
}

function renderIosInstallOnboarding() {
  const card = $("#iosInstallCard");
  if (!card) return;
  card.classList.toggle("hidden", !shouldShowIosInstallOnboarding());
}

function dismissIosInstallOnboarding() {
  try {
    localStorage.setItem(IOS_INSTALL_DISMISS_KEY, "true");
  } catch {}
  $("#iosInstallCard")?.classList.add("hidden");
  trackEvent("ios_install_onboarding_dismissed", { app_version: APP_VERSION });
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
  analyticsIsReturningUser = Boolean(lastOpen);
  trackEvent("app_opened", {
    is_returning_user: analyticsIsReturningUser,
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

function loadShareRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARE_RECORDS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistShareRecords() {
  localStorage.setItem(SHARE_RECORDS_STORAGE_KEY, JSON.stringify(shareRecords));
}

function getSupabaseConfig() {
  return window.BACKPACKER_SUPABASE || {};
}

function getTripShareFunctionUrl() {
  const config = getSupabaseConfig();
  if (config.tripShareFunctionUrl) return config.tripShareFunctionUrl;
  if (!config.url) return "";
  return `${String(config.url).replace(/\/+$/, "")}/functions/v1/trip-share`;
}

function getTripDraftAiFunctionUrl() {
  const config = getSupabaseConfig();
  if (config.tripDraftAiFunctionUrl) return config.tripDraftAiFunctionUrl;
  if (!config.url) return "";
  return `${String(config.url).replace(/\/+$/, "")}/functions/v1/trip-draft-ai`;
}

function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && window.supabase?.createClient);
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseClient;
}

function getSharePayloadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get("share");
  if (queryToken) return queryToken;
  const hash = window.location.hash || "";
  if (!hash.startsWith("#share=")) return "";
  return hash.slice("#share=".length);
}

async function ensureSupabaseOwnerSession() {
  const client = getSupabaseClient();
  if (!client) throw new Error("supabase_not_configured");
  const current = await client.auth.getSession();
  if (current.data.session?.access_token) return current.data.session.access_token;
  const created = await client.auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) throw created.error || new Error("anonymous_auth_failed");
  return created.data.session.access_token;
}

async function getExistingSupabaseAccessToken() {
  const client = getSupabaseClient();
  if (!client) return "";
  const current = await client.auth.getSession();
  return current.data.session?.access_token || "";
}

async function callTripShareFunction(action, payload = {}, { requireOwner = false, useExistingSession = false } = {}) {
  const config = getSupabaseConfig();
  const url = getTripShareFunctionUrl();
  if (!url || !config.anonKey) throw new Error("supabase_not_configured");
  const headers = {
    "Content-Type": "application/json",
    apikey: config.anonKey,
  };
  if (requireOwner) {
    headers.Authorization = `Bearer ${await ensureSupabaseOwnerSession()}`;
  } else if (useExistingSession) {
    const token = await getExistingSupabaseAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `trip_share_${action}_failed`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function callTripDraftAiFunction(action, payload = {}) {
  const config = getSupabaseConfig();
  const url = getTripDraftAiFunctionUrl();
  if (!url || !config.anonKey) throw new Error("supabase_not_configured");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
      Authorization: `Bearer ${await ensureSupabaseOwnerSession()}`,
    },
    cache: "no-store",
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `trip_draft_ai_${action}_failed`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function normalizeDisplayName(value = "") {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDisplayNameError(value = "") {
  const displayName = normalizeDisplayName(value);
  if (!displayName) return "Введите имя или ник";
  if (displayName.length > 40) return "Имя или ник должны быть не длиннее 40 символов";
  return "";
}

async function loadMyProfile({ createSession = false } = {}) {
  if (!isSupabaseConfigured()) return null;
  if (userProfile.loading) return userProfile.displayName ? { displayName: userProfile.displayName } : null;
  userProfile.loading = true;
  try {
    const payload = await callTripShareFunction("get_my_profile", {}, createSession ? { requireOwner: true } : { useExistingSession: true });
    userProfile = {
      loaded: true,
      loading: false,
      displayName: payload.profile?.displayName || "",
      error: "",
    };
    renderHomeProfile();
    renderShareRoleBanner();
    return payload.profile || null;
  } catch {
    userProfile = { ...userProfile, loaded: false, loading: false, error: "Не удалось загрузить имя пользователя" };
    renderHomeProfile();
    return null;
  }
}

async function saveMyProfile(displayName) {
  const normalized = normalizeDisplayName(displayName);
  const error = getDisplayNameError(normalized);
  if (error) throw new Error(error);
  const payload = await callTripShareFunction("upsert_my_profile", { displayName: normalized }, { requireOwner: true });
  userProfile = {
    loaded: true,
    loading: false,
    displayName: payload.profile?.displayName || normalized,
    error: "",
  };
  renderHomeProfile();
  renderShareRoleBanner();
  return userProfile;
}

function renderHomeProfile() {
  const button = $("#homeProfileButton");
  const name = $("#homeProfileName");
  if (!button || !name) return;
  const shouldShow = isSupabaseConfigured() && currentScreen === "home";
  button.classList.toggle("hidden", !shouldShow);
  name.textContent = userProfile.displayName || "Добавьте имя или ник";
}

function getHomeTripStatusLabel(tripId) {
  const record = shareRecords[tripId];
  if (record?.shareId && !record.revoked) return "Групповая (автор)";
  return "Личная";
}

function renderProfileSheet() {
  const input = $("#profileDisplayNameInput");
  const error = $("#profileError");
  const button = $("#profileSaveButton");
  if (input && document.activeElement !== input) input.value = userProfile.displayName || input.value || "";
  if (error) error.textContent = userProfile.error || "";
  if (button) {
    button.disabled = profileSaving;
    button.textContent = profileSaving ? "Сохраняем..." : (pendingProfileAction ? "Сохранить и продолжить" : "Сохранить");
  }
}

function openProfileSheet(action = null) {
  pendingProfileAction = action;
  userProfile.error = "";
  renderProfileSheet();
  openSheet("profileSheet");
  window.setTimeout(() => $("#profileDisplayNameInput")?.focus(), 80);
}

async function requireProfileForSharedAction(entryPoint, action) {
  if (!isSupabaseConfigured()) {
    await action();
    return;
  }
  if (userProfile.displayName) {
    await action();
    return;
  }
  const profile = await loadMyProfile({ createSession: true });
  if (profile?.displayName) {
    await action();
    return;
  }
  openProfileSheet({ entryPoint, action });
}

async function submitProfileForm(event) {
  event.preventDefault();
  if (profileSaving) return;
  const input = $("#profileDisplayNameInput");
  const value = input?.value || "";
  const validationError = getDisplayNameError(value);
  if (validationError) {
    userProfile.error = validationError;
    renderProfileSheet();
    return;
  }
  profileSaving = true;
  userProfile.error = "";
  renderProfileSheet();
  try {
    await saveMyProfile(value);
    closeSheet("profileSheet");
    showToast("Имя обновлено");
    const action = pendingProfileAction?.action;
    pendingProfileAction = null;
    if (typeof action === "function") await action();
  } catch {
    userProfile.error = "Не удалось сохранить имя. Проверьте соединение и попробуйте ещё раз.";
    renderProfileSheet();
  } finally {
    profileSaving = false;
    renderProfileSheet();
  }
}

async function loadReadOnlyShareFromUrl() {
  const token = getSharePayloadFromUrl();
  if (!token) return null;
  if (!isSupabaseConfigured()) {
    return { invalid: true, state: normalizeState(structuredClone(seedState)), options: { includeBudget: false } };
  }
  try {
    const payload = await callTripShareFunction("read", { token }, { useExistingSession: true });
    const nextState = normalizeState(payload.state);
    return {
      shareId: payload.shareId || "",
      sourceTripId: payload.tripId || nextState.trip.id,
      title: nextState.trip.title || "Поездка",
      destination: nextState.trip.destination || "",
      updatedAt: payload.updatedAt || new Date().toISOString(),
      options: {
        includeBudget: payload.includeBudget !== false,
      },
      isOwner: Boolean(payload.isOwner),
      isAuthor: Boolean(payload.isAuthor ?? payload.isOwner),
      isSaved: Boolean(payload.isSaved),
      authorDisplayName: payload.authorDisplayName || "",
      currentUserDisplayName: payload.currentUserDisplayName || "",
      profileRequired: Boolean(payload.profileRequired),
      source: "public_link",
      state: nextState,
    };
  } catch {
    return { invalid: true, state: normalizeState(structuredClone(seedState)), options: { includeBudget: false } };
  }
}

function isReadOnlyMode() {
  return Boolean(readOnlyShare);
}

function canShowBudget() {
  return !isReadOnlyMode() || readOnlyShare.options?.includeBudget !== false;
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
  normalized.items = normalized.items.map((item, index) => {
    const participantId = participantIds.has(item.participantId) ? item.participantId : selfParticipant.id;
    const price = parseMoney(item.price);
    const sourceAllocations = Array.isArray(item.allocations) ? item.allocations : [];
    const allocations = sourceAllocations
      .map((allocation) => ({
        participantId: participantIds.has(allocation.participantId) ? allocation.participantId : "",
        amount: parseMoney(allocation.amount),
      }))
      .filter((allocation) => allocation.participantId && allocation.amount > 0);
    if (!allocations.length && price > 0) allocations.push({ participantId, amount: price });
    const allocationTotal = allocations.reduce((sum, allocation) => sum + parseMoney(allocation.amount), 0);
    if (allocations.length && allocationTotal !== price) {
      const delta = price - allocationTotal;
      allocations[allocations.length - 1].amount = Math.max(0, allocations[allocations.length - 1].amount + delta);
    }
    return {
      order: index,
      ...item,
      price,
      paidAmount: parseMoney(item.paidAmount),
      participantId,
      allocations,
    };
  });
  return normalized;
}

function saveState() {
  if (isReadOnlyMode()) return;
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
  schedulePublishedTripSync();
}

function persistTripStore(store = tripStore) {
  localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(store));
}

function getDefaultDonationState() {
  return {
    firstPromptShownAt: null,
    lastPromptDismissedAt: null,
    donationCtaClickedAt: null,
    donatedAt: null,
    promptShowCount: 0,
  };
}

function normalizeDonationState(nextState = {}) {
  const defaults = getDefaultDonationState();
  return {
    firstPromptShownAt: nextState.firstPromptShownAt || defaults.firstPromptShownAt,
    lastPromptDismissedAt: nextState.lastPromptDismissedAt || defaults.lastPromptDismissedAt,
    donationCtaClickedAt: nextState.donationCtaClickedAt || defaults.donationCtaClickedAt,
    donatedAt: nextState.donatedAt || defaults.donatedAt,
    promptShowCount: Number(nextState.promptShowCount) || defaults.promptShowCount,
  };
}

function loadDonationState() {
  try {
    return normalizeDonationState(JSON.parse(localStorage.getItem(DONATION_STATE_KEY) || "{}"));
  } catch {
    return getDefaultDonationState();
  }
}

function saveDonationState() {
  try {
    localStorage.setItem(DONATION_STATE_KEY, JSON.stringify(donationState));
  } catch {
    // Donation prompts are optional; planning must keep working if storage fails.
  }
}

function formatMoney(value = 0) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString("ru-RU")} ${currencySymbol(state.trip.currency)}`;
}

function formatBudgetMoney(value = 0) {
  return canShowBudget() ? formatMoney(value) : "Скрыто";
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
    allocations: getItemAllocations(item).map((allocation) => ({
      ...allocation,
      amount: convertMoney(allocation.amount, fromCurrency, toCurrency),
    })),
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

function formatTripCardDateRange(startDate, endDate) {
  if (startDate && endDate) return `${formatDate(startDate)}-${formatDate(endDate)}`;
  if (startDate) return `с ${formatDate(startDate)}`;
  if (endDate) return `до ${formatDate(endDate)}`;
  return "Даты не заданы";
}

function formatDateForInput(dateString) {
  if (!dateString) return "";
  const [year, month, day] = String(dateString).split("-");
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function parseDateFromInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    const date = new Date(`${year}-${month}-${day}T12:00:00`);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== Number(year) ||
      date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day)
    ) {
      return "";
    }
    if (state.trip.startDate && raw < state.trip.startDate) return "";
    if (state.trip.endDate && raw > state.trip.endDate) return "";
    return raw;
  }
  const normalized = raw.replace(/[^\d]/g, "");
  if (normalized.length !== 8) return "";
  const day = normalized.slice(0, 2);
  const month = normalized.slice(2, 4);
  const year = normalized.slice(4, 8);
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return "";
  }
  const iso = `${year}-${month}-${day}`;
  if (state.trip.startDate && iso < state.trip.startDate) return "";
  if (state.trip.endDate && iso > state.trip.endDate) return "";
  return iso;
}

function getTripDayCount(trip) {
  const start = new Date(`${trip?.startDate || ""}T12:00:00`);
  const end = new Date(`${trip?.endDate || trip?.startDate || ""}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.round((end - start) / 86400000);
  return Math.max(1, diff + 1);
}

function formatDayCountText(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} дня`;
  return `${count} дней`;
}

function formatTripDayCount(trip) {
  return formatDayCountText(getTripDayCount(trip));
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

function splitDurationInput(minutes) {
  const total = parseMoney(minutes);
  if (!total) return { hours: "", minutes: "" };
  return {
    hours: Math.floor(total / 60) || "",
    minutes: total % 60 || "",
  };
}

function getDurationFromInput(hours, minutes) {
  const hourValue = parseMoney(hours);
  const minuteValue = parseMoney(minutes);
  if (!hourValue && !minuteValue) return 0;
  return hourValue * 60 + minuteValue;
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
  return getTripDatesForTrip(state.trip);
}

function getTripDatesForTrip(trip) {
  const dates = [];
  const start = new Date(`${trip?.startDate || ""}T12:00:00`);
  const end = new Date(`${trip?.endDate || ""}T12:00:00`);
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

function getParticipantFromList(participants, participantId) {
  return participants.find((participant) => participant.id === participantId) || participants.find((participant) => participant.isSelf) || participants[0] || null;
}

function getItemAllocations(item, participants = state.trip.participants) {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const price = parseMoney(item.price);
  const allocations = Array.isArray(item.allocations)
    ? item.allocations
        .map((allocation) => ({
          participantId: participantIds.has(allocation.participantId) ? allocation.participantId : "",
          amount: parseMoney(allocation.amount),
        }))
        .filter((allocation) => allocation.participantId && allocation.amount > 0)
    : [];
  if (allocations.length) return allocations;
  const fallback = getParticipantFromList(participants, item.participantId);
  return fallback && price > 0 ? [{ participantId: fallback.id, amount: price }] : [];
}

function getItemAllocationTotal(item, participants = state.trip.participants) {
  return getItemAllocations(item, participants).reduce((sum, allocation) => sum + parseMoney(allocation.amount), 0);
}

function getPrimaryParticipantForItem(item, participants = state.trip.participants) {
  const allocation = getItemAllocations(item, participants)[0];
  return getParticipantFromList(participants, allocation?.participantId || item.participantId);
}

function getParticipantsForItem(item, participants = state.trip.participants) {
  const seen = new Set();
  return getItemAllocations(item, participants)
    .map((allocation) => getParticipantFromList(participants, allocation.participantId))
    .filter((participant) => {
      if (!participant || seen.has(participant.id)) return false;
      seen.add(participant.id);
      return true;
    });
}

function renderItemParticipantBadges(item) {
  if (state.trip.participants.length <= 1) return "";
  const itemParticipants = getParticipantsForItem(item);
  const participants = itemParticipants.slice(0, 3);
  if (!participants.length) return "";
  const hiddenCount = Math.max(0, itemParticipants.length - participants.length);
  const label = itemParticipants.map((participant) => participant.name).join(", ");
  return `
    <span class="item-participant-stack" aria-label="Расход распределен: ${escapeAttr(label)}">
      ${participants.map((participant) => `
        <span class="item-side-badge item-participant-badge participant-${escapeAttr(participant.colorKey)}" title="${escapeAttr(participant.name)}">${escapeHtml(participant.initials)}</span>
      `).join("")}
      ${hiddenCount ? `<span class="item-side-badge item-participant-badge item-participant-more">+${hiddenCount}</span>` : ""}
    </span>
  `;
}

function renderParticipantAvatar(participant) {
  return `<span class="participant-avatar participant-${escapeAttr(participant.colorKey)}">${escapeHtml(participant.initials)}</span>`;
}

function getParticipantTotals() {
  const totals = new Map(state.trip.participants.map((participant) => [participant.id, 0]));
  state.items.filter(isActiveCost).forEach((item) => {
    getItemAllocations(item).forEach((allocation) => {
      totals.set(allocation.participantId, (totals.get(allocation.participantId) || 0) + parseMoney(allocation.amount));
    });
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
  renderShareRoleBanner();
  renderProposalInbox();
  renderMyItemProposals();
  renderPlan();
  renderBasket();
  renderBudget();
  renderEstimateTable();
  renderCurrencyCalculator();
  renderSharePreview();
}

function isHomeTrainerHidden() {
  try {
    return localStorage.getItem(HOME_TRAINER_VISIBILITY_KEY) === "true";
  } catch {
    return false;
  }
}

function setHomeTrainerHidden(isHidden) {
  try {
    localStorage.setItem(HOME_TRAINER_VISIBILITY_KEY, isHidden ? "true" : "false");
  } catch {
    // The UI state is optional; the trainer remains visible if storage is unavailable.
  }
}

function renderHomeSupport() {
  const trainerShell = $("#homeTrainerShell");
  const trainerButton = $("#trainerVisibilityButton");
  const isHidden = isHomeTrainerHidden();
  trainerShell?.classList.toggle("hidden", isHidden);
  if (trainerButton) {
    trainerButton.textContent = isHidden ? "Показать тренажер на главной" : "Скрыть тренажер на главной";
  }
}

function renderProductVersionInfo() {
  const target = $("#productVersionInfo");
  if (!target) return;
  target.textContent = `Версия ${APP_VERSION}: ${APP_RELEASE_SUMMARY}`;
}

function toggleHomeSupportPanel(panelName) {
  const sheetMap = {
    product: "productInfoSheet",
    howto: "howToSheet",
  };
  const sheetId = sheetMap[panelName];
  if (sheetId) openSheet(sheetId);
  if (panelName === "product") {
    trackEvent("product_info_opened", {
      entry_source: "home",
      is_returning_user: analyticsIsReturningUser,
    });
  }
}

function setupDonationFlow() {
  const button = $("#donationPigButton");
  if (!button || !DONATION_FLOW_ENABLED) return;
  button.disabled = false;
  button.removeAttribute("aria-disabled");
  button.classList.add("donation-enabled");
}

function isMeaningfulTrip(entry) {
  if (!entry || entry.isDemo || entry.isImported || entry.origin === "imported") return false;
  const items = normalizeState(entry.state).items || [];
  return items.length >= 3;
}

function getMeaningfulTripsCount() {
  return tripStore.trips.filter(isMeaningfulTrip).length;
}

function shouldShowDonationPrompt() {
  return (
    DONATION_FLOW_ENABLED &&
    getMeaningfulTripsCount() >= 2 &&
    donationState.firstPromptShownAt === null &&
    donationState.donatedAt === null
  );
}

function getDonationPromptCopy(source = "manual") {
  return "Если Backpacker уже помогает вам планировать поездки и вы захотите поддержать развитие приложения - будем очень благодарны ❤️";
}

function openDonationSheet(source = "manual") {
  if (!DONATION_FLOW_ENABLED) return;
  renderDonationIntroStep(source);
  openSheet("donationSheet");
  if (!donationSheetHistoryArmed) {
    history.pushState({ backpackerDonationSheet: true }, "");
    donationSheetHistoryArmed = true;
  }
  trackEvent("donation_prompt_shown", {
    ...getTripAnalyticsContext(),
    source,
    meaningful_trips_count: getMeaningfulTripsCount(),
    prompt_show_count: donationState.promptShowCount,
  });
}

function scheduleDonationPrompt() {
  window.clearTimeout(donationPromptTimer);
  if (!shouldShowDonationPrompt()) return;
  donationState.firstPromptShownAt = new Date().toISOString();
  donationState.promptShowCount += 1;
  saveDonationState();
  switchView("plan", "automatic");
  donationPromptTimer = window.setTimeout(() => {
    if ($$(".sheet.open").length) return;
    openDonationSheet("auto");
  }, 600);
}

function dismissDonationSheet(method = "not_now", options = {}) {
  const sheet = $("#donationSheet");
  if (!sheet?.classList.contains("open")) return;
  donationState.lastPromptDismissedAt = new Date().toISOString();
  saveDonationState();
  closeSheet("donationSheet");
  trackEvent("donation_prompt_dismissed", {
    ...getTripAnalyticsContext(),
    dismiss_method: method,
  });
  if (donationSheetHistoryArmed && !options.fromPopState) {
    donationIgnoreNextPop = true;
    history.back();
  }
  donationSheetHistoryArmed = false;
}

function renderDonationIntroStep(source = "manual") {
  $("#donationIntroActions")?.classList.remove("hidden");
  $("#donationAmountStep")?.classList.add("hidden");
  const text = $("#donationPromptText");
  if (text) text.textContent = getDonationPromptCopy(source);
}

function renderDonationAmountStep() {
  $("#donationIntroActions")?.classList.add("hidden");
  $("#donationAmountStep")?.classList.remove("hidden");
  $("#donationCustomAmount")?.classList.add("hidden");
  $(".donation-amount-grid")?.classList.remove("hidden");
  const text = $("#donationPromptText");
  if (text) text.textContent = "Выберите удобную сумму поддержки.\nКнопка откроет платёжную страницу (карту не привязываем, данные не собираем!), с которой вы сможете перейти в ваш банк.";
}

function renderDonationCustomAmountStep() {
  $(".donation-amount-grid")?.classList.add("hidden");
  $("#donationCustomAmount")?.classList.remove("hidden");
  const input = $("#donationCustomAmountInput");
  if (input) {
    input.value = "";
    window.setTimeout(() => input.focus(), 80);
  }
}

function submitDonationCustomAmount() {
  const amount = parseMoney($("#donationCustomAmountInput")?.value);
  if (!amount) {
    showToast("Введите сумму");
    return;
  }
  openDonationCheckout(String(amount));
}

function handleDonationCtaClick() {
  trackEvent("donation_cta_clicked", getTripAnalyticsContext());
  renderDonationAmountStep();
}

function buildDonationCheckoutUrl(amount = "custom") {
  const url = new URL(DONATION_URL, window.location.href);
  url.searchParams.set("amount", amount);
  return url.toString();
}

function openDonationCheckout(amount = "custom") {
  donationState.donationCtaClickedAt = new Date().toISOString();
  saveDonationState();
  trackEvent("donation_checkout_opened", {
    ...getTripAnalyticsContext(),
    amount_option: amount,
  });
  window.open(buildDonationCheckoutUrl(amount), "_blank", "noopener,noreferrer");
}

function renderHome() {
  const list = $("#tripList");
  if (!list) return;
  renderHomeSupport();
  renderHomeProfile();
  renderReceivedTrips();
  const trips = tripStore.trips
    .filter((entry) => !entry.isDemo)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  if (!trips.length) {
    list.innerHTML = `
      <p class="empty-trips">
        <span>Здесь будут поездки: ваши личные и те, в которые вас пригласят</span>
        <span>Впервые здесь? Начните с тренажера 👆🏻 или создайте новую поездку</span>
      </p>
    `;
    return;
  }

  list.innerHTML = trips.map((entry) => {
    const trip = entry.state.trip;
    const style = entry.coverDataUrl ? ` style="background-image: linear-gradient(145deg, rgba(18,54,61,.66), rgba(18,54,61,.12)), url('${escapeAttr(entry.coverDataUrl)}')"` : "";
    const statusLabel = getHomeTripStatusLabel(entry.id);
    const cardDateRange = formatTripCardDateRange(trip.startDate, trip.endDate);
    return `
      <article class="home-card trip-list-card"${style}>
        <button class="trip-card-open" data-open-trip="${escapeAttr(entry.id)}" type="button">
          <div class="trip-card-status-row">
            <span class="home-card-kicker">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="trip-card-title-block">
            <strong>${escapeHtml(trip.title || "Новая поездка")}</strong>
            <div class="trip-card-submeta">
              <span>${escapeHtml(trip.destination || "Направление не задано")}</span>
              <span>${escapeHtml(cardDateRange)}</span>
            </div>
          </div>
          <div class="home-card-meta">
            <span>${formatTripDayCount(trip)}</span>
            <span>${formatCurrencyAmount(trip.budgetLimit, trip.currency)}</span>
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

function renderReceivedTrips() {
  const section = $("#receivedTripsSection");
  const list = $("#receivedTripList");
  if (!section || !list) return;
  const shouldShow = receivedSharesLoading || receivedShareCards.length > 0;
  section.classList.toggle("hidden", !shouldShow);
  if (receivedSharesLoading && !receivedShareCards.length) {
    list.innerHTML = `<p class="empty-trips"><span>Обновляем сохраненные ссылки...</span></p>`;
    return;
  }
  list.innerHTML = receivedShareCards.map((entry) => {
    const dateText = formatTripCardDateRange(entry.startDate, entry.endDate);
    const destinationText = entry.destination || "Направление не задано";
    const dayCountText = entry.startDate || entry.endDate
      ? formatTripDayCount({ startDate: entry.startDate, endDate: entry.endDate })
      : entry.dayCount || "Дни не заданы";
    const coverStyle = entry.coverDataUrl ? ` style="background-image: linear-gradient(145deg, rgba(18,54,61,.66), rgba(18,54,61,.12)), url('${escapeAttr(entry.coverDataUrl)}')"` : "";
    const statusBadge = entry.revoked ? "Доступ закрыт" : "Групповая (гость) · Read-only";
    const authorBadge = entry.authorDisplayName ? `Автор: ${entry.authorDisplayName}` : "Автор поездки";
    return `
      <article class="home-card trip-list-card received-trip-card${entry.revoked ? " received-trip-card-closed" : ""}"${coverStyle}>
        <button class="trip-card-open" data-open-received-trip="${escapeAttr(entry.shareId)}" type="button" ${entry.revoked ? "disabled aria-disabled=\"true\"" : ""}>
          <div class="trip-card-status-row">
            <span class="home-card-kicker">${escapeHtml(statusBadge)}</span>
            <span class="home-card-kicker received-trip-author-badge">${escapeHtml(authorBadge)}</span>
          </div>
          <div class="trip-card-title-block">
            <strong>${escapeHtml(entry.title || "Поездка")}</strong>
            <div class="trip-card-submeta">
              <span>${escapeHtml(destinationText)}</span>
              <span>${escapeHtml(entry.revoked ? "Доступ закрыт" : dateText)}</span>
            </div>
          </div>
          <div class="home-card-meta">
            <span>${escapeHtml(dayCountText)}</span>
            <span>${entry.includeBudget === false ? "Смета скрыта" : escapeHtml(formatCurrencyAmount(entry.budgetLimit || 0, entry.currency || "RUB"))}</span>
          </div>
        </button>
        <button class="delete-trip-button received-trip-remove-button" data-remove-received-trip="${escapeAttr(entry.shareId)}" type="button">Удалить из списка</button>
      </article>
    `;
  }).join("");
}

async function refreshReceivedTrips({ silent = true } = {}) {
  if (!isSupabaseConfigured()) {
    receivedShareCards = [];
    receivedSharesLoaded = true;
    renderReceivedTrips();
    return;
  }
  const token = await getExistingSupabaseAccessToken().catch(() => "");
  if (!token) {
    receivedShareCards = [];
    receivedSharesLoaded = true;
    renderReceivedTrips();
    return;
  }
  receivedSharesLoading = true;
  renderReceivedTrips();
  try {
    const payload = await callTripShareFunction("list_received", {}, { useExistingSession: true });
    receivedShareCards = Array.isArray(payload.trips) ? payload.trips : [];
    receivedSharesLoaded = true;
  } catch {
    if (!silent) showToast("Не удалось обновить «Со мной поделились»");
  } finally {
    receivedSharesLoading = false;
    renderReceivedTrips();
  }
}

function renderSaveReceivedTripButton() {
  const button = $("#saveReceivedTripButton");
  if (!button) return;
  const canSave = Boolean(readOnlyShare?.shareId && !readOnlyShare.invalid && !readOnlyShare.isOwner && !readOnlyShare.isSaved && readOnlyShare.source === "public_link");
  button.classList.toggle("hidden", !canSave);
  button.disabled = !canSave;
}

async function saveReceivedTrip(profileReady = false) {
  if (!readOnlyShare?.shareId || readOnlyShare.invalid || readOnlyShare.isOwner || readOnlyShare.isSaved) return;
  if (!profileReady) {
    await requireProfileForSharedAction("save_received", () => saveReceivedTrip(true));
    return;
  }
  const button = $("#saveReceivedTripButton");
  if (button) button.disabled = true;
  try {
    await callTripShareFunction("save_received", { shareId: readOnlyShare.shareId }, { requireOwner: true });
    readOnlyShare.isSaved = true;
    renderSaveReceivedTripButton();
    await refreshReceivedTrips();
    showToast("Поездка добавлена в «Со мной поделились»");
  } catch (error) {
    if (error.status === 409) {
      readOnlyShare.isOwner = true;
      renderSaveReceivedTripButton();
      showToast("Это ваша ссылка");
    } else if (error.status === 410) {
      readOnlyShare.invalid = true;
      renderSaveReceivedTripButton();
      showToast("Доступ закрыт");
    } else {
      showToast(isSupabaseConfigured() ? "Не удалось добавить поездку" : "Supabase не настроен");
    }
  } finally {
    renderSaveReceivedTripButton();
  }
}

async function openReceivedTrip(shareId) {
  if (!shareId) return;
  try {
    const payload = await callTripShareFunction("read_received", { shareId }, { requireOwner: true });
    const nextState = normalizeState(payload.state);
    readOnlyShare = {
      shareId: payload.shareId || shareId,
      sourceTripId: payload.tripId || nextState.trip.id,
      title: nextState.trip.title || "Поездка",
      destination: nextState.trip.destination || "",
      updatedAt: payload.updatedAt || new Date().toISOString(),
      options: {
        includeBudget: payload.includeBudget !== false,
      },
      isOwner: false,
      isSaved: true,
      source: "received_list",
      state: nextState,
    };
    state = nextState;
    showTripScreen();
    trackEvent("received_trip_opened", { share_id: shareId });
  } catch (error) {
    if (error.status === 410) {
      showToast("Доступ закрыт");
      await refreshReceivedTrips();
      return;
    }
    showToast("Не удалось открыть поездку");
  }
}

async function removeReceivedTrip(shareId) {
  if (!shareId) return;
  try {
    await callTripShareFunction("remove_received", { shareId }, { requireOwner: true });
    receivedShareCards = receivedShareCards.filter((entry) => entry.shareId !== shareId);
    renderReceivedTrips();
    showToast("Удалено из «Со мной поделились»");
  } catch {
    showToast("Не удалось удалить из списка");
  }
}

function getAuthorAllocationForItem(item) {
  const selfParticipant = getSelfParticipant();
  const allocation = getItemAllocations(item).find((entry) => entry.participantId === selfParticipant?.id);
  return allocation?.amount || 0;
}

function getOwnProposalForItem(itemId) {
  return (shareProposalContext?.proposals || []).find((proposal) => proposal.itemId === itemId && ["pending", "accepted", "rejected", "withdrawn", "stale"].includes(proposal.status));
}

async function refreshShareProposalContext() {
  if (!readOnlyShare?.shareId || readOnlyShare.invalid) return null;
  try {
    shareProposalContext = await callTripShareFunction("get_share_context", { shareId: readOnlyShare.shareId }, { requireOwner: true });
    readOnlyShare.isOwner = Boolean(shareProposalContext.isOwner ?? readOnlyShare.isOwner);
    readOnlyShare.isAuthor = Boolean(shareProposalContext.isAuthor ?? readOnlyShare.isAuthor);
    readOnlyShare.authorDisplayName = shareProposalContext.authorDisplayName || readOnlyShare.authorDisplayName || "";
    readOnlyShare.currentUserDisplayName = shareProposalContext.currentUserDisplayName || readOnlyShare.currentUserDisplayName || "";
    readOnlyShare.profileRequired = Boolean(shareProposalContext.profileRequired);
    if (shareProposalContext.currentUserDisplayName) {
      userProfile = { loaded: true, loading: false, displayName: shareProposalContext.currentUserDisplayName, error: "" };
    }
    renderShareRoleBanner();
    return shareProposalContext;
  } catch {
    shareProposalContext = null;
    return null;
  }
}

function formatProposalStatus(status) {
  return {
    pending: "На рассмотрении",
    accepted: "Принято",
    rejected: "Отклонено",
    withdrawn: "Отозвано",
    stale: "Неактуально",
  }[status] || status;
}

function resetExpenseProposalDraft(itemId = "") {
  expenseProposalDraft = { itemId, participantMode: "", participantId: "", proposedParticipantName: "", amount: 0 };
}

async function openExpenseProposalSheet(itemId, profileReady = false) {
  if (!isReadOnlyMode()) return;
  if (readOnlyShare?.isOwner || readOnlyShare?.isAuthor) {
    showToast("Это ваша поездка");
    return;
  }
  if (!profileReady) {
    await requireProfileForSharedAction("expense_proposal", () => openExpenseProposalSheet(itemId, true));
    return;
  }
  resetExpenseProposalDraft(itemId);
  await refreshShareProposalContext();
  renderExpenseProposalSheet();
  openSheet("expenseProposalSheet");
}

function renderExpenseProposalSheet() {
  const item = state.items.find((entry) => entry.id === expenseProposalDraft.itemId);
  const body = $("#expenseProposalBody");
  if (!item) {
    body.innerHTML = `<p class="field-hint">Расход не найден.</p>`;
    return;
  }
  const existingProposal = getOwnProposalForItem(item.id);
  const authorAmount = getAuthorAllocationForItem(item);
  const userParticipant = shareProposalContext?.userParticipantId
    ? getParticipantById(shareProposalContext.userParticipantId)
    : null;
  const availableParticipants = shareProposalContext?.availableParticipants || [];
  const currentUserAmount = userParticipant
    ? getItemAllocations(item).find((allocation) => allocation.participantId === userParticipant.id)?.amount || 0
    : 0;

  if (!canShowBudget() || shareProposalContext?.includeBudget === false) {
    body.innerHTML = `<p class="field-hint">Автор скрыл смету. Предложения по расходам недоступны.</p>`;
    return;
  }
  if (shareProposalContext?.isOwner) {
    body.innerHTML = `<p class="field-hint">Автор управляет расходами напрямую.</p>`;
    return;
  }
  if (existingProposal?.status === "pending") {
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Ваше предложение: <strong>${formatMoney(existingProposal.amount)}</strong> · ${formatProposalStatus(existingProposal.status)}</p>
        <button class="ghost-button" type="button" data-withdraw-expense-proposal="${escapeAttr(existingProposal.id)}">Отозвать предложение</button>
      </section>
    `;
    return;
  }
  if (existingProposal?.status === "accepted") {
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Ваша доля: <strong>${formatMoney(existingProposal.amount)}</strong> · ${formatProposalStatus(existingProposal.status)}</p>
        <button class="ghost-button" type="button" data-withdraw-accepted-expense-proposal="${escapeAttr(existingProposal.id)}" ${resolvingExpenseProposalIds.has(existingProposal.id) ? "disabled" : ""}>Отозвать долю</button>
      </section>
    `;
    return;
  }
  if (existingProposal && existingProposal.status !== "withdrawn") {
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Ваше предложение: <strong>${formatMoney(existingProposal.amount)}</strong> · ${formatProposalStatus(existingProposal.status)}</p>
        <button class="primary-button" type="button" data-new-expense-proposal>Создать новое предложение</button>
      </section>
    `;
    return;
  }
  if (authorAmount <= 0) {
    body.innerHTML = `<p class="field-hint">Автор уже распределил весь расход между участниками.</p>`;
    return;
  }

  if (!expenseProposalDraft.participantMode && userParticipant) {
    expenseProposalDraft.participantMode = "existing";
    expenseProposalDraft.participantId = userParticipant.id;
  }

  if (!expenseProposalDraft.participantMode) {
    const existingOptions = availableParticipants.length
      ? `
        <button class="primary-button" type="button" data-proposal-mode="existing">Я уже есть среди участников</button>
        <button class="ghost-button" type="button" data-proposal-mode="new">Добавить меня как нового участника</button>
      `
      : `
        <p class="field-hint">Вас пока нет среди участников. Добавить себя вместе с предложением доли?</p>
        <button class="primary-button" type="button" data-proposal-mode="new">Добавить меня</button>
      `;
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Доступно из доли автора: <strong>${formatMoney(authorAmount)}</strong></p>
      </section>
      <section class="proposal-choice">
        <h3>Как вы участвуете в поездке?</h3>
        ${existingOptions}
      </section>
    `;
    return;
  }

  if (expenseProposalDraft.participantMode === "existing" && !expenseProposalDraft.participantId) {
    body.innerHTML = `
      <section class="proposal-choice">
        <h3>Кто вы в списке участников?</h3>
        ${availableParticipants.map((participant) => `
          <button class="ghost-button" type="button" data-proposal-participant="${escapeAttr(participant.id)}">${escapeHtml(participant.name)}</button>
        `).join("")}
        <button class="ghost-button" type="button" data-proposal-back>Назад</button>
      </section>
    `;
    return;
  }

  if (expenseProposalDraft.participantMode === "new" && !expenseProposalDraft.proposedParticipantName) {
    const suggestedName = userProfile.displayName || shareProposalContext?.currentUserDisplayName || "";
    body.innerHTML = `
      <section class="proposal-choice">
        <h3>Как вас показать автору?</h3>
        <label class="field wide">
          Имя
          <input id="proposalParticipantNameInput" maxlength="40" placeholder="Например, Ваня" value="${escapeAttr(suggestedName)}" />
        </label>
        <button class="primary-button" type="button" data-save-proposal-name>Продолжить</button>
        <button class="ghost-button" type="button" data-proposal-back>Назад</button>
      </section>
    `;
    return;
  }

  const selectedParticipantId = expenseProposalDraft.participantMode === "existing" ? expenseProposalDraft.participantId : "";
  const selectedParticipant = selectedParticipantId ? getParticipantById(selectedParticipantId) : null;
  const displayName = selectedParticipant?.name || expenseProposalDraft.proposedParticipantName;
  const futureAmount = currentUserAmount + (expenseProposalDraft.amount || authorAmount);
  body.innerHTML = `
    <section class="proposal-summary">
      <h3>${escapeHtml(item.title)}</h3>
      <p>Общая стоимость: <strong>${formatMoney(item.price)}</strong></p>
      <p>Текущая доля автора: <strong>${formatMoney(authorAmount)}</strong></p>
      ${currentUserAmount ? `<p>Ваша текущая доля: <strong>${formatMoney(currentUserAmount)}</strong></p>` : ""}
      <p>Участник: <strong>${escapeHtml(displayName)}</strong></p>
    </section>
    <section class="proposal-choice">
      <h3>Сколько вы готовы взять на себя?</h3>
      <button class="primary-button" type="button" data-proposal-full-amount="${authorAmount}">Весь доступный остаток — ${formatMoney(authorAmount)}</button>
      <label class="field wide">
        Другая сумма
        <input id="proposalAmountInput" inputmode="numeric" placeholder="0" />
      </label>
      <p class="field-hint">После принятия ваша доля составит ${formatMoney(futureAmount)}.</p>
      <button class="primary-button" type="button" data-submit-expense-proposal>Отправить предложение</button>
      <button class="ghost-button" type="button" data-proposal-back>Назад</button>
    </section>
  `;
}

async function submitExpenseProposal(profileReady = false) {
  const item = state.items.find((entry) => entry.id === expenseProposalDraft.itemId);
  if (!item || !readOnlyShare?.shareId) return;
  if (!profileReady) {
    await requireProfileForSharedAction("expense_proposal_submit", () => submitExpenseProposal(true));
    return;
  }
  const manualAmount = parseMoney($("#proposalAmountInput")?.value);
  const amount = expenseProposalDraft.amount || manualAmount;
  if (amount <= 0) {
    showToast("Укажите сумму");
    return;
  }
  try {
    const payload = await callTripShareFunction("create_expense_proposal", {
      shareId: readOnlyShare.shareId,
      itemId: item.id,
      participantMode: expenseProposalDraft.participantMode,
      participantId: expenseProposalDraft.participantId,
      proposedParticipantName: expenseProposalDraft.proposedParticipantName,
      amount,
    }, { requireOwner: true });
    shareProposalContext ||= {};
    shareProposalContext.proposals = [payload.proposal, ...(shareProposalContext.proposals || [])];
    showToast("Предложение отправлено автору");
    renderExpenseProposalSheet();
  } catch (error) {
    showToast(error?.message === "pending_proposal_exists" ? "У вас уже есть предложение по этому расходу" : "Не удалось отправить предложение");
  }
}

async function withdrawExpenseProposal(proposalId) {
  try {
    const payload = await callTripShareFunction("withdraw_expense_proposal", { proposalId }, { requireOwner: true });
    if (shareProposalContext?.proposals) {
      shareProposalContext.proposals = shareProposalContext.proposals.map((proposal) => (
        proposal.id === proposalId ? payload.proposal : proposal
      ));
    }
    showToast("Предложение отозвано");
    renderExpenseProposalSheet();
  } catch {
    showToast("Не удалось отозвать предложение");
  }
}

function getAcceptedExpenseProposalsForItem(itemId) {
  return authorExpenseProposals.filter((proposal) => proposal.itemId === itemId && proposal.status === "accepted");
}

function getOwnAcceptedExpenseProposalForItem(itemId) {
  return (shareProposalContext?.proposals || []).find((proposal) => proposal.itemId === itemId && proposal.status === "accepted");
}

function renderAcceptedExpenseControls(item) {
  const controls = $("#acceptedExpenseControls");
  if (!controls) return;
  if (!item || isReadOnlyMode()) {
    controls.classList.add("hidden");
    controls.innerHTML = "";
    return;
  }
  const proposals = getAcceptedExpenseProposalsForItem(item.id);
  controls.classList.toggle("hidden", !proposals.length);
  controls.innerHTML = proposals.map((proposal) => `
    <article class="accepted-expense-card">
      <div>
        <strong>${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || "Участник")}</strong>
        <p>Взял(а) на себя ${formatMoney(proposal.amount)}.</p>
      </div>
      <button class="ghost-button compact" type="button" data-reject-accepted-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>Отменить долю</button>
    </article>
  `).join("");
}

function renderEstimateProposalControls() {
  const controls = $("#estimateProposalControls");
  if (!controls) return;
  if (!canShowBudget()) {
    controls.classList.add("hidden");
    controls.innerHTML = "";
    return;
  }
  const proposals = isReadOnlyMode()
    ? (shareProposalContext?.proposals || []).filter((proposal) => proposal.status === "accepted")
    : authorExpenseProposals.filter((proposal) => proposal.status === "accepted");
  controls.classList.toggle("hidden", !proposals.length);
  controls.innerHTML = proposals.map((proposal) => `
    <article class="estimate-proposal-action">
      <div>
        <strong>${escapeHtml(proposal.itemTitle || state.items.find((item) => item.id === proposal.itemId)?.title || "Расход")}</strong>
        <p>${isReadOnlyMode() ? "Ваша доля" : escapeHtml(proposal.requesterDisplayName || proposal.requesterName || "Участник")}: ${formatMoney(proposal.amount)}</p>
      </div>
      <button class="ghost-button compact" type="button" ${isReadOnlyMode()
        ? `data-withdraw-accepted-expense-proposal="${escapeAttr(proposal.id)}"`
        : `data-reject-accepted-expense-proposal="${escapeAttr(proposal.id)}"`} ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>
        ${isReadOnlyMode() ? "Отозвать долю" : "Отменить долю"}
      </button>
    </article>
  `).join("");
}

async function resolveAcceptedExpenseProposal(proposalId, nextStatus) {
  if (resolvingExpenseProposalIds.has(proposalId)) return;
  resolvingExpenseProposalIds.add(proposalId);
  renderProposalInbox();
  renderEstimateProposalControls();
  renderAcceptedExpenseControls(state.items.find((item) => item.id === $("#itemForm")?.elements?.id?.value));
  try {
    if (!isReadOnlyMode()) await syncCurrentTripShareBeforeAccept();
    const payload = await callTripShareFunction("resolve_accepted_expense_proposal", { proposalId, nextStatus }, { requireOwner: true });
    if (payload.state) {
      state = normalizeState(payload.state);
      if (!isReadOnlyMode()) saveState();
    }
    if (isReadOnlyMode()) await refreshShareProposalContext();
    else await refreshAuthorExpenseProposals();
    render();
    renderExpenseProposalSheet();
    const currentItem = state.items.find((item) => item.id === $("#itemForm")?.elements?.id?.value);
    renderItemAllocationSummary(currentItem);
    renderAcceptedExpenseControls(currentItem);
    showToast(nextStatus === "withdrawn" ? "Доля отозвана" : "Доля отменена");
  } catch {
    showToast("Не удалось изменить долю");
  } finally {
    resolvingExpenseProposalIds.delete(proposalId);
    renderProposalInbox();
    renderEstimateProposalControls();
  }
}

function resetItemProposalDraft() {
  itemProposalDraft = { title: "", itemType: "idea", link: "", price: "", notes: "" };
}

async function refreshItemProposalContext() {
  if (!readOnlyShare?.shareId || readOnlyShare.invalid || readOnlyShare.isOwner || readOnlyShare.isAuthor) return null;
  try {
    const payload = await callTripShareFunction("get_item_proposal_context", { shareId: readOnlyShare.shareId }, { requireOwner: true });
    readOnlyShare.currentUserDisplayName = payload.currentUserDisplayName || readOnlyShare.currentUserDisplayName || "";
    readOnlyShare.profileRequired = Boolean(payload.profileRequired);
    if (payload.currentUserDisplayName) {
      userProfile = { loaded: true, loading: false, displayName: payload.currentUserDisplayName, error: "" };
    }
    shareProposalContext ||= {};
    shareProposalContext.itemProposals = payload.proposals || [];
    renderMyItemProposals();
    return payload;
  } catch {
    return null;
  }
}

async function openItemProposalSheet(profileReady = false) {
  if (!isReadOnlyMode() || readOnlyShare?.invalid || readOnlyShare?.isOwner || readOnlyShare?.isAuthor) return;
  if (!profileReady) {
    await requireProfileForSharedAction("item_proposal", () => openItemProposalSheet(true));
    return;
  }
  resetItemProposalDraft();
  renderItemProposalSheet();
  openSheet("itemProposalSheet");
  await refreshItemProposalContext();
  window.setTimeout(() => $("#itemProposalTitleInput")?.focus(), 80);
}

function renderItemProposalSheet() {
  const form = $("#itemProposalForm");
  if (!form) return;
  form.elements.itemType.innerHTML = itemTypes.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  form.elements.title.value = itemProposalDraft.title || "";
  form.elements.itemType.value = itemProposalDraft.itemType || "idea";
  form.elements.link.value = itemProposalDraft.link || "";
  form.elements.price.value = itemProposalDraft.price || "";
  form.elements.notes.value = itemProposalDraft.notes || "";
  $("#itemProposalSubmitButton").disabled = itemProposalSubmitting;
  $("#itemProposalSubmitButton").textContent = itemProposalSubmitting ? "Отправляем..." : "Отправить автору";
}

function getItemProposalFormData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const title = String(data.title || "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  const itemType = itemTypes.some(([key]) => key === data.itemType) ? data.itemType : "idea";
  const link = String(data.link || "").trim();
  const priceRaw = String(data.price || "").trim();
  const price = priceRaw ? parseMoney(priceRaw) : "";
  const notes = String(data.notes || "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return { title, itemType, link, price, notes };
}

async function submitItemProposal(event) {
  event.preventDefault();
  if (itemProposalSubmitting || !readOnlyShare?.shareId) return;
  const formData = getItemProposalFormData(event.currentTarget);
  if (!formData.title) {
    showToast("Введите название идеи");
    return;
  }
  if (formData.price !== "" && formData.price < 0) {
    showToast("Цена не может быть отрицательной");
    return;
  }
  itemProposalSubmitting = true;
  renderItemProposalSheet();
  try {
    const payload = await callTripShareFunction("create_item_proposal", {
      shareId: readOnlyShare.shareId,
      ...formData,
      idempotencyKey: crypto.randomUUID?.() || `proposal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }, { requireOwner: true });
    shareProposalContext ||= {};
    shareProposalContext.itemProposals = [payload.proposal, ...(shareProposalContext.itemProposals || [])];
    closeSheet("itemProposalSheet");
    showToast("Идея отправлена автору");
    renderMyItemProposals();
  } catch (error) {
    showToast(error?.message === "profile_required" ? "Сначала добавьте имя или ник" : "Не удалось отправить идею");
  } finally {
    itemProposalSubmitting = false;
    renderItemProposalSheet();
  }
}

async function withdrawItemProposal(proposalId) {
  try {
    const payload = await callTripShareFunction("withdraw_item_proposal", { proposalId }, { requireOwner: true });
    shareProposalContext ||= {};
    shareProposalContext.itemProposals = (shareProposalContext.itemProposals || []).map((proposal) => (
      proposal.id === proposalId ? payload.proposal : proposal
    ));
    showToast("Идея отозвана");
    renderMyItemProposals();
  } catch {
    showToast("Не удалось отозвать идею");
  }
}

function renderMyItemProposals() {
  const section = $("#myItemProposalsSection");
  const list = $("#myItemProposalsList");
  if (!section || !list) return;
  const proposals = shareProposalContext?.itemProposals || [];
  section.classList.toggle("hidden", !isReadOnlyMode() || readOnlyShare?.isOwner || readOnlyShare?.isAuthor || !proposals.length);
  list.innerHTML = proposals.map((proposal) => `
    <article class="proposal-card proposal-${escapeAttr(proposal.status)}">
      <div>
        <strong>${escapeHtml(proposal.title || "Идея")}</strong>
        <p>${escapeHtml(getTypeLabel(proposal.itemType || "idea"))} · ${formatProposalStatus(proposal.status)}</p>
      </div>
      ${proposal.status === "pending" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-withdraw-item-proposal="${escapeAttr(proposal.id)}">Отозвать идею</button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderProposalInbox() {
  const section = $("#proposalInboxSection");
  if (!section) return;
  const proposals = [
    ...authorExpenseProposals.map((proposal) => ({ ...proposal, proposalType: "expense" })),
    ...authorItemProposals.map((proposal) => ({ ...proposal, proposalType: "item" })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const pendingCount = proposals.filter((proposal) => proposal.status === "pending").length;
  section.classList.toggle("hidden", isReadOnlyMode() || !proposals.length);
  $("#proposalInboxTitle").textContent = `Предложения · ${pendingCount}`;
  $("#proposalInboxList").innerHTML = proposals.map((proposal) => proposal.proposalType === "item" ? `
    <article class="proposal-card proposal-${escapeAttr(proposal.status)}">
      <div>
        <strong>${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || "Пользователь Backpacker")}</strong>
        <p>предлагает добавить «${escapeHtml(proposal.title || "Идея")}».</p>
        <p class="proposal-account-link">Новая идея · ${escapeHtml(getTypeLabel(proposal.itemType || "idea"))}${proposal.price ? ` · ${formatMoney(proposal.price)}` : ""}</p>
        ${proposal.link ? `<a class="item-link" href="${escapeAttr(proposal.link)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">открыть ссылку</a>` : ""}
        ${proposal.notes ? `<p class="item-note">${escapeHtml(proposal.notes)}</p>` : ""}
        <span>${formatProposalStatus(proposal.status)}</span>
      </div>
      ${proposal.status === "pending" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-reject-item-proposal="${escapeAttr(proposal.id)}" ${resolvingItemProposalIds.has(proposal.id) ? "disabled" : ""}>Отклонить</button>
          <button class="primary-button compact" type="button" data-accept-item-proposal="${escapeAttr(proposal.id)}" ${resolvingItemProposalIds.has(proposal.id) ? "disabled" : ""}>${resolvingItemProposalIds.has(proposal.id) ? "Добавляем..." : "Принять идею"}</button>
        </div>
      ` : ""}
    </article>
  ` : `
    <article class="proposal-card proposal-${escapeAttr(proposal.status)}">
      <div>
        <strong>${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || "Пользователь Backpacker")}</strong>
        <p>${proposal.participantMode === "new" ? "хочет присоединиться и взять" : "предлагает взять"} ${formatMoney(proposal.amount)} в расходе «${escapeHtml(proposal.itemTitle)}».</p>
        ${proposal.participantName ? `<p class="proposal-account-link">Участник поездки: ${escapeHtml(proposal.participantName)} · аккаунт ${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || "Пользователь Backpacker")}</p>` : ""}
        <span>${formatProposalStatus(proposal.status)}</span>
      </div>
      ${proposal.status === "pending" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-reject-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>Отклонить</button>
          <button class="primary-button compact" type="button" data-accept-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>${resolvingExpenseProposalIds.has(proposal.id) ? "Применяем..." : (proposal.participantMode === "new" ? "Добавить и принять" : "Принять")}</button>
        </div>
      ` : proposal.status === "accepted" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-reject-accepted-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>Отменить долю</button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderShareRoleBanner() {
  const banner = $("#shareRoleBanner");
  if (!banner) return;
  if (!isReadOnlyMode() || readOnlyShare?.invalid || readOnlyShare?.isOwner || readOnlyShare?.isAuthor) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }
  const authorName = readOnlyShare.authorDisplayName || "Автор поездки";
  banner.classList.remove("hidden");
  banner.textContent = `Автор — ${authorName}`;
}

async function refreshAuthorExpenseProposals() {
  if (isReadOnlyMode() || !state?.trip?.id) {
    authorExpenseProposals = [];
    authorItemProposals = [];
    renderProposalInbox();
    return;
  }
  const [expenseResult, itemResult] = await Promise.allSettled([
    callTripShareFunction("list_expense_proposals", { tripId: state.trip.id }, { requireOwner: true }),
    callTripShareFunction("list_item_proposals", { tripId: state.trip.id }, { requireOwner: true }),
  ]);
  authorExpenseProposals = expenseResult.status === "fulfilled" ? (expenseResult.value.proposals || []) : [];
  authorItemProposals = itemResult.status === "fulfilled" ? (itemResult.value.proposals || []) : [];
  renderProposalInbox();
  renderEstimateProposalControls();
}

async function syncCurrentTripShareBeforeAccept() {
  const record = getTripShareRecord();
  await callTripShareFunction("update", {
    tripId: state.trip.id,
    includeBudget: record?.includeBudget !== false,
    schemaVersion: TRIP_SHARE_SCHEMA_VERSION,
    state: buildPublishedTripState(),
  }, { requireOwner: true });
}

async function acceptExpenseProposal(proposalId) {
  if (resolvingExpenseProposalIds.has(proposalId)) return;
  resolvingExpenseProposalIds.add(proposalId);
  renderProposalInbox();
  try {
    await syncCurrentTripShareBeforeAccept();
    const payload = await callTripShareFunction("accept_expense_proposal", { proposalId }, { requireOwner: true });
    if (payload.state) {
      state = normalizeState(payload.state);
      saveState();
    }
    await refreshAuthorExpenseProposals();
    render();
    showToast(payload.status === "stale" ? "Предложение стало неактуальным" : "Предложение принято");
  } catch {
    showToast("Не удалось принять предложение");
  } finally {
    resolvingExpenseProposalIds.delete(proposalId);
    renderProposalInbox();
  }
}

async function rejectExpenseProposal(proposalId) {
  if (resolvingExpenseProposalIds.has(proposalId)) return;
  resolvingExpenseProposalIds.add(proposalId);
  renderProposalInbox();
  try {
    await callTripShareFunction("reject_expense_proposal", { proposalId }, { requireOwner: true });
    await refreshAuthorExpenseProposals();
    render();
    showToast("Предложение отклонено");
  } catch {
    showToast("Не удалось отклонить предложение");
  } finally {
    resolvingExpenseProposalIds.delete(proposalId);
    renderProposalInbox();
  }
}

async function acceptItemProposal(proposalId) {
  if (resolvingItemProposalIds.has(proposalId)) return;
  resolvingItemProposalIds.add(proposalId);
  renderProposalInbox();
  try {
    await syncCurrentTripShareBeforeAccept();
    const payload = await callTripShareFunction("accept_item_proposal", { proposalId }, { requireOwner: true });
    if (payload.state) {
      state = normalizeState(payload.state);
      saveState();
    }
    await refreshAuthorExpenseProposals();
    render();
    showToast(payload.status === "stale" ? "Идея стала неактуальной" : "Идея добавлена в «Без даты»");
  } catch {
    showToast("Не удалось принять идею");
  } finally {
    resolvingItemProposalIds.delete(proposalId);
    renderProposalInbox();
  }
}

async function rejectItemProposal(proposalId) {
  if (resolvingItemProposalIds.has(proposalId)) return;
  resolvingItemProposalIds.add(proposalId);
  renderProposalInbox();
  try {
    await callTripShareFunction("reject_item_proposal", { proposalId }, { requireOwner: true });
    await refreshAuthorExpenseProposals();
    render();
    showToast("Идея отклонена");
  } catch {
    showToast("Не удалось отклонить идею");
  } finally {
    resolvingItemProposalIds.delete(proposalId);
    renderProposalInbox();
  }
}

function renderHeader() {
  const dates = getTripDates();
  const totals = getTotals();
  $("#tripTitle").textContent = state.trip.title || "Новая поездка";
  $("#tripMeta").textContent = `${state.trip.destination || "Направление"} · ${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)} · ${dates.length || 1} дня`;
  $("#tripBudgetMeta").textContent = canShowBudget() ? `Бюджет ${formatMoney(state.trip.budgetLimit)}` : "Смета скрыта";
  $("#paidTotal").textContent = formatBudgetMoney(totals.paid);
  $("#plannedTotal").textContent = formatBudgetMoney(totals.possible);
  $("#remainingTotal").textContent = formatBudgetMoney(totals.remaining);
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
        <strong>${formatBudgetMoney(total)}</strong>
      </div>
    `)
    .join("");
  const byDay = dates
    .map((date, index) => {
      const total = state.items
        .filter((item) => item.date === date && isActiveCost(item))
        .reduce((sum, item) => sum + parseMoney(item.price), 0);
      return `<div class="budget-row"><span>День ${index + 1} · ${formatDate(date)}</span><strong>${formatBudgetMoney(total)}</strong></div>`;
    })
    .join("");
  $("#budgetPage").innerHTML = `
    <section class="budget-grid">
      <div class="metric-card"><span>Бюджет поездки</span><strong>${formatBudgetMoney(state.trip.budgetLimit)}</strong></div>
      <div class="metric-card"><span>Уже оплачено</span><strong>${formatBudgetMoney(totals.paid)}</strong></div>
      <div class="metric-card"><span>Бронь</span><strong>${formatBudgetMoney(totals.fixed)}</strong></div>
      <div class="metric-card"><span>Опционально</span><strong>${formatBudgetMoney(totals.optional)}</strong></div>
      <div class="metric-card service-total"><span>Возможный итог</span><strong>${formatBudgetMoney(totals.possible)}</strong></div>
      <div class="metric-card"><span>Остаток</span><strong style="color:${canShowBudget() && totals.remaining < 0 ? "var(--danger)" : "var(--green)"}">${formatBudgetMoney(totals.remaining)}</strong></div>
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
  if (!canShowBudget()) {
    table.innerHTML = `
      <tbody>
        <tr><td>Автор скрыл смету для этой ссылки.</td></tr>
      </tbody>
    `;
    renderEstimateProposalControls();
    return;
  }
  const { header, rows } = buildEstimateRows();
  table.innerHTML = `
    <thead>
      <tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>${row.map((cell, index) => `<td>${index >= 3 ? formatMoney(cell) : escapeHtml(cell)}</td>`).join("")}</tr>
      `).join("")}
    </tbody>
  `;
  renderEstimateProposalControls();
}

function renderItemCard(item) {
  const price = canShowBudget() && parseMoney(item.price) ? formatMoney(item.price) : "--";
  const participantBadges = renderItemParticipantBadges(item);
  const note = item.notes ? `<p class="item-note">${escapeHtml(item.notes)}</p>` : "";
  const link = item.link
    ? `<a class="item-link" href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">открыть ссылку</a>`
    : "";
  const sourceMarker = item.creationSource === "accepted_proposal" && item.proposedByDisplayName
    ? `<p class="item-source-marker" title="${escapeAttr(`Предложено: ${item.proposedByDisplayName}`)}">Предложено: ${escapeHtml(item.proposedByDisplayName)}</p>`
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
        ${sourceMarker}
        <div class="item-content-grid">
          <div class="item-main-flow">
            <p class="item-duration">${formatDurationText(item.durationMinutes)}</p>
            <div class="item-time-slots" aria-label="Время события">${renderItemTimeSlots(item)}</div>
            <p class="item-date-label">Дата</p>
            <div class="item-date-slots" aria-label="Дата события">${renderItemDateSlots(item)}</div>
          </div>
          <div class="item-side-badges">
            <span class="item-side-badge status-icon status-${item.status}" title="${escapeAttr(getStatusLabel(item.status))}" aria-label="${escapeAttr(getStatusLabel(item.status))}">${getStatusIcon(item.status)}</span>
            ${participantBadges}
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

function fillItemForm(item = null) {
  const form = $("#itemForm");
  form.reset();
  form.elements.date.min = state.trip.startDate || "";
  form.elements.date.max = state.trip.endDate || "";
  if (item) {
    Object.entries(item).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value ?? "";
    });
    form.elements.date.value = formatDateForInput(item.date);
    const duration = splitDurationInput(item.durationMinutes);
    form.elements.durationHours.value = duration.hours;
    form.elements.durationRemainder.value = duration.minutes;
    return;
  }
  form.elements.id.value = "";
  form.elements.type.value = "idea";
  form.elements.status.value = "want";
  form.elements.priority.value = "nice";
  form.elements.date.value = "";
  form.elements.durationHours.value = "";
  form.elements.durationRemainder.value = "";
  form.elements.participantId.value = getSelfParticipant().id;
}

function openItemSheet(itemId = null) {
  fillSelects();
  renderParticipantOwnerField();
  $("#deleteItemButton").style.display = itemId ? "inline-flex" : "none";
  $("#resetItemButton").style.display = itemId ? "inline-flex" : "none";
  $("#copyItemButton").hidden = !itemId;
  $("#itemSheetTitle").textContent = itemId ? "Редактировать элемент" : "Добавить в поездку";
  const trackedItem = itemId ? state.items.find((entry) => entry.id === itemId) : null;
  fillItemForm(trackedItem);
  renderItemAllocationSummary(trackedItem);
  renderAcceptedExpenseControls(trackedItem);
  updateOpenLinkButton();
  openSheet("itemSheet");
  itemFormOpenedAt = Date.now();
  if (trackedItem) {
    refreshAuthorExpenseProposals().then(() => {
      const currentItem = state.items.find((entry) => entry.id === trackedItem.id);
      renderAcceptedExpenseControls(currentItem);
    });
  }
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
}

function renderParticipantOwnerField() {
  $("#participantOwnerField").hidden = state.trip.participants.length <= 1;
}

function renderItemAllocationSummary(item) {
  const summary = $("#itemAllocationSummary");
  if (!summary) return;
  const allocations = item ? getItemAllocations(item) : [];
  if (!item || allocations.length <= 1 || !canShowBudget()) {
    summary.classList.add("hidden");
    summary.textContent = "";
    return;
  }
  summary.classList.remove("hidden");
  summary.textContent = `Распределено: ${allocations.map((allocation) => {
    const participant = getParticipantById(allocation.participantId);
    return `${participant.name} ${formatMoney(allocation.amount)}`;
  }).join(" · ")}`;
}

function getSavedItemAllocations(existing, price, participantId) {
  if (price <= 0) return [];
  if (!existing) return [{ participantId, amount: price }];
  const existingAllocations = getItemAllocations(existing);
  const existingTotal = existingAllocations.reduce((sum, allocation) => sum + parseMoney(allocation.amount), 0);
  const samePrice = parseMoney(existing.price) === price;
  const sameParticipant = (existing.participantId || "") === participantId;
  if (samePrice && sameParticipant && existingAllocations.length > 1 && existingTotal === price) {
    return existingAllocations.map((allocation) => ({ ...allocation }));
  }
  return [{ participantId, amount: price }];
}

function getItemAnalyticsFlags(item) {
  return {
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
  };
}

function saveItem(event) {
  event.preventDefault();
  if (isReadOnlyMode()) return;
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = state.items.find((entry) => entry.id === data.id);
  const isNew = !existing;
  const itemDate = parseDateFromInput(data.date);
  const participantId = state.trip.participants.some((participant) => participant.id === data.participantId)
    ? data.participantId
    : getSelfParticipant().id;
  const price = parseMoney(data.price);
  const item = {
    id: data.id || `item-${Date.now()}`,
    title: data.title.trim(),
    type: data.type || "idea",
    status: data.status || "want",
    priority: data.priority || "nice",
    date: itemDate,
    startTime: data.startTime || "",
    durationMinutes: getDurationFromInput(data.durationHours, data.durationRemainder),
    price,
    paidAmount: parseMoney(data.paidAmount),
    participantId,
    allocations: getSavedItemAllocations(existing, price, participantId),
    link: data.link.trim(),
    locationText: data.locationText.trim(),
    notes: data.notes.trim(),
    order: existing && (existing.date || "") === (itemDate || "") ? existing.order : getNextOrder(itemDate),
  };
  if (existing?.creationSource) item.creationSource = existing.creationSource;
  if (existing?.sourceProposalId) item.sourceProposalId = existing.sourceProposalId;
  if (existing?.proposedByUserId) item.proposedByUserId = existing.proposedByUserId;
  if (existing?.proposedByDisplayName) item.proposedByDisplayName = existing.proposedByDisplayName;
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
    ...getItemAnalyticsFlags(item),
    ...(isNew ? { creation_method: "manual" } : { changed_fields: changedFields }),
  });
  if (getTripOrigin() === "demo" && !isNew) {
    trackEvent("trainer_action_completed", {
      ...getTripAnalyticsContext(),
      action_type: "item_updated",
      trainer_version: TRAINER_VERSION,
    });
  }
  if (isNew) scheduleDonationPrompt();
  checkTripMilestones();
}

function getItemFormChangedFields(item) {
  const form = $("#itemForm");
  const current = {
    title: form.elements.title.value.trim(),
    type: form.elements.type.value,
    status: form.elements.status.value,
    priority: form.elements.priority.value,
    date: parseDateFromInput(form.elements.date.value) || "",
    startTime: form.elements.startTime.value || "",
    durationMinutes: getDurationFromInput(form.elements.durationHours.value, form.elements.durationRemainder.value),
    price: parseMoney(form.elements.price.value),
    paidAmount: parseMoney(form.elements.paidAmount.value),
    participantId: form.elements.participantId.value,
    link: form.elements.link.value.trim(),
    locationText: form.elements.locationText.value.trim(),
    notes: form.elements.notes.value.trim(),
  };
  return Object.keys(current).filter((field) => String(item[field] ?? "") !== String(current[field] ?? ""));
}

function getFormTimeBucket(openedAt) {
  if (!openedAt) return "under_10s";
  const seconds = (Date.now() - openedAt) / 1000;
  if (seconds < 10) return "under_10s";
  if (seconds <= 30) return "10_30s";
  if (seconds <= 60) return "31_60s";
  return "over_60s";
}

function resetCurrentItemForm() {
  const id = $("#itemForm").elements.id.value;
  if (!id) return;
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  const changedFields = getItemFormChangedFields(item);
  fillItemForm(item);
  updateOpenLinkButton();
  showToast("Изменения сброшены");
  if (changedFields.length === 0) return;
  trackEvent("item_form_reset", {
    ...getTripAnalyticsContext(),
    item_id: item.id,
    mode: "edit",
    had_unsaved_changes: true,
    changed_fields_count: changedFields.length,
    time_in_form_bucket: getFormTimeBucket(itemFormOpenedAt),
  });
}

function getNextOrderForItems(items, date) {
  const orders = items
    .filter((item) => (item.date || "") === (date || ""))
    .map((item) => Number(item.order))
    .filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function getNextOrder(date) {
  return getNextOrderForItems(state.items, date);
}

function getTripEntry(entryId) {
  return tripStore.trips.find((entry) => entry.id === entryId);
}

function getTripState(entryId) {
  if (entryId === state.trip.id) return state;
  const entry = getTripEntry(entryId);
  return entry ? normalizeState(structuredClone(entry.state)) : null;
}

function getCopyCandidateTrips() {
  return tripStore.trips.filter((entry) => !entry.isDemo && entry.id !== state.trip.id);
}

function createTripItemCopy({ sourceItem, sourceTrip, targetState, targetDate }) {
  const sameCurrency = sourceTrip.currency === targetState.trip.currency;
  const now = new Date().toISOString();
  const targetSelf = getSelfParticipant(targetState);
  const sameTrip = sourceTrip.id === targetState.trip.id;
  const copiedStatus = sourceItem.status === "paid" ? "fixed" : sourceItem.status;
  const price = sameCurrency ? parseMoney(sourceItem.price) : 0;
  const participantId = sameTrip ? sourceItem.participantId : targetSelf.id;
  return {
    ...sourceItem,
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: copiedStatus,
    date: targetDate || "",
    price,
    paidAmount: 0,
    participantId,
    allocations: sameTrip ? getItemAllocations(sourceItem) : (price > 0 ? [{ participantId, amount: price }] : []),
    order: getNextOrderForItems(targetState.items, targetDate),
    createdAt: now,
    updatedAt: now,
  };
}

function getCardCopySourceItem() {
  return state.items.find((item) => item.id === cardCopyState.sourceItemId) || null;
}

function getCardCopyTargetState() {
  if (!cardCopyState.targetTripId) return null;
  return getTripState(cardCopyState.targetTripId);
}

function getCardCopyDateOptions(targetState, { omitSourceBucket = false } = {}) {
  const sourceItem = getCardCopySourceItem();
  const dates = getTripDatesForTrip(targetState.trip).map((date, index) => ({
    value: date,
    title: `День ${index + 1}`,
    meta: formatDate(date),
  }));
  const options = [
    ...dates,
    { value: "", title: "Без даты", meta: "В конец списка идей без даты" },
  ];
  if (!omitSourceBucket || !sourceItem) return options;
  return options.filter((option) => (option.value || "") !== (sourceItem.date || ""));
}

function openCardCopySheet() {
  const sourceItemId = $("#itemForm").elements.id.value;
  const sourceItem = state.items.find((item) => item.id === sourceItemId);
  if (!sourceItem) return;
  cardCopyState = {
    sourceItemId,
    scope: "",
    targetTripId: "",
    targetDate: null,
    isSubmitting: false,
  };
  renderCardCopySheet();
  openSheet("cardCopySheet");
  if (!cardCopySheetHistoryArmed) {
    history.pushState({ backpackerCardCopySheet: true }, "");
    cardCopySheetHistoryArmed = true;
  }
  trackEvent("item_copy_opened", {
    ...getTripAnalyticsContext(),
    item_id: sourceItem.id,
    item_type: sourceItem.type,
    item_status: sourceItem.status,
    source_bucket: sourceItem.date ? "day" : "undated",
    available_destination_scope: getCopyCandidateTrips().length > 0 ? "both" : "same_trip",
  });
}

function dismissCardCopySheet(method = "close") {
  const sourceItem = getCardCopySourceItem();
  closeSheet("cardCopySheet");
  if (cardCopySheetHistoryArmed && method !== "back") {
    cardCopyIgnoreNextPop = true;
    history.back();
  }
  cardCopySheetHistoryArmed = false;
  trackEvent("item_copy_cancelled", {
    ...getTripAnalyticsContext(),
    item_id: sourceItem?.id || null,
    method,
  });
}

function renderCardCopySheet() {
  renderCardCopyScopeStep();
  renderCardCopyTripStep();
  renderCardCopyDateStep();
  renderCardCopyWarning();
  renderCardCopyActions();
}

function renderCardCopyScopeStep() {
  const container = $("#cardCopyScopeStep");
  const hasOtherTrips = getCopyCandidateTrips().length > 0;
  container.classList.toggle("hidden", Boolean(cardCopyState.scope));
  container.innerHTML = `
    <button class="card-copy-option" type="button" data-card-copy-scope="same" aria-pressed="${cardCopyState.scope === "same"}">
      <strong>В эту поездку</strong>
      <span>Выбрать другой день или «Без даты»</span>
    </button>
    ${hasOtherTrips ? `
      <button class="card-copy-option" type="button" data-card-copy-scope="another" aria-pressed="${cardCopyState.scope === "another"}">
        <strong>В другую поездку</strong>
        <span>Сначала выбрать поездку, потом день</span>
      </button>
    ` : ""}
  `;
}

function renderCardCopyTripStep() {
  const container = $("#cardCopyTripStep");
  const isVisible = cardCopyState.scope === "another" && !cardCopyState.targetTripId;
  container.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    container.innerHTML = "";
    return;
  }
  const trips = getCopyCandidateTrips();
  container.innerHTML = trips.map((entry) => {
    const trip = entry.state.trip;
    return `
      <button class="card-copy-option" type="button" data-card-copy-trip="${escapeAttr(entry.id)}">
        <strong>${escapeHtml(trip.title || "Новая поездка")}</strong>
        <span>${formatDate(trip.startDate)}-${formatDate(trip.endDate)} · ${escapeHtml(trip.destination || "Направление не задано")}</span>
      </button>
    `;
  }).join("");
}

function renderCardCopyDateStep() {
  const container = $("#cardCopyDateStep");
  const targetState = getCardCopyTargetState();
  const isVisible = Boolean(cardCopyState.scope && targetState);
  container.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    container.innerHTML = "";
    return;
  }
  const sameTrip = targetState.trip.id === state.trip.id;
  const options = getCardCopyDateOptions(targetState, { omitSourceBucket: sameTrip });
  container.innerHTML = options.length
    ? options.map((option) => `
      <button class="card-copy-option" type="button" data-card-copy-date="${escapeAttr(option.value)}" aria-pressed="${cardCopyState.targetDate !== null && (cardCopyState.targetDate || "") === (option.value || "")}">
        <strong>${escapeHtml(option.title)}</strong>
        <span>${escapeHtml(option.meta)}</span>
      </button>
    `).join("")
    : `<p class="card-copy-empty">В этой поездке нет другого дня или блока для копии.</p>`;
}

function renderCardCopyWarning() {
  const warning = $("#cardCopyWarning");
  const targetState = getCardCopyTargetState();
  const sourceItem = getCardCopySourceItem();
  const shouldWarn = Boolean(sourceItem && targetState && targetState.trip.id !== state.trip.id && targetState.trip.currency !== state.trip.currency);
  warning.classList.toggle("hidden", !shouldWarn);
  warning.textContent = shouldWarn
    ? "В выбранной поездке другая валюта. Стоимость карточки не будет скопирована."
    : "";
}

function renderCardCopyActions() {
  const confirmButton = $("#cardCopyConfirmButton");
  const backButton = $("#cardCopyBackButton");
  const targetState = getCardCopyTargetState();
  const options = targetState
    ? getCardCopyDateOptions(targetState, { omitSourceBucket: targetState.trip.id === state.trip.id })
    : [];
  const hasSelectedTarget = Boolean(cardCopyState.scope && targetState && cardCopyState.targetDate !== null && options.some((option) => (option.value || "") === (cardCopyState.targetDate || "")));
  confirmButton.disabled = !hasSelectedTarget || cardCopyState.isSubmitting;
  backButton.hidden = !cardCopyState.scope;
}

function handleCardCopyScope(scope) {
  cardCopyState.scope = scope;
  cardCopyState.targetTripId = scope === "same" ? state.trip.id : "";
  cardCopyState.targetDate = null;
  renderCardCopySheet();
}

function handleCardCopyTrip(targetTripId) {
  cardCopyState.targetTripId = targetTripId;
  cardCopyState.targetDate = null;
  renderCardCopySheet();
}

function handleCardCopyDate(targetDate) {
  cardCopyState.targetDate = targetDate || "";
  renderCardCopySheet();
}

function goBackCardCopyStep() {
  if (cardCopyState.scope === "another" && cardCopyState.targetTripId) {
    cardCopyState.targetTripId = "";
    cardCopyState.targetDate = null;
  } else {
    cardCopyState.scope = "";
    cardCopyState.targetTripId = "";
    cardCopyState.targetDate = null;
  }
  renderCardCopySheet();
}

function confirmCardCopy() {
  if (cardCopyState.isSubmitting) return;
  const sourceItem = getCardCopySourceItem();
  const targetState = getCardCopyTargetState();
  if (!sourceItem || !targetState) return;
  const options = getCardCopyDateOptions(targetState, { omitSourceBucket: targetState.trip.id === state.trip.id });
  if (cardCopyState.targetDate === null || !options.some((option) => (option.value || "") === (cardCopyState.targetDate || ""))) return;
  cardCopyState.isSubmitting = true;
  renderCardCopyActions();

  const copiedItem = createTripItemCopy({
    sourceItem,
    sourceTrip: state.trip,
    targetState,
    targetDate: cardCopyState.targetDate,
  });
  targetState.items.push(copiedItem);

  if (targetState.trip.id === state.trip.id) {
    state.items = targetState.items;
    saveState();
    render();
    checkTripMilestones();
  } else {
    const entryIndex = tripStore.trips.findIndex((entry) => entry.id === targetState.trip.id);
    if (entryIndex >= 0) {
      tripStore.trips[entryIndex] = createTripEntry(targetState, {
        id: tripStore.trips[entryIndex].id,
        isDemo: tripStore.trips[entryIndex].isDemo,
        createdAt: tripStore.trips[entryIndex].createdAt,
        updatedAt: new Date().toISOString(),
        coverDataUrl: tripStore.trips[entryIndex].coverDataUrl,
      });
      persistTripStore(tripStore);
    }
  }

  closeSheet("cardCopySheet");
  if (cardCopySheetHistoryArmed) {
    cardCopyIgnoreNextPop = true;
    history.back();
  }
  cardCopySheetHistoryArmed = false;
  const targetText = targetState.trip.id === state.trip.id
    ? (cardCopyState.targetDate ? formatDate(cardCopyState.targetDate) : "Без даты")
    : `поездку «${targetState.trip.title || "Новая поездка"}»`;
  showToast(`Карточка скопирована в ${targetText}`);
  const sameTrip = targetState.trip.id === state.trip.id;
  const hasTargetDate = Boolean(cardCopyState.targetDate);
  const copyDestinationType = sameTrip
    ? (hasTargetDate ? "same_trip_other_day" : "same_trip_undated")
    : (hasTargetDate ? "other_trip_day" : "other_trip_undated");
  trackEvent("item_created", {
    ...getTripAnalyticsContext(targetState.trip),
    item_id: copiedItem.id,
    ...getItemAnalyticsFlags(copiedItem),
    creation_method: "copy",
    copy_destination_type: copyDestinationType,
  });
  cardCopyState.isSubmitting = false;
}

function moveItem(itemId, targetDate, beforeItemId = null, method = "drag_desktop") {
  if (isReadOnlyMode()) return;
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
  if (isReadOnlyMode()) return;
  const id = $("#itemForm").elements.id.value;
  if (!id) return;
  const item = state.items.find((entry) => entry.id === id);
  const title = item?.title || "элемент";
  if (!window.confirm(`Удалить «${title}»? Это действие нельзя отменить.`)) return;
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
  if (isReadOnlyMode()) return;
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
  state.items = state.items.map((item) => {
    const allocations = getItemAllocations(item).map((allocation) => (
      allocation.participantId === participant.id ? { ...allocation, participantId: selfParticipant.id } : allocation
    ));
    return item.participantId === participant.id
      ? { ...item, participantId: selfParticipant.id, allocations }
      : { ...item, allocations };
  });
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
  if (isReadOnlyMode()) return;
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
  $("#tripPdfOptions")?.classList.add("hidden");
  $("#tripLinkOptions")?.classList.add("hidden");
  $("#openTripLinkButton").hidden = isReadOnlyMode();
  $("#shareTripTextButton").hidden = isReadOnlyMode();
  $("#downloadEstimateButton").hidden = isReadOnlyMode() && !canShowBudget();
  $("#openTripPdfOptionsButton").hidden = isReadOnlyMode() && !canShowBudget();
  openSheet("shareSheet");
  trackEvent("share_opened", { ...getTripAnalyticsContext(), share_context: "trip" });
}

function renderSharePreview() {
  const target = $("#sharePreview");
  if (target) target.textContent = buildShareText(false);
}

function getTripShareRecord() {
  return shareRecords[state.trip.id] || null;
}

function saveTripShareRecord(record) {
  shareRecords[state.trip.id] = {
    ...record,
    tripId: state.trip.id,
    updatedAt: new Date().toISOString(),
  };
  persistShareRecords();
}

function removeTripShareRecord() {
  delete shareRecords[state.trip.id];
  persistShareRecords();
}

function buildTripShareUrl(token) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", token);
  return url.toString();
}

function buildPublishedTripState() {
  const published = normalizeState(structuredClone(state));
  const entry = tripStore.trips.find((trip) => trip.id === published.trip.id);
  if (entry?.coverDataUrl) published.trip.coverDataUrl = entry.coverDataUrl;
  return published;
}

async function publishTripShare(options = {}) {
  const existing = getTripShareRecord();
  const includeBudget = options.includeBudget !== false;
  const mustRotateToken = Boolean(existing?.shareId && !existing?.token);
  if (mustRotateToken) {
    await callTripShareFunction("revoke", { tripId: state.trip.id }, { requireOwner: true }).catch(() => {});
    removeTripShareRecord();
  }
  const payload = await callTripShareFunction("publish", {
    tripId: state.trip.id,
    includeBudget,
    rotateToken: mustRotateToken,
    schemaVersion: TRIP_SHARE_SCHEMA_VERSION,
    state: buildPublishedTripState(),
  }, { requireOwner: true });
  const token = payload.token || existing?.token || "";
  const record = {
    shareId: payload.shareId || existing?.shareId || "",
    token,
    includeBudget,
    revoked: false,
    ownerSessionLimitation: "Anonymous Auth: после потери браузерной сессии управление ссылкой не восстанавливается до появления постоянных аккаунтов.",
  };
  saveTripShareRecord(record);
  return record;
}

async function updatePublishedTripShare(options = {}) {
  const existing = getTripShareRecord();
  if (!existing?.shareId || existing.revoked) return null;
  if (!existing.token) return publishTripShare({ includeBudget: options.includeBudget ?? existing.includeBudget });
  const includeBudget = options.includeBudget ?? (existing.includeBudget !== false);
  const payload = await callTripShareFunction("update", {
    tripId: state.trip.id,
    includeBudget,
    schemaVersion: TRIP_SHARE_SCHEMA_VERSION,
    state: buildPublishedTripState(),
  }, { requireOwner: true });
  const record = {
    ...existing,
    shareId: payload.shareId || existing.shareId,
    includeBudget,
    revoked: false,
  };
  saveTripShareRecord(record);
  return record;
}

async function ensureTripSharePublished(options = {}) {
  const existing = getTripShareRecord();
  if (existing?.shareId && existing.token && !existing.revoked) {
    return updatePublishedTripShare({ includeBudget: options.includeBudget ?? existing.includeBudget });
  }
  return publishTripShare(options);
}

function schedulePublishedTripSync() {
  const record = getTripShareRecord();
  if (!record?.shareId || record.revoked || isReadOnlyMode()) return;
  window.clearTimeout(tripShareSyncTimer);
  tripShareSyncTimer = window.setTimeout(async () => {
    if (tripShareSyncInFlight) {
      schedulePublishedTripSync();
      return;
    }
    tripShareSyncInFlight = true;
    try {
      await updatePublishedTripShare();
    } catch {
      showToast("Не удалось обновить опубликованную поездку");
    } finally {
      tripShareSyncInFlight = false;
    }
  }, TRIP_SHARE_SYNC_DEBOUNCE_MS);
}

function renderTripLinkOptions(record = getTripShareRecord()) {
  const panel = $("#tripLinkOptions");
  if (!panel) return;
  const includeInput = $("#tripLinkIncludeBudget");
  if (includeInput && record) includeInput.checked = record.includeBudget !== false;
  const input = $("#tripShareLinkInput");
  const status = $("#tripShareLinkStatus");
  const copyButton = $("#copyTripLinkButton");
  const revokeButton = $("#revokeTripLinkButton");
  const hasActiveLink = Boolean(record?.token && !record.revoked);
  if (input) input.value = hasActiveLink ? buildTripShareUrl(record.token) : "";
  if (copyButton) copyButton.disabled = !hasActiveLink && !isSupabaseConfigured();
  if (revokeButton) revokeButton.disabled = !hasActiveLink;
  if (status) {
    status.classList.toggle("error", !isSupabaseConfigured());
    status.textContent = isSupabaseConfigured()
      ? (hasActiveLink ? "Изменения поездки будут обновляться автоматически." : "Ссылка ещё не создана.")
      : "Supabase не настроен: ссылка не создана.";
  }
}

async function showTripLinkOptions(profileReady = false) {
  if (isReadOnlyMode()) return;
  if (!profileReady) {
    await requireProfileForSharedAction("publish_link", () => showTripLinkOptions(true));
    return;
  }
  const panel = $("#tripLinkOptions");
  if (panel && !panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    return;
  }
  $("#tripPdfOptions")?.classList.add("hidden");
  panel?.classList.remove("hidden");
  renderTripLinkOptions();
  try {
    const record = await ensureTripSharePublished({ includeBudget: $("#tripLinkIncludeBudget")?.checked ?? true });
    renderTripLinkOptions(record);
    showToast("Доступ по ссылке открыт");
    trackEvent("share_method_selected", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "link", method: "link_access" });
  } catch {
    renderTripLinkOptions();
    showToast(isSupabaseConfigured() ? "Не удалось открыть доступ" : "Supabase не настроен");
  }
}

async function copyTripShareLink(profileReady = false) {
  if (!profileReady) {
    await requireProfileForSharedAction("copy_link", () => copyTripShareLink(true));
    return;
  }
  try {
    let record = getTripShareRecord();
    if (!record?.token) record = await publishTripShare({ includeBudget: $("#tripLinkIncludeBudget")?.checked ?? true });
    const url = buildTripShareUrl(record.token);
    renderTripLinkOptions(record);
    await copyText(url);
    showToast("Ссылка скопирована");
    trackEvent("share_completed", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "link", method: "clipboard" });
  } catch {
    renderTripLinkOptions();
    showToast(isSupabaseConfigured() ? "Не удалось скопировать ссылку" : "Supabase не настроен");
  }
}

async function updateTripShareBudgetVisibility(profileReady = false) {
  const record = getTripShareRecord();
  if (!record?.shareId) return;
  if (!profileReady) {
    await requireProfileForSharedAction("update_link", () => updateTripShareBudgetVisibility(true));
    return;
  }
  try {
    const updated = await updatePublishedTripShare({ includeBudget: $("#tripLinkIncludeBudget")?.checked ?? true });
    renderTripLinkOptions(updated);
    showToast("Настройка ссылки обновлена");
  } catch {
    showToast("Не удалось обновить ссылку");
  }
}

async function revokeTripShareLink(profileReady = false) {
  const record = getTripShareRecord();
  if (!record?.shareId) return;
  if (!profileReady) {
    await requireProfileForSharedAction("revoke_link", () => revokeTripShareLink(true));
    return;
  }
  try {
    await callTripShareFunction("revoke", { tripId: state.trip.id }, { requireOwner: true });
  } catch {
    showToast("Не удалось отозвать доступ");
    return;
  }
  saveTripShareRecord({
    ...record,
    revoked: true,
  });
  const input = $("#tripShareLinkInput");
  if (input) input.value = "";
  showToast("Доступ отозван");
}

function buildShareText(compact = false) {
  const totals = getTotals();
  const lines = [
    `Backpacker: ${state.trip.title}`,
    `${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)} · ${state.trip.destination}`,
    "",
  ];
  if (canShowBudget()) {
    lines.push(
      "Бюджет:",
      `Оплачено: ${formatMoney(totals.paid)}`,
      `План: ${formatMoney(totals.possible)}`,
      `Остаток: ${formatMoney(totals.remaining)}`,
      "",
    );
  }
  getTripDates().forEach((date, index) => {
    const items = state.items.filter((item) => item.date === date && item.status !== "skipped").sort(sortItems);
    lines.push(`День ${index + 1} · ${formatDate(date)}`);
    if (!items.length) lines.push("- пока пусто");
    items.forEach((item) => {
      const priceText = canShowBudget() ? ` · ${formatMoney(item.price)}` : "";
      lines.push(`- ${item.startTime ? `${item.startTime} ` : ""}${item.title} · ${getStatusLabel(item.status)}${priceText}`);
    });
    lines.push("");
  });
  const unscheduled = state.items.filter((item) => !item.date && item.status !== "skipped");
  if (unscheduled.length) {
    lines.push("Без даты:");
    unscheduled.forEach((item) => {
      const priceText = canShowBudget() ? ` · ${formatMoney(item.price)}` : "";
      lines.push(`- ${item.title} · ${getStatusLabel(item.status)}${priceText}`);
    });
  }
  return compact ? lines.filter(Boolean).join("\n") : lines.join("\n");
}

function buildEstimateText() {
  const { header, rows } = buildEstimateRows();
  return [header.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
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
  const participants = state.trip.participants;
  const header = ["День", "Статья", "Категория", "Всего", ...participants.map((participant) => participant.name)];
  const rows = [...state.items]
    .filter(isActiveCost)
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || sortItems(a, b))
    .map((item) => {
      const allocations = getItemAllocations(item);
      const allocationByParticipant = new Map(allocations.map((allocation) => [allocation.participantId, parseMoney(allocation.amount)]));
      return [
        item.date ? formatDate(item.date) : "без даты",
        item.title,
        getTypeLabel(item.type),
        getItemAllocationTotal(item),
        ...participants.map((participant) => allocationByParticipant.get(participant.id) || 0),
      ];
    });
  const totals = participants.map((participant, index) => rows.reduce((sum, row) => sum + parseMoney(row[index + 4]), 0));
  rows.push(["Итого", "", "", rows.reduce((sum, row) => sum + parseMoney(row[3]), 0), ...totals]);
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
  downloadBlobFile(fileName, blob);
}

function downloadBlobFile(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeSpreadsheetValue(value = "") {
  return escapeHtml(String(value ?? ""));
}

function buildSpreadsheetHtml(title, table) {
  const headerHtml = table.header.map((cell) => `<th>${escapeSpreadsheetValue(cell)}</th>`).join("");
  const textColumnIndexes = table.header
    .map((cell, index) => (cell === "Время" ? index : -1))
    .filter((index) => index >= 0);
  const rowsHtml = table.rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => {
            const className = textColumnIndexes.includes(index) ? ` class="spreadsheet-text"` : "";
            return `<td${className}>${escapeSpreadsheetValue(cell)}</td>`;
          })
          .join("")}</tr>`,
    )
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
    .spreadsheet-text { mso-number-format:"\\@"; }
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
  if (!canShowBudget()) {
    showToast("Автор скрыл смету");
    return;
  }
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
  if (!canShowBudget()) {
    showToast("Автор скрыл смету");
    return;
  }
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

function showTripPdfOptions() {
  const options = $("#tripPdfOptions");
  options?.classList.toggle("hidden");
}

function getTripPdfOptions() {
  return {
    includeBudget: canShowBudget() && ($("#tripPdfIncludeBudget")?.checked ?? true),
    includeNotes: $("#tripPdfIncludeNotes")?.checked ?? false,
    includeUndated: $("#tripPdfIncludeUndated")?.checked ?? true,
  };
}

const TRIP_PDF_DEFAULT_OPTIONS = { includeBudget: true, includeNotes: false, includeUndated: true };

function getTripPdfChangedOptionKeys(options) {
  const changed = [];
  if (options.includeBudget !== TRIP_PDF_DEFAULT_OPTIONS.includeBudget) changed.push("budget");
  if (options.includeNotes !== TRIP_PDF_DEFAULT_OPTIONS.includeNotes) changed.push("notes");
  if (options.includeUndated !== TRIP_PDF_DEFAULT_OPTIONS.includeUndated) changed.push("undated");
  return changed;
}

function getTripPdfChangedOptionsBucket(options) {
  const changed = getTripPdfChangedOptionKeys(options);
  if (changed.length === 0) return "none";
  if (changed.length > 1) return "multiple";
  return changed[0];
}

function getTripPdfAnalyticsOptionProps(options) {
  return {
    include_budget: options.includeBudget,
    include_notes: options.includeNotes,
    include_undated: options.includeUndated,
    options_changed: getTripPdfChangedOptionKeys(options).length > 0,
    changed_options: getTripPdfChangedOptionsBucket(options),
  };
}

function classifyTripPdfGenerationFailure(error) {
  if (error?.message === "pdf-lib unavailable") return "browser";
  return "generation";
}

function getTripPdfItemCount(options) {
  const datedCount = state.items.filter((item) => item.date && item.status !== "skipped").length;
  const undatedCount = options.includeUndated
    ? state.items.filter((item) => !item.date && item.status !== "skipped").length
    : 0;
  return datedCount + undatedCount;
}

function getTripPdfFileName() {
  const start = state.trip.startDate ? state.trip.startDate.replaceAll("-", "") : "trip";
  const end = state.trip.endDate ? state.trip.endDate.replaceAll("-", "") : "";
  const range = end && end !== start ? `${start}-${end}` : start;
  return `backpacker-${slugifyFileName(state.trip.title)}-${range}.pdf`;
}

function drawPdfWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
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
  const visibleLines = lines.slice(0, maxLines);
  visibleLines.forEach((item, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    ctx.fillText(`${item}${suffix}`, x, y + index * lineHeight);
  });
  return visibleLines.length * lineHeight;
}

async function buildTripPdfBlob(options) {
  if (!window.PDFLib?.PDFDocument) throw new Error("pdf-lib unavailable");
  const { PDFDocument } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 595;
  const pageHeight = 842;
  const scale = 2;
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const canvas = document.createElement("canvas");
  canvas.width = pageWidth * scale;
  canvas.height = pageHeight * scale;
  const ctx = canvas.getContext("2d");
  const pages = [];
  let y = margin;

  function loadPdfImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function loadPdfSvgIcon(svgText, color = "#ffffff") {
    return new Promise((resolve) => {
      if (!svgText) {
        resolve(null);
        return;
      }
      const svg = svgText
        .replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" `)
        .replace(/aria-hidden="true"/g, "");
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  }

  const logoImage = await loadPdfImage("./icons/backpacker-logo-transparent.png");
  const statusImages = {};
  await Promise.all(["paid", "fixed", "want", "maybe", "backup"].map(async (status) => {
    statusImages[status] = await loadPdfImage(`./assets/status-${status}.png`);
  }));
  const typeImages = {};
  await Promise.all(Object.keys(typeIcons).map(async (type) => {
    typeImages[type] = await loadPdfSvgIcon(typeIcons[type], "#ffffff");
  }));

  function startPage() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, pageWidth, pageHeight);
    ctx.fillStyle = "#fbf8f0";
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    y = margin;
  }

  async function commitPage() {
    const pngBytes = await new Promise((resolve) => canvas.toBlob((blob) => blob.arrayBuffer().then(resolve), "image/png"));
    pages.push(pngBytes);
  }

  async function ensureSpace(height) {
    if (y + height <= pageHeight - margin) return;
    await commitPage();
    startPage();
  }

  function drawSectionTitle(title, meta = "") {
    ctx.fillStyle = "#dfe9e5";
    roundRect(ctx, margin, y, contentWidth, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#1f2423";
    ctx.font = "700 15px Arial, sans-serif";
    ctx.fillText(title, margin + 12, y + 22);
    if (meta) {
      ctx.font = "700 11px Arial, sans-serif";
      ctx.fillStyle = "#66716f";
      ctx.fillText(meta, margin + contentWidth - ctx.measureText(meta).width - 12, y + 22);
    }
    y += 46;
  }

  function drawPdfMetricCard(x, cardY, width, height, label, value, variant = "") {
    ctx.fillStyle = variant === "paid" ? "#eff8f1" : "#fffdf8";
    roundRect(ctx, x, cardY, width, height, 6);
    ctx.fill();
    ctx.strokeStyle = variant === "paid" ? "rgba(45, 123, 82, 0.3)" : "#ded8cc";
    ctx.stroke();
    ctx.fillStyle = variant === "paid" ? "#2d7b52" : "#66716f";
    ctx.font = "800 11px Arial, sans-serif";
    drawPdfWrappedText(ctx, label, x + 8, cardY + 17, width - 16, 13, 2);
    ctx.fillStyle = "#1f2423";
    ctx.font = "800 16px Arial, sans-serif";
    ctx.fillText(value, x + 8, cardY + height - 12);
  }

  function drawHeader() {
    const totals = getTotals();
    const hasGroupParticipants = state.trip.participants.length > 1;
    const headerHeight = hasGroupParticipants ? 184 : 164;
    ctx.fillStyle = "#eef3ef";
    roundRect(ctx, margin, y, contentWidth, headerHeight, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(222, 216, 204, 0.8)";
    ctx.stroke();

    if (logoImage) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.48)";
      roundRect(ctx, margin + 10, y + 12, 46, 46, 8);
      ctx.fill();
      ctx.drawImage(logoImage, margin + 14, y + 16, 38, 38);
    }
    ctx.fillStyle = "#1f2423";
    ctx.font = "800 22px Arial, sans-serif";
    drawPdfWrappedText(ctx, state.trip.title || "Поездка", margin + 66, y + 31, contentWidth - 76, 25, 1);
    ctx.font = "700 12px Arial, sans-serif";
    ctx.fillStyle = "#66716f";
    const meta = `${state.trip.destination || "Направление не задано"} · ${formatDate(state.trip.startDate)}-${formatDate(state.trip.endDate)} · ${formatTripDayCount(state.trip)}`;
    drawPdfWrappedText(ctx, meta, margin + 66, y + 56, contentWidth - 76, 15, 1);

    ctx.fillStyle = "rgba(255, 253, 248, 0.78)";
    roundRect(ctx, margin + 180, y + 74, contentWidth - 190, 30, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(18, 54, 61, 0.18)";
    ctx.stroke();
    ctx.fillStyle = "#12363d";
    ctx.font = "800 13px Arial, sans-serif";
    ctx.fillText(`Бюджет ${formatMoney(state.trip.budgetLimit)}`, margin + 194, y + 94);

    const cardGap = 8;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    const cardY = y + 114;
    drawPdfMetricCard(margin, cardY, cardWidth, 42, "Оплачено", formatMoney(totals.paid), "paid");
    drawPdfMetricCard(margin + cardWidth + cardGap, cardY, cardWidth, 42, "Уже распределено", formatMoney(totals.possible));
    drawPdfMetricCard(margin + (cardWidth + cardGap) * 2, cardY, cardWidth, 42, "Осталось распределить", formatMoney(totals.remaining));
    if (hasGroupParticipants) {
      ctx.fillStyle = "#66716f";
      ctx.font = "800 11px Arial, sans-serif";
      ctx.fillText("Участники", margin + 8, y + 175);
      ctx.fillStyle = "#1f2423";
      ctx.font = "700 11px Arial, sans-serif";
      drawPdfWrappedText(
        ctx,
        state.trip.participants.map((participant) => participant.name).join(" · "),
        margin + 84,
        y + 175,
        contentWidth - 92,
        13,
        1,
      );
    }
    y += headerHeight + 16;
  }

  async function drawBudget() {
    if (!options.includeBudget) return;
    const totals = getTotals();
    const hasGroupParticipants = state.trip.participants.length > 1;
    const height = hasGroupParticipants ? 136 : 118;
    await ensureSpace(height);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, margin, y, contentWidth, height - 12, 8);
    ctx.fill();
    ctx.strokeStyle = "#ded8cc";
    ctx.stroke();
    ctx.fillStyle = "#1f2423";
    ctx.font = "800 15px Arial, sans-serif";
    ctx.fillText("Бюджет", margin + 14, y + 24);
    const budgetRows = [
      ["Бюджет", formatMoney(state.trip.budgetLimit)],
      ["Оплачено", formatMoney(totals.paid)],
      ["Уже распределено", formatMoney(totals.possible)],
      ["Осталось распределить", formatMoney(totals.remaining)],
    ];
    ctx.font = "700 11px Arial, sans-serif";
    budgetRows.forEach((row, index) => {
      const rowY = y + 48 + index * 18;
      ctx.fillStyle = "#66716f";
      ctx.fillText(row[0], margin + 14, rowY);
      ctx.fillStyle = "#1f2423";
      ctx.fillText(row[1], margin + 190, rowY);
    });
    if (hasGroupParticipants) {
      const rowY = y + 48 + budgetRows.length * 18;
      ctx.fillStyle = "#66716f";
      ctx.fillText("Участники", margin + 14, rowY);
      ctx.fillStyle = "#1f2423";
      drawPdfWrappedText(
        ctx,
        state.trip.participants.map((participant) => participant.name).join(" · "),
        margin + 190,
        rowY,
        contentWidth - 204,
        13,
        1,
      );
    }
    y += height;
  }

  function getPdfParticipantColor(participant) {
    return {
      orange: "#ff8f3d",
      yellow: "#ffcf36",
      blue: "#7fd8ee",
      teal: "#65c7a0",
      purple: "#c8a7da",
      pink: "#f7a7b6",
    }[participant?.colorKey] || "#ffbe35";
  }

  function getPdfStatusMark(status) {
    return {
      paid: "✓",
      fixed: "Б",
      want: "Х",
      maybe: "?",
      backup: "З",
      skipped: "×",
    }[status] || "•";
  }

  function drawPdfBadge(cx, cy, radius, fill, text, textColor = "#ffffff") {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = "900 12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawPdfImageBadge(cx, cy, radius, fill, image, fallbackText, textColor = "#ffffff") {
    drawPdfBadge(cx, cy, radius, fill, "", textColor);
    if (image) {
      ctx.save();
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(image, cx - radius * 0.58, cy - radius * 0.58, radius * 1.16, radius * 1.16);
      ctx.restore();
      return;
    }
    ctx.fillStyle = textColor;
    ctx.font = `900 ${Math.max(8, radius * 0.7)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fallbackText, cx, cy + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawPdfSlot(x, slotY, width, text, fill) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, slotY, width, 26, 4);
    ctx.fill();
    ctx.fillStyle = "#1f2423";
    ctx.font = "500 14px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width / 2, slotY + 13);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawPdfTimeSlots(item, x, slotY, fill) {
    const start = splitTimeSlots(item.startTime);
    const end = splitTimeSlots(getEndTime(item.startTime, item.durationMinutes));
    const slotWidth = 31;
    const gap = 5;
    drawPdfSlot(x, slotY, slotWidth, start[0], fill);
    drawPdfSlot(x + slotWidth + gap, slotY, slotWidth, start[1], fill);
    ctx.fillStyle = getPdfTypeColor(item.type);
    ctx.font = "500 16px Arial, sans-serif";
    ctx.fillText("-", x + slotWidth * 2 + gap * 2 + 2, slotY + 18);
    drawPdfSlot(x + slotWidth * 2 + gap * 3 + 13, slotY, slotWidth, end[0], fill);
    drawPdfSlot(x + slotWidth * 3 + gap * 4 + 13, slotY, slotWidth, end[1], fill);
  }

  function drawPdfDateSlots(item, x, slotY, fill) {
    const [day, month, year] = getItemDateSlots(item.date);
    drawPdfSlot(x, slotY, 31, day, fill);
    ctx.fillStyle = getPdfTypeColor(item.type);
    ctx.font = "500 16px Arial, sans-serif";
    ctx.fillText(".", x + 36, slotY + 18);
    drawPdfSlot(x + 46, slotY, 31, month, fill);
    ctx.fillText(".", x + 82, slotY + 18);
    drawPdfSlot(x + 92, slotY, 68, year, fill);
  }

  function drawPdfPricePill(text, x, pillY, width) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    roundRect(ctx, x, pillY, width, 28, 4);
    ctx.fill();
    ctx.strokeStyle = "#6f7877";
    ctx.stroke();
    ctx.fillStyle = "#1f2423";
    ctx.font = "800 13px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width - 8, pillY + 14);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawPdfItem(item, x, itemY, width) {
    const baseWidth = 220;
    const baseHeight = 264;
    const itemScale = width / baseWidth;
    ctx.save();
    ctx.translate(x, itemY);
    ctx.scale(itemScale, itemScale);

    const headerHeight = 44;
    const bodyY = itemY + headerHeight;
    const localBodyY = headerHeight;
    const bodyHeight = 220;
    const height = headerHeight + bodyHeight;
    const padding = 12;
    const itemParticipants = getParticipantsForItem(item).slice(0, 3);
    const showParticipantBadge = state.trip.participants.length > 1 && itemParticipants.length;
    const badgeX = baseWidth - padding - 18;
    const accent = getPdfTypeColor(item.type);
    const slotFill = getPdfTypeSlotColor(item.type);
    ctx.fillStyle = getPdfTypeBodyColor(item.type);
    roundRect(ctx, 0, 0, baseWidth, height, 6);
    ctx.fill();
    ctx.strokeStyle = "#ded8cc";
    ctx.stroke();
    ctx.save();
    roundRect(ctx, 0, 0, baseWidth, height, 6);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, baseWidth, headerHeight);
    ctx.restore();
    const typeImage = typeImages[item.type] || typeImages.other;
    if (typeImage) {
      ctx.drawImage(typeImage, padding + 2, 8, 28, 28);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 23px Arial, sans-serif";
      ctx.fillText(getPdfTypeMark(item.type), padding + 2, 29);
    }
    const typeLabel = getTypeLabel(item.type).toUpperCase();
    ctx.font = "800 18px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(typeLabel, baseWidth - padding, 28);
    ctx.textAlign = "left";

    const price = options.includeBudget && parseMoney(item.price) ? formatMoney(item.price) : "--";
    const priceWidth = Math.max(78, Math.min(100, ctx.measureText(price).width + 20));
    drawPdfPricePill(price, baseWidth - padding - priceWidth, localBodyY + 17, priceWidth);

    ctx.fillStyle = "#1f2423";
    ctx.font = "800 14px Arial, sans-serif";
    drawPdfWrappedText(ctx, item.title, padding, localBodyY + 22, baseWidth - padding * 2 - priceWidth - 10, 17, 2);
    ctx.fillStyle = accent;
    ctx.font = "900 italic 13px Arial, sans-serif";
    ctx.fillText(formatDurationText(item.durationMinutes), padding, localBodyY + 64);
    drawPdfTimeSlots(item, padding, localBodyY + 73, slotFill);
    ctx.fillStyle = accent;
    ctx.font = "900 italic 13px Arial, sans-serif";
    ctx.fillText("Дата", padding, localBodyY + 124);
    drawPdfDateSlots(item, padding, localBodyY + 133, slotFill);

    drawPdfImageBadge(badgeX, localBodyY + 87, 18, accent, statusImages[item.status], getPdfStatusMark(item.status));
    if (showParticipantBadge) {
      itemParticipants.forEach((participant, index) => {
        drawPdfBadge(badgeX - index * 15, localBodyY + 134, 18, getPdfParticipantColor(participant), participant.initials, "#1f2423");
      });
    }
    if (options.includeNotes && item.notes) {
      ctx.font = "400 10px Arial, sans-serif";
      ctx.fillStyle = "#1f2423";
      drawPdfWrappedText(ctx, item.notes, padding, localBodyY + 182, baseWidth - padding * 2, 13, 3);
    }
    ctx.restore();
    return baseHeight * itemScale;
  }

  async function drawItemGrid(items) {
    const columns = 4;
    const gap = 8;
    const cardWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
    const cardHeight = cardWidth * (264 / 220);
    let index = 0;
    while (index < items.length) {
      await ensureSpace(cardHeight + 12);
      items.slice(index, index + columns).forEach((item, offset) => {
        drawPdfItem(item, margin + offset * (cardWidth + gap), y, cardWidth);
      });
      y += cardHeight + 12;
      index += columns;
    }
  }

  startPage();
  drawHeader();

  for (const [index, date] of getTripDates().entries()) {
    const items = state.items.filter((item) => item.date === date && item.status !== "skipped").sort(sortItems);
    await ensureSpace(60);
    drawSectionTitle(`День ${index + 1}`, formatDate(date));
    if (items.length) {
      await drawItemGrid(items);
    } else {
      ctx.font = "700 12px Arial, sans-serif";
      ctx.fillStyle = "#66716f";
      ctx.fillText("Пока пусто", margin, y);
      y += 28;
    }
  }

  const undated = state.items.filter((item) => !item.date && item.status !== "skipped").sort(sortItems);
  if (options.includeUndated && undated.length) {
    await ensureSpace(60);
    drawSectionTitle("Без даты", "Идеи и запасные варианты");
    await drawItemGrid(undated);
  }

  await commitPage();
  for (const pngBytes of pages) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const image = await pdfDoc.embedPng(pngBytes);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

function drawPdfMeasureLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
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
  return lines.length ? lines : [""];
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

  function getPdfTypeColor(type) {
    return {
      ticket: "#4fb986",
    stay: "#e8a51d",
    transport: "#1aaec3",
    excursion: "#e97725",
    food: "#d94a35",
    place: "#0c8ca8",
    spa: "#8f4f6c",
    shopping: "#689d72",
    idea: "#d88d22",
    }[type] || "#d88d22";
  }

  function getPdfTypeBodyColor(type) {
    return {
      ticket: "#ddf4e9",
      stay: "#fff0c9",
      transport: "#d7f4f7",
      excursion: "#ffe1c8",
      food: "#ffe0db",
      place: "#d9f1f5",
      spa: "#f0dde5",
      shopping: "#e6f1e8",
      idea: "#ffefcf",
    }[type] || "#ffefcf";
  }

  function getPdfTypeSlotColor(type) {
    return {
      ticket: "#9ee1bf",
      stay: "#ffd979",
      transport: "#91e0ea",
      excursion: "#ffb27a",
      food: "#f6aaa0",
      place: "#81d0de",
      spa: "#c998ae",
      shopping: "#a9d4b1",
      idea: "#f0bf72",
    }[type] || "#f0bf72";
  }

  function getPdfTypeMark(type) {
    return {
      ticket: "↔",
      stay: "⌂",
      transport: "▣",
      excursion: "♙",
      food: "♨",
      place: "⌖",
      spa: "♨",
      shopping: "□",
      idea: "○",
    }[type] || "○";
  }

function setTripPdfButtonsBusy(isBusy, label = "") {
  const downloadButton = $("#downloadTripPdfButton");
  const shareButton = $("#shareTripPdfButton");
  [downloadButton, shareButton].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
  if (downloadButton) downloadButton.textContent = isBusy && label === "download" ? "Готовим..." : "Скачать";
  if (shareButton) shareButton.textContent = isBusy && label === "share" ? "Готовим..." : "Поделиться";
}

async function prepareTripPdfExport(deliveryMethod) {
  if (tripPdfGenerating) return;
  const options = getTripPdfOptions();
  const itemCount = getTripPdfItemCount(options);
  if (!itemCount) {
    showToast("В поездке пока нет элементов для экспорта.");
    return;
  }
  tripPdfGenerating = true;
  setTripPdfButtonsBusy(true, deliveryMethod);
  const optionProps = getTripPdfAnalyticsOptionProps(options);
  trackEvent("export_started", {
    ...getTripAnalyticsContext(),
    export_type: "trip_pdf",
    delivery_method: deliveryMethod,
    ...optionProps,
  });
  let blob;
  try {
    blob = await buildTripPdfBlob(options);
  } catch (error) {
    trackEvent("export_failed", {
      ...getTripAnalyticsContext(),
      export_type: "trip_pdf",
      delivery_method: deliveryMethod,
      failure_reason_bucket: classifyTripPdfGenerationFailure(error),
    });
    showToast("Не удалось создать PDF. Попробуйте ещё раз.");
    tripPdfGenerating = false;
    setTripPdfButtonsBusy(false);
    return;
  }
  const fileName = getTripPdfFileName();
  trackEvent("export_completed", {
    ...getTripAnalyticsContext(),
    export_type: "trip_pdf",
    delivery_method: deliveryMethod,
    ...optionProps,
  });
  return { blob, fileName };
}

async function downloadTripPdf() {
  const result = await prepareTripPdfExport("download");
  if (!result) return;
  downloadBlobFile(result.fileName, result.blob);
  showToast("PDF сохранён");
  tripPdfGenerating = false;
  setTripPdfButtonsBusy(false);
}

async function shareTripPdf() {
  const probeFile = new File(["probe"], "probe.pdf", { type: "application/pdf" });
  const canShareFiles = Boolean(navigator.canShare?.({ files: [probeFile] }) && navigator.share);
  const deliveryMethod = canShareFiles ? "share" : "download";
  const result = await prepareTripPdfExport(deliveryMethod);
  if (!result) return;
  try {
    if (canShareFiles) {
      const file = new File([result.blob], result.fileName, { type: "application/pdf" });
      await navigator.share({
        title: `Backpacker: ${state.trip.title}`,
        text: "План поездки из Backpacker",
        files: [file],
      });
      trackEvent("share_completed", { ...getTripAnalyticsContext(), share_format: "pdf", method: "web_share" });
      showToast("PDF отправлен");
    } else {
      downloadBlobFile(result.fileName, result.blob);
      showToast("PDF сохранён. Его можно отправить из загрузок.");
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      trackEvent("export_failed", {
        ...getTripAnalyticsContext(),
        export_type: "trip_pdf",
        delivery_method: deliveryMethod,
        failure_reason_bucket: "share_api",
      });
      showToast("Не удалось создать PDF. Попробуйте ещё раз.");
    }
  } finally {
    tripPdfGenerating = false;
    setTripPdfButtonsBusy(false);
  }
}

async function shareTrip() {
  const text = buildShareText(true);
  const shareData = {
    title: `Backpacker: ${state.trip.title}`,
    text,
    url: window.location.href,
  };
  trackEvent("share_method_selected", {
    ...getTripAnalyticsContext(),
    share_context: "trip",
    share_format: "text",
    method: navigator.share ? "web_share" : "clipboard",
  });
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      trackEvent("share_completed", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "text", method: "web_share" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(`${text}\n\n${window.location.href}`);
  showToast("Ссылка и сводка скопированы");
  trackEvent("share_completed", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "text", method: "clipboard" });
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

  if (isAppleMobileBrowser()) {
    renderIosInstallOnboarding();
    showToast("На iPhone: Safari → Поделиться → На экран Домой");
    trackEvent("pwa_install_clicked", { prompt_available: false, platform: "ios" });
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

async function startApp() {
  trackAppOpen();
  const splashStatus = $("#appSplashStatus");
  if (splashStatus && getSharePayloadFromUrl()) splashStatus.textContent = "Открываем приглашение...";
  readOnlyShare = await loadReadOnlyShareFromUrl();
  if (readOnlyShare) {
    if (readOnlyShare.invalid) showToast("Ссылка недействительна");
    state = readOnlyShare.state;
    hideAppSplash();
    showTripScreen();
    return;
  }
  hideAppSplash();
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

function showHomeScreen(source = null) {
  currentScreen = "home";
  $("#introScreen").classList.add("hidden");
  $("#homeScreen").classList.remove("hidden");
  $(".app-shell").classList.add("hidden");
  renderHome();
  loadMyProfile({ createSession: false }).catch(() => {});
  renderIosInstallOnboarding();
  refreshReceivedTrips();
  trackEvent("home_opened", { trip_count: getUserTripCount(), ...(source ? { source } : {}) });
}

function showTripScreen() {
  currentScreen = "trip";
  $("#introScreen").classList.add("hidden");
  $("#homeScreen").classList.add("hidden");
  $(".app-shell").classList.remove("hidden");
  $("#editTripButton").hidden = isReadOnlyMode();
  $("#shareButton").hidden = false;
  $$("[data-action='add']").forEach((button) => {
    button.hidden = Boolean(isReadOnlyMode() && (readOnlyShare?.invalid || readOnlyShare?.isOwner || readOnlyShare?.isAuthor));
  });
  renderSaveReceivedTripButton();
  render();
  refreshAuthorExpenseProposals();
  if (isReadOnlyMode()) {
    refreshShareProposalContext();
    refreshItemProposalContext();
  }
}

function openTrip(tripId) {
  const entry = tripStore.trips.find((trip) => trip.id === tripId);
  if (!entry) return;
  readOnlyShare = null;
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

function setTripDraftAiStatus(message = "", isError = false) {
  const status = $("#tripDraftStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", Boolean(isError));
}

function renderTripDraftAiSheet() {
  const choice = $(".trip-draft-choice-grid");
  const inputStep = $("#tripDraftInputStep");
  const previewStep = $("#tripDraftPreviewStep");
  const voiceControls = $("#tripDraftVoiceControls");
  const recordButton = $("#tripDraftRecordButton");
  const parseButton = $("#tripDraftParseButton");
  const createButton = $("#tripDraftCreateButton");
  const recordingIndicator = $("#tripDraftRecordingIndicator");
  const title = $("#tripDraftAiTitle");
  if (!choice || !inputStep || !previewStep) return;

  choice.classList.toggle("hidden", tripDraftAiState.mode !== "choice");
  inputStep.classList.toggle("hidden", tripDraftAiState.mode !== "input");
  previewStep.classList.toggle("hidden", tripDraftAiState.mode !== "preview");
  voiceControls?.classList.toggle("hidden", tripDraftAiState.inputMode !== "voice");
  recordingIndicator?.classList.toggle("hidden", !tripDraftAiState.isRecording);
  if (title) title.textContent = tripDraftAiState.mode === "choice" ? "Создать поездку" : "AI-черновик поездки";
  if (recordButton) recordButton.textContent = tripDraftAiState.isRecording ? "Остановить запись" : "Начать запись";
  if (parseButton) {
    parseButton.disabled = tripDraftAiState.isBusy;
    parseButton.textContent = tripDraftAiState.isBusy ? "Разбираю..." : "Разобрать поездку";
  }
  if (createButton) {
    createButton.disabled = tripDraftAiState.isBusy || !tripDraftAiState.draft;
  }
}

function openTripDraftAiSheet() {
  tripDraftAiState = { mode: "choice", inputMode: "text", isBusy: false, isRecording: false, draft: null, mediaRecorder: null, chunks: [] };
  const input = $("#tripDraftTextInput");
  if (input) input.value = "";
  setTripDraftAiStatus("");
  renderTripDraftPreview(null);
  renderTripDraftAiSheet();
  openSheet("tripDraftAiSheet");
  trackEvent("trip_create_sheet_opened", { creation_source: "home" });
}

function startTripDraftTextMode(mode = "text") {
  tripDraftAiState = { ...tripDraftAiState, mode: "input", inputMode: mode, draft: null };
  setTripDraftAiStatus(mode === "voice" ? "Запишите голос, потом проверьте текст перед разбором." : "");
  renderTripDraftAiSheet();
  window.setTimeout(() => $("#tripDraftTextInput")?.focus(), 80);
}

function cleanupTripDraftAiRecording() {
  if (!tripDraftAiState.mediaRecorder) return;
  try {
    if (tripDraftAiState.mediaRecorder.state !== "inactive") tripDraftAiState.mediaRecorder.stop();
  } catch {
    // Best effort cleanup only.
  }
  tripDraftAiState = { ...tripDraftAiState, isRecording: false, mediaRecorder: null, chunks: [] };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function toggleTripDraftRecording() {
  if (tripDraftAiState.isRecording && tripDraftAiState.mediaRecorder) {
    tripDraftAiState.mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setTripDraftAiStatus("Запись голоса не поддерживается в этом браузере. Можно вставить текст.", true);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    tripDraftAiState = { ...tripDraftAiState, mediaRecorder: recorder, chunks: [], isRecording: true };
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) tripDraftAiState.chunks.push(event.data);
    });
    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      tripDraftAiState = { ...tripDraftAiState, isRecording: false, mediaRecorder: null, isBusy: true };
      renderTripDraftAiSheet();
      setTripDraftAiStatus("Расшифровываю запись...");
      try {
        const blob = new Blob(tripDraftAiState.chunks, { type: recorder.mimeType || "audio/webm" });
        const audioDataUrl = await blobToDataUrl(blob);
        const payload = await callTripDraftAiFunction("transcribe", { audioDataUrl });
        const input = $("#tripDraftTextInput");
        if (input) input.value = [input.value.trim(), payload.text || ""].filter(Boolean).join(input.value.trim() ? "\n\n" : "");
        setTripDraftAiStatus("Текст готов. Проверьте его перед разбором.");
        trackEvent("trip_draft_voice_transcribed", { ok: true });
      } catch {
        setTripDraftAiStatus("Не удалось расшифровать запись. Можно вставить текст вручную.", true);
        trackEvent("trip_draft_voice_transcribed", { ok: false });
      } finally {
        tripDraftAiState = { ...tripDraftAiState, isBusy: false, chunks: [] };
        renderTripDraftAiSheet();
      }
    });
    recorder.start();
    setTripDraftAiStatus("Говорите. Нажмите ещё раз, чтобы остановить запись.");
    renderTripDraftAiSheet();
  } catch {
    setTripDraftAiStatus("Не удалось получить доступ к микрофону. Можно вставить текст.", true);
  }
}

function normalizeTripDraftItemType(type = "") {
  const value = String(type || "").toLowerCase();
  return itemTypes.some(([key]) => key === value) ? value : "idea";
}

function normalizeTripDraftDate(value = "") {
  return parseDateFromInput(String(value || "")) || "";
}

function normalizeTripDraftTime(value = "") {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function normalizeTripDraftResponse(payload = {}) {
  const draft = payload.draft || payload;
  const trip = draft.trip || {};
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const fallbackStart = today.toISOString().slice(0, 10);
  const fallbackEnd = tomorrow.toISOString().slice(0, 10);
  const startDate = normalizeTripDraftDate(trip.startDate) || fallbackStart;
  const endDate = normalizeTripDraftDate(trip.endDate) || startDate || fallbackEnd;
  const items = Array.isArray(draft.items) ? draft.items : [];
  const questions = Array.isArray(draft.questions) ? draft.questions.filter(Boolean).slice(0, 5) : [];
  return {
    trip: {
      title: String(trip.title || "Новая поездка").trim().slice(0, 80) || "Новая поездка",
      destination: String(trip.destination || "").trim().slice(0, 120),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      currency: getSupportedCurrencies().includes(trip.currency) ? trip.currency : "RUB",
      budgetLimit: parseMoney(trip.budgetLimit),
      preferencesText: String(trip.preferencesText || "").trim().slice(0, 4000),
    },
    items: items.slice(0, 80).map((item, index) => ({
      title: String(item.title || `Идея ${index + 1}`).trim().slice(0, 120) || `Идея ${index + 1}`,
      type: normalizeTripDraftItemType(item.type),
      status: statuses.some(([key]) => key === item.status) ? item.status : DEFAULT_ITEM_STATUS,
      priority: priorities.some(([key]) => key === item.priority) ? item.priority : DEFAULT_ITEM_PRIORITY,
      date: normalizeTripDraftDate(item.date),
      startTime: normalizeTripDraftTime(item.startTime),
      durationMinutes: Math.max(0, Math.min(1440, parseMoney(item.durationMinutes))),
      price: Math.max(0, parseMoney(item.price)),
      paidAmount: 0,
      link: String(item.link || "").trim().slice(0, 500),
      locationText: String(item.locationText || "").trim().slice(0, 160),
      notes: String(item.notes || "").trim().slice(0, 1000),
    })),
    questions,
  };
}

function renderTripDraftPreview(draft) {
  const box = $("#tripDraftPreviewBox");
  if (!box) return;
  if (!draft) {
    box.innerHTML = "";
    return;
  }
  const datedCount = draft.items.filter((item) => item.date).length;
  const parkingCount = draft.items.length - datedCount;
  const firstItems = draft.items.slice(0, 8);
  box.innerHTML = `
    <article class="trip-draft-preview-card">
      <h3>${escapeHtml(draft.trip.title)}</h3>
      <p>${escapeHtml(draft.trip.destination || "Направление не указано")} · ${escapeHtml(formatTripCardDateRange(draft.trip.startDate, draft.trip.endDate))}</p>
    </article>
    <article class="trip-draft-preview-card">
      <h3>Что попадёт в поездку</h3>
      <p>${datedCount} в план по дням · ${parkingCount} в парковку</p>
    </article>
    ${firstItems.length ? `<article class="trip-draft-preview-card"><h3>Первые идеи</h3><ul>${firstItems.map((item) => `<li>${escapeHtml(item.title)}${item.date ? ` · ${escapeHtml(formatDate(item.date))}` : " · парковка"}</li>`).join("")}</ul></article>` : ""}
    ${draft.questions.length ? `<article class="trip-draft-preview-card"><h3>Что можно уточнить позже</h3><ul>${draft.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></article>` : ""}
  `;
}

async function parseTripDraftText() {
  const input = $("#tripDraftTextInput");
  const text = input?.value.trim() || "";
  if (text.length < 20) {
    setTripDraftAiStatus("Добавьте чуть больше описания поездки.", true);
    input?.focus();
    return;
  }
  tripDraftAiState = { ...tripDraftAiState, isBusy: true, draft: null };
  setTripDraftAiStatus("Разбираю текст в черновик...");
  renderTripDraftAiSheet();
  try {
    const payload = await callTripDraftAiFunction("parse", {
      text,
      schemaVersion: TRIP_DRAFT_AI_SCHEMA_VERSION,
      locale: "ru-RU",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    });
    const draft = normalizeTripDraftResponse(payload);
    tripDraftAiState = { ...tripDraftAiState, isBusy: false, mode: "preview", draft };
    renderTripDraftPreview(draft);
    setTripDraftAiStatus("");
    renderTripDraftAiSheet();
    trackEvent("trip_draft_ai_parsed", {
      ok: true,
      has_dates: Boolean(draft.trip.startDate && draft.trip.endDate),
      item_count: draft.items.length,
      dated_item_count: draft.items.filter((item) => item.date).length,
      has_questions: Boolean(draft.questions.length),
    });
  } catch (error) {
    tripDraftAiState = { ...tripDraftAiState, isBusy: false };
    setTripDraftAiStatus(error.message === "supabase_not_configured" ? "Supabase не настроен: AI-черновик пока недоступен." : "Не удалось разобрать поездку. Попробуйте ещё раз.", true);
    renderTripDraftAiSheet();
    trackEvent("trip_draft_ai_parsed", { ok: false });
  }
}

function createTripEntryFromDraft(draft) {
  const id = `trip-${Date.now()}`;
  const selfParticipant = createSelfParticipant(id);
  const orderByDate = new Map();
  const nextState = {
    trip: {
      id,
      title: draft.trip.title,
      destination: draft.trip.destination,
      startDate: draft.trip.startDate,
      endDate: draft.trip.endDate,
      currency: draft.trip.currency,
      budgetLimit: draft.trip.budgetLimit,
      preferencesText: draft.trip.preferencesText,
      participants: [selfParticipant],
    },
    items: draft.items.map((item, index) => {
      const order = orderByDate.get(item.date || "") || 0;
      orderByDate.set(item.date || "", order + 1);
      return {
        id: `item-${Date.now()}-${index}`,
        title: item.title,
        type: item.type,
        status: item.status,
        priority: item.priority,
        date: item.date,
        startTime: item.startTime,
        durationMinutes: item.durationMinutes,
        price: item.price,
        paidAmount: item.paidAmount,
        participantId: selfParticipant.id,
        allocations: item.price > 0 ? [{ participantId: selfParticipant.id, amount: item.price }] : [],
        link: item.link,
        locationText: item.locationText,
        notes: item.notes,
        order,
        creationSource: "ai_draft",
      };
    }),
  };
  return createTripEntry(nextState, { id });
}

function createTripFromAiDraft() {
  if (!tripDraftAiState.draft) return;
  const entry = createTripEntryFromDraft(tripDraftAiState.draft);
  tripStore.trips.push(entry);
  persistTripStore(tripStore);
  closeSheet("tripDraftAiSheet");
  openTrip(entry.id);
  showToast("Черновик поездки создан");
  trackEvent("trip_created", {
    ...getTripAnalyticsContext(entry.state.trip),
    trip_id: entry.id,
    trip_origin: "user_created",
    creation_source: "ai_draft",
    trip_count_after_create: getUserTripCount(),
    is_second_user_trip: getUserTripCount() >= 2,
  });
  checkTripMilestones();
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

function switchView(view, navigationSource = "other") {
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
      navigation_source: navigationSource,
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
    if (isReadOnlyMode()) {
      event.preventDefault();
      return;
    }
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
    event.preventDefault?.();
    event.stopPropagation?.();
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
    if (isReadOnlyMode()) return;
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
    event.stopPropagation();
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

  document.addEventListener("touchmove", (event) => {
    if (!pointerDrag || pointerDrag.pointerType === "mouse") return;
    if (!pointerDrag.active && Date.now() - pointerDrag.startTime < longPressDelay) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false, capture: true });

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

function handleNativeDateTimeClear(event) {
  if (event.key !== "Backspace" && event.key !== "Delete") return;
  const input = event.target.closest?.("#itemForm input[name='date'], #itemForm input[name='startTime']");
  if (!input || input.disabled || input.readOnly || !input.value) return;

  event.preventDefault();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function bindEvents() {
  document.addEventListener("keydown", handleNativeDateTimeClear);

  document.addEventListener("click", (event) => {
    if (dragJustHappened) {
      event.preventDefault();
      return;
    }

    const addButton = event.target.closest("[data-action='add']");
    if (addButton) {
      event.preventDefault();
      event.stopPropagation();
      if (isReadOnlyMode()) openItemProposalSheet().catch(() => showToast("Не удалось открыть форму идеи"));
      else openItemSheet();
      return;
    }

    const tripDraftModeButton = event.target.closest("[data-trip-draft-mode]");
    if (tripDraftModeButton) {
      event.preventDefault();
      event.stopPropagation();
      const mode = tripDraftModeButton.dataset.tripDraftMode;
      if (mode === "manual") {
        closeSheet("tripDraftAiSheet");
        createNewTrip("home_manual");
      } else if (mode === "text" || mode === "voice") {
        startTripDraftTextMode(mode);
      }
      return;
    }

    const editButton = event.target.closest("[data-edit]");
    if (editButton && isReadOnlyMode()) {
      openExpenseProposalSheet(editButton.dataset.edit);
      return;
    }
    if (editButton) {
      openItemSheet(editButton.dataset.edit);
      return;
    }

    const navButton = event.target.closest(".nav-button");
    if (navButton) switchView(navButton.dataset.view, "bottom_bar");

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      currentFilter = filterButton.dataset.filter;
      renderBasket();
    }

    const closeTarget = event.target.closest("[data-close]");
    if (closeTarget) {
      if (closeTarget.dataset.close === "profile") pendingProfileAction = null;
      if (closeTarget.dataset.close === "tripDraftAi") cleanupTripDraftAiRecording();
      closeSheet(`${closeTarget.dataset.close}Sheet`);
    }

    const donationDismissTarget = event.target.closest("[data-donation-dismiss]");
    if (donationDismissTarget) {
      event.preventDefault();
      event.stopPropagation();
      dismissDonationSheet(donationDismissTarget.dataset.donationDismiss || "not_now");
      return;
    }

    const cardCopyDismissTarget = event.target.closest("[data-card-copy-dismiss]");
    if (cardCopyDismissTarget) {
      event.preventDefault();
      event.stopPropagation();
      dismissCardCopySheet(cardCopyDismissTarget.dataset.cardCopyDismiss || "close");
      return;
    }

    const cardCopyScopeTarget = event.target.closest("[data-card-copy-scope]");
    if (cardCopyScopeTarget) {
      handleCardCopyScope(cardCopyScopeTarget.dataset.cardCopyScope);
      return;
    }

    const cardCopyTripTarget = event.target.closest("[data-card-copy-trip]");
    if (cardCopyTripTarget) {
      handleCardCopyTrip(cardCopyTripTarget.dataset.cardCopyTrip);
      return;
    }

    const cardCopyDateTarget = event.target.closest("[data-card-copy-date]");
    if (cardCopyDateTarget) {
      handleCardCopyDate(cardCopyDateTarget.dataset.cardCopyDate || "");
      return;
    }

    const openTripButton = event.target.closest("[data-open-trip]");
    if (openTripButton) openTrip(openTripButton.dataset.openTrip);

    const deleteTripButton = event.target.closest("[data-delete-trip]");
    if (deleteTripButton) deleteTrip(deleteTripButton.dataset.deleteTrip);

    const openReceivedTripButton = event.target.closest("[data-open-received-trip]");
    if (openReceivedTripButton && !openReceivedTripButton.disabled) openReceivedTrip(openReceivedTripButton.dataset.openReceivedTrip);

    const removeReceivedTripButton = event.target.closest("[data-remove-received-trip]");
    if (removeReceivedTripButton) removeReceivedTrip(removeReceivedTripButton.dataset.removeReceivedTrip);

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

    const proposalModeButton = event.target.closest("[data-proposal-mode]");
    if (proposalModeButton) {
      expenseProposalDraft.participantMode = proposalModeButton.dataset.proposalMode;
      expenseProposalDraft.participantId = "";
      expenseProposalDraft.proposedParticipantName = "";
      renderExpenseProposalSheet();
      return;
    }

    const proposalParticipantButton = event.target.closest("[data-proposal-participant]");
    if (proposalParticipantButton) {
      expenseProposalDraft.participantId = proposalParticipantButton.dataset.proposalParticipant;
      renderExpenseProposalSheet();
      return;
    }

    const proposalBackButton = event.target.closest("[data-proposal-back]");
    if (proposalBackButton) {
      expenseProposalDraft.participantMode = "";
      expenseProposalDraft.participantId = "";
      expenseProposalDraft.proposedParticipantName = "";
      expenseProposalDraft.amount = 0;
      renderExpenseProposalSheet();
      return;
    }

    const saveProposalNameButton = event.target.closest("[data-save-proposal-name]");
    if (saveProposalNameButton) {
      const name = normalizeParticipantName($("#proposalParticipantNameInput")?.value);
      if (!name) {
        showToast("Введите имя");
        return;
      }
      expenseProposalDraft.proposedParticipantName = name;
      renderExpenseProposalSheet();
      return;
    }

    const proposalFullAmountButton = event.target.closest("[data-proposal-full-amount]");
    if (proposalFullAmountButton) {
      expenseProposalDraft.amount = parseMoney(proposalFullAmountButton.dataset.proposalFullAmount);
      renderExpenseProposalSheet();
      return;
    }

    const submitProposalButton = event.target.closest("[data-submit-expense-proposal]");
    if (submitProposalButton) {
      submitExpenseProposal();
      return;
    }

    const withdrawProposalButton = event.target.closest("[data-withdraw-expense-proposal]");
    if (withdrawProposalButton) {
      withdrawExpenseProposal(withdrawProposalButton.dataset.withdrawExpenseProposal);
      return;
    }

    const withdrawAcceptedProposalButton = event.target.closest("[data-withdraw-accepted-expense-proposal]");
    if (withdrawAcceptedProposalButton) {
      resolveAcceptedExpenseProposal(withdrawAcceptedProposalButton.dataset.withdrawAcceptedExpenseProposal, "withdrawn");
      return;
    }

    const newProposalButton = event.target.closest("[data-new-expense-proposal]");
    if (newProposalButton) {
      shareProposalContext.proposals = (shareProposalContext.proposals || []).filter((proposal) => proposal.itemId !== expenseProposalDraft.itemId || proposal.status === "pending");
      resetExpenseProposalDraft(expenseProposalDraft.itemId);
      renderExpenseProposalSheet();
      return;
    }

    const acceptProposalButton = event.target.closest("[data-accept-expense-proposal]");
    if (acceptProposalButton) {
      acceptExpenseProposal(acceptProposalButton.dataset.acceptExpenseProposal);
      return;
    }

    const rejectProposalButton = event.target.closest("[data-reject-expense-proposal]");
    if (rejectProposalButton) {
      rejectExpenseProposal(rejectProposalButton.dataset.rejectExpenseProposal);
      return;
    }

    const rejectAcceptedProposalButton = event.target.closest("[data-reject-accepted-expense-proposal]");
    if (rejectAcceptedProposalButton) {
      resolveAcceptedExpenseProposal(rejectAcceptedProposalButton.dataset.rejectAcceptedExpenseProposal, "rejected");
      return;
    }

    const withdrawItemProposalButton = event.target.closest("[data-withdraw-item-proposal]");
    if (withdrawItemProposalButton) {
      withdrawItemProposal(withdrawItemProposalButton.dataset.withdrawItemProposal);
      return;
    }

    const acceptItemProposalButton = event.target.closest("[data-accept-item-proposal]");
    if (acceptItemProposalButton) {
      acceptItemProposal(acceptItemProposalButton.dataset.acceptItemProposal);
      return;
    }

    const rejectItemProposalButton = event.target.closest("[data-reject-item-proposal]");
    if (rejectItemProposalButton) {
      rejectItemProposal(rejectItemProposalButton.dataset.rejectItemProposal);
      return;
    }
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
  $("#createTripButton").addEventListener("click", openTripDraftAiSheet);
  $("#tripDraftBackButton")?.addEventListener("click", () => {
    if (tripDraftAiState.isRecording) return;
    tripDraftAiState = { ...tripDraftAiState, mode: "choice", draft: null };
    setTripDraftAiStatus("");
    renderTripDraftAiSheet();
  });
  $("#tripDraftRecordButton")?.addEventListener("click", toggleTripDraftRecording);
  $("#tripDraftParseButton")?.addEventListener("click", parseTripDraftText);
  $("#tripDraftEditTextButton")?.addEventListener("click", () => {
    tripDraftAiState = { ...tripDraftAiState, mode: "input" };
    renderTripDraftAiSheet();
  });
  $("#tripDraftCreateButton")?.addEventListener("click", createTripFromAiDraft);
  $("#refreshProposalsButton").addEventListener("click", refreshAuthorExpenseProposals);
  $("#introNextButton").addEventListener("click", () => showIntroSlide(1));
  $("#introSecondNextButton").addEventListener("click", () => showIntroSlide(2));
  $("#introStartButton").addEventListener("click", finishIntro);
  $("#coverInput").addEventListener("change", saveSelectedCover);
  $("#homeShareButton").addEventListener("click", openHomeShareSheet);
  $("#homeProfileButton")?.addEventListener("click", () => openProfileSheet(null));
  $("#profileForm")?.addEventListener("submit", submitProfileForm);
  $("#homeInstallAppButton").addEventListener("click", installPwa);
  $("#iosInstallCloseButton")?.addEventListener("click", dismissIosInstallOnboarding);
  $("#saveReceivedTripButton")?.addEventListener("click", saveReceivedTrip);
  $("#shareAppButton").addEventListener("click", shareApp);
  $("#donationPigButton")?.addEventListener("click", () => {
    if (!DONATION_FLOW_ENABLED) return;
    trackEvent("donation_pig_opened_manually", {
      meaningful_trips_count: getMeaningfulTripsCount(),
    });
    openDonationSheet("manual");
  });
  $("#donationCtaButton")?.addEventListener("click", handleDonationCtaClick);
  $("#donationBackButton")?.addEventListener("click", () => renderDonationIntroStep("manual"));
  $$("[data-donation-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      const amount = button.dataset.donationAmount || "custom";
      if (amount === "custom") {
        renderDonationCustomAmountStep();
        return;
      }
      openDonationCheckout(amount);
    });
  });
  $("#donationCustomAmountOk")?.addEventListener("click", submitDonationCustomAmount);
  $("#donationCustomAmountInput")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitDonationCustomAmount();
  });
  $$("[data-home-panel]").forEach((button) => {
    button.addEventListener("click", () => toggleHomeSupportPanel(button.dataset.homePanel));
  });
  $("#trainerVisibilityButton")?.addEventListener("click", () => {
    setHomeTrainerHidden(!isHomeTrainerHidden());
    renderHomeSupport();
  });
  $("#hideTrainerButton")?.addEventListener("click", () => {
    setHomeTrainerHidden(true);
    renderHomeSupport();
  });
  $("#homeTelegramButton")?.addEventListener("click", () => trackEvent("feedback_channel_opened", { channel: "telegram", source: "home_support" }));
  $("#feedbackButton").addEventListener("click", () => trackEvent("feedback_channel_opened", { channel: "telegram" }));
  $("#homeButton").addEventListener("click", () => showHomeScreen("trip_bottom_bar"));
  $("#itemForm").addEventListener("submit", saveItem);
  $("#itemProposalForm")?.addEventListener("submit", submitItemProposal);
  $("#copyItemButton").addEventListener("click", openCardCopySheet);
  $("#resetItemButton").addEventListener("click", resetCurrentItemForm);
  $("#deleteItemButton").addEventListener("click", deleteCurrentItem);
  $("#cardCopyBackButton").addEventListener("click", goBackCardCopyStep);
  $("#cardCopyConfirmButton").addEventListener("click", confirmCardCopy);
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
  $("#shareTripTextButton").addEventListener("click", shareTrip);
  $("#openTripLinkButton").addEventListener("click", showTripLinkOptions);
  $("#tripLinkIncludeBudget").addEventListener("change", updateTripShareBudgetVisibility);
  $("#copyTripLinkButton").addEventListener("click", copyTripShareLink);
  $("#revokeTripLinkButton").addEventListener("click", revokeTripShareLink);
  $("#openTripPdfOptionsButton").addEventListener("click", showTripPdfOptions);
  $("#downloadTripPdfButton").addEventListener("click", downloadTripPdf);
  $("#shareTripPdfButton").addEventListener("click", shareTripPdf);
  $("#downloadEstimateButton").addEventListener("click", chooseAndDownloadEstimate);
  $("#downloadPlanButton").addEventListener("click", chooseAndDownloadPlan);
  $("#copyEstimateButton").addEventListener("click", chooseAndDownloadEstimate);
  $("#refreshRatesButton").addEventListener("click", refreshExchangeRates);
  ["currencyAmount", "currencyFrom", "currencyTo"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderCurrencyCalculator);
    $(`#${id}`).addEventListener("change", renderCurrencyCalculator);
  });
  bindDesktopDrag();
  bindPointerDrag();
  bindDonationSheetGestures();
}

function bindDonationSheetGestures() {
  const panel = $("[data-donation-panel]");
  if (!panel) return;
  panel.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input, textarea, select")) return;
    donationDragStartY = event.clientY;
    donationDragCurrentY = event.clientY;
    panel.setPointerCapture?.(event.pointerId);
  });
  panel.addEventListener("pointermove", (event) => {
    if (!donationDragStartY) return;
    donationDragCurrentY = event.clientY;
    const deltaY = Math.max(0, donationDragCurrentY - donationDragStartY);
    panel.style.transform = deltaY ? `translateY(${Math.min(deltaY, 96)}px)` : "";
  });
  panel.addEventListener("pointerup", () => {
    const deltaY = Math.max(0, donationDragCurrentY - donationDragStartY);
    panel.style.transform = "";
    donationDragStartY = 0;
    donationDragCurrentY = 0;
    if (deltaY > 70) dismissDonationSheet("swipe");
  });
  panel.addEventListener("pointercancel", () => {
    panel.style.transform = "";
    donationDragStartY = 0;
    donationDragCurrentY = 0;
  });
}

bindEvents();
setupDonationFlow();
renderProductVersionInfo();
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

window.addEventListener("popstate", () => {
  if (cardCopyIgnoreNextPop) {
    cardCopyIgnoreNextPop = false;
    return;
  }
  if ($("#cardCopySheet")?.classList.contains("open")) {
    dismissCardCopySheet("back");
    return;
  }
  if (donationIgnoreNextPop) {
    donationIgnoreNextPop = false;
    return;
  }
  if ($("#donationSheet")?.classList.contains("open")) {
    dismissDonationSheet("back", { fromPopState: true });
  }
});

window.addEventListener("pagehide", trackOnboardingExit);

if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
