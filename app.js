const STORAGE_KEY = "backpacker.mvp.v1";
const TRIPS_STORAGE_KEY = "backpacker.trips.v1";
const PRIVATE_TRIP_SYNC_METADATA_KEY = "backpacker.privateTripSync.v1";
const PRIVATE_TRIP_SYNC_CONFLICT_KEY = "backpacker.privateTripSync.conflicts.v1";
const TRIP_DRAFT_PENDING_KEY_PREFIX = "backpacker.tripDraftAi.pending.v1";
const TRIP_ITEM_PREVIEW_TTL_SECONDS = 600;
const TRIP_ITEM_PREVIEW_RENEW_MS = 60 * 1000;
// Icon actions instead of labels: with a thumbnail in the row, two text buttons left the
// file name almost no width. Each button keeps a title and an aria-label with the file name.
const ATTACHMENT_OPEN_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const ATTACHMENT_DELETE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 7V5.5h4V7M6.5 7l1 12.5h9L17.5 7M10.5 10.5v6M13.5 10.5v6"></path></svg>`;
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
const ANALYTICS_SOURCE_CONTRACT = window.BackpackerAnalyticsSource;
const ANALYTICS_SCHEMA_VERSION = ANALYTICS_SOURCE_CONTRACT?.ANALYTICS_SCHEMA_VERSION || "2026-08-29.1";
const ANALYTICS_EVENT_CONTRACT_VERSION = ANALYTICS_SOURCE_CONTRACT?.EVENT_CONTRACT_VERSION || "0.3";
const APP_REFERRAL_PARAM = "ref";
const APP_REFERRAL_MARKER = "app_share_v1";
const SUPABASE_CLIENT_ANALYTICS_EVENTS = new Set([
  "app_referral_arrived",
  "trip_created",
  "trip_first_value_reached",
  "item_created",
  "item_updated",
  "item_day_changed",
  "trip_settings_updated",
  "idea_saved",
  "idea_add_to_trip_started",
  "trip_working_plan_reached",
  "app_shared",
]);
const ANALYTICS_DEFINITION_VERSION = "2026-06-25.1";
const ONBOARDING_VERSION = "2026-06-25.1";
const ONBOARDING_PREVIEW_PARAM = "onboarding";
const TRAINER_VERSION = "2026-06-25.1";
const APP_VERSION = "1.1.2.81";
const APP_RELEASE_SUMMARY = "App Share referral activation добавляет privacy-safe учёт новых пользователей без referral graph или PII.";
const IOS_INSTALL_DISMISS_KEY = `backpacker.iosInstall.dismissed.${APP_VERSION}`;
const TRIP_SHARE_SCHEMA_VERSION = "trip_share.v1";
const TRIP_SHARE_SYNC_DEBOUNCE_MS = 1200;
// Фоновая синхронизация переживает временную осечку молча: сообщать о сети,
// которая через две секунды поднимется, значит приучать не читать чипы.
const TRIP_SHARE_SYNC_RETRIES = 2;
const TRIP_SHARE_SYNC_RETRY_MS = 2500;
const TRIP_DRAFT_AI_SCHEMA_VERSION = "trip_draft_ai.v1";
const TRIP_DRAFT_AI_ENABLED = true;
const VIRTUAL_DAY_PREFIX = "day-";
const DONATION_FLOW_ENABLED = false;
const DONATION_URL = ANALYTICS_CONFIG.donationUrl || "https://t.me/bckpckrbot?start=donate";
const DEFAULT_ITEM_STATUS = "want";
const DEFAULT_ITEM_PRIORITY = "nice";
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
let itemSheetHistoryArmed = false;
let itemSheetIgnoreNextPop = false;
let itemCreateContext = {
  source: "",
  creationMethod: "manual",
  returnScreenOnCancel: "",
  sourceIdeaId: "",
  toastOnSave: "",
};
let analyticsIsReturningUser = false;
let supabaseAnalyticsSessionPromise = null;
let cardCopyState = {
  sourceKind: "trip_item",
  sourceItemId: "",
  sourceIdeaId: "",
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
let recoverableAuthState = {
  error: "",
  loginSending: false,
  status: "",
  upgradeSending: false,
  user: null,
};
let extensionConnectState = {
  request: null,
  status: "idle",
  error: "",
};
const IDENTITY_BRIDGE_PENDING_EXTENSION_CONNECT_KEY = "backpacker.identityBridge.pendingExtensionConnect.v1";
let ideasState = {
  activeCollectionKey: "all",
  collections: [],
  editingIdeaId: "",
  error: "",
  ideas: [],
  loaded: false,
  loading: false,
  saving: false,
};
let tripDraftAiState = { mode: "choice", inputMode: "text", isBusy: false, isCreating: false, isRecording: false, draft: null, sourceText: "", mediaRecorder: null, chunks: [] };
let linkIntakeState = { isLoading: false, draft: null, status: "", error: "", previewOnlyImageUrl: "", appliedSnapshot: null };
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

var privateTripSyncState = {
  applyingRemote: false,
  pending: false,
  ready: false,
  running: false,
  timer: null,
};
var privateTripSyncMetadata = loadPrivateTripSyncMetadata();
var privateTripSyncConflicts = loadPrivateTripSyncConflicts();
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
// Повод последнего сообщения об осечке: один и тот же не повторяем.
let tripShareSyncReported = "";
let tripItemAttachmentsRequestVersion = 0;
let tripItemAttachmentsPreviewsInFlight = false;
let tripDraftPendingSaveTimer = null;
let bookingPackFailedUploads = [];
let tripItemAttachmentsState = {
  attachments: [],
  deletingId: "",
  error: "",
  itemId: "",
  loading: false,
  pendingFiles: [],
  previews: {},
  tripId: "",
  uploading: false,
  uploadingName: "",
};
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

function getAnalyticsIdentityType() {
  // The current analytics distinct_id remains browser-local. Supabase account
  // identity must not silently replace or merge it before the separately
  // approved anonymous-to-account identity design and smoke.
  return "anonymous_browser";
}

function getAnalyticsContext(extra = {}) {
  return {
    anon_user_id: getOrCreateAnalyticsUserId(),
    session_id: analyticsSessionId,
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    event_contract_version: ANALYTICS_EVENT_CONTRACT_VERSION,
    app_version: APP_VERSION,
    environment: getAnalyticsEnvironment(),
    is_internal_user: getAnalyticsFlag("internal"),
    is_test_user: getAnalyticsFlag("test_user"),
    identity_type: getAnalyticsIdentityType(),
    "$geoip_disable": true,
    screen: currentScreen,
    display_mode: getDisplayMode(),
    ...extra,
  };
}

function createAnalyticsEventId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getAnalyticsSourceFunctionUrl() {
  const config = getSupabaseConfig();
  if (!config.url) return "";
  return `${String(config.url).replace(/\/+$/, "")}/functions/v1/analytics-source`;
}

function getAnalyticsServerContext(eventId = createAnalyticsEventId()) {
  return {
    event_id: eventId,
    app_version: APP_VERSION,
    environment: getAnalyticsEnvironment(),
    is_internal_user: getAnalyticsFlag("internal"),
    is_test_user: getAnalyticsFlag("test_user"),
  };
}

async function getSupabaseAnalyticsAccessToken() {
  if (!supabaseAnalyticsSessionPromise) {
    supabaseAnalyticsSessionPromise = ensureSupabaseOwnerSession()
      .finally(() => { supabaseAnalyticsSessionPromise = null; });
  }
  return supabaseAnalyticsSessionPromise;
}

function writeSupabaseAnalyticsEvent(eventName, payload) {
  if (!SUPABASE_CLIENT_ANALYTICS_EVENTS.has(eventName)) return Promise.resolve(false);
  const config = getSupabaseConfig();
  const url = getAnalyticsSourceFunctionUrl();
  if (!url || !config.anonKey) return Promise.resolve(false);
  const eventId = createAnalyticsEventId();
  const sourcePayload = { ...payload };
  delete sourcePayload.anon_user_id;
  delete sourcePayload.session_id;
  delete sourcePayload.identity_type;
  delete sourcePayload["$geoip_disable"];

  return getSupabaseAnalyticsAccessToken()
    .then((accessToken) => fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      body: JSON.stringify({ eventId, eventName, payload: sourcePayload }),
    }))
    .then((response) => {
      if (!response.ok && ANALYTICS_CONFIG.debug) {
        console.warn("[Backpacker analytics] Supabase source write failed", eventName, response.status);
      }
      return response.ok;
    })
    .catch((error) => {
      if (ANALYTICS_CONFIG.debug) {
        console.warn("[Backpacker analytics] Supabase source unavailable", eventName, error?.name || "unexpected");
      }
      return false;
    });
}

function trackEvent(name, props = {}) {
  const eventProps = ANALYTICS_SOURCE_CONTRACT?.sanitizeEventProperties
    ? ANALYTICS_SOURCE_CONTRACT.sanitizeEventProperties(name, props)
    : props;
  const missingRequired = ANALYTICS_SOURCE_CONTRACT?.getMissingRequiredProperties?.(name, eventProps) || [];
  if (missingRequired.length) {
    if (ANALYTICS_CONFIG.debug) console.warn("[Backpacker analytics] skipped malformed event", name, missingRequired);
    return Promise.resolve(false);
  }
  const rawPayload = getAnalyticsContext({
    ...eventProps,
    source_event_timestamp: new Date().toISOString(),
  });
  const payload = ANALYTICS_SOURCE_CONTRACT?.sanitizeContractEventPayload
    ? ANALYTICS_SOURCE_CONTRACT.sanitizeContractEventPayload(name, rawPayload)
    : rawPayload;
  if (ANALYTICS_CONFIG.debug) {
    console.info("[Backpacker analytics]", name, payload);
  }
  return writeSupabaseAnalyticsEvent(name, payload);
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

function getLinkIntakeFunctionUrl() {
  const config = getSupabaseConfig();
  if (config.linkIntakeFunctionUrl) return config.linkIntakeFunctionUrl;
  if (!config.url) return "";
  return `${String(config.url).replace(/\/+$/, "")}/functions/v1/link-intake`;
}

function getExtensionConnectFunctionUrl() {
  const config = getSupabaseConfig();
  const core = getExtensionConnectUiCore();
  if (core?.resolveExtensionConnectFunctionUrl) {
    return core.resolveExtensionConnectFunctionUrl(config);
  }
  if (!config.url) return "";
  return `${String(config.url).replace(/\/+$/, "")}/functions/v1/extension-connect`;
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

function getRecoverableAuthCore() {
  return window.BackpackerRecoverableAuth;
}

function getExtensionConnectUiCore() {
  return window.BackpackerExtensionConnectUI;
}

function getIdentityBridgeCore() {
  return window.BackpackerIdentityBridge;
}

function getRecoverableAuthRedirectUrl() {
  const config = getSupabaseConfig();
  const core = getRecoverableAuthCore();
  if (core?.resolveRecoverableAuthRedirectUrl) {
    return core.resolveRecoverableAuthRedirectUrl({
      href: window.location.href,
      configuredUrl: config.authRedirectUrl,
    });
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getRecoverableAuthUserSummary(user = null) {
  const core = getRecoverableAuthCore();
  return core?.summarizeAuthUser ? core.summarizeAuthUser(user) : {
    email: user?.email || "",
    hasEmailIdentity: false,
    id: user?.id || "",
    isAnonymous: user?.is_anonymous === true,
    providers: [],
  };
}

function getCurrentRecoverableAuthUser() {
  return recoverableAuthState.user || getRecoverableAuthUserSummary(null);
}

async function refreshRecoverableAuthSession({ refreshProfile = false } = {}) {
  const client = getSupabaseClient();
  if (!client) {
    recoverableAuthState.user = null;
    renderProfileSheet();
    return null;
  }
  const sessionResult = await client.auth.getSession();
  const session = sessionResult.data.session;
  if (!session?.access_token) {
    recoverableAuthState.user = null;
    renderProfileSheet();
    return null;
  }
  const userResult = await client.auth.getUser();
  const user = userResult.data?.user || session.user || null;
  recoverableAuthState.user = getRecoverableAuthUserSummary(user);
  renderProfileSheet();
  renderHomeProfile();
  if (refreshProfile) await loadMyProfile({ createSession: false }).catch(() => null);
  return recoverableAuthState.user;
}

function cleanRecoverableAuthCallbackUrl() {
  const core = getRecoverableAuthCore();
  if (!core?.getCleanAuthCallbackUrl || !window.history?.replaceState) return;
  const cleanUrl = core.getCleanAuthCallbackUrl(window.location.href);
  if (cleanUrl !== window.location.href) window.history.replaceState({}, document.title, cleanUrl);
}

async function handleRecoverableAuthCallback() {
  if (!isSupabaseConfigured()) return null;
  const core = getRecoverableAuthCore();
  const info = core?.getAuthCallbackInfo?.(window.location.href);
  const client = getSupabaseClient();
  if (!info?.hasAuthParams || !client) {
    return refreshRecoverableAuthSession();
  }
  if (info.hasError) {
    recoverableAuthState.error = window.t("share.profile.email.callback.confirm.error");
    recoverableAuthState.status = "";
    cleanRecoverableAuthCallbackUrl();
    showToast(window.t("share.profile.email.callback.confirm.toast"));
    renderProfileSheet();
    return refreshRecoverableAuthSession();
  }
  try {
    if (info.hasCode && client.auth.exchangeCodeForSession) {
      const exchanged = await client.auth.exchangeCodeForSession(info.code);
      if (exchanged.error) {
        const current = await client.auth.getSession();
        if (!current.data.session?.access_token) throw exchanged.error;
      }
    }
    const user = await refreshRecoverableAuthSession({ refreshProfile: true });
    recoverableAuthState.error = "";
    recoverableAuthState.status = user?.hasEmailIdentity
      ? window.t("share.profile.email.callback.saved")
      : window.t("share.profile.email.callback.signed.in");
    showToast(recoverableAuthState.status);
    closeRecoverableAuthSheetAfterSuccess(user);
    await resumePendingExtensionConnectAfterRecoverableAuth(user);
    return user;
  } catch {
    recoverableAuthState.error = window.t("share.profile.email.callback.restore.error");
    recoverableAuthState.status = "";
    showToast(window.t("share.profile.email.callback.restore.toast"));
    renderProfileSheet();
    return null;
  } finally {
    cleanRecoverableAuthCallbackUrl();
  }
}

function closeRecoverableAuthSheetAfterSuccess(user) {
  if (!user?.hasEmailIdentity) return;
  const sheet = $("#profileSheet");
  if (!sheet?.classList.contains("open")) return;
  window.setTimeout(() => {
    if ($("#profileSheet")?.classList.contains("open") && !recoverableAuthState.error) {
      closeSheet("profileSheet");
    }
  }, 900);
}

function subscribeRecoverableAuthChanges() {
  const client = getSupabaseClient();
  if (!client?.auth?.onAuthStateChange) return;
  client.auth.onAuthStateChange((event, session) => {
    recoverableAuthState.user = session?.user ? getRecoverableAuthUserSummary(session.user) : null;
    renderProfileSheet();
    renderHomeProfile();
    if (["SIGNED_IN", "USER_UPDATED"].includes(event)) {
      privateTripSyncState.ready = true;
      // Storage is keyed by uid, so anything typed before identity resolved was not written
      // yet. Persist it the moment the key becomes available.
      saveTripDraftPending();
      window.setTimeout(() => {
        loadMyProfile({ createSession: false }).catch(() => null);
        syncPrivateTripsWithCloud({ silent: true }).catch(() => null);
      }, 0);
    } else if (event === "SIGNED_OUT") {
      privateTripSyncState.ready = false;
    }
  });
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

async function hadExistingSupabaseSessionBeforeReferralLanding() {
  const authCallback = getRecoverableAuthCore()?.getAuthCallbackInfo?.(window.location.href);
  if (authCallback?.hasAuthParams) return false;
  return Boolean(await getExistingSupabaseAccessToken().catch(() => ""));
}

function getCanonicalAppShareUrl() {
  const base = window.location.origin && window.location.protocol !== "file:"
    ? `${window.location.origin}${window.location.pathname}`
    : "https://dphnll.github.io/Backpacker_demo/";
  const url = new URL(base);
  url.searchParams.set(APP_REFERRAL_PARAM, APP_REFERRAL_MARKER);
  return url.toString();
}

function hasAppReferralMarker() {
  try {
    return new URL(window.location.href).searchParams.get(APP_REFERRAL_PARAM) === APP_REFERRAL_MARKER;
  } catch {
    return false;
  }
}

function cleanAppReferralMarker() {
  if (!window.history?.replaceState || !hasAppReferralMarker()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(APP_REFERRAL_PARAM);
  window.history.replaceState({}, document.title, url.toString());
}

async function captureAppReferralArrival({ hadExistingSession = true } = {}) {
  if (!hasAppReferralMarker()) return false;
  try {
    if (hadExistingSession) return false;
    return await trackEvent("app_referral_arrived");
  } finally {
    cleanAppReferralMarker();
  }
}

async function callTripShareFunction(action, payload = {}, { requireOwner = false, useExistingSession = false, ensureSession = false } = {}) {
  const config = getSupabaseConfig();
  const url = getTripShareFunctionUrl();
  if (!url || !config.anonKey) throw new Error("supabase_not_configured");
  const headers = {
    "Content-Type": "application/json",
    apikey: config.anonKey,
  };
  if (requireOwner) {
    headers.Authorization = `Bearer ${await ensureSupabaseOwnerSession()}`;
  } else if (ensureSession) {
    headers.Authorization = `Bearer ${await getSupabaseAnalyticsAccessToken()}`;
  } else if (useExistingSession) {
    const token = await getExistingSupabaseAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({ action, ...payload, analytics: getAnalyticsServerContext() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `trip_share_${action}_failed`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function getTripDraftLocale() {
  return window.BackpackerI18n?.getLocale?.() === "en" ? "en" : "ru";
}

function tripDraftT(key, params = {}) {
  return window.t(`ai.draft.${key}`, params);
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
    body: JSON.stringify({ action, ...payload, locale: getTripDraftLocale() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `trip_draft_ai_${action}_failed`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function callLinkIntakeFunction(action, payload = {}) {
  const config = getSupabaseConfig();
  const url = getLinkIntakeFunctionUrl();
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
    const error = new Error(data.error || `link_intake_${action}_failed`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function callExtensionConnectFunction(action, payload = {}) {
  const config = getSupabaseConfig();
  const url = getExtensionConnectFunctionUrl();
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
    const error = new Error(data.error || `extension_connect_${action}_failed`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function storePendingExtensionConnectIntent(request) {
  const bridge = getIdentityBridgeCore();
  if (!bridge?.serializePendingExtensionConnectIntent) return null;
  const serialized = bridge.serializePendingExtensionConnectIntent(request);
  let stored = false;
  [window.sessionStorage, window.localStorage].forEach((storage) => {
    try {
      storage?.setItem(IDENTITY_BRIDGE_PENDING_EXTENSION_CONNECT_KEY, serialized);
      stored = true;
    } catch {
      // Optional browser storage can be unavailable in private or restricted contexts.
    }
  });
  if (!stored) return null;
  return serialized;
}

function clearPendingExtensionConnectIntent() {
  [window.sessionStorage, window.localStorage].forEach((storage) => {
    try {
      storage?.removeItem(IDENTITY_BRIDGE_PENDING_EXTENSION_CONNECT_KEY);
    } catch {
      // Nothing to clean if this storage is unavailable.
    }
  });
}

function readPendingExtensionConnectIntent() {
  const bridge = getIdentityBridgeCore();
  if (!bridge?.restorePendingExtensionConnectIntent) return null;
  let sawStoredIntent = false;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    let serialized = "";
    try {
      serialized = storage?.getItem(IDENTITY_BRIDGE_PENDING_EXTENSION_CONNECT_KEY) || "";
    } catch {
      serialized = "";
    }
    if (!serialized) continue;
    sawStoredIntent = true;
    try {
      const restored = bridge.restorePendingExtensionConnectIntent(serialized);
      if (restored?.request) return restored;
    } catch {
      // Corrupted or unsafe pending data is ignored and cleaned below.
    }
  }
  if (sawStoredIntent) clearPendingExtensionConnectIntent();
  return null;
}

async function resumePendingExtensionConnectAfterRecoverableAuth(user) {
  const pending = readPendingExtensionConnectIntent();
  if (!pending?.request) return false;
  const bridge = getIdentityBridgeCore();
  const state = bridge?.getIdentityBridgeState?.({ user, extensionConnectRequest: pending.request });
  extensionConnectState = {
    request: pending.request,
    status: state?.identityRequired ? "identity_required" : "idle",
    error: "",
  };
  renderExtensionConnectCard();
  if (state?.identityRequired) return false;
  clearPendingExtensionConnectIntent();
  await connectBackpackerExtension();
  return true;
}

async function requireRecoverableIdentityForExtensionConnect(request) {
  const bridge = getIdentityBridgeCore();
  if (!bridge?.getIdentityBridgeState) {
    return { status: "connect_allowed", connectAllowed: true, identityRequired: false, request };
  }
  await ensureSupabaseOwnerSession();
  const user = await refreshRecoverableAuthSession();
  const state = bridge.getIdentityBridgeState({ user, extensionConnectRequest: request });
  if (state.identityRequired) {
    try {
      storePendingExtensionConnectIntent(request);
    } catch {
      // Identity gate still blocks Extension Connect if browser session storage is unavailable.
    }
  }
  return state;
}

function getTravelIdeaCore() {
  return window.BackpackerTravelIdeas;
}

function getPlatformFileBoundaryCore() {
  return window.BackpackerPlatformFileBoundary;
}

/** True only when a native shell has installed that particular file action. */
function hasPlatformFileAction(action) {
  return Boolean(getPlatformFileBoundaryCore()?.isPlatformFileActionAvailable?.(action));
}

function runPlatformFileAction(action, args) {
  return getPlatformFileBoundaryCore().callPlatformFileAction(action, args);
}

function getTravelIdeasClientApi() {
  return window.BackpackerTravelIdeasClient;
}

function getTripItemAttachmentsCore() {
  return window.BackpackerTripItemAttachments;
}

function getTripItemAttachmentsClientApi() {
  return window.BackpackerTripItemAttachmentsClient;
}

function getPrivateTripSyncCore() {
  return window.BackpackerPrivateTripSync;
}

function getPrivateTripSyncClientApi() {
  return window.BackpackerPrivateTripSyncClient;
}

function loadPrivateTripSyncMetadata() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRIVATE_TRIP_SYNC_METADATA_KEY) || "{}");
    return parsed && typeof parsed === "object" && parsed.owners && typeof parsed.owners === "object"
      ? parsed
      : { owners: {} };
  } catch {
    return { owners: {} };
  }
}

function persistPrivateTripSyncMetadata() {
  try {
    localStorage.setItem(PRIVATE_TRIP_SYNC_METADATA_KEY, JSON.stringify(privateTripSyncMetadata));
  } catch {
    // Sync remains best-effort if browser storage is temporarily unavailable.
  }
}

function loadPrivateTripSyncConflicts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRIVATE_TRIP_SYNC_CONFLICT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.copyId) : [];
  } catch {
    return [];
  }
}

function persistPrivateTripSyncConflicts() {
  try {
    localStorage.setItem(PRIVATE_TRIP_SYNC_CONFLICT_KEY, JSON.stringify(privateTripSyncConflicts));
  } catch {
    // The notice is best-effort if browser storage is temporarily unavailable.
  }
}

function rememberPrivateTripSyncConflict(baseTitle, copyId) {
  if (privateTripSyncConflicts.some((entry) => entry.copyId === copyId)) return;
  privateTripSyncConflicts.push({ baseTitle: String(baseTitle || window.t("home.trip.untitled")).trim(), copyId });
  persistPrivateTripSyncConflicts();
}

function dismissPrivateTripSyncConflicts() {
  privateTripSyncConflicts = [];
  persistPrivateTripSyncConflicts();
  renderSyncConflictNotice();
}

// A conflict copy the user already deleted no longer needs an explanation on the home screen.
function getActivePrivateTripSyncConflicts() {
  const known = new Set(tripStore.trips.map((entry) => entry.id));
  const active = privateTripSyncConflicts.filter((entry) => known.has(entry.copyId));
  if (active.length !== privateTripSyncConflicts.length) {
    privateTripSyncConflicts = active;
    persistPrivateTripSyncConflicts();
  }
  return active;
}

function getPrivateTripSyncOwnerMetadata(userId, { create = true } = {}) {
  const ownerId = String(userId || "");
  if (!ownerId) return null;
  const existing = privateTripSyncMetadata.owners[ownerId];
  if (existing && typeof existing === "object") {
    existing.trips ||= {};
    existing.pendingDeletes ||= [];
    return existing;
  }
  if (!create) return null;
  privateTripSyncMetadata.owners[ownerId] = { pendingDeletes: [], trips: {} };
  return privateTripSyncMetadata.owners[ownerId];
}

function getKnownPrivateTripOwnerId(tripId) {
  return Object.entries(privateTripSyncMetadata.owners).find(([, metadata]) => (
    metadata?.trips && Object.prototype.hasOwnProperty.call(metadata.trips, tripId)
  ))?.[0] || "";
}

function canSyncPrivateTrips() {
  const user = getCurrentRecoverableAuthUser();
  return Boolean(
    privateTripSyncState.ready
    && user?.id
    && user.hasEmailIdentity
    && getPrivateTripSyncCore()
    && getPrivateTripSyncClientApi()
    && getSupabaseClient(),
  );
}

function createPrivateTripSyncToken() {
  const token = globalThis.crypto?.randomUUID?.();
  if (!token) throw new Error("trip_sync_uuid_unavailable");
  return token;
}

function rememberPrivateTripSyncRow(ownerMetadata, row) {
  ownerMetadata.trips[row.tripId] = {
    deleted: Boolean(row.deletedAt),
    lastFingerprint: row.entry ? getPrivateTripSyncCore().fingerprintTripEntry(row.entry) : "",
    syncToken: row.syncToken,
  };
}

function normalizePrivateTripSyncEntry(entry) {
  return createTripEntry(entry.state, {
    id: entry.id,
    isDemo: false,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    coverDataUrl: entry.coverDataUrl,
  });
}

function replacePrivateTripSyncEntry(entry) {
  const normalized = normalizePrivateTripSyncEntry(entry);
  const index = tripStore.trips.findIndex((candidate) => candidate.id === normalized.id);
  if (index >= 0) tripStore.trips[index] = normalized;
  else tripStore.trips.push(normalized);
  return normalized;
}

function removePrivateTripSyncEntry(tripId) {
  tripStore.trips = tripStore.trips.filter((entry) => entry.isDemo || entry.id !== tripId);
}

function createPrivateTripConflictId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function queuePrivateTripDeletion(tripId) {
  if (!canSyncPrivateTrips()) return;
  const user = getCurrentRecoverableAuthUser();
  const ownerMetadata = getPrivateTripSyncOwnerMetadata(user.id);
  if (!ownerMetadata.pendingDeletes.includes(tripId)) ownerMetadata.pendingDeletes.push(tripId);
  persistPrivateTripSyncMetadata();
}

function schedulePrivateTripSync(delay = 700) {
  if (!canSyncPrivateTrips() || privateTripSyncState.applyingRemote) return;
  window.clearTimeout(privateTripSyncState.timer);
  privateTripSyncState.timer = window.setTimeout(() => {
    syncPrivateTripsWithCloud({ silent: true }).catch(() => {});
  }, delay);
}

async function writePrivateTripSnapshot(client, localEntry, remoteRow = null) {
  const api = getPrivateTripSyncClientApi();
  const nextToken = createPrivateTripSyncToken();
  return remoteRow
    ? api.updatePrivateTripSnapshot(client, localEntry, remoteRow.syncToken, nextToken)
    : api.insertPrivateTripSnapshot(client, localEntry, nextToken);
}

async function syncPrivateTripsWithCloud({ silent = false } = {}) {
  if (!canSyncPrivateTrips()) return { status: "identity_required" };
  if (privateTripSyncState.running) {
    privateTripSyncState.pending = true;
    return { status: "already_running" };
  }
  privateTripSyncState.running = true;
  privateTripSyncState.pending = false;
  const user = getCurrentRecoverableAuthUser();
  const ownerMetadata = getPrivateTripSyncOwnerMetadata(user.id);
  const client = getSupabaseClient();
  const api = getPrivateTripSyncClientApi();
  const core = getPrivateTripSyncCore();
  const previousTripCount = tripStore.trips.filter((entry) => !entry.isDemo).length;
  let conflictCount = 0;
  try {
    let remoteRows = await api.listPrivateTripSnapshots(client);
    const remoteById = new Map(remoteRows.map((row) => [row.tripId, row]));

    const remainingDeletes = [];
    for (const tripId of ownerMetadata.pendingDeletes) {
      const remote = remoteById.get(tripId);
      if (!remote || remote.deletedAt) {
        if (remote) rememberPrivateTripSyncRow(ownerMetadata, remote);
        continue;
      }
      const metadata = ownerMetadata.trips[tripId];
      if (!metadata?.syncToken || metadata.syncToken !== remote.syncToken) {
        conflictCount += 1;
        continue;
      }
      try {
        const tombstone = await api.tombstonePrivateTripSnapshot(
          client,
          tripId,
          remote.syncToken,
          createPrivateTripSyncToken(),
        );
        remoteById.set(tripId, tombstone);
        rememberPrivateTripSyncRow(ownerMetadata, tombstone);
      } catch (error) {
        if (error?.code === "trip_sync_conflict") {
          conflictCount += 1;
          remainingDeletes.push(tripId);
        } else {
          throw error;
        }
      }
    }
    ownerMetadata.pendingDeletes = remainingDeletes;

    const foreignLocalIds = new Set();
    const localById = new Map(tripStore.trips.filter((entry) => {
      if (entry.isDemo) return false;
      const knownOwnerId = getKnownPrivateTripOwnerId(entry.id);
      if (knownOwnerId && knownOwnerId !== user.id) {
        foreignLocalIds.add(entry.id);
        return false;
      }
      return true;
    }).map((entry) => [entry.id, entry]));
    const tripIds = new Set([
      ...localById.keys(),
      ...Array.from(remoteById.keys()).filter((tripId) => !foreignLocalIds.has(tripId)),
    ]);
    for (const tripId of tripIds) {
      const local = localById.get(tripId) || null;
      const remote = remoteById.get(tripId) || null;
      const metadata = ownerMetadata.trips[tripId] || null;
      const decision = core.decideTripReconciliation({ localEntry: local, remoteRow: remote, metadata });
      if (decision.action === "upload_local") {
        const saved = await writePrivateTripSnapshot(client, local, remote);
        remoteById.set(tripId, saved);
        rememberPrivateTripSyncRow(ownerMetadata, saved);
      } else if (decision.action === "import_remote") {
        replacePrivateTripSyncEntry(remote.entry);
        rememberPrivateTripSyncRow(ownerMetadata, remote);
      } else if (decision.action === "in_sync" || decision.action === "remember_deleted") {
        rememberPrivateTripSyncRow(ownerMetadata, remote);
      } else if (decision.action === "remove_local") {
        removePrivateTripSyncEntry(tripId);
        rememberPrivateTripSyncRow(ownerMetadata, remote);
      } else if (["fork_local_and_import", "fork_local_and_remove"].includes(decision.action)) {
        const copy = core.createConflictCopy(local, createPrivateTripConflictId());
        const savedCopy = await writePrivateTripSnapshot(client, copy);
        replacePrivateTripSyncEntry(copy);
        rememberPrivateTripSyncRow(ownerMetadata, savedCopy);
        if (decision.action === "fork_local_and_import") replacePrivateTripSyncEntry(remote.entry);
        else removePrivateTripSyncEntry(tripId);
        rememberPrivateTripSyncRow(ownerMetadata, remote);
        rememberPrivateTripSyncConflict(local.state?.trip?.title, copy.id);
        conflictCount += 1;
      }
    }

    privateTripSyncState.applyingRemote = true;
    persistTripStore(tripStore);
    const currentEntry = tripStore.trips.find((entry) => entry.id === state.trip.id);
    if (currentEntry && !isReadOnlyMode()) state = normalizeState(structuredClone(currentEntry.state));
    persistPrivateTripSyncMetadata();
    privateTripSyncState.applyingRemote = false;

    const nextTripCount = tripStore.trips.filter((entry) => !entry.isDemo).length;
    if (currentScreen === "home") renderHome();
    else if (currentScreen === "trip" && !isReadOnlyMode()) render();
    // Every automatic sync passes silent, so a conflict must announce itself regardless:
    // the home screen notice explains it in full, the toast only draws attention to it.
    if (conflictCount) showToast(window.t("home.sync.toast.conflict"));
    else if (nextTripCount > previousTripCount) showToast(window.t("home.sync.toast.merged"));
    return { conflictCount, status: "synced", tripCount: nextTripCount };
  } catch (error) {
    privateTripSyncState.applyingRemote = false;
    if (!silent) showToast(window.t("home.sync.toast.error"));
    throw error;
  } finally {
    privateTripSyncState.running = false;
    if (privateTripSyncState.pending) schedulePrivateTripSync(100);
  }
}

function getIdeaCollectionIdFromKey(key = "") {
  return String(key).startsWith("collection:") ? String(key).slice("collection:".length) : null;
}

function getIdeaCollectionKey(collectionId = "") {
  const normalized = getTravelIdeaCore()?.normalizeTravelIdeaCollectionId?.(collectionId);
  return normalized ? `collection:${normalized}` : "ungrouped";
}

function getCurrentIdeaCollectionTitle() {
  if (ideasState.activeCollectionKey === "all") return window.t("ideas.collection.all");
  if (ideasState.activeCollectionKey === "ungrouped") return window.t("ideas.collection.unassigned");
  const id = getIdeaCollectionIdFromKey(ideasState.activeCollectionKey);
  return ideasState.collections.find((collection) => collection.id === id)?.title || window.t("ideas.collection.fallback");
}

async function getCurrentSupabaseUserForIdeas(client) {
  await ensureSupabaseOwnerSession();
  const sessionResult = await client.auth.getSession();
  let user = sessionResult.data.session?.user || null;
  if (!user?.id && client.auth.getUser) {
    const userResult = await client.auth.getUser();
    user = userResult.data?.user || null;
  }
  if (!user?.id) throw new Error("anonymous_auth_failed");
  return user;
}

function getTravelIdeasErrorCopy(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || 0);
  if (error?.message === "supabase_not_configured") return window.t("ideas.error.unavailable");
  if (status === 401 || status === 403 || code === "42501" || message.includes("permission denied") || message.includes("rls")) {
    return window.t("ideas.error.access");
  }
  if (message.includes("failed to fetch") || message.includes("network")) return window.t("ideas.error.network");
  if (message.includes("invalid_travel_idea_collection")) return window.t("ideas.error.collection");
  return window.t("ideas.error.generic");
}

function getExtensionConnectErrorCopy(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "").toLowerCase();
  if (error?.message === "supabase_not_configured") return window.t("extension.connect.error.supabase");
  if (status === 401 || status === 403 || message.includes("recoverable_identity_required")) {
    return window.t("extension.connect.error.auth.required");
  }
  if (message.includes("extension_channel_unavailable")) return window.t("extension.connect.error.channel.unavailable");
  if (message.includes("extension_handoff_timeout")) return window.t("extension.connect.error.handoff.timeout");
  if (message.includes("extension_rejected:bad_nonce")) return window.t("extension.connect.error.link.expired");
  if (message.includes("extension_rejected:bad_origin")) return window.t("extension.connect.error.origin");
  if (message.includes("extension_rejected:bad_account")) return window.t("extension.connect.error.account");
  if (message.includes("extension_rejected")) return window.t("extension.connect.error.rejected");
  if (message.includes("failed to fetch") || message.includes("network")) return window.t("extension.connect.error.network");
  return window.t("extension.connect.error.generic");
}

function getExtensionConnectLinkErrorState(error) {
  const untrusted = String(error?.code || "").toLowerCase() === "untrusted_extension_id";
  return {
    status: untrusted ? "link_untrusted" : "link_invalid",
    error: window.t(untrusted
      ? "extension.connect.error.link.untrusted"
      : "extension.connect.error.link.invalid"),
  };
}

function getExtensionConnectRuntimeErrorState(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("extension_rejected:bad_nonce")) {
    return {
      status: "link_expired",
      error: window.t("extension.connect.error.link.expired"),
    };
  }
  return { status: "error", error: getExtensionConnectErrorCopy(error) };
}

function ensureExtensionConnectCard() {
  let card = $("#extensionConnectCard");
  if (card) return card;
  card = document.createElement("section");
  card.id = "extensionConnectCard";
  card.className = "extension-connect-card";
  card.style.cssText = "position:fixed;inset:16px;z-index:1200;display:grid;place-items:center;background:rgba(18,54,61,.18);";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "extensionConnectTitle");
  card.setAttribute("aria-describedby", "extensionConnectSummary extensionConnectStatus");
  card.innerHTML = `
    <div class="extension-connect-card__body" style="width:100%;min-width:0;max-width:420px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border-radius:18px;background:#fffdf8;box-shadow:0 22px 60px rgba(18,54,61,.22);color:#12363d;">
      <p class="home-card-kicker">Backpacker Travel Capture</p>
      <h2 id="extensionConnectTitle" tabindex="-1"></h2>
      <p id="extensionConnectSummary"></p>
      <p class="extension-connect-card__status" id="extensionConnectStatus" role="status" aria-live="polite" aria-atomic="true" style="overflow-wrap:anywhere;"></p>
      <form class="recoverable-auth-form" id="extensionConnectIdentityForm" aria-labelledby="extensionConnectIdentityEmailLabel" hidden>
        <label class="field wide">
          <span id="extensionConnectIdentityEmailLabel"></span>
          <input id="extensionConnectEmailInput" name="extensionConnectEmail" type="email" autocomplete="email" placeholder="you@example.com" />
        </label>
        <button class="primary-button" id="extensionConnectEmailButton" type="submit"></button>
      </form>
      <div class="extension-connect-card__actions" style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="primary-button" id="extensionConnectConfirmButton" type="button"></button>
        <button class="ghost-button" id="extensionConnectDismissButton" type="button"></button>
      </div>
    </div>
  `;
  document.body.appendChild(card);
  $("#extensionConnectConfirmButton")?.addEventListener("click", connectBackpackerExtension);
  $("#extensionConnectDismissButton")?.addEventListener("click", dismissExtensionConnectCard);
  $("#extensionConnectIdentityForm")?.addEventListener("submit", submitExtensionConnectIdentityForm);
  $("#extensionConnectTitle")?.focus();
  return card;
}

function renderExtensionConnectCard() {
  const request = extensionConnectState.request;
  const existing = $("#extensionConnectCard");
  if (!request) {
    // Removed, not hidden. `ensureExtensionConnectCard` writes the card's layout
    // as an inline `display: grid`, and an inline declaration outranks the
    // `[hidden] { display: none }` rule that the `hidden` attribute leans on —
    // `styles.css` carries no `.extension-connect-card` rule to override it
    // either. Setting `hidden` therefore left the card on screen after «Не
    // сейчас» and after «Закрыть», until a reload dropped it by other means.
    // Taking the node out closes it outright and takes its listeners with it;
    // `ensureExtensionConnectCard` rebuilds the whole card if a new connect
    // request ever arrives.
    if (existing) existing.remove();
    return;
  }
  const card = ensureExtensionConnectCard();
  const title = $("#extensionConnectTitle");
  const status = $("#extensionConnectStatus");
  const button = $("#extensionConnectConfirmButton");
  const dismissButton = $("#extensionConnectDismissButton");
  const summary = $("#extensionConnectSummary");
  const identityForm = $("#extensionConnectIdentityForm");
  const identityEmailLabel = $("#extensionConnectIdentityEmailLabel");
  const emailButton = $("#extensionConnectEmailButton");
  const connected = extensionConnectState.status === "connected";
  const connecting = extensionConnectState.status === "connecting";
  const identityRequired = extensionConnectState.status === "identity_required";
  const linkState = ["link_invalid", "link_untrusted", "link_expired"].includes(extensionConnectState.status);
  card.hidden = false;
  card.classList.toggle("extension-connect-card--error", Boolean(extensionConnectState.error));
  card.classList.toggle("extension-connect-card--connected", connected);
  const authUser = getCurrentRecoverableAuthUser();
  const connectedEmail = authUser?.hasEmailIdentity ? authUser.email : "";
  if (title) {
    const titleKey = connected
      ? "extension.connect.title.connected"
      : extensionConnectState.status === "link_untrusted"
      ? "extension.connect.title.link.untrusted"
      : extensionConnectState.status === "link_expired"
      ? "extension.connect.title.link.expired"
      : extensionConnectState.status === "link_invalid"
      ? "extension.connect.title.link.invalid"
      : "extension.connect.title.default";
    title.textContent = window.t(titleKey);
  }
  if (summary) {
    summary.textContent = linkState
      ? window.t("extension.connect.summary.restart")
      : connected
      ? window.t("extension.connect.summary.connected")
      : identityRequired
      ? window.t("extension.connect.summary.identity")
      : window.t("extension.connect.summary.default");
  }
  if (status) {
    status.setAttribute("role", extensionConnectState.error ? "alert" : "status");
    status.textContent = extensionConnectState.error
      || (connected
        ? (connectedEmail
          ? window.t("extension.connect.status.connected.account", { email: connectedEmail })
          : window.t("extension.connect.status.connected.generic"))
        : (identityRequired
          ? (recoverableAuthState.status || window.t("extension.connect.status.identity"))
          : window.t("extension.connect.status.default")));
  }
  if (identityForm) {
    identityForm.hidden = !identityRequired;
  }
  if (identityEmailLabel) {
    identityEmailLabel.textContent = window.t("extension.connect.identity.email.label");
  }
  if (emailButton) {
    emailButton.disabled = recoverableAuthState.upgradeSending;
    emailButton.textContent = window.t(recoverableAuthState.upgradeSending
      ? "extension.connect.action.email.sending"
      : "extension.connect.action.email.send");
  }
  if (button) {
    button.hidden = identityRequired || linkState;
    button.disabled = connecting || connected;
    button.textContent = window.t(connecting
      ? "extension.connect.action.connecting"
      : connected
      ? "extension.connect.action.connected"
      : extensionConnectState.status === "error"
      ? "extension.connect.action.retry"
      : "extension.connect.action.connect");
  }
  if (dismissButton) {
    dismissButton.disabled = false;
    dismissButton.onclick = dismissExtensionConnectCard;
    dismissButton.textContent = window.t(connected || linkState
      ? "extension.connect.action.close"
      : "extension.connect.action.cancel");
  }
  renderHomeProfile();
}

function dismissExtensionConnectCard() {
  extensionConnectState = { ...extensionConnectState, request: null, error: "" };
  const core = getExtensionConnectUiCore();
  if (core?.stripExtensionConnectParams && window.history?.replaceState) {
    window.history.replaceState({}, document.title, core.stripExtensionConnectParams(window.location.href));
  }
  renderExtensionConnectCard();
}

const EXTENSION_CONNECT_HANDOFF_TIMEOUT_MS = 12000;

function sendCredentialToExtension(extensionId, message) {
  return new Promise((resolve, reject) => {
    const runtime = window.chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new Error("extension_channel_unavailable"));
      return;
    }
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      callback();
    };
    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error("extension_handoff_timeout")));
    }, EXTENSION_CONNECT_HANDOFF_TIMEOUT_MS);
    runtime.sendMessage(extensionId, message, (response) => {
      const lastError = runtime.lastError?.message;
      if (lastError) {
        finish(() => reject(new Error(`extension_rejected:${lastError}`)));
        return;
      }
      if (!response?.ok) {
        finish(() => reject(new Error(`extension_rejected:${response?.error || "unknown"}`)));
        return;
      }
      finish(() => resolve(response));
    });
  });
}

async function submitExtensionConnectIdentityForm(event) {
  event.preventDefault();
  const request = extensionConnectState.request;
  if (!request || recoverableAuthState.upgradeSending) return;
  const { email, error: emailError } = getRecoverableAuthEmailFromInput("#extensionConnectEmailInput");
  if (emailError) {
    extensionConnectState = {
      ...extensionConnectState,
      status: "identity_required",
      error: window.t(email
        ? "extension.connect.identity.email.invalid"
        : "extension.connect.identity.email.required"),
    };
    renderExtensionConnectCard();
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    extensionConnectState = {
      ...extensionConnectState,
      status: "identity_required",
      error: window.t("extension.connect.identity.email.unavailable"),
    };
    renderExtensionConnectCard();
    return;
  }
  recoverableAuthState.upgradeSending = true;
  extensionConnectState = { ...extensionConnectState, status: "identity_required", error: "" };
  renderExtensionConnectCard();
  renderProfileSheet();
  try {
    await ensureSupabaseOwnerSession();
    storePendingExtensionConnectIntent(request);
    const result = await client.auth.updateUser({ email }, { emailRedirectTo: getRecoverableAuthRedirectUrl() });
    if (result.error) throw result.error;
    recoverableAuthState.status = window.t("share.profile.email.sent");
    showToast(window.t("share.profile.email.sent.toast"));
    await refreshRecoverableAuthSession();
  } catch (error) {
    extensionConnectState = {
      ...extensionConnectState,
      status: "identity_required",
      error: getRecoverableAuthSendErrorMessage(error),
    };
  } finally {
    recoverableAuthState.upgradeSending = false;
    renderProfileSheet();
    renderExtensionConnectCard();
  }
}

async function connectBackpackerExtension() {
  const request = extensionConnectState.request;
  const core = getExtensionConnectUiCore();
  if (!request || !core?.buildCredentialBridgeMessage || !core?.normalizeExtensionId) return;
  extensionConnectState = { ...extensionConnectState, status: "connecting", error: "" };
  renderExtensionConnectCard();
  try {
    const officialExtensionId = core.normalizeExtensionId(request.extensionId, window.location.href);
    const identityState = await requireRecoverableIdentityForExtensionConnect(request);
    if (identityState.identityRequired) {
      extensionConnectState = { ...extensionConnectState, status: "identity_required", error: "" };
      renderExtensionConnectCard();
      return;
    }
    const payload = await callExtensionConnectFunction("connect", { clientKey: request.clientKey });
    const message = core.buildCredentialBridgeMessage({
      request,
      account: payload.account,
      credential: payload.credential,
      connection: payload.connection,
    });
    await sendCredentialToExtension(officialExtensionId, message);
    extensionConnectState = { ...extensionConnectState, status: "connected", error: "" };
    if (core.stripExtensionConnectParams && window.history?.replaceState) {
      window.history.replaceState({}, document.title, core.stripExtensionConnectParams(window.location.href));
    }
    showToast(window.t("extension.connect.toast.connected"));
  } catch (error) {
    extensionConnectState = { ...extensionConnectState, ...getExtensionConnectRuntimeErrorState(error) };
  }
  renderExtensionConnectCard();
}

function initializeExtensionConnectBridge() {
  const core = getExtensionConnectUiCore();
  if (!core?.parseExtensionConnectRequest) return;
  try {
    core.assertNoCredentialInUrl?.(window.location.href);
    const request = core.parseExtensionConnectRequest(window.location.href);
    if (!request) return;
    extensionConnectState = { request, status: "idle", error: "" };
  } catch (error) {
    extensionConnectState = {
      request: {
        extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        clientKey: "invalid-client",
        nonce: "invalid-nonce-value-invalid-nonce-value",
      },
      ...getExtensionConnectLinkErrorState(error),
    };
  }
  renderExtensionConnectCard();
}

function normalizeIdeasRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

async function loadTravelIdeas({ silent = false } = {}) {
  const client = getSupabaseClient();
  const api = getTravelIdeasClientApi();
  if (!client || !api) {
    ideasState = {
      ...ideasState,
      error: window.t("ideas.error.unavailable"),
      loaded: true,
      loading: false,
    };
    renderIdeasScreen();
    return;
  }
  ideasState = { ...ideasState, error: "", loading: !silent, loaded: ideasState.loaded && silent };
  renderIdeasScreen();
  try {
    await getCurrentSupabaseUserForIdeas(client);
    const [collections, ideas] = await Promise.all([
      api.fetchTravelIdeaCollections(client),
      api.fetchInboxTravelIdeas(client),
    ]);
    const nextCollections = normalizeIdeasRows(collections);
    const nextIdeas = normalizeIdeasRows(ideas);
    const activeCollectionId = getIdeaCollectionIdFromKey(ideasState.activeCollectionKey);
    const activeCollectionExists = !activeCollectionId || nextCollections.some((collection) => collection.id === activeCollectionId);
    ideasState = {
      ...ideasState,
      collections: nextCollections,
      ideas: nextIdeas,
      activeCollectionKey: activeCollectionExists ? ideasState.activeCollectionKey : "all",
      error: "",
      loaded: true,
      loading: false,
    };
  } catch (error) {
    ideasState = {
      ...ideasState,
      error: getTravelIdeasErrorCopy(error),
      loaded: true,
      loading: false,
    };
  }
  renderIdeasScreen();
}

function renderIdeaCollectionChips() {
  const container = $("#ideaCollectionChips");
  if (!container) return;
  const chips = [
    ["all", window.t("ideas.collection.all")],
    ["ungrouped", window.t("ideas.collection.unassigned")],
    ...ideasState.collections.map((collection) => [`collection:${collection.id}`, collection.title || window.t("ideas.collection.fallback")]),
  ];
  container.innerHTML = chips.map(([key, label]) => `
    <button class="idea-collection-chip" type="button" data-idea-collection="${escapeAttr(key)}" aria-pressed="${ideasState.activeCollectionKey === key}">
      <span>${escapeHtml(label)}</span>
    </button>
  `).join("");
}

function formatIdeaCardPrice(viewModel) {
  if (viewModel.priceAmount === null || viewModel.priceAmount === undefined) return "";
  return viewModel.priceCurrency
    ? formatCurrencyAmount(viewModel.priceAmount, viewModel.priceCurrency)
    : window.BackpackerI18n.formatNumber(viewModel.priceAmount, { maximumFractionDigits: 2 });
}

function renderIdeaCard(row) {
  const core = getTravelIdeaCore();
  const viewModel = core.mapTravelIdeaRowToViewModel(row, ideasState.collections);
  const title = String(row?.title || "").trim() ? viewModel.title : window.t("ideas.card.title.fallback");
  const collectionTitle = viewModel.collectionId
    ? ideasState.collections.find((collection) => collection.id === viewModel.collectionId)?.title || window.t("ideas.collection.fallback")
    : window.t("ideas.collection.unassigned");
  const typeLabel = getPlanTypeLabel(viewModel.semanticType);
  const price = formatIdeaCardPrice(viewModel);
  const extras = [
    viewModel.locationText,
    price,
    viewModel.hasLink ? window.t("ideas.card.has.link") : "",
  ].filter(Boolean).join(" · ");
  const copy = viewModel.excerpt || viewModel.notes || "";
  const icon = typeIcons[viewModel.semanticType] || typeIcons.idea;
  return `
    <button class="idea-card" type="button" data-open-idea="${escapeAttr(viewModel.id)}" aria-label="${escapeAttr(window.t("ideas.card.open", { title }))}">
      <span class="idea-card-thumb${viewModel.hasImage ? " has-image" : ""}" aria-hidden="true">
        ${viewModel.hasImage ? `<img class="idea-thumb-image" src="${escapeAttr(viewModel.imageUrl)}" alt="${escapeAttr(viewModel.imageAlt)}" loading="lazy" />` : ""}
        <span class="idea-card-thumb-fallback">${icon}</span>
      </span>
      <span class="idea-card-body">
        <strong class="idea-card-title">${escapeHtml(title)}</strong>
        <span class="idea-card-meta">${escapeHtml(typeLabel)} · ${escapeHtml(collectionTitle)}</span>
        ${extras ? `<span class="idea-card-extra">${escapeHtml(extras)}</span>` : ""}
        ${copy ? `<span class="idea-card-copy">${escapeHtml(copy)}</span>` : ""}
      </span>
    </button>
  `;
}

function renderIdeasStateCard(kind) {
  if (kind === "loading") {
    return `<article class="ideas-state-card"><strong>${escapeHtml(window.t("ideas.state.loading.title"))}</strong><p>${escapeHtml(window.t("ideas.state.loading.copy"))}</p></article>`;
  }
  if (kind === "error") {
    return `
      <article class="ideas-state-card is-error">
        <strong>${escapeHtml(window.t("ideas.state.error.title"))}</strong>
        <p>${escapeHtml(ideasState.error)}</p>
        <div class="ideas-state-actions">
          <button class="ghost-button" type="button" data-ideas-retry>${escapeHtml(window.t("ideas.state.error.retry"))}</button>
          <button class="primary-button" type="button" data-open-idea-form>${escapeHtml(window.t("ideas.add"))}</button>
        </div>
      </article>
    `;
  }
  if (kind === "empty-all") {
    return `
      <article class="ideas-state-card">
        <strong>${escapeHtml(window.t("ideas.state.empty.title"))}</strong>
        <p>${escapeHtml(window.t("ideas.state.empty.copy"))}</p>
        <div class="ideas-state-actions">
          <button class="primary-button" type="button" data-open-idea-form>${escapeHtml(window.t("ideas.add"))}</button>
          <button class="ghost-button" type="button" data-open-idea-collection-form>${escapeHtml(window.t("ideas.collection.create"))}</button>
        </div>
      </article>
    `;
  }
  return `
    <article class="ideas-state-card">
      <strong>${escapeHtml(window.t("ideas.state.empty.filter.title", { collection: getCurrentIdeaCollectionTitle() }))}</strong>
      <p>${escapeHtml(window.t("ideas.state.empty.filter.copy"))}</p>
      <div class="ideas-state-actions">
        <button class="primary-button" type="button" data-open-idea-form>${escapeHtml(window.t("ideas.add"))}</button>
        <button class="ghost-button" type="button" data-open-idea-collection-form>${escapeHtml(window.t("ideas.collection.new"))}</button>
      </div>
    </article>
  `;
}

function renderIdeasScreen() {
  const list = $("#ideasList");
  if (!list) return;
  renderIdeaCollectionChips();
  if (ideasState.loading) {
    list.innerHTML = renderIdeasStateCard("loading");
    return;
  }
  if (ideasState.error) {
    list.innerHTML = renderIdeasStateCard("error");
    return;
  }
  const core = getTravelIdeaCore();
  const inboxIdeas = core.filterInboxTravelIdeas(ideasState.ideas, "all");
  const filteredIdeas = core.filterInboxTravelIdeas(ideasState.ideas, ideasState.activeCollectionKey);
  if (!inboxIdeas.length) {
    list.innerHTML = renderIdeasStateCard("empty-all");
    return;
  }
  if (!filteredIdeas.length) {
    list.innerHTML = renderIdeasStateCard("empty-filter");
    return;
  }
  list.innerHTML = filteredIdeas.map(renderIdeaCard).join("");
}

function scrollIdeasScreenToTopAfterSave() {
  const active = document.activeElement;
  if (active && typeof active.blur === "function") active.blur();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const screen = $("#ideasScreen");
      if (!screen || screen.classList.contains("hidden")) return;
      screen.scrollIntoView({ block: "start" });
      window.scrollTo({ top: Math.max(0, screen.offsetTop), left: 0, behavior: "auto" });
    });
  });
}

function getDefaultIdeaFormCollectionKey() {
  if (ideasState.activeCollectionKey === "ungrouped" || ideasState.activeCollectionKey.startsWith("collection:")) {
    return ideasState.activeCollectionKey;
  }
  return "ungrouped";
}

function renderIdeaFormSelects(selectedCollectionKey = "ungrouped", selectedType = "idea", selectedCurrency = "") {
  const form = $("#ideaForm");
  if (!form) return;
  form.elements.semanticType.innerHTML = itemTypes
    .map(([key]) => `<option value="${escapeAttr(key)}">${escapeHtml(getPlanTypeLabel(key))}</option>`)
    .join("");
  form.elements.semanticType.value = selectedType || "idea";
  form.elements.collectionKey.innerHTML = [
    ["ungrouped", window.t("ideas.collection.unassigned")],
    ...ideasState.collections.map((collection) => [`collection:${collection.id}`, collection.title || window.t("ideas.collection.fallback")]),
  ].map(([key, label]) => `<option value="${escapeAttr(key)}">${escapeHtml(label)}</option>`).join("");
  form.elements.collectionKey.value = selectedCollectionKey || "ungrouped";
  form.elements.priceCurrency.innerHTML = [
    ["", "—"],
    ...getSupportedCurrencies().map((currency) => [currency, currency]),
  ].map(([key, label]) => `<option value="${escapeAttr(key)}">${escapeHtml(label)}</option>`).join("");
  form.elements.priceCurrency.value = selectedCurrency || "";
}

function openIdeaSheet(ideaId = "") {
  const form = $("#ideaForm");
  if (!form) return;
  const idea = ideaId ? ideasState.ideas.find((entry) => entry.id === ideaId) : null;
  ideasState.editingIdeaId = idea?.id || "";
  $("#ideaSheetTitle").textContent = window.t(idea ? "ideas.form.title.edit" : "ideas.form.title.create");
  $("#ideaFormError").textContent = "";
  renderIdeaFormSelects(
    idea ? getIdeaCollectionKey(idea.collection_id) : getDefaultIdeaFormCollectionKey(),
    idea?.semantic_type || "idea",
    idea?.price_currency || "",
  );
  form.elements.id.value = idea?.id || "";
  form.elements.title.value = idea?.title || "";
  form.elements.url.value = idea?.url || "";
  form.elements.locationText.value = idea?.location_text || "";
  form.elements.priceAmount.value = idea?.price_amount ?? "";
  form.elements.notes.value = idea?.notes || "";
  $("#ideaAddToTripButton").hidden = !idea;
  $("#ideaAddToTripButton").disabled = ideasState.saving;
  $("#ideaArchiveButton").hidden = !idea;
  $("#ideaSaveButton").disabled = ideasState.saving;
  $("#ideaArchiveButton").disabled = ideasState.saving;
  openSheet("ideaSheet");
  window.setTimeout(() => form.elements.title?.focus(), 80);
}

function readIdeaFormInput(form) {
  const priceRaw = String(form.elements.priceAmount.value || "").trim();
  const collectionId = getIdeaCollectionIdFromKey(form.elements.collectionKey.value);
  return {
    title: form.elements.title.value,
    semanticType: form.elements.semanticType.value,
    collection_id: collectionId,
    url: form.elements.url.value,
    locationText: form.elements.locationText.value,
    priceAmount: priceRaw ? parseMoney(priceRaw) : null,
    priceCurrency: form.elements.priceCurrency.value,
    notes: form.elements.notes.value,
  };
}

async function submitIdeaForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (ideasState.saving) return;
  if (!validateMoneyFields(form, ["priceAmount"])) {
    form.reportValidity();
    $("#ideaFormError").textContent = window.t("ideas.form.validation.price");
    return;
  }
  const client = getSupabaseClient();
  const api = getTravelIdeasClientApi();
  const core = getTravelIdeaCore();
  if (!client || !api || !core) {
    $("#ideaFormError").textContent = window.t("ideas.error.unavailable");
    return;
  }
  ideasState.saving = true;
  $("#ideaFormError").textContent = "";
  $("#ideaSaveButton").disabled = true;
  $("#ideaArchiveButton").disabled = true;
  try {
    const input = readIdeaFormInput(form);
    const editingId = form.elements.id.value;
    let saved;
    if (editingId) {
      const patch = core.buildTravelIdeaEditablePatch(input);
      if (!patch) {
        $("#ideaFormError").textContent = window.t("ideas.form.validation.title");
        return;
      }
      saved = await api.updateTravelIdea(client, editingId, patch);
      ideasState.ideas = ideasState.ideas.map((idea) => idea.id === editingId ? { ...idea, ...saved } : idea);
      showToast(window.t("ideas.toast.saved"));
    } else {
      const user = await getCurrentSupabaseUserForIdeas(client);
      const payload = core.buildTravelIdeaInsertPayload({ ...input, source: "manual", status: "inbox" }, user.id);
      if (!payload) {
        $("#ideaFormError").textContent = window.t("ideas.form.validation.title");
        return;
      }
      saved = await api.insertTravelIdea(client, payload);
      ideasState.ideas = [saved, ...ideasState.ideas];
      ideasState.activeCollectionKey = getIdeaCollectionKey(saved.collection_id);
      trackEvent("idea_saved", {
        idea_id: saved.id,
        capture_source: saved.source || payload.source,
      });
      showToast(window.t("ideas.toast.created"));
    }
    closeSheet("ideaSheet");
    renderIdeasScreen();
    scrollIdeasScreenToTopAfterSave();
  } catch (error) {
    $("#ideaFormError").textContent = getTravelIdeasErrorCopy(error);
  } finally {
    ideasState.saving = false;
    $("#ideaSaveButton").disabled = false;
    $("#ideaAddToTripButton").disabled = false;
    $("#ideaArchiveButton").disabled = false;
  }
}

async function archiveCurrentIdea() {
  const ideaId = $("#ideaForm")?.elements.id.value || ideasState.editingIdeaId;
  if (!ideaId || ideasState.saving) return;
  const client = getSupabaseClient();
  const api = getTravelIdeasClientApi();
  if (!client || !api) return;
  ideasState.saving = true;
  $("#ideaFormError").textContent = "";
  $("#ideaSaveButton").disabled = true;
  $("#ideaArchiveButton").disabled = true;
  try {
    const archived = await api.archiveTravelIdea(client, ideaId);
    ideasState.ideas = ideasState.ideas.map((idea) => idea.id === ideaId ? { ...idea, ...archived, status: "archived" } : idea);
    closeSheet("ideaSheet");
    renderIdeasScreen();
    showToast(window.t("ideas.toast.archived"));
  } catch (error) {
    $("#ideaFormError").textContent = getTravelIdeasErrorCopy(error);
  } finally {
    ideasState.saving = false;
    $("#ideaSaveButton").disabled = false;
    $("#ideaAddToTripButton").disabled = false;
    $("#ideaArchiveButton").disabled = false;
  }
}

function openIdeaCollectionSheet() {
  const form = $("#ideaCollectionForm");
  if (!form) return;
  form.reset();
  $("#ideaCollectionFormError").textContent = "";
  $("#ideaCollectionSaveButton").disabled = ideasState.saving;
  openSheet("ideaCollectionSheet");
  window.setTimeout(() => form.elements.title?.focus(), 80);
}

async function submitIdeaCollectionForm(event) {
  event.preventDefault();
  if (ideasState.saving) return;
  const form = event.currentTarget;
  const client = getSupabaseClient();
  const api = getTravelIdeasClientApi();
  const core = getTravelIdeaCore();
  if (!client || !api || !core) {
    $("#ideaCollectionFormError").textContent = window.t("ideas.error.unavailable");
    return;
  }
  ideasState.saving = true;
  $("#ideaCollectionFormError").textContent = "";
  $("#ideaCollectionSaveButton").disabled = true;
  try {
    const user = await getCurrentSupabaseUserForIdeas(client);
    const payload = core.buildTravelIdeaCollectionInsertPayload({ title: form.elements.title.value }, user.id);
    if (!payload) {
      $("#ideaCollectionFormError").textContent = window.t("ideas.collection.form.validation.title");
      return;
    }
    const collection = await api.insertTravelIdeaCollection(client, payload);
    ideasState.collections = [...ideasState.collections, collection]
      .sort((a, b) => (Number(a.sort_order) - Number(b.sort_order)) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
    ideasState.activeCollectionKey = `collection:${collection.id}`;
    const ideaForm = $("#ideaForm");
    if (ideaForm && $("#ideaSheet")?.classList.contains("open")) {
      renderIdeaFormSelects(ideasState.activeCollectionKey, ideaForm.elements.semanticType.value, ideaForm.elements.priceCurrency.value);
    }
    closeSheet("ideaCollectionSheet");
    renderIdeasScreen();
    showToast(window.t("ideas.collection.toast.created"));
  } catch (error) {
    $("#ideaCollectionFormError").textContent = getTravelIdeasErrorCopy(error);
  } finally {
    ideasState.saving = false;
    $("#ideaCollectionSaveButton").disabled = false;
  }
}

function normalizeDisplayName(value = "") {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDisplayNameError(value = "") {
  const displayName = normalizeDisplayName(value);
  if (!displayName) return window.t("share.profile.validation.required");
  if (displayName.length > 40) return window.t("share.profile.validation.long");
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
    userProfile = { ...userProfile, loaded: false, loading: false, error: window.t("share.profile.loaded.error") };
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
  refreshRecoverableAuthSession().catch(() => {});
  return userProfile;
}

function renderHomeProfile() {
  const button = $("#homeProfileButton");
  const name = $("#homeProfileName");
  if (!button || !name) return;
  const shouldShow = isSupabaseConfigured() && currentScreen === "home";
  button.classList.toggle("hidden", !shouldShow);
  name.textContent = getHomeProfileLabel();
}

function getHomeProfileLabel() {
  if (userProfile.displayName) return userProfile.displayName;
  if (extensionConnectState.request && extensionConnectState.status === "identity_required") {
    if (recoverableAuthState.upgradeSending) return window.t("home.profile.email.sending");
    if (recoverableAuthState.status) return window.t("home.profile.email.check");
    return window.t("home.profile.email.save");
  }
  return window.t("home.profile.add");
}

function getHomeTripStatusLabel(tripId) {
  const record = shareRecords[tripId];
  if (record?.shareId && !record.revoked) return window.t("home.trip.status.shared.owner");
  return window.t("home.trip.status.personal");
}

function renderProfileSheet() {
  const input = $("#profileDisplayNameInput");
  const error = $("#profileError");
  const button = $("#profileSaveButton");
  const authCard = $("#recoverableAuthCard");
  const authSummary = $("#recoverableAuthSummary");
  const authStatus = $("#recoverableAuthStatus");
  const upgradeForm = $("#recoverableAuthUpgradeForm");
  const loginForm = $("#recoverableAuthLoginForm");
  const sendButton = $("#recoverableAuthSendButton");
  const loginButton = $("#recoverableAuthLoginButton");
  if (input && document.activeElement !== input) input.value = userProfile.displayName || input.value || "";
  if (error) error.textContent = userProfile.error || "";
  if (button) {
    button.disabled = profileSaving;
    button.textContent = window.t(profileSaving
      ? "share.profile.saving"
      : pendingProfileAction ? "share.profile.save.continue" : "share.profile.save");
  }
  if (!authCard) return;
  const authUser = recoverableAuthState.user;
  authCard.hidden = !isSupabaseConfigured();
  const isLinked = Boolean(authUser?.hasEmailIdentity && authUser.email);
  const isAnonymous = authUser?.isAnonymous === true;
  if (authSummary) {
    authSummary.textContent = isLinked
      ? window.t("share.profile.email.summary.linked", { email: authUser.email })
      : window.t("share.profile.email.summary.anonymous");
  }
  if (authStatus) {
    authStatus.classList.toggle("error", Boolean(recoverableAuthState.error));
    authStatus.textContent = recoverableAuthState.error
      || recoverableAuthState.status
      || (isLinked ? window.t("share.profile.email.saved", { email: authUser.email }) : "");
  }
  if (upgradeForm) upgradeForm.hidden = !isAnonymous || isLinked;
  if (loginForm) loginForm.hidden = isLinked;
  if (sendButton) {
    sendButton.disabled = recoverableAuthState.upgradeSending;
    sendButton.textContent = window.t(recoverableAuthState.upgradeSending ? "share.profile.email.sending" : "share.profile.email.send");
  }
  if (loginButton) {
    loginButton.disabled = recoverableAuthState.loginSending;
    loginButton.textContent = window.t(recoverableAuthState.loginSending ? "share.profile.email.sending" : "share.profile.email.login");
  }
}

function openProfileSheet(action = null) {
  pendingProfileAction = action;
  userProfile.error = "";
  renderProfileSheet();
  refreshRecoverableAuthSession().catch(() => {});
  openSheet("profileSheet");
  window.setTimeout(() => $("#profileDisplayNameInput")?.focus(), 80);
}

function getRecoverableAuthEmailFromInput(selector) {
  const core = getRecoverableAuthCore();
  const input = $(selector);
  const email = core?.normalizeEmail ? core.normalizeEmail(input?.value || "") : String(input?.value || "").trim().toLowerCase();
  const error = core?.getEmailError ? core.getEmailError(email) : "";
  return { email, error };
}

function getRecoverableAuthSendErrorMessage(error, { login = false } = {}) {
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);
  if (status === 429 || code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many")) {
    return window.t("share.profile.email.rate.limit");
  }
  if (message.includes("already")) {
    return window.t("share.profile.email.already");
  }
  return window.t(login ? "share.profile.email.login.error" : "share.profile.email.send.error");
}

async function submitRecoverableAuthUpgradeForm(event) {
  event.preventDefault();
  if (recoverableAuthState.upgradeSending) return;
  const { email, error } = getRecoverableAuthEmailFromInput("#recoverableAuthEmailInput");
  if (error) {
    recoverableAuthState.error = error;
    recoverableAuthState.status = "";
    renderProfileSheet();
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    recoverableAuthState.error = window.t("share.profile.email.supabase.missing");
    recoverableAuthState.status = "";
    renderProfileSheet();
    return;
  }
  recoverableAuthState.upgradeSending = true;
  recoverableAuthState.error = "";
  recoverableAuthState.status = "";
  renderProfileSheet();
  try {
    await ensureSupabaseOwnerSession();
    const result = await client.auth.updateUser({ email }, { emailRedirectTo: getRecoverableAuthRedirectUrl() });
    if (result.error) throw result.error;
    recoverableAuthState.status = window.t("share.profile.email.sent");
    showToast(window.t("share.profile.email.sent.toast"));
    await refreshRecoverableAuthSession();
  } catch (error) {
    recoverableAuthState.error = getRecoverableAuthSendErrorMessage(error);
  } finally {
    recoverableAuthState.upgradeSending = false;
    renderProfileSheet();
  }
}

async function submitRecoverableAuthLoginForm(event) {
  event.preventDefault();
  if (recoverableAuthState.loginSending) return;
  const { email, error } = getRecoverableAuthEmailFromInput("#recoverableLoginEmailInput");
  if (error) {
    recoverableAuthState.error = error;
    recoverableAuthState.status = "";
    renderProfileSheet();
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    recoverableAuthState.error = window.t("share.profile.email.login.unavailable");
    recoverableAuthState.status = "";
    renderProfileSheet();
    return;
  }
  recoverableAuthState.loginSending = true;
  recoverableAuthState.error = "";
  recoverableAuthState.status = "";
  renderProfileSheet();
  try {
    const result = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getRecoverableAuthRedirectUrl(),
        shouldCreateUser: false,
      },
    });
    if (result.error) throw result.error;
    recoverableAuthState.status = window.t("share.profile.email.sent");
    showToast(window.t("share.profile.email.sent.toast"));
  } catch (error) {
    recoverableAuthState.error = getRecoverableAuthSendErrorMessage(error, { login: true });
  } finally {
    recoverableAuthState.loginSending = false;
    renderProfileSheet();
  }
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
    showToast(window.t("share.profile.saved"));
    const action = pendingProfileAction?.action;
    pendingProfileAction = null;
    if (typeof action === "function") await action();
  } catch {
    userProfile.error = window.t("share.profile.save.error");
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
    const payload = await callTripShareFunction("read", { token }, { ensureSession: true });
    const nextState = normalizeState(payload.state);
    const share = {
      shareId: payload.shareId || "",
      sourceTripId: payload.tripId || nextState.trip.id,
      title: nextState.trip.title || window.t("share.received.trip.fallback"),
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
    if (!share.isOwner && share.shareId && share.sourceTripId) {
      trackEvent("shared_trip_opened", {
        trip_id: share.sourceTripId,
        trip_origin: "user_created",
        collaboration_id: share.shareId,
        actor_role: "recipient",
        access_mode: "view",
      });
    }
    return share;
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
  normalized.trip.dayCount = normalized.trip.startDate || normalized.trip.endDate
    ? getTripDayCount(normalized.trip)
    : normalizeTripDayCount(normalized.trip.dayCount, 1);
  normalized.trip.datePrecision = normalizeTripDraftDatePrecision(normalized.trip.datePrecision, normalized.trip.startDate, normalized.trip.endDate);
  normalized.trip.dateSourceText = normalized.trip.datePrecision === "approximate" ? String(normalized.trip.dateSourceText || "").trim().slice(0, 160) : "";
  normalized.trip.aiSourceText = String(normalized.trip.aiSourceText || "").trim().slice(0, 30000);
  normalized.trip.preferencesText = String(normalized.trip.preferencesText || "").trim().slice(0, 4000);
  normalized.trip.budgetLimit = parseMoney(normalized.trip.budgetLimit);
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
    const allocations = window.BackpackerFinancial.normalizeAllocations(item.allocations, {
      price,
      participantIds: Array.from(participantIds),
      ownerId: participantId,
    });
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
  if (privateTripSyncState.ready && !privateTripSyncState.applyingRemote) schedulePrivateTripSync();
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
  // Копейки и центы не показываем: в плашки они не помещаются, а решения
  // по ним никто не принимает. Округление только на выводе — в расчётах
  // и в хранении сумма остаётся точной.
  return `${Math.round(amount).toLocaleString("ru-RU")} ${currencySymbol(state.trip.currency)}`;
}

function formatBudgetMoney(value = 0) {
  if (!canShowBudget()) return window.t("budget.hidden");
  const amount = Math.round(Number(value) || 0);
  const currency = state.trip.currency || "";
  const symbol = window.BackpackerI18n.getLocale() === "en" && currency === "RSD"
    ? "RSD"
    : currencySymbol(currency);
  return `${window.BackpackerI18n.formatNumber(amount, { maximumFractionDigits: 0 })} ${symbol}`.trim();
}

function formatBudgetDate(dateString) {
  if (!dateString) return window.t("budget.estimate.undated");
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return window.t("budget.estimate.undated");
  return window.BackpackerI18n.formatDate(date, { day: "2-digit", month: "2-digit", year: "numeric" });
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
  const symbol = window.BackpackerI18n.getLocale() === "en" && currency === "RSD"
    ? "RSD"
    : currencySymbol(currency);
  return `${window.BackpackerI18n.formatNumber(amount, { maximumFractionDigits: 2 })} ${symbol}`.trim();
}

function convertCurrencyAmount(value, fromCurrency, toCurrency) {
  const amount = parseMoney(value);
  const fromRate = currencyRatesToRub[fromCurrency] || 1;
  const toRate = currencyRatesToRub[toCurrency] || 1;
  return (amount * fromRate) / toRate;
}

// Обратный курс смотрят так же часто, как прямой, а перевыбирать обе валюты
// вручную долго. Меняем направление одним нажатием.
function swapCurrencyDirection() {
  const fromSelect = $("#currencyFrom");
  const toSelect = $("#currencyTo");
  if (!fromSelect || !toSelect) return;
  const previousFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = previousFrom;
  renderCurrencyCalculator();
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
  const source = window.t(ratesSource === "live" ? "budget.currency.status.live" : "budget.currency.status.demo");
  const updated = ratesUpdatedAt
    ? window.t("budget.currency.status.updated", {
      time: window.BackpackerI18n.formatDate(ratesUpdatedAt, { hour: "2-digit", minute: "2-digit" }),
    })
    : "";
  status.textContent = window.t("budget.currency.status.summary", { source, updated });
}

async function refreshExchangeRates() {
  renderRatesStatus(window.t("budget.currency.status.refreshing"));
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
    renderRatesStatus(window.t("budget.currency.status.error"));
    trackEvent("currency_rates_refreshed", { source: "demo", failed: true });
  }
}

function parseMoney(value) {
  return window.BackpackerFinancial?.parseMoney(value) || 0;
}

const MONEY_INPUT_ERROR = "Проверьте сумму: для копеек используйте 1–2 цифры после точки или запятой.";

function getItemMoneyInputError() {
  return window.t("item.editor.validation.money");
}

function validateMoneyInput(input) {
  if (!input) return true;
  input.setCustomValidity("");
  if (!window.BackpackerFinancial?.isValidMoney(input.value)) {
    input.setCustomValidity(getItemMoneyInputError());
  }
  return !input.validationMessage;
}

function validateMoneyFields(form, names) {
  return names.every((name) => validateMoneyInput(form.elements[name]));
}

function normalizeTripDayCount(value, fallback = 1) {
  const count = Math.ceil(parseMoney(value));
  if (!Number.isFinite(count) || count <= 0) return fallback;
  return Math.max(1, Math.min(60, count));
}

function getVirtualDayIndex(value = "") {
  const match = String(value || "").match(/^day-(\d+)$/);
  if (!match) return 0;
  return normalizeTripDayCount(match[1], 0);
}

function isVirtualDayDate(value = "") {
  return getVirtualDayIndex(value) > 0;
}

function createVirtualDayDate(index) {
  return `${VIRTUAL_DAY_PREFIX}${normalizeTripDayCount(index)}`;
}

function formatDate(dateString, options = {}) {
  const virtualIndex = getVirtualDayIndex(dateString);
  if (virtualIndex) return `День ${virtualIndex}`;
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

function formatHomeDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return window.BackpackerI18n.formatDate(date, { day: "numeric", month: "long" });
}

function formatHomeTripCardDateRange(startDate, endDate) {
  if (startDate && endDate) {
    return window.t("home.date.range", { start: formatHomeDate(startDate), end: formatHomeDate(endDate) });
  }
  if (startDate) return window.t("home.date.from", { date: formatHomeDate(startDate) });
  if (endDate) return window.t("home.date.until", { date: formatHomeDate(endDate) });
  return window.t("home.trip.dates.missing");
}

function formatHomeTripDayCount(trip) {
  const count = getTripDayCount(trip);
  return window.t("home.trip.days", { count });
}

function formatHomeCurrencyAmount(value, currency) {
  const amount = Number(value) || 0;
  return `${window.BackpackerI18n.formatNumber(amount, { maximumFractionDigits: 2 })} ${currencySymbol(currency)}`;
}

function formatPlanDate(dateString, options = {}) {
  const virtualIndex = getVirtualDayIndex(dateString);
  if (virtualIndex) return window.t("plan.day.label", { number: virtualIndex });
  if (!dateString) return window.t("plan.unscheduled.title").toLowerCase();
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return window.t("plan.unscheduled.title").toLowerCase();
  return window.BackpackerI18n.formatDate(date, {
    day: "numeric",
    month: "long",
    ...options,
  });
}

function formatPlanTripDateRange(startDate, endDate) {
  if (startDate && endDate) {
    return window.t("plan.trip.date.range", {
      start: formatPlanDate(startDate),
      end: formatPlanDate(endDate),
    });
  }
  if (startDate) return window.t("plan.trip.date.from", { date: formatPlanDate(startDate) });
  if (endDate) return window.t("plan.trip.date.until", { date: formatPlanDate(endDate) });
  return window.t("plan.trip.date.missing");
}

function formatPlanDayCount(count) {
  return window.t("plan.trip.days", { count: Number(count) || 1 });
}

function formatPlanMoney(value = 0) {
  const amount = Math.round(Number(value) || 0);
  const currency = state.trip.currency || "";
  const symbol = window.BackpackerI18n.getLocale() === "en" && currency === "RSD"
    ? "RSD"
    : currencySymbol(currency);
  return `${window.BackpackerI18n.formatNumber(amount, { maximumFractionDigits: 0 })} ${symbol}`.trim();
}

function formatPlanDurationText(minutes) {
  const total = parseMoney(minutes);
  if (!total) return "--";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return [
    hours ? window.t("plan.item.duration.hours", { count: hours }) : "",
    rest ? window.t("plan.item.duration.minutes", { count: rest }) : "",
  ].filter(Boolean).join(" ");
}

function getPlanTypeLabel(type) {
  const key = `item.editor.type.${type}`;
  const label = window.t(key);
  return label === key ? window.t("plan.item.type.fallback") : label;
}

function getPlanStatusLabel(status) {
  const key = `item.editor.status.${status}`;
  const label = window.t(key);
  return label === key ? window.t("plan.item.status.fallback") : label;
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
  if (!trip?.startDate && !trip?.endDate && trip?.dayCount) {
    return normalizeTripDayCount(trip.dayCount);
  }
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

function formatEventMoveCountText(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} событие перенесено`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} события перенесены`;
  return `${count} событий перенесено`;
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
  const virtualIndex = getVirtualDayIndex(dateString);
  if (virtualIndex) return [window.t("plan.day.short"), String(virtualIndex), "–"];
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
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Array.from({ length: normalizeTripDayCount(trip?.dayCount, 0) }, (_, index) => createVirtualDayDate(index + 1));
  }
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
  const fallback = getParticipantFromList(participants, item.participantId);
  const allocations = window.BackpackerFinancial.normalizeAllocations(item.allocations, {
    price,
    participantIds: Array.from(participantIds),
    ownerId: fallback?.id || "",
  });
  if (allocations.length) return allocations;
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
  const label = itemParticipants.map(getItemEditorParticipantDisplayName).join(", ");
  return `
    <span class="item-participant-stack" aria-label="${escapeAttr(window.t("plan.item.participants.aria", { participants: label }))}">
      ${participants.map((participant) => {
        const displayName = getItemEditorParticipantDisplayName(participant);
        return `
          <span class="item-side-badge item-participant-badge participant-${escapeAttr(participant.colorKey)}" title="${escapeAttr(displayName)}">${escapeHtml(displayName.slice(0, 1).toUpperCase())}</span>
        `;
      }).join("")}
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
  return window.BackpackerFinancial.getFinancialSummary(state);
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
  // Hiding the trainer is one tap, so the way back has to live on the home screen too.
  $("#showTrainerButton")?.classList.toggle("hidden", !isHidden);
  if (trainerButton) {
    trainerButton.textContent = window.t(isHidden ? "home.trainer.settings.show" : "home.trainer.settings.hide");
  }
}

function renderSyncConflictNotice() {
  const card = $("#syncConflictCard");
  if (!card) return;
  const conflicts = getActivePrivateTripSyncConflicts();
  card.classList.toggle("hidden", !conflicts.length);
  if (!conflicts.length) return;
  const single = conflicts.length === 1;
  $("#syncConflictTitle").textContent = window.t(single ? "home.sync.title.single" : "home.sync.title.multiple");
  $("#syncConflictSummary").textContent = single
    ? window.t("home.sync.summary.single", { title: conflicts[0].baseTitle })
    : window.t("home.sync.summary.multiple");
  const list = $("#syncConflictList");
  list.innerHTML = "";
  conflicts.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = window.t("home.sync.copy", { title: entry.baseTitle });
    list.append(item);
  });
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
  renderSyncConflictNotice();
  renderReceivedTrips();
  const trips = tripStore.trips
    .filter((entry) => !entry.isDemo)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  if (!trips.length) {
    list.innerHTML = `
      <p class="empty-trips">
        <span>${escapeHtml(window.t("home.empty.primary"))}</span>
        <span>${escapeHtml(window.t("home.empty.secondary"))}</span>
      </p>
    `;
    return;
  }

  list.innerHTML = trips.map((entry) => {
    const trip = entry.state.trip;
    const style = entry.coverDataUrl ? ` style="--trip-cover: url('${escapeAttr(entry.coverDataUrl)}')"` : "";
    const statusLabel = getHomeTripStatusLabel(entry.id);
    const cardDateRange = formatHomeTripCardDateRange(trip.startDate, trip.endDate);
    return `
      <article class="home-card trip-list-card"${style}>
        <button class="trip-card-open" data-open-trip="${escapeAttr(entry.id)}" type="button">
          <div class="trip-card-status-row">
            <span class="home-card-kicker">${escapeHtml(statusLabel)}</span>
          </div>
          <div class="trip-card-title-block">
            <strong>${escapeHtml(trip.title || window.t("home.trip.untitled"))}</strong>
            <div class="trip-card-submeta">
              <span>${escapeHtml(trip.destination || window.t("home.trip.destination.missing"))}</span>
              <span>${escapeHtml(cardDateRange)}</span>
            </div>
          </div>
          <div class="home-card-meta">
            <span>${escapeHtml(formatHomeTripDayCount(trip))}</span>
            <span>${escapeHtml(formatHomeCurrencyAmount(trip.budgetLimit, trip.currency))}</span>
          </div>
        </button>
        <button class="cover-trip-button" data-cover-trip="${escapeAttr(entry.id)}" type="button" aria-label="${escapeAttr(window.t("home.trip.cover.action"))}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h4l1.8-2h4.4L16 8h4v11H4V8z"></path>
            <circle cx="12" cy="13.5" r="3"></circle>
            <path d="M18 5v4M16 7h4"></path>
          </svg>
        </button>
        <button class="delete-trip-button" data-delete-trip="${escapeAttr(entry.id)}" type="button">${escapeHtml(window.t("home.trip.delete"))}</button>
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
    list.innerHTML = `<p class="empty-trips"><span>${escapeHtml(window.t("home.received.loading"))}</span></p>`;
    return;
  }
  list.innerHTML = receivedShareCards.map((entry) => {
    const dateText = formatHomeTripCardDateRange(entry.startDate, entry.endDate);
    const destinationText = entry.destination || window.t("home.trip.destination.missing");
    const dayCountText = entry.startDate || entry.endDate
      ? formatHomeTripDayCount({ startDate: entry.startDate, endDate: entry.endDate })
      : entry.dayCount ? window.t("home.trip.days", { count: Number(entry.dayCount) }) : window.t("home.trip.days.missing");
    const coverStyle = entry.coverDataUrl ? ` style="--trip-cover: url('${escapeAttr(entry.coverDataUrl)}')"` : "";
    const statusBadge = window.t(entry.revoked ? "home.received.access.closed" : "home.received.shared.guest");
    const authorBadge = entry.authorDisplayName
      ? window.t("home.received.author.named", { name: entry.authorDisplayName })
      : window.t("home.received.author");
    return `
      <article class="home-card trip-list-card received-trip-card${entry.revoked ? " received-trip-card-closed" : ""}"${coverStyle}>
        <button class="trip-card-open" data-open-received-trip="${escapeAttr(entry.shareId)}" type="button" ${entry.revoked ? "disabled aria-disabled=\"true\"" : ""}>
          <div class="trip-card-status-row">
            <span class="home-card-kicker">${escapeHtml(statusBadge)}</span>
            <span class="home-card-kicker received-trip-author-badge">${escapeHtml(authorBadge)}</span>
          </div>
          <div class="trip-card-title-block">
            <strong>${escapeHtml(entry.title || window.t("home.received.trip.untitled"))}</strong>
            <div class="trip-card-submeta">
              <span>${escapeHtml(destinationText)}</span>
              <span>${escapeHtml(entry.revoked ? window.t("home.received.access.closed") : dateText)}</span>
            </div>
          </div>
          <div class="home-card-meta">
            <span>${escapeHtml(dayCountText)}</span>
            <span>${entry.includeBudget === false ? escapeHtml(window.t("home.received.budget.hidden")) : escapeHtml(formatHomeCurrencyAmount(entry.budgetLimit || 0, entry.currency || "RUB"))}</span>
          </div>
        </button>
        <button class="delete-trip-button received-trip-remove-button" data-remove-received-trip="${escapeAttr(entry.shareId)}" type="button">${escapeHtml(window.t("home.received.remove"))}</button>
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
    if (!silent) showToast(window.t("home.received.refresh.failed"));
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
    showToast(window.t("share.received.saved"));
  } catch (error) {
    if (error.status === 409) {
      readOnlyShare.isOwner = true;
      renderSaveReceivedTripButton();
      showToast(window.t("share.received.own"));
    } else if (error.status === 410) {
      readOnlyShare.invalid = true;
      renderSaveReceivedTripButton();
      showToast(window.t("share.received.closed"));
    } else {
      showToast(window.t(isSupabaseConfigured() ? "share.received.add.error" : "share.link.supabase.missing"));
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
      title: nextState.trip.title || window.t("share.received.trip.fallback"),
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
    trackEvent("shared_trip_opened", {
      trip_id: readOnlyShare.sourceTripId,
      trip_origin: "user_created",
      collaboration_id: readOnlyShare.shareId,
      actor_role: "recipient",
      access_mode: "view",
    });
  } catch (error) {
    if (error.status === 410) {
      showToast(window.t("home.received.access.closed"));
      await refreshReceivedTrips();
      return;
    }
    showToast(window.t("home.received.open.failed"));
  }
}

async function removeReceivedTrip(shareId) {
  if (!shareId) return;
  try {
    await callTripShareFunction("remove_received", { shareId }, { requireOwner: true });
    receivedShareCards = receivedShareCards.filter((entry) => entry.shareId !== shareId);
    renderReceivedTrips();
    showToast(window.t("home.received.removed"));
  } catch {
    showToast(window.t("home.received.remove.failed"));
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
    pending: window.t("share.proposal.status.pending"),
    accepted: window.t("share.proposal.status.accepted"),
    rejected: window.t("share.proposal.status.rejected"),
    withdrawn: window.t("share.proposal.status.withdrawn"),
    stale: window.t("share.proposal.status.stale"),
  }[status] || status;
}

function resetExpenseProposalDraft(itemId = "") {
  expenseProposalDraft = { itemId, participantMode: "", participantId: "", proposedParticipantName: "", amount: 0 };
}

async function openExpenseProposalSheet(itemId, profileReady = false) {
  if (!isReadOnlyMode()) return;
  if (readOnlyShare?.isOwner || readOnlyShare?.isAuthor) {
    showToast(window.t("share.proposal.expense.own.trip"));
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
    body.innerHTML = `<p class="field-hint">${escapeHtml(window.t("share.proposal.expense.not.found"))}</p>`;
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
    body.innerHTML = `<p class="field-hint">${escapeHtml(window.t("share.proposal.expense.budget.hidden"))}</p>`;
    return;
  }
  if (shareProposalContext?.isOwner) {
    body.innerHTML = `<p class="field-hint">${escapeHtml(window.t("share.proposal.expense.owner.direct"))}</p>`;
    return;
  }
  if (existingProposal?.status === "pending") {
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(window.t("share.proposal.expense.yours", { amount: formatBudgetMoney(existingProposal.amount), status: formatProposalStatus(existingProposal.status) }))}</p>
        <button class="ghost-button" type="button" data-withdraw-expense-proposal="${escapeAttr(existingProposal.id)}">${escapeHtml(window.t("share.proposal.expense.withdraw"))}</button>
      </section>
    `;
    return;
  }
  if (existingProposal?.status === "accepted") {
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(window.t("share.proposal.expense.share", { amount: formatBudgetMoney(existingProposal.amount), status: formatProposalStatus(existingProposal.status) }))}</p>
        <button class="ghost-button" type="button" data-withdraw-accepted-expense-proposal="${escapeAttr(existingProposal.id)}" ${resolvingExpenseProposalIds.has(existingProposal.id) ? "disabled" : ""}>${escapeHtml(window.t("share.proposal.expense.withdraw.share"))}</button>
      </section>
    `;
    return;
  }
  if (existingProposal && existingProposal.status !== "withdrawn") {
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(window.t("share.proposal.expense.yours", { amount: formatBudgetMoney(existingProposal.amount), status: formatProposalStatus(existingProposal.status) }))}</p>
        <button class="primary-button" type="button" data-new-expense-proposal>${escapeHtml(window.t("share.proposal.expense.new"))}</button>
      </section>
    `;
    return;
  }
  if (authorAmount <= 0) {
    body.innerHTML = `<p class="field-hint">${escapeHtml(window.t("share.proposal.expense.allocated"))}</p>`;
    return;
  }

  if (!expenseProposalDraft.participantMode && userParticipant) {
    expenseProposalDraft.participantMode = "existing";
    expenseProposalDraft.participantId = userParticipant.id;
  }

  if (!expenseProposalDraft.participantMode) {
    const existingOptions = availableParticipants.length
      ? `
        <button class="primary-button" type="button" data-proposal-mode="existing">${escapeHtml(window.t("share.proposal.expense.existing"))}</button>
        <button class="ghost-button" type="button" data-proposal-mode="new">${escapeHtml(window.t("share.proposal.expense.add.new"))}</button>
      `
      : `
        <p class="field-hint">${escapeHtml(window.t("share.proposal.expense.not.participant"))}</p>
        <button class="primary-button" type="button" data-proposal-mode="new">${escapeHtml(window.t("share.proposal.expense.add.me"))}</button>
      `;
    body.innerHTML = `
      <section class="proposal-summary">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(window.t("share.proposal.expense.author.available", { amount: formatBudgetMoney(authorAmount) }))}</p>
      </section>
      <section class="proposal-choice">
        <h3>${escapeHtml(window.t("share.proposal.expense.participation"))}</h3>
        ${existingOptions}
      </section>
    `;
    return;
  }

  if (expenseProposalDraft.participantMode === "existing" && !expenseProposalDraft.participantId) {
    body.innerHTML = `
      <section class="proposal-choice">
        <h3>${escapeHtml(window.t("share.proposal.expense.who"))}</h3>
        ${availableParticipants.map((participant) => `
          <button class="ghost-button" type="button" data-proposal-participant="${escapeAttr(participant.id)}">${escapeHtml(participant.name)}</button>
        `).join("")}
        <button class="ghost-button" type="button" data-proposal-back>${escapeHtml(window.t("share.proposal.back"))}</button>
      </section>
    `;
    return;
  }

  if (expenseProposalDraft.participantMode === "new" && !expenseProposalDraft.proposedParticipantName) {
    const suggestedName = userProfile.displayName || shareProposalContext?.currentUserDisplayName || "";
    body.innerHTML = `
      <section class="proposal-choice">
        <h3>${escapeHtml(window.t("share.proposal.expense.author.display"))}</h3>
        <label class="field wide">
          ${escapeHtml(window.t("share.proposal.expense.name"))}
          <input id="proposalParticipantNameInput" maxlength="40" placeholder="${escapeAttr(window.t("share.proposal.expense.name.placeholder"))}" value="${escapeAttr(suggestedName)}" />
        </label>
        <button class="primary-button" type="button" data-save-proposal-name>${escapeHtml(window.t("share.proposal.continue"))}</button>
        <button class="ghost-button" type="button" data-proposal-back>${escapeHtml(window.t("share.proposal.back"))}</button>
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
      <p>${escapeHtml(window.t("share.proposal.expense.total", { amount: formatBudgetMoney(item.price) }))}</p>
      <p>${escapeHtml(window.t("share.proposal.expense.author.current", { amount: formatBudgetMoney(authorAmount) }))}</p>
      ${currentUserAmount ? `<p>${escapeHtml(window.t("share.proposal.expense.your.current", { amount: formatBudgetMoney(currentUserAmount) }))}</p>` : ""}
      <p>${escapeHtml(window.t("share.proposal.expense.participant", { name: displayName }))}</p>
    </section>
    <section class="proposal-choice">
      <h3>${escapeHtml(window.t("share.proposal.expense.amount.title"))}</h3>
      <button class="primary-button" type="button" data-proposal-full-amount="${authorAmount}">${escapeHtml(window.t("share.proposal.expense.amount.full", { amount: formatBudgetMoney(authorAmount) }))}</button>
      <label class="field wide">
        ${escapeHtml(window.t("share.proposal.expense.amount.other"))}
        <input id="proposalAmountInput" inputmode="numeric" placeholder="0" />
      </label>
      <p class="field-hint">${escapeHtml(window.t("share.proposal.expense.amount.after", { amount: formatBudgetMoney(futureAmount) }))}</p>
      <button class="primary-button" type="button" data-submit-expense-proposal>${escapeHtml(window.t("share.proposal.expense.submit"))}</button>
      <button class="ghost-button" type="button" data-proposal-back>${escapeHtml(window.t("share.proposal.back"))}</button>
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
    showToast(window.t("share.proposal.expense.amount.required"));
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
    showToast(window.t("share.proposal.expense.sent"));
    renderExpenseProposalSheet();
  } catch (error) {
    showToast(window.t(error?.message === "pending_proposal_exists"
      ? "share.proposal.expense.duplicate"
      : "share.proposal.expense.send.error"));
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
    showToast(window.t("share.proposal.expense.withdrawn"));
    renderExpenseProposalSheet();
  } catch {
    showToast(window.t("share.proposal.expense.withdraw.error"));
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
        <strong>${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || window.t("item.editor.expense.participant.fallback"))}</strong>
        <p>${escapeHtml(window.t("item.editor.expense.covered", { amount: formatItemEditorMoney(proposal.amount) }))}</p>
      </div>
      <button class="ghost-button compact" type="button" data-reject-accepted-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>${escapeHtml(window.t("item.editor.expense.remove.share"))}</button>
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
        <strong>${escapeHtml(proposal.itemTitle || state.items.find((item) => item.id === proposal.itemId)?.title || window.t("budget.estimate.proposal.expense"))}</strong>
        <p>${isReadOnlyMode()
          ? escapeHtml(window.t("budget.estimate.proposal.your.share"))
          : escapeHtml(proposal.requesterDisplayName || proposal.requesterName || window.t("budget.estimate.proposal.participant"))}: ${escapeHtml(formatBudgetMoney(proposal.amount))}</p>
      </div>
      <button class="ghost-button compact" type="button" ${isReadOnlyMode()
        ? `data-withdraw-accepted-expense-proposal="${escapeAttr(proposal.id)}"`
        : `data-reject-accepted-expense-proposal="${escapeAttr(proposal.id)}"`} ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>
        ${escapeHtml(window.t(isReadOnlyMode() ? "budget.estimate.proposal.withdraw" : "budget.estimate.proposal.cancel"))}
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
    showToast(window.t(nextStatus === "withdrawn"
      ? "item.editor.expense.share.withdrawn"
      : "item.editor.expense.share.removed"));
  } catch {
    showToast(window.t("item.editor.expense.share.error"));
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
  form.elements.itemType.innerHTML = itemTypes.map(([key]) => `<option value="${key}">${escapeHtml(getPlanTypeLabel(key))}</option>`).join("");
  form.elements.title.value = itemProposalDraft.title || "";
  form.elements.itemType.value = itemProposalDraft.itemType || "idea";
  form.elements.link.value = itemProposalDraft.link || "";
  form.elements.price.value = itemProposalDraft.price || "";
  form.elements.notes.value = itemProposalDraft.notes || "";
  $("#itemProposalSubmitButton").disabled = itemProposalSubmitting;
  $("#itemProposalSubmitButton").textContent = window.t(itemProposalSubmitting
    ? "share.proposal.item.submitting"
    : "share.proposal.item.submit");
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
    showToast(window.t("share.proposal.item.title.required"));
    return;
  }
  if (formData.price !== "" && formData.price < 0) {
    showToast(window.t("share.proposal.item.price.invalid"));
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
    showToast(window.t("share.proposal.item.sent"));
    renderMyItemProposals();
  } catch (error) {
    showToast(window.t(error?.message === "profile_required"
      ? "share.proposal.item.profile.required"
      : "share.proposal.item.send.error"));
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
    showToast(window.t("share.proposal.item.withdrawn"));
    renderMyItemProposals();
  } catch {
    showToast(window.t("share.proposal.item.withdraw.error"));
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
        <strong>${escapeHtml(proposal.title || window.t("share.proposal.item.fallback"))}</strong>
        <p>${escapeHtml(getPlanTypeLabel(proposal.itemType || "idea"))} · ${escapeHtml(formatProposalStatus(proposal.status))}</p>
      </div>
      ${proposal.status === "pending" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-withdraw-item-proposal="${escapeAttr(proposal.id)}">${escapeHtml(window.t("share.proposal.item.withdraw"))}</button>
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
  $("#proposalInboxTitle").textContent = window.t("share.proposal.inbox.title", { count: pendingCount });
  $("#proposalInboxList").innerHTML = proposals.map((proposal) => proposal.proposalType === "item" ? `
    <article class="proposal-card proposal-${escapeAttr(proposal.status)}">
      <div>
        <strong>${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || window.t("share.proposal.user.fallback"))}</strong>
        <p>${escapeHtml(window.t("share.proposal.item.suggests", { title: proposal.title || window.t("share.proposal.item.fallback") }))}</p>
        <p class="proposal-account-link">${escapeHtml(window.t("share.proposal.item.new", { type: getPlanTypeLabel(proposal.itemType || "idea") }))}${proposal.price ? ` · ${escapeHtml(formatBudgetMoney(proposal.price))}` : ""}</p>
        ${proposal.link ? `<a class="item-link" href="${escapeAttr(proposal.link)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${escapeHtml(window.t("share.proposal.item.open.link"))}</a>` : ""}
        ${proposal.notes ? `<p class="item-note">${escapeHtml(proposal.notes)}</p>` : ""}
        <span>${formatProposalStatus(proposal.status)}</span>
      </div>
      ${proposal.status === "pending" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-reject-item-proposal="${escapeAttr(proposal.id)}" ${resolvingItemProposalIds.has(proposal.id) ? "disabled" : ""}>${escapeHtml(window.t("share.proposal.reject"))}</button>
          <button class="primary-button compact" type="button" data-accept-item-proposal="${escapeAttr(proposal.id)}" ${resolvingItemProposalIds.has(proposal.id) ? "disabled" : ""}>${escapeHtml(window.t(resolvingItemProposalIds.has(proposal.id) ? "share.proposal.accept.adding" : "share.proposal.accept.item"))}</button>
        </div>
      ` : ""}
    </article>
  ` : `
    <article class="proposal-card proposal-${escapeAttr(proposal.status)}">
      <div>
        <strong>${escapeHtml(proposal.requesterDisplayName || proposal.requesterName || window.t("share.proposal.user.fallback"))}</strong>
        <p>${escapeHtml(window.t(proposal.participantMode === "new" ? "share.proposal.expense.joins" : "share.proposal.expense.suggests", { amount: formatBudgetMoney(proposal.amount), title: proposal.itemTitle }))}</p>
        ${proposal.participantName ? `<p class="proposal-account-link">${escapeHtml(window.t("share.proposal.expense.account", { participant: proposal.participantName, account: proposal.requesterDisplayName || proposal.requesterName || window.t("share.proposal.user.fallback") }))}</p>` : ""}
        <span>${formatProposalStatus(proposal.status)}</span>
      </div>
      ${proposal.status === "pending" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-reject-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>${escapeHtml(window.t("share.proposal.reject"))}</button>
          <button class="primary-button compact" type="button" data-accept-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>${escapeHtml(window.t(resolvingExpenseProposalIds.has(proposal.id) ? "share.proposal.expense.applying" : (proposal.participantMode === "new" ? "share.proposal.expense.add.accept" : "share.proposal.accept")))}</button>
        </div>
      ` : proposal.status === "accepted" ? `
        <div class="proposal-actions">
          <button class="ghost-button compact" type="button" data-reject-accepted-expense-proposal="${escapeAttr(proposal.id)}" ${resolvingExpenseProposalIds.has(proposal.id) ? "disabled" : ""}>${escapeHtml(window.t("share.proposal.expense.cancel.share"))}</button>
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
  const authorName = readOnlyShare.authorDisplayName || window.t("share.role.author.fallback");
  banner.classList.remove("hidden");
  banner.textContent = window.t("share.role.author", { name: authorName });
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
  const includeBudget = record?.includeBudget !== false;
  await callTripShareFunction("update", {
    tripId: state.trip.id,
    includeBudget,
    schemaVersion: TRIP_SHARE_SCHEMA_VERSION,
    state: buildPublishedTripState({ includeBudget }),
  }, { requireOwner: true });
}

async function acceptExpenseProposal(proposalId) {
  if (resolvingExpenseProposalIds.has(proposalId)) return;
  resolvingExpenseProposalIds.add(proposalId);
  renderProposalInbox();
  try {
    const previousItems = structuredClone(state.items);
    await syncCurrentTripShareBeforeAccept();
    const payload = await callTripShareFunction("accept_expense_proposal", { proposalId }, { requireOwner: true });
    if (payload.state) {
      state = normalizeState(payload.state);
      saveState();
      trackPersistedItemAnalyticsChanges(previousItems, state.items, "proposal");
    }
    await refreshAuthorExpenseProposals();
    render();
    showToast(window.t(payload.status === "stale" ? "share.proposal.stale" : "share.proposal.accepted"));
  } catch {
    showToast(window.t("share.proposal.accept.error"));
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
    showToast(window.t("share.proposal.rejected"));
  } catch {
    showToast(window.t("share.proposal.reject.error"));
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
    const previousItems = structuredClone(state.items);
    await syncCurrentTripShareBeforeAccept();
    const payload = await callTripShareFunction("accept_item_proposal", { proposalId }, { requireOwner: true });
    if (payload.state) {
      state = normalizeState(payload.state);
      saveState();
      trackPersistedItemAnalyticsChanges(previousItems, state.items, "proposal");
    }
    await refreshAuthorExpenseProposals();
    render();
    showToast(window.t(payload.status === "stale" ? "share.proposal.item.stale" : "share.proposal.item.accepted"));
  } catch {
    showToast(window.t("share.proposal.item.accept.error"));
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
    showToast(window.t("share.proposal.item.rejected"));
  } catch {
    showToast(window.t("share.proposal.item.reject.error"));
  } finally {
    resolvingItemProposalIds.delete(proposalId);
    renderProposalInbox();
  }
}

function renderHeader() {
  const dates = getTripDates();
  const totals = getTotals();
  $("#tripTitle").textContent = state.trip.title || window.t("plan.trip.untitled");
  $("#tripMeta").textContent = `${state.trip.destination || window.t("plan.trip.destination.missing")} · ${formatPlanTripDateRange(state.trip.startDate, state.trip.endDate)} · ${formatPlanDayCount(dates.length || 1)}`;
  $("#tripBudgetMeta").textContent = canShowBudget()
    ? window.t("plan.trip.budget", { amount: formatPlanMoney(totals.budgetLimit) })
    : window.t("plan.trip.budget.hidden");
  $("#paidTotal").textContent = canShowBudget() ? formatPlanMoney(totals.paidTotal) : window.t("plan.trip.budget.hidden");
  $("#plannedTotal").textContent = canShowBudget() ? formatPlanMoney(totals.confirmedOutstanding) : window.t("plan.trip.budget.hidden");
  $("#remainingTotal").textContent = canShowBudget() ? formatPlanMoney(totals.remainingConfirmed) : window.t("plan.trip.budget.hidden");
  $("#remainingTotal").style.color = totals.remainingConfirmed < 0 ? "var(--danger)" : "";
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
          <h3>${escapeHtml(window.t("plan.day.label", { number: index + 1 }))}</h3>
          <span class="day-date">${escapeHtml(formatPlanDate(date, { weekday: "short" }))}</span>
          <span class="day-total">${escapeHtml(formatPlanMoney(total))}</span>
        </div>
      </header>
      <div class="day-items" data-drop-date="${date}">
        ${items.length ? items.map(renderItemCard).join("") : `<p class="empty-state">${escapeHtml(window.t("plan.day.empty"))}</p>`}
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
    : `<p class="empty-state">${escapeHtml(window.t("plan.unscheduled.empty"))}</p>`;
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
    ["all", window.t("plan.filter.all")],
    ["nodate", window.t("plan.filter.unscheduled")],
    ...["paid", "fixed", "want", "maybe", "backup"]
      .map((status) => [status, getPlanStatusLabel(status)]),
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
    .map(([status]) => {
      const groupItems = items.filter((item) => item.status === status).sort(sortItems);
      if (!groupItems.length) return "";
      return `
        <section class="basket-group">
          <div class="card-title-row">
            <h3>${escapeHtml(getPlanStatusLabel(status))}</h3>
            <span class="muted">${groupItems.length}</span>
          </div>
          <div class="basket-grid-list">
            ${groupItems.map(renderItemCard).join("")}
          </div>
        </section>
      `;
    })
    .join("");
  $("#basketList").innerHTML = groups || `<p class="empty-state card">${escapeHtml(window.t("plan.filter.empty"))}</p>`;
}

function renderBudget() {
  const totals = getTotals();
  const dates = getTripDates();
  const participantTotals = getParticipantTotals()
    .map(({ participant, total }) => {
      const displayName = getItemEditorParticipantDisplayName(participant);
      const displayParticipant = { ...participant, initials: displayName.slice(0, 1).toUpperCase() };
      return `
        <div class="participant-total-row">
          <span>${renderParticipantAvatar(displayParticipant)}<span>${escapeHtml(displayName)}</span>${participant.isSelf ? `<em>${escapeHtml(window.t("budget.participant.self"))}</em>` : ""}</span>
          <strong>${escapeHtml(formatBudgetMoney(total))}</strong>
        </div>
      `;
    })
    .join("");
  const byDay = dates
    .map((date, index) => {
      const total = state.items
        .filter((item) => item.date === date && isActiveCost(item))
        .reduce((sum, item) => sum + parseMoney(item.price), 0);
      return `<div class="budget-row"><span>${escapeHtml(window.t("budget.day.label", { number: index + 1 }))} · ${escapeHtml(formatBudgetDate(date))}</span><strong>${escapeHtml(formatBudgetMoney(total))}</strong></div>`;
    })
    .join("");
  $("#budgetPage").innerHTML = `
    <section class="budget-metric-group">
      <h3>${escapeHtml(window.t("budget.section.core"))}</h3>
      <div class="budget-grid">
        <div class="metric-card service-total budget-limit-total"><span>${escapeHtml(window.t("budget.metric.limit"))}</span><strong>${escapeHtml(formatBudgetMoney(totals.budgetLimit))}</strong></div>
        <div class="metric-card"><span>${escapeHtml(window.t("budget.metric.paid"))}</span><strong>${escapeHtml(formatBudgetMoney(totals.paidTotal))}</strong></div>
        <div class="metric-card"><span>${escapeHtml(window.t("budget.metric.booked"))}</span><strong>${escapeHtml(formatBudgetMoney(totals.confirmedOutstanding))}</strong></div>
        <div class="metric-card"><span>${escapeHtml(window.t("budget.metric.available"))}</span><strong style="color:${canShowBudget() && totals.remainingConfirmed < 0 ? "var(--danger)" : "var(--green)"}">${escapeHtml(formatBudgetMoney(totals.remainingConfirmed))}</strong></div>
      </div>
    </section>
    <section class="budget-metric-group">
      <h3>${escapeHtml(window.t("budget.section.flexible"))}</h3>
      <div class="budget-grid additional-budget-grid">
        <div class="metric-card"><span>${escapeHtml(window.t("budget.metric.backup"))}</span><strong>${escapeHtml(formatBudgetMoney(totals.additionalTotal))}</strong></div>
        <div class="metric-card service-total"><span>${escapeHtml(window.t("budget.metric.possible"))}</span><strong>${escapeHtml(formatBudgetMoney(totals.possibleTotal))}</strong></div>
        <div class="metric-card"><span>${escapeHtml(window.t("budget.metric.remaining.all"))}</span><strong style="color:${canShowBudget() && totals.remainingAll < 0 ? "var(--danger)" : "var(--green)"}">${escapeHtml(formatBudgetMoney(totals.remainingAll))}</strong></div>
      </div>
    </section>
    <section class="card budget-days-card">
      <div class="card-title-row">
        <h3>${escapeHtml(window.t("budget.days.title"))}</h3>
        <div class="title-actions">
          <span class="muted">${dates.length}</span>
          <button class="ghost-button compact" id="copyDaysButton" type="button">${escapeHtml(window.t("budget.export.download"))}</button>
        </div>
      </div>
      ${byDay}
    </section>
    <section class="card participant-totals-card">
      <div class="card-title-row">
        <h3>${escapeHtml(window.t("budget.participants.title"))}</h3>
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
        <tr><td>${escapeHtml(window.t("budget.estimate.hidden"))}</td></tr>
      </tbody>
    `;
    renderEstimateProposalControls();
    return;
  }
  const { header, rows } = buildEstimateRows({
    dayLabel: window.t("budget.estimate.column.day"),
    itemLabel: window.t("budget.estimate.column.item"),
    categoryLabel: window.t("budget.estimate.column.category"),
    totalColumnLabel: window.t("budget.estimate.column.total"),
    undatedLabel: window.t("budget.estimate.undated"),
    totalRowLabel: window.t("budget.estimate.total"),
    dateFormatter: formatBudgetDate,
    typeFormatter: getPlanTypeLabel,
    participantFormatter: getItemEditorParticipantDisplayName,
  });
  table.innerHTML = `
    <thead>
      <tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>${row.map((cell, index) => `<td>${index >= 3 ? escapeHtml(formatBudgetMoney(cell)) : escapeHtml(cell)}</td>`).join("")}</tr>
      `).join("")}
    </tbody>
  `;
  renderEstimateProposalControls();
}

function renderItemCard(item) {
  const price = canShowBudget() && parseMoney(item.price) ? formatPlanMoney(item.price) : "--";
  const participantBadges = renderItemParticipantBadges(item);
  const note = item.notes ? `<p class="item-note">${escapeHtml(item.notes)}</p>` : "";
  const link = item.link
    ? `<a class="item-link" href="${escapeAttr(item.link)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${escapeHtml(window.t("plan.item.link.open"))}</a>`
    : "";
  const sourceMarker = item.creationSource === "accepted_proposal" && item.proposedByDisplayName
    ? `<p class="item-source-marker" title="${escapeAttr(window.t("plan.item.source.suggested", { name: item.proposedByDisplayName }))}">${escapeHtml(window.t("plan.item.source.suggested", { name: item.proposedByDisplayName }))}</p>`
    : "";
  return `
    <button class="item-card type-${item.type}" data-edit="${item.id}" data-drag-id="${item.id}" draggable="false" type="button">
      <span class="tile-icon" aria-hidden="true">
        <span>${typeIcons[item.type] || typeIcons.other}</span>
        <small>${escapeHtml(getPlanTypeLabel(item.type))}</small>
      </span>
      <div class="item-body">
        <div class="item-top">
          <span class="item-title">${escapeHtml(item.title)}</span>
          <span class="price-pill">${price}</span>
        </div>
        ${sourceMarker}
        <div class="item-content-grid">
          <div class="item-main-flow">
            <p class="item-duration">${escapeHtml(formatPlanDurationText(item.durationMinutes))}</p>
            <div class="item-time-slots" aria-label="${escapeAttr(window.t("plan.item.time.aria"))}">${renderItemTimeSlots(item)}</div>
            <p class="item-date-label">${escapeHtml(window.t("plan.item.date.label"))}</p>
            <div class="item-date-slots" aria-label="${escapeAttr(window.t("plan.item.date.aria"))}">${renderItemDateSlots(item)}</div>
          </div>
          <div class="item-side-badges">
            <span class="item-side-badge status-icon status-${item.status}" title="${escapeAttr(getPlanStatusLabel(item.status))}" aria-label="${escapeAttr(getPlanStatusLabel(item.status))}">${getStatusIcon(item.status)}</span>
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

function resetLinkIntakeState() {
  linkIntakeState = { isLoading: false, draft: null, status: "", error: "", previewOnlyImageUrl: "", appliedSnapshot: null };
}

function isLinkIntakePanelAvailable() {
  const form = $("#itemForm");
  return Boolean(form && !form.elements.id.value && !isReadOnlyMode());
}

function getLinkIntakePriceLabel(draft) {
  if (!draft || !draft.price) return "";
  const currency = draft.currency || state.trip.currency || "";
  const amount = draft.currency && draft.currency !== state.trip.currency
    ? `${draft.price} ${draft.currency}`
    : formatItemEditorMoney(draft.price);
  if (draft.priceKind === "from") return window.t("item.editor.link.price.from", { amount });
  if (draft.priceKind === "range") return window.t("item.editor.link.price.range", { amount });
  if (draft.priceKind === "exact") return window.t("item.editor.link.price.exact", { amount });
  const genericAmount = currency ? `${draft.price} ${currency}` : String(draft.price);
  return window.t("item.editor.link.price.generic", { amount: genericAmount });
}

function getLinkIntakeDraftWarnings(draft) {
  if (!draft) return [];
  const warnings = [];
  if (draft.price && draft.priceKind !== "exact") {
    warnings.push(window.t("item.editor.link.warning.estimate"));
  }
  if (draft.price && draft.currency && draft.currency !== state.trip.currency) {
    warnings.push(window.t("item.editor.link.warning.currency", {
      sourceCurrency: draft.currency,
      tripCurrency: state.trip.currency,
    }));
  }
  return [...warnings, ...(Array.isArray(draft.warnings) ? draft.warnings : [])].slice(0, 6);
}

function renderLinkIntakePanel({ visible = true } = {}) {
  const panel = $("#linkIntakePanel");
  if (!panel) return;
  const shouldShow = visible && isLinkIntakePanelAvailable();
  panel.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  const button = $("#linkIntakePreviewButton");
  const status = $("#linkIntakeStatus");
  const preview = $("#linkIntakePreview");
  const hint = $("#linkIntakeHint");
  const buttonState = window.BackpackerLinkIntakeUiCore.createLinkIntakeButtonState(linkIntakeState);
  if (button) {
    button.disabled = buttonState.disabled;
    button.textContent = window.t(linkIntakeState.isLoading
      ? "item.editor.link.preview.loading"
      : "item.editor.link.preview");
  }
  if (status) {
    status.textContent = linkIntakeState.error || linkIntakeState.status || "";
    status.classList.toggle("is-error", Boolean(linkIntakeState.error));
  }
  if (hint) {
    hint.textContent = window.t("item.editor.link.hint");
  }
  if (!preview) return;

  const draft = linkIntakeState.draft;
  preview.classList.toggle("hidden", !draft);
  if (!draft) {
    preview.innerHTML = "";
    return;
  }

  const image = linkIntakeState.previewOnlyImageUrl
    ? `<div class="link-intake-image-preview"><img src="${escapeAttr(linkIntakeState.previewOnlyImageUrl)}" alt="" loading="lazy" data-link-intake-image /></div>`
    : "";
  const description = draft.description
    ? `<p class="link-intake-preview-copy">${escapeHtml(draft.description)}</p>`
    : "";
  const price = getLinkIntakePriceLabel(draft)
    ? `<p class="link-intake-preview-copy">${escapeHtml(getLinkIntakePriceLabel(draft))}</p>`
    : "";
  const warnings = getLinkIntakeDraftWarnings(draft)
    .map((warning) => `<p class="link-intake-preview-warning">${escapeHtml(warning)}</p>`)
    .join("");
  preview.innerHTML = `
    <article class="link-intake-preview-card">
      ${image}
      <p class="link-intake-preview-title">${escapeHtml(window.t("item.editor.link.preview.title"))}</p>
      ${description}
      ${price}
      ${warnings}
      <p class="link-intake-preview-copy">${escapeHtml(window.t("item.editor.link.preview.image.note"))}</p>
    </article>
  `;
  preview.querySelector("[data-link-intake-image]")?.addEventListener("error", (event) => {
    event.currentTarget.closest(".link-intake-image-preview")?.classList.add("hidden");
  }, { once: true });
}

function getLinkIntakeFormValues() {
  const form = $("#itemForm");
  if (!form) return {};
  return {
    link: form.elements.link.value,
    title: form.elements.title.value,
    type: form.elements.type.value,
    locationText: form.elements.locationText.value,
    price: form.elements.price.value,
  };
}

function restoreLinkIntakeFormValues(values, fields) {
  const form = $("#itemForm");
  if (!form || !values || !Array.isArray(fields)) return;
  fields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(values, field) || !form.elements[field]) return;
    form.elements[field].value = values[field];
    if (field === "price") validateMoneyInput(form.elements.price);
  });
  updateOpenLinkButton();
}

function clearStaleLinkIntakeDraftFields() {
  const snapshot = linkIntakeState.appliedSnapshot;
  if (!snapshot) return [];
  const result = window.BackpackerLinkIntakeUiCore.clearStaleLinkIntakeValues(getLinkIntakeFormValues(), snapshot);
  restoreLinkIntakeFormValues(result.values, result.clearedFields);
  linkIntakeState.appliedSnapshot = null;
  return result.clearedFields;
}

function applyLinkIntakeDraftToItemForm(draft) {
  const form = $("#itemForm");
  if (!form || !draft) return null;
  const beforeValues = getLinkIntakeFormValues();
  if (draft.sourceUrl) form.elements.link.value = draft.sourceUrl;
  if (draft.title) form.elements.title.value = draft.title;
  if (draft.type && Array.from(form.elements.type.options).some((option) => option.value === draft.type)) {
    form.elements.type.value = draft.type;
  }
  if (draft.locationText) form.elements.locationText.value = draft.locationText;
  const canUseExactPrice = draft.price && draft.priceKind === "exact" && (!draft.currency || draft.currency === state.trip.currency);
  if (canUseExactPrice) {
    form.elements.price.value = String(draft.price);
    validateMoneyInput(form.elements.price);
  }
  updateOpenLinkButton();
  return window.BackpackerLinkIntakeUiCore.createLinkIntakeAppliedSnapshot(beforeValues, getLinkIntakeFormValues());
}

function getDefaultItemCreateContext() {
  return {
    source: "",
    creationMethod: "manual",
    returnScreenOnCancel: "",
    sourceIdeaId: "",
    toastOnSave: "",
  };
}

function resetItemCreateContext() {
  itemCreateContext = getDefaultItemCreateContext();
  renderItemDraftWarning("");
}

function renderItemDraftWarning(message = "") {
  const warning = $("#itemDraftWarning");
  if (!warning) return;
  warning.textContent = message || "";
  warning.classList.toggle("hidden", !message);
}

function applyInitialDraftToItemForm(initialDraft = {}) {
  const form = $("#itemForm");
  if (!form || !initialDraft) return;
  if (initialDraft.title) form.elements.title.value = String(initialDraft.title || "");
  if (initialDraft.type && Array.from(form.elements.type.options).some((option) => option.value === initialDraft.type)) {
    form.elements.type.value = initialDraft.type;
  }
  form.elements.status.value = "want";
  form.elements.priority.value = "nice";
  form.elements.date.value = formatDateForInput(initialDraft.date || "");
  if (initialDraft.link) form.elements.link.value = String(initialDraft.link || "");
  if (initialDraft.locationText) form.elements.locationText.value = String(initialDraft.locationText || "");
  if (initialDraft.notes) form.elements.notes.value = String(initialDraft.notes || "");
  const price = parseMoney(initialDraft.price);
  form.elements.price.value = price > 0 ? String(price) : "";
  validateMoneyInput(form.elements.price);
  updateOpenLinkButton();
}

async function previewLinkIntakeFromForm() {
  if (linkIntakeState.isLoading || isReadOnlyMode()) return;
  const form = $("#itemForm");
  const url = normalizeExternalUrl(form?.elements.link.value || "");
  const request = window.BackpackerLinkIntakeUiCore.createLinkIntakePreviewRequest(url);
  if (!request.shouldCallBackend) {
    clearStaleLinkIntakeDraftFields();
    linkIntakeState = { ...linkIntakeState, isLoading: false, draft: null, error: window.t("item.editor.link.validation.url"), status: "", previewOnlyImageUrl: "", appliedSnapshot: null };
    renderLinkIntakePanel();
    return;
  }
  linkIntakeState = { ...linkIntakeState, isLoading: true, draft: null, status: window.t("item.editor.link.status.searching"), error: "", previewOnlyImageUrl: "" };
  renderLinkIntakePanel();
  try {
    const payload = await callLinkIntakeFunction("preview", { url: request.url });
    const draft = payload.draft || null;
    if (!draft || (!draft.title && !draft.sourceUrl && !draft.description && !draft.locationText)) {
      throw new Error("empty_draft");
    }
    clearStaleLinkIntakeDraftFields();
    const appliedSnapshot = applyLinkIntakeDraftToItemForm(draft);
    linkIntakeState = {
      isLoading: false,
      draft,
      status: window.t("item.editor.link.status.filled"),
      error: "",
      previewOnlyImageUrl: draft.imageUrl || "",
      appliedSnapshot,
    };
    renderLinkIntakePanel();
  } catch (error) {
    const reason = error.message === "supabase_not_configured"
      ? window.t("item.editor.link.error.unavailable")
      : error.message === "invalid_url"
        ? window.t("item.editor.link.error.invalid")
        : error.message === "empty_draft"
          ? window.t("item.editor.link.error.empty")
          : window.t("item.editor.link.error.generic");
    clearStaleLinkIntakeDraftFields();
    linkIntakeState = { isLoading: false, draft: null, status: "", error: reason, previewOnlyImageUrl: "", appliedSnapshot: null };
    renderLinkIntakePanel();
  }
}

function resetTripItemAttachmentsState(item = null) {
  tripItemAttachmentsRequestVersion += 1;
  tripItemAttachmentsState = {
    attachments: [],
    deletingId: "",
    error: "",
    itemId: item?.id || "",
    loading: false,
    pendingFiles: [],
    previews: {},
    tripId: state.trip.id || "",
    uploading: false,
    uploadingName: "",
  };
  renderTripItemAttachments();
}

function getTripItemAttachmentById(attachmentId) {
  return tripItemAttachmentsState.attachments.find((attachment) => attachment.id === attachmentId) || null;
}

function getFreshTripItemAttachmentPreview(attachmentId) {
  const preview = tripItemAttachmentsState.previews[attachmentId];
  // Renew a little before the signed URL actually lapses so a thumbnail never 403s on screen.
  return preview && preview.expiresAt - TRIP_ITEM_PREVIEW_RENEW_MS > Date.now() ? preview : null;
}

// Signed URLs cannot be embedded straight from the row: each one is a network call, so they
// are fetched after the list renders and the list is redrawn once they arrive.
async function ensureTripItemAttachmentPreviews() {
  const core = getTripItemAttachmentsCore();
  const api = getTripItemAttachmentsClientApi();
  if (!core || !api || tripItemAttachmentsPreviewsInFlight) return;
  const itemId = tripItemAttachmentsState.itemId;
  const missing = tripItemAttachmentsState.attachments.filter(
    (attachment) => core.isPreviewableAttachment(attachment.mimeType) && !getFreshTripItemAttachmentPreview(attachment.id),
  );
  if (!missing.length) return;
  tripItemAttachmentsPreviewsInFlight = true;
  const requestVersion = tripItemAttachmentsRequestVersion;
  const resolved = {};
  try {
    for (const attachment of missing) {
      try {
        const url = await api.createTripItemAttachmentSignedUrl(getSupabaseClient(), attachment, TRIP_ITEM_PREVIEW_TTL_SECONDS);
        resolved[attachment.id] = { expiresAt: Date.now() + TRIP_ITEM_PREVIEW_TTL_SECONDS * 1000, url };
      } catch {
        // A single unavailable preview must not break the rest of the list.
      }
    }
  } finally {
    tripItemAttachmentsPreviewsInFlight = false;
  }
  if (requestVersion !== tripItemAttachmentsRequestVersion || tripItemAttachmentsState.itemId !== itemId) return;
  if (!Object.keys(resolved).length) return;
  tripItemAttachmentsState = {
    ...tripItemAttachmentsState,
    previews: { ...tripItemAttachmentsState.previews, ...resolved },
  };
  renderTripItemAttachments();
}

function renderTripItemAttachments() {
  const section = $("#itemAttachmentsSection");
  const list = $("#itemAttachmentsList");
  const status = $("#itemAttachmentsStatus");
  const addButton = $("#itemAttachmentAddButton");
  if (!section || !list || !status || !addButton) return;

  const visible = Boolean(tripItemAttachmentsState.tripId) && !isReadOnlyMode();
  const busy = tripItemAttachmentsState.uploading || Boolean(tripItemAttachmentsState.deletingId);
  $("#itemSaveButton").disabled = visible && tripItemAttachmentsState.uploading;
  $("#resetItemButton").disabled = visible && tripItemAttachmentsState.uploading;
  $("#deleteItemButton").disabled = visible && (busy || tripItemAttachmentsState.loading);
  section.classList.toggle("hidden", !visible);
  if (!visible) {
    list.innerHTML = "";
    status.textContent = "";
    return;
  }

  const core = getTripItemAttachmentsCore();
  status.textContent = tripItemAttachmentsState.loading
    ? window.t("item.editor.attachments.loading")
    : tripItemAttachmentsState.uploading
      ? window.t("item.editor.attachments.uploading", { fileName: tripItemAttachmentsState.uploadingName })
      : tripItemAttachmentsState.error
        || (tripItemAttachmentsState.pendingFiles.length
          ? window.t("item.editor.attachments.pending")
          : "");
  status.classList.toggle("is-error", Boolean(tripItemAttachmentsState.error));
  addButton.disabled = busy || tripItemAttachmentsState.loading;
  addButton.textContent = window.t(tripItemAttachmentsState.uploading
    ? "item.editor.attachments.add.loading"
    : "item.editor.attachments.add");

  const rows = tripItemAttachmentsState.attachments.map((attachment) => {
    const deleting = tripItemAttachmentsState.deletingId === attachment.id;
    const type = core?.getAttachmentTypeLabel?.(attachment.mimeType) || window.t("item.editor.attachments.file");
    const size = formatItemAttachmentSize(attachment.fileSizeBytes);
    const previewable = Boolean(core?.isPreviewableAttachment?.(attachment.mimeType));
    const preview = previewable ? getFreshTripItemAttachmentPreview(attachment.id) : null;
    // A photo says what it is; a file name like IMG_20260804_102714 does not.
    const thumb = previewable
      ? `<button class="item-attachment-thumb${preview ? "" : " is-loading"}" type="button" data-attachment-open="${escapeAttr(attachment.id)}" ${deleting ? "disabled" : ""} aria-label="${escapeAttr(window.t("item.editor.attachments.open.file", { fileName: attachment.fileName }))}">${
        preview ? `<img src="${escapeAttr(preview.url)}" alt="" loading="lazy" decoding="async" />` : ""
      }</button>`
      : "";
    return `
      <article class="item-attachment-row${previewable ? " has-thumb" : ""}">
        ${thumb}
        <div class="item-attachment-copy">
          <span class="item-attachment-name" title="${escapeAttr(attachment.fileName)}">${previewable ? "" : "📎 "}${escapeHtml(attachment.fileName)}</span>
          <span class="item-attachment-meta">${escapeHtml([type, size].filter(Boolean).join(" · "))}</span>
        </div>
        <div class="item-attachment-actions">
          <button class="icon-button item-attachment-action" type="button" data-attachment-open="${escapeAttr(attachment.id)}" ${deleting ? "disabled" : ""} title="${escapeAttr(window.t("item.editor.attachments.open"))}" aria-label="${escapeAttr(window.t("item.editor.attachments.open.file", { fileName: attachment.fileName }))}">${ATTACHMENT_OPEN_ICON}</button>
          <button class="icon-button item-attachment-action item-attachment-delete" type="button" data-attachment-delete="${escapeAttr(attachment.id)}" ${deleting ? "disabled" : ""} title="${escapeAttr(window.t(deleting ? "item.editor.attachments.deleting" : "item.editor.attachments.delete"))}" aria-label="${escapeAttr(window.t(deleting ? "item.editor.attachments.deleting.file" : "item.editor.attachments.delete.file", { fileName: attachment.fileName }))}">${ATTACHMENT_DELETE_ICON}</button>
        </div>
      </article>
    `;
  }).join("");

  const pendingRows = tripItemAttachmentsState.pendingFiles.map((pending) => {
    const type = core?.getAttachmentTypeLabel?.(pending.mimeType) || window.t("item.editor.attachments.file");
    const size = formatItemAttachmentSize(pending.fileSizeBytes);
    return `
      <article class="item-attachment-row is-pending">
        <div class="item-attachment-copy">
          <span class="item-attachment-name" title="${escapeAttr(pending.fileName)}">📎 ${escapeHtml(pending.fileName)}</span>
          <span class="item-attachment-meta">${escapeHtml([type, size, window.t("item.editor.attachments.after.save")].filter(Boolean).join(" · "))}</span>
        </div>
        <div class="item-attachment-actions">
          <button class="icon-button item-attachment-action item-attachment-delete" type="button" data-attachment-pending-remove="${escapeAttr(pending.id)}" ${busy ? "disabled" : ""} title="${escapeAttr(window.t("item.editor.attachments.remove"))}" aria-label="${escapeAttr(window.t("item.editor.attachments.remove.file", { fileName: pending.fileName }))}">${ATTACHMENT_DELETE_ICON}</button>
        </div>
      </article>
    `;
  }).join("");

  const empty = !tripItemAttachmentsState.loading && !rows && !pendingRows
    ? `<p class="item-attachment-empty">${escapeHtml(window.t("item.editor.attachments.empty"))}</p>`
    : "";
  const retry = tripItemAttachmentsState.error && !tripItemAttachmentsState.uploading
    ? `<button class="ghost-button compact item-attachment-retry" type="button" data-attachment-retry>${escapeHtml(window.t("item.editor.attachments.retry"))}</button>`
    : "";
  list.innerHTML = `${rows}${pendingRows}${empty}${retry}`;
  ensureTripItemAttachmentPreviews();
}

async function loadTripItemAttachments() {
  const itemId = tripItemAttachmentsState.itemId;
  const tripId = tripItemAttachmentsState.tripId;
  if (!itemId || !tripId) return;
  const requestVersion = ++tripItemAttachmentsRequestVersion;
  tripItemAttachmentsState = {
    ...tripItemAttachmentsState,
    attachments: [],
    error: "",
    loading: true,
  };
  renderTripItemAttachments();
  try {
    await ensureSupabaseOwnerSession();
    const attachments = await getTripItemAttachmentsClientApi().listTripItemAttachments(
      getSupabaseClient(),
      { tripId, tripItemId: itemId },
    );
    if (requestVersion !== tripItemAttachmentsRequestVersion || tripItemAttachmentsState.itemId !== itemId) return;
    tripItemAttachmentsState = { ...tripItemAttachmentsState, attachments, error: "", loading: false };
  } catch (error) {
    if (requestVersion !== tripItemAttachmentsRequestVersion || tripItemAttachmentsState.itemId !== itemId) return;
    tripItemAttachmentsState = {
      ...tripItemAttachmentsState,
      error: getLocalizedTripItemAttachmentErrorMessage(error, "item.editor.attachments.error.list"),
      loading: false,
    };
  }
  renderTripItemAttachments();
}

async function uploadCurrentTripItemAttachment(file) {
  const itemId = tripItemAttachmentsState.itemId;
  const tripId = tripItemAttachmentsState.tripId;
  if (!file || !tripId || tripItemAttachmentsState.uploading) return;
  if (!itemId) {
    try {
      const normalized = getTripItemAttachmentsCore().validateAttachmentFile(file);
      const pendingId = globalThis.crypto?.randomUUID?.() || `pending-${Date.now()}`;
      tripItemAttachmentsState = {
        ...tripItemAttachmentsState,
        error: "",
        pendingFiles: [
          ...tripItemAttachmentsState.pendingFiles,
          { ...normalized, file, id: pendingId },
        ],
      };
      showToast(window.t("item.editor.attachments.pending.toast"));
    } catch (error) {
      tripItemAttachmentsState = {
        ...tripItemAttachmentsState,
        error: getLocalizedTripItemAttachmentErrorMessage(error, "item.editor.attachments.error.add"),
      };
    }
    renderTripItemAttachments();
    return;
  }
  tripItemAttachmentsState = {
    ...tripItemAttachmentsState,
    error: "",
    uploading: true,
    uploadingName: String(file.name || window.t("item.editor.attachments.file").toLowerCase()),
  };
  renderTripItemAttachments();
  try {
    await ensureSupabaseOwnerSession();
    const attachment = await getTripItemAttachmentsClientApi().uploadTripItemAttachment(
      getSupabaseClient(),
      { tripId, tripItemId: itemId },
      file,
    );
    if (tripItemAttachmentsState.itemId === itemId) {
      tripItemAttachmentsState = {
        ...tripItemAttachmentsState,
        attachments: [...tripItemAttachmentsState.attachments, attachment],
        error: "",
      };
      showToast(window.t("item.editor.attachments.added"));
    }
  } catch (error) {
    if (tripItemAttachmentsState.itemId === itemId) {
      tripItemAttachmentsState = {
        ...tripItemAttachmentsState,
        error: getLocalizedTripItemAttachmentErrorMessage(error),
      };
    }
  } finally {
    if (tripItemAttachmentsState.itemId === itemId) {
      tripItemAttachmentsState = { ...tripItemAttachmentsState, uploading: false, uploadingName: "" };
      renderTripItemAttachments();
    }
  }
}

async function uploadPendingTripItemAttachments(item) {
  if (!item?.id || tripItemAttachmentsState.pendingFiles.length === 0) return;
  const pendingFiles = [...tripItemAttachmentsState.pendingFiles];
  tripItemAttachmentsState = {
    ...tripItemAttachmentsState,
    error: "",
    itemId: item.id,
    loading: false,
    tripId: state.trip.id,
    uploading: true,
    uploadingName: pendingFiles[0].fileName,
  };
  renderTripItemAttachments();
  try {
    await ensureSupabaseOwnerSession();
    for (const pending of pendingFiles) {
      tripItemAttachmentsState = { ...tripItemAttachmentsState, uploadingName: pending.fileName };
      renderTripItemAttachments();
      const attachment = await getTripItemAttachmentsClientApi().uploadTripItemAttachment(
        getSupabaseClient(),
        { tripId: state.trip.id, tripItemId: item.id },
        pending.file,
      );
      tripItemAttachmentsState = {
        ...tripItemAttachmentsState,
        attachments: [...tripItemAttachmentsState.attachments, attachment],
        pendingFiles: tripItemAttachmentsState.pendingFiles.filter((entry) => entry.id !== pending.id),
      };
    }
  } catch (error) {
    tripItemAttachmentsState = {
      ...tripItemAttachmentsState,
      error: window.t("item.editor.attachments.saved.error", {
        error: getLocalizedTripItemAttachmentErrorMessage(error),
      }),
    };
    throw error;
  } finally {
    tripItemAttachmentsState = { ...tripItemAttachmentsState, uploading: false, uploadingName: "" };
    renderTripItemAttachments();
  }
}

/**
 * Hands an already-signed URL to the native shell. Kept separate from the
 * browser path on purpose: the branch is decided before any window exists,
 * because a shell has no popup to pre-open and an `about:blank` tab opened "just
 * in case" would be left sitting on screen.
 */
async function openTripItemAttachmentThroughPlatform(attachment) {
  const failWith = (message) => {
    tripItemAttachmentsState = { ...tripItemAttachmentsState, error: message };
    renderTripItemAttachments();
  };
  try {
    await ensureSupabaseOwnerSession();
    const signedUrl = await getTripItemAttachmentsClientApi().createTripItemAttachmentSignedUrl(
      getSupabaseClient(),
      attachment,
      120,
    );
    const result = await runPlatformFileAction("openRemoteDocument", [signedUrl]);
    // Cancelling is the user closing the viewer, not a problem to report.
    if (result.status === "success" || result.status === "cancelled") return;
    failWith(window.t("item.editor.attachments.error.open"));
  } catch (error) {
    failWith(
      getLocalizedTripItemAttachmentErrorMessage(error, "item.editor.attachments.error.open"),
    );
  }
}

async function openTripItemAttachment(attachmentId) {
  const attachment = getTripItemAttachmentById(attachmentId);
  if (!attachment) return;
  if (hasPlatformFileAction("openRemoteDocument")) {
    await openTripItemAttachmentThroughPlatform(attachment);
    return;
  }
  const previewWindow = window.open("about:blank", "_blank");
  if (previewWindow) previewWindow.opener = null;
  try {
    await ensureSupabaseOwnerSession();
    const signedUrl = await getTripItemAttachmentsClientApi().createTripItemAttachmentSignedUrl(
      getSupabaseClient(),
      attachment,
      120,
    );
    if (!previewWindow) throw new Error("attachment_window_blocked");
    previewWindow.location.replace(signedUrl);
  } catch (error) {
    previewWindow?.close();
    const message = error?.message === "attachment_window_blocked"
      ? window.t("item.editor.attachments.error.popup")
      : getLocalizedTripItemAttachmentErrorMessage(error, "item.editor.attachments.error.open");
    tripItemAttachmentsState = { ...tripItemAttachmentsState, error: message };
    renderTripItemAttachments();
  }
}

async function deleteCurrentTripItemAttachment(attachmentId) {
  const attachment = getTripItemAttachmentById(attachmentId);
  if (!attachment || tripItemAttachmentsState.deletingId) return;
  if (!window.confirm(window.t("item.editor.attachments.delete.confirm", { fileName: attachment.fileName }))) return;
  tripItemAttachmentsState = { ...tripItemAttachmentsState, deletingId: attachmentId, error: "" };
  renderTripItemAttachments();
  try {
    await ensureSupabaseOwnerSession();
    await getTripItemAttachmentsClientApi().deleteTripItemAttachment(getSupabaseClient(), attachment);
    tripItemAttachmentsState = {
      ...tripItemAttachmentsState,
      attachments: tripItemAttachmentsState.attachments.filter((entry) => entry.id !== attachmentId),
      error: "",
    };
    showToast(window.t("item.editor.attachments.deleted"));
  } catch (error) {
    tripItemAttachmentsState = {
      ...tripItemAttachmentsState,
      error: getLocalizedTripItemAttachmentErrorMessage(error, "item.editor.attachments.error.delete"),
    };
  } finally {
    tripItemAttachmentsState = { ...tripItemAttachmentsState, deletingId: "" };
    renderTripItemAttachments();
  }
}

function handleTripItemAttachmentsClick(event) {
  const retry = event.target.closest("[data-attachment-retry]");
  if (retry) {
    if (tripItemAttachmentsState.pendingFiles.length && tripItemAttachmentsState.itemId) {
      uploadPendingTripItemAttachments({ id: tripItemAttachmentsState.itemId })
        .then(() => showToast(window.t("item.editor.attachments.added.multiple")))
        .catch(() => {});
      return;
    }
    loadTripItemAttachments();
    return;
  }
  const openButton = event.target.closest("[data-attachment-open]");
  if (openButton) {
    openTripItemAttachment(openButton.dataset.attachmentOpen);
    return;
  }
  const pendingRemoveButton = event.target.closest("[data-attachment-pending-remove]");
  if (pendingRemoveButton) {
    tripItemAttachmentsState = {
      ...tripItemAttachmentsState,
      error: "",
      pendingFiles: tripItemAttachmentsState.pendingFiles.filter(
        (entry) => entry.id !== pendingRemoveButton.dataset.attachmentPendingRemove,
      ),
    };
    renderTripItemAttachments();
    return;
  }
  const deleteButton = event.target.closest("[data-attachment-delete]");
  if (deleteButton) deleteCurrentTripItemAttachment(deleteButton.dataset.attachmentDelete);
}

function localizeItemDraftWarning(message = "") {
  const warnings = {
    "Валюта цены не указана. Цена не перенесена в карточку поездки.": "item.editor.draft.warning.currency.missing",
    "В идее цена указана в другой валюте. Цена не перенесена в карточку поездки.": "item.editor.draft.warning.currency.mismatch",
  };
  return warnings[message] ? window.t(warnings[message]) : message;
}

function getLocalizedTripItemAttachmentErrorMessage(error, fallbackKey = "item.editor.attachments.error.upload") {
  const code = String(error?.code || error?.message || "").toLowerCase();
  if (code.includes("file_type_unsupported")) return window.t("item.editor.attachments.error.type");
  if (code.includes("file_too_large")) return window.t("item.editor.attachments.error.large");
  if (code.includes("file_empty") || code.includes("file_name_invalid")) return window.t("item.editor.attachments.error.read");
  if (code.includes("auth") || Number(error?.status) === 401 || Number(error?.status) === 403) {
    return window.t("item.editor.attachments.error.access");
  }
  if (code.includes("list")) return window.t("item.editor.attachments.error.list");
  if (code.includes("delete")) return window.t("item.editor.attachments.error.delete");
  if (code.includes("signed_url")) return window.t("item.editor.attachments.error.open");
  return window.t(fallbackKey);
}

function formatItemAttachmentSize(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) {
    return `${window.BackpackerI18n.formatNumber(bytes, { maximumFractionDigits: 0 })} ${window.t("item.editor.attachments.unit.bytes")}`;
  }
  if (bytes < 1024 * 1024) {
    return `${window.BackpackerI18n.formatNumber(Math.ceil(bytes / 1024), { maximumFractionDigits: 0 })} ${window.t("item.editor.attachments.unit.kilobytes")}`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${window.BackpackerI18n.formatNumber(megabytes, {
    minimumFractionDigits: megabytes >= 10 ? 0 : 1,
    maximumFractionDigits: megabytes >= 10 ? 0 : 1,
  })} ${window.t("item.editor.attachments.unit.megabytes")}`;
}

function getItemEditorOptionLabel(group, key, fallback) {
  const translationKey = `item.editor.${group}.${key}`;
  const translated = window.t(translationKey);
  return translated === translationKey ? fallback : translated;
}

function getItemEditorParticipantDisplayName(participant) {
  if (participant?.isSelf && participant.name === "Я") return window.t("item.editor.participant.self");
  return String(participant?.name || window.t("item.editor.expense.participant.fallback"));
}

function formatItemEditorMoney(value = 0) {
  const amount = Math.round(Number(value) || 0);
  const currency = state.trip.currency || "";
  const symbol = window.BackpackerI18n.getLocale() === "en" && currency === "RSD"
    ? "RSD"
    : currencySymbol(currency);
  return `${window.BackpackerI18n.formatNumber(amount, { maximumFractionDigits: 0 })} ${symbol}`.trim();
}

function updateItemEditorContextLabels() {
  const currency = state.trip.currency || "";
  const priceLabel = document.querySelector("[data-item-price-label]");
  const paidLabel = document.querySelector("[data-item-paid-label]");
  if (priceLabel) priceLabel.textContent = window.t("item.editor.field.price.label", { currency });
  if (paidLabel) paidLabel.textContent = window.t("item.editor.field.paid.label", { currency });
}

function validateItemTitleInput(input = $("#itemForm")?.elements?.title) {
  if (!input) return true;
  const missing = !String(input.value || "").trim();
  input.setCustomValidity(missing ? window.t("item.editor.validation.title.required") : "");
  return !missing;
}

function validateItemDateInput(input = $("#itemForm")?.elements?.date) {
  if (!input) return true;
  input.setCustomValidity("");
  if (input.value && input.min && input.value < input.min) {
    input.setCustomValidity(window.t("item.editor.validation.date.after", { start: input.min }));
  } else if (input.value && input.max && input.value > input.max) {
    input.setCustomValidity(window.t("item.editor.validation.date.before", { end: input.max }));
  }
  return !input.validationMessage;
}

function openItemSheet(itemId = null, options = {}) {
  fillSelects();
  updateItemEditorContextLabels();
  renderParticipantOwnerField();
  $("#deleteItemButton").style.display = itemId ? "inline-flex" : "none";
  $("#resetItemButton").style.display = itemId ? "inline-flex" : "none";
  $("#copyItemButton").hidden = !itemId;
  $("#itemSheetTitle").textContent = window.t(itemId ? "item.editor.title.edit" : "item.editor.title.create");
  const trackedItem = itemId ? state.items.find((entry) => entry.id === itemId) : null;
  resetItemCreateContext();
  fillItemForm(trackedItem);
  validateItemTitleInput();
  validateItemDateInput();
  resetTripItemAttachmentsState(trackedItem);
  if (!trackedItem && options.initialDraft) {
    applyInitialDraftToItemForm(options.initialDraft);
    itemCreateContext = {
      source: options.source || "",
      creationMethod: options.creationMethod || "manual",
      returnScreenOnCancel: options.returnScreenOnCancel || "",
      sourceIdeaId: options.sourceIdeaId || "",
      toastOnSave: options.toastOnSave || "",
    };
    renderItemDraftWarning(options.inlineWarning || "");
  }
  renderItemAllocationSummary(trackedItem);
  renderAcceptedExpenseControls(trackedItem);
  updateOpenLinkButton();
  resetLinkIntakeState();
  renderLinkIntakePanel({ visible: !itemId && !isReadOnlyMode() });
  openSheet("itemSheet");
  if (trackedItem) loadTripItemAttachments();
  if (!itemId && itemCreateContext.returnScreenOnCancel && !itemSheetHistoryArmed) {
    history.pushState({ backpackerItemSheet: true }, "");
    itemSheetHistoryArmed = true;
  }
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
  form.elements.type.innerHTML = itemTypes
    .map(([key, label]) => `<option value="${key}">${escapeHtml(getItemEditorOptionLabel("type", key, label))}</option>`)
    .join("");
  form.elements.status.innerHTML = statuses
    .map(([key, label]) => `<option value="${key}">${escapeHtml(getItemEditorOptionLabel("status", key, label))}</option>`)
    .join("");
  form.elements.priority.innerHTML = priorities
    .map(([key, label]) => `<option value="${key}">${escapeHtml(getItemEditorOptionLabel("priority", key, label))}</option>`)
    .join("");
  form.elements.participantId.innerHTML = state.trip.participants
    .map((participant) => {
      const displayName = getItemEditorParticipantDisplayName(participant);
      const label = participant.isSelf
        ? window.t("item.editor.participant.option.self", {
          name: displayName,
          badge: window.t("item.editor.participant.self.badge"),
        })
        : displayName;
      return `<option value="${escapeAttr(participant.id)}">${escapeHtml(label)}</option>`;
    })
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
  const allocationText = allocations.map((allocation) => {
    const participant = getParticipantById(allocation.participantId);
    return `${getItemEditorParticipantDisplayName(participant)} ${formatItemEditorMoney(allocation.amount)}`;
  }).join(" · ");
  summary.textContent = window.t("item.editor.allocation.summary", { allocations: allocationText });
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

function getItemAnalyticsChangedFields(previousItem, nextItem) {
  const fields = [
    "title", "type", "status", "priority", "date", "startTime", "durationMinutes", "price", "paidAmount",
    "participantId", "allocations", "link", "locationText", "notes",
  ];
  return fields.filter((field) => JSON.stringify(previousItem?.[field] ?? null) !== JSON.stringify(nextItem?.[field] ?? null));
}

function trackPersistedItemAnalyticsChanges(previousItems = [], nextItems = [], creationSource = "proposal") {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  nextItems.forEach((item) => {
    const previousItem = previousById.get(item.id);
    if (!previousItem) {
      trackEvent("item_created", {
        ...getTripAnalyticsContext(),
        item_id: item.id,
        ...getItemAnalyticsFlags(item),
        creation_source: creationSource,
      });
      return;
    }
    const changedFields = getItemAnalyticsChangedFields(previousItem, item);
    if (!changedFields.length) return;
    trackEvent("item_updated", {
      ...getTripAnalyticsContext(),
      item_id: item.id,
      ...getItemAnalyticsFlags(item),
      changed_fields: changedFields,
    });
  });
}

function readItemFormDate(value, existing = null) {
  const parsed = parseDateFromInput(value);
  if (parsed) return parsed;
  if (existing?.date && isVirtualDayDate(existing.date) && !state.trip.startDate && !state.trip.endDate) return existing.date;
  return "";
}

function clearItemSheetHistory({ fromPopState = false } = {}) {
  if (itemSheetHistoryArmed && !fromPopState) {
    itemSheetIgnoreNextPop = true;
    history.back();
  }
  itemSheetHistoryArmed = false;
}

function closeItemSheetAfterSave() {
  closeSheet("itemSheet");
  clearItemSheetHistory();
  resetItemCreateContext();
  resetTripItemAttachmentsState();
}

function dismissItemSheet(method = "close", { fromPopState = false } = {}) {
  if (tripItemAttachmentsState.uploading) {
    showToast(window.t("item.editor.attachments.wait"));
    return;
  }
  const returnScreen = itemCreateContext.returnScreenOnCancel;
  closeSheet("itemSheet");
  clearItemSheetHistory({ fromPopState });
  resetItemCreateContext();
  resetTripItemAttachmentsState();
  if (returnScreen === "ideas") showIdeasScreen();
}

async function saveItem(event) {
  event.preventDefault();
  if (isReadOnlyMode()) return;
  if (tripItemAttachmentsState.uploading) {
    showToast(window.t("item.editor.attachments.wait"));
    return;
  }
  const form = event.currentTarget;
  const formIsValid = validateItemTitleInput(form.elements.title)
    && validateItemDateInput(form.elements.date)
    && validateMoneyFields(form, ["price", "paidAmount"]);
  if (!formIsValid) {
    form.reportValidity();
    showToast(form.elements.title.validationMessage
      || form.elements.date.validationMessage
      || form.elements.price.validationMessage
      || form.elements.paidAmount.validationMessage);
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = state.items.find((entry) => entry.id === data.id);
  const isNew = !existing;
  const createContext = isNew ? { ...itemCreateContext } : getDefaultItemCreateContext();
  const itemDate = readItemFormDate(data.date, existing);
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
  const changedFields = existing ? getItemAnalyticsChangedFields(existing, item) : [];
  if (isNew || changedFields.length) {
    trackEvent(isNew ? "item_created" : "item_updated", {
      ...getTripAnalyticsContext(),
      item_id: item.id,
      ...getItemAnalyticsFlags(item),
      ...(isNew
        ? {
          creation_source: createContext.creationMethod || "manual",
          ...(createContext.sourceIdeaId ? { source_idea_id: createContext.sourceIdeaId } : {}),
        }
        : { changed_fields: changedFields }),
    });
  }
  if (getTripOrigin() === "demo" && !isNew) {
    trackEvent("trainer_action_completed", {
      ...getTripAnalyticsContext(),
      action_type: "item_updated",
      trainer_version: TRAINER_VERSION,
    });
  }
  if (isNew) scheduleDonationPrompt();
  checkTripMilestones();
  if (tripItemAttachmentsState.pendingFiles.length) {
    try {
      await uploadPendingTripItemAttachments(item);
    } catch {
      form.elements.id.value = item.id;
      $("#deleteItemButton").style.display = "inline-flex";
      $("#resetItemButton").style.display = "inline-flex";
      $("#copyItemButton").hidden = false;
      $("#itemSheetTitle").textContent = window.t("item.editor.title.edit");
      render();
      showToast(window.t("item.editor.attachments.saved.partial"));
      return;
    }
  }
  closeItemSheetAfterSave();
  render();
  showToast(isNew && createContext.toastOnSave ? createContext.toastOnSave : window.t("item.editor.saved"));
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
  validateItemTitleInput();
  validateItemDateInput();
  updateOpenLinkButton();
  showToast(window.t("item.editor.reset.done"));
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

function getTravelIdeaDestinationTrips() {
  return tripStore.trips.filter((entry) => !entry.isDemo);
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
  if (cardCopyState.sourceKind !== "trip_item") return null;
  return state.items.find((item) => item.id === cardCopyState.sourceItemId) || null;
}

function getCardCopySourceIdea() {
  if (cardCopyState.sourceKind !== "travel_idea") return null;
  return ideasState.ideas.find((idea) => idea.id === cardCopyState.sourceIdeaId) || null;
}

function getCardCopyTargetState() {
  if (!cardCopyState.targetTripId) return null;
  return getTripState(cardCopyState.targetTripId);
}

function getCardCopyTripOptions() {
  return cardCopyState.sourceKind === "travel_idea"
    ? getTravelIdeaDestinationTrips()
    : getCopyCandidateTrips();
}

function getCardCopyDateOptions(targetState, { omitSourceBucket = false } = {}) {
  const sourceItem = getCardCopySourceItem();
  const dates = getTripDatesForTrip(targetState.trip).map((date, index) => ({
    value: date,
    title: window.t("plan.day.label", { number: index + 1 }),
    meta: formatPlanDate(date),
  }));
  const options = [
    ...dates,
    {
      value: "",
      title: window.t("plan.unscheduled.title"),
      meta: window.t("plan.copy.day.unscheduled.meta"),
    },
  ];
  if (!omitSourceBucket || !sourceItem) return options;
  return options.filter((option) => (option.value || "") !== (sourceItem.date || ""));
}

function openCardCopySheet() {
  const sourceItemId = $("#itemForm").elements.id.value;
  const sourceItem = state.items.find((item) => item.id === sourceItemId);
  if (!sourceItem) return;
  cardCopyState = {
    sourceKind: "trip_item",
    sourceItemId,
    sourceIdeaId: "",
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

function openTravelIdeaDestinationPicker() {
  const ideaId = $("#ideaForm")?.elements.id.value || ideasState.editingIdeaId;
  const sourceIdea = ideasState.ideas.find((idea) => idea.id === ideaId);
  if (!sourceIdea) return;
  if (!getTravelIdeaDestinationTrips().length) {
    showToast(window.t("ideas.add.to.trip.no.trips"));
    return;
  }
  cardCopyState = {
    sourceKind: "travel_idea",
    sourceItemId: "",
    sourceIdeaId: sourceIdea.id,
    scope: "another",
    targetTripId: "",
    targetDate: null,
    isSubmitting: false,
  };
  closeSheet("ideaSheet");
  renderCardCopySheet();
  openSheet("cardCopySheet");
  if (!cardCopySheetHistoryArmed) {
    history.pushState({ backpackerCardCopySheet: true }, "");
    cardCopySheetHistoryArmed = true;
  }
  trackEvent("idea_add_to_trip_started", {
    idea_id: sourceIdea.id,
    capture_source: sourceIdea.source,
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
  if (cardCopyState.sourceKind === "trip_item") {
    trackEvent("item_copy_cancelled", {
      ...getTripAnalyticsContext(),
      item_id: sourceItem?.id || null,
      method,
    });
  }
}

function renderCardCopySheet() {
  $("#cardCopySheetTitle").textContent = cardCopyState.sourceKind === "travel_idea"
    ? window.t("plan.copy.title.idea")
    : window.t("plan.copy.title.card");
  $("#cardCopyConfirmButton").textContent = cardCopyState.sourceKind === "travel_idea"
    ? window.t("plan.copy.confirm.idea")
    : window.t("plan.copy.confirm.card");
  renderCardCopyScopeStep();
  renderCardCopyTripStep();
  renderCardCopyDateStep();
  renderCardCopyWarning();
  renderCardCopyActions();
}

function renderCardCopyScopeStep() {
  const container = $("#cardCopyScopeStep");
  if (cardCopyState.sourceKind === "travel_idea") {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }
  const hasOtherTrips = getCopyCandidateTrips().length > 0;
  container.classList.toggle("hidden", Boolean(cardCopyState.scope));
  container.innerHTML = `
    <button class="card-copy-option" type="button" data-card-copy-scope="same" aria-pressed="${cardCopyState.scope === "same"}">
      <strong>${escapeHtml(window.t("plan.copy.scope.same.title"))}</strong>
      <span>${escapeHtml(window.t("plan.copy.scope.same.meta"))}</span>
    </button>
    ${hasOtherTrips ? `
      <button class="card-copy-option" type="button" data-card-copy-scope="another" aria-pressed="${cardCopyState.scope === "another"}">
        <strong>${escapeHtml(window.t("plan.copy.scope.other.title"))}</strong>
        <span>${escapeHtml(window.t("plan.copy.scope.other.meta"))}</span>
      </button>
    ` : ""}
  `;
}

function renderCardCopyTripStep() {
  const container = $("#cardCopyTripStep");
  const isVisible = cardCopyState.sourceKind === "travel_idea"
    ? !cardCopyState.targetTripId
    : cardCopyState.scope === "another" && !cardCopyState.targetTripId;
  container.classList.toggle("hidden", !isVisible);
  if (!isVisible) {
    container.innerHTML = "";
    return;
  }
  const trips = getCardCopyTripOptions();
  container.innerHTML = trips.map((entry) => {
    const trip = entry.state.trip;
    return `
      <button class="card-copy-option" type="button" data-card-copy-trip="${escapeAttr(entry.id)}">
        <strong>${escapeHtml(trip.title || window.t("plan.trip.untitled"))}</strong>
        <span>${escapeHtml(formatPlanTripDateRange(trip.startDate, trip.endDate))} · ${escapeHtml(trip.destination || window.t("plan.trip.destination.missing"))}</span>
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
  const options = getCardCopyDateOptions(targetState, { omitSourceBucket: cardCopyState.sourceKind === "trip_item" && sameTrip });
  container.innerHTML = options.length
    ? options.map((option) => `
      <button class="card-copy-option" type="button" data-card-copy-date="${escapeAttr(option.value)}" aria-pressed="${cardCopyState.targetDate !== null && (cardCopyState.targetDate || "") === (option.value || "")}">
        <strong>${escapeHtml(option.title)}</strong>
        <span>${escapeHtml(option.meta)}</span>
      </button>
    `).join("")
    : `<p class="card-copy-empty">${escapeHtml(window.t("plan.copy.empty"))}</p>`;
}

function renderCardCopyWarning() {
  const warning = $("#cardCopyWarning");
  const targetState = getCardCopyTargetState();
  if (cardCopyState.sourceKind === "travel_idea") {
    const sourceIdea = getCardCopySourceIdea();
    const draft = sourceIdea && targetState
      ? getTravelIdeaCore()?.mapTravelIdeaToTripItemDraft?.(sourceIdea, targetState.trip.currency)
      : null;
    warning.classList.toggle("hidden", !draft?.priceWarning);
    warning.textContent = localizeItemDraftWarning(draft?.priceWarning || "");
    return;
  }
  const sourceItem = getCardCopySourceItem();
  const shouldWarn = Boolean(sourceItem && targetState && targetState.trip.id !== state.trip.id && targetState.trip.currency !== state.trip.currency);
  warning.classList.toggle("hidden", !shouldWarn);
  warning.textContent = shouldWarn
    ? window.t("plan.copy.warning.currency")
    : "";
}

function renderCardCopyActions() {
  const confirmButton = $("#cardCopyConfirmButton");
  const backButton = $("#cardCopyBackButton");
  const targetState = getCardCopyTargetState();
  const options = targetState
    ? getCardCopyDateOptions(targetState, { omitSourceBucket: cardCopyState.sourceKind === "trip_item" && targetState.trip.id === state.trip.id })
    : [];
  const hasSelectedTarget = Boolean(cardCopyState.scope && targetState && cardCopyState.targetDate !== null && options.some((option) => (option.value || "") === (cardCopyState.targetDate || "")));
  confirmButton.disabled = !hasSelectedTarget || cardCopyState.isSubmitting;
  backButton.hidden = cardCopyState.sourceKind === "travel_idea"
    ? !cardCopyState.targetTripId
    : !cardCopyState.scope;
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
  if (cardCopyState.sourceKind === "travel_idea") {
    cardCopyState.targetTripId = "";
    cardCopyState.targetDate = null;
    renderCardCopySheet();
    return;
  }
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

function closeCardCopySheetForTransition(afterClose) {
  closeSheet("cardCopySheet");
  if (cardCopySheetHistoryArmed) {
    cardCopyIgnoreNextPop = true;
    history.back();
  }
  cardCopySheetHistoryArmed = false;
  window.setTimeout(afterClose, 0);
}

function openTravelIdeaItemDraft({ sourceIdea, targetState, targetDate }) {
  const draft = getTravelIdeaCore().mapTravelIdeaToTripItemDraft(sourceIdea, targetState.trip.currency);
  if (!draft.title) {
    cardCopyState.isSubmitting = false;
    renderCardCopyActions();
    return;
  }
  const targetTripId = targetState.trip.id;
  const initialDraft = {
    title: draft.title,
    type: draft.type,
    link: draft.link,
    locationText: draft.locationText,
    notes: draft.notes,
    price: draft.price,
    date: targetDate || "",
  };
  closeCardCopySheetForTransition(() => {
    cardCopyState.isSubmitting = false;
    openTrip(targetTripId, { persistNavigation: false, refreshProposals: false });
    openItemSheet(null, {
      initialDraft,
      creationMethod: "idea",
      returnScreenOnCancel: "ideas",
      inlineWarning: localizeItemDraftWarning(draft.priceWarning),
      source: "travel_idea",
      sourceIdeaId: sourceIdea.id,
      toastOnSave: window.t("item.editor.saved.from.idea"),
    });
  });
}

function confirmCardCopy() {
  if (cardCopyState.isSubmitting) return;
  const sourceItem = getCardCopySourceItem();
  const sourceIdea = getCardCopySourceIdea();
  const targetState = getCardCopyTargetState();
  if (cardCopyState.sourceKind === "trip_item" && !sourceItem) return;
  if (cardCopyState.sourceKind === "travel_idea" && !sourceIdea) return;
  if (!targetState) return;
  const options = getCardCopyDateOptions(targetState, { omitSourceBucket: cardCopyState.sourceKind === "trip_item" && targetState.trip.id === state.trip.id });
  if (cardCopyState.targetDate === null || !options.some((option) => (option.value || "") === (cardCopyState.targetDate || ""))) return;
  cardCopyState.isSubmitting = true;
  renderCardCopyActions();

  if (cardCopyState.sourceKind === "travel_idea") {
    openTravelIdeaItemDraft({ sourceIdea, targetState, targetDate: cardCopyState.targetDate });
    return;
  }

  const copiedItem = createTripItemCopy({
    sourceItem,
    sourceTrip: state.trip,
    targetState,
    targetDate: cardCopyState.targetDate,
  });
  if (!copiedItem.title) {
    cardCopyState.isSubmitting = false;
    renderCardCopyActions();
    return;
  }
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
    ? (cardCopyState.targetDate
      ? window.t("plan.copy.target.same.day", { date: formatPlanDate(cardCopyState.targetDate) })
      : window.t("plan.copy.target.same.unscheduled"))
    : window.t("plan.copy.target.other", { title: targetState.trip.title || window.t("plan.trip.untitled") });
  showToast(window.t("plan.copy.toast", { target: targetText }));
  const sameTrip = targetState.trip.id === state.trip.id;
  const hasTargetDate = Boolean(cardCopyState.targetDate);
  const copyDestinationType = sameTrip
    ? (hasTargetDate ? "same_trip_other_day" : "same_trip_undated")
    : (hasTargetDate ? "other_trip_day" : "other_trip_undated");
  trackEvent("item_created", {
    ...getTripAnalyticsContext(targetState.trip),
    item_id: copiedItem.id,
    ...getItemAnalyticsFlags(copiedItem),
    creation_source: "copy",
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
  if (previousDate !== moving.date) {
    trackEvent("item_day_changed", {
      ...getTripAnalyticsContext(),
      item_id: moving.id,
      item_type: moving.type,
      item_status: moving.status,
      from_bucket: previousDate ? "day" : "undated",
      to_bucket: moving.date ? "day" : "undated",
      method,
      dropped_before_item: Boolean(beforeItemId),
    });
  }
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
  const title = item?.title || window.t("item.editor.delete.fallback");
  if (!window.confirm(window.t("item.editor.delete.confirm", { title }))) return;
  state.items = state.items.filter((item) => item.id !== id);
  saveState();
  closeSheet("itemSheet");
  render();
  showToast(window.t("item.editor.deleted"));
  trackEvent("item_deleted", {
    ...getTripAnalyticsContext(),
    item_id: id,
    item_type: item?.type || null,
    item_status: item?.status || null,
  });
}

function ensureTripContextLabels() {
  const form = $("#tripForm");
  if (!form) return;
  const labelText = form.querySelector("[data-trip-preferences-label]");
  if (labelText) labelText.textContent = window.t("trip.setup.field.preferences.label");
}

function renderAiSourceTextField() {
  ensureTripContextLabels();
  const field = $("#aiSourceTextField");
  const form = $("#tripForm");
  const input = form?.elements.aiSourceText;
  if (!field || !input) return;
  const text = String(state.trip.aiSourceText || "").trim();
  field.hidden = !text;
  input.value = text;
}

function openTripSheet() {
  if (isReadOnlyMode()) return;
  const form = $("#tripForm");
  Object.entries(state.trip).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  validateTripRequiredInputs();
  validateTripBudgetInput(form.elements.budgetLimit);
  syncTripDateInputs();
  renderParticipantsList();
  renderAiSourceTextField();
  openSheet("tripSheet");
  trackEvent("trip_settings_opened", getTripAnalyticsContext());
}

function renderParticipantsList() {
  const list = $("#participantsList");
  if (!list) return;
  list.innerHTML = state.trip.participants.map((participant) => {
    const displayName = participant.isSelf && participant.name === "Я"
      ? window.t("trip.setup.participant.self.name")
      : participant.name;
    const displayParticipant = { ...participant, initials: displayName.slice(0, 1).toUpperCase() };
    return `
      <div class="participant-row">
        ${renderParticipantAvatar(displayParticipant)}
        <div class="participant-row-text">
          <strong>${escapeHtml(displayName)}${participant.isSelf ? ` <span>(${escapeHtml(window.t("trip.setup.participant.self.badge"))})</span>` : ""}</strong>
        </div>
        <div class="participant-row-actions">
          <button class="ghost-button compact" type="button" data-rename-participant="${escapeAttr(participant.id)}">${escapeHtml(window.t("trip.setup.participant.rename"))}</button>
          ${participant.isSelf ? "" : `<button class="danger-button compact participant-delete-button" type="button" data-delete-participant="${escapeAttr(participant.id)}">${escapeHtml(window.t("trip.setup.participant.delete"))}</button>`}
        </div>
      </div>
      ${participantEditorState.mode === "rename" && participantEditorState.participantId === participant.id ? renderParticipantEditor() : ""}
    `;
  }).join("") + (participantEditorState.mode === "add" ? renderParticipantEditor() : "");
}

function renderParticipantEditor() {
  const label = window.t(participantEditorState.mode === "add"
    ? "trip.setup.participant.editor.name"
    : "trip.setup.participant.editor.new.name");
  return `
    <div class="participant-editor-row">
      <label class="field participant-editor-field">
        ${escapeHtml(label)}
        <input id="participantEditorInput" value="${escapeAttr(participantEditorState.value)}" maxlength="40" />
      </label>
      <button class="ghost-button compact" type="button" data-save-participant>${escapeHtml(window.t("trip.setup.participant.editor.save"))}</button>
      <button class="ghost-button compact" type="button" data-cancel-participant>${escapeHtml(window.t("trip.setup.participant.editor.cancel"))}</button>
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
    showToast(window.t("trip.setup.participant.validation.required"));
    return "";
  }
  if (name.length > 40) {
    showToast(window.t("trip.setup.participant.validation.long"));
    return "";
  }
  if (isParticipantNameDuplicate(name)) {
    showToast(window.t("trip.setup.participant.validation.duplicate"));
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
  showToast(window.t("trip.setup.participant.added"));
}

function openAddParticipantDialog() {
  closeParticipantEditor();
  const dialog = document.createElement("div");
  dialog.className = "add-participant-dialog";
  dialog.innerHTML = `
    <div class="add-participant-backdrop" data-add-participant-cancel></div>
    <section class="add-participant-panel" role="dialog" aria-modal="true" aria-labelledby="addParticipantTitle">
      <h2 id="addParticipantTitle">${escapeHtml(window.t("trip.setup.participants.add"))}</h2>
      <label class="field">
        <span>${escapeHtml(window.t("trip.setup.participant.editor.name"))}</span>
        <input data-add-participant-name maxlength="40" />
      </label>
      <div class="add-participant-actions">
        <button class="primary-button" type="button" data-add-participant-save>${escapeHtml(window.t("trip.setup.participant.editor.save"))}</button>
        <button class="ghost-button" type="button" data-add-participant-cancel>${escapeHtml(window.t("trip.setup.participant.editor.cancel"))}</button>
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
    showToast(window.t("trip.setup.participant.validation.required"));
    return "";
  }
  if (name.length > 40) {
    showToast(window.t("trip.setup.participant.validation.long"));
    return "";
  }
  return name;
}

function isParticipantNameDuplicate(name, participantId = "") {
  const normalizedName = normalizeParticipantName(name).toLowerCase();
  return state.trip.participants.some((participant) => participant.id !== participantId && participant.name.toLowerCase() === normalizedName);
}

function requestParticipantName(initialName = "") {
  const name = normalizeParticipantName(window.prompt(window.t("trip.setup.participant.editor.name"), initialName) || "");
  if (!name) {
    showToast(window.t("trip.setup.participant.validation.required"));
    return "";
  }
  if (name.length > 40) {
    showToast(window.t("trip.setup.participant.validation.long"));
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
    showToast(window.t("trip.setup.participant.validation.duplicate"));
    return;
  }

  if (participantEditorState.mode === "add") {
    state.trip.participants.push(createParticipant({
      tripId: state.trip.id,
      name,
      index: state.trip.participants.length,
    }));
    showToast(window.t("trip.setup.participant.added"));
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
    ? window.t("trip.setup.participant.delete.assigned", {
      name: participant.name,
      count: assignedItems.length,
      amount: `${window.BackpackerI18n.formatNumber(total, { maximumFractionDigits: 2 })} ${currencySymbol(state.trip.currency)}`,
    })
    : window.t("trip.setup.participant.delete.empty", { name: participant.name });
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
  showToast(window.t(assignedItems.length
    ? "trip.setup.participant.expenses.moved"
    : "trip.setup.participant.removed"));
}

function validateTripRequiredInputs() {
  const form = $("#tripForm");
  const titleInput = form?.elements.title;
  const destinationInput = form?.elements.destination;
  if (!titleInput || !destinationInput) return { valid: true, message: "" };

  const titleMissing = !String(titleInput.value || "").trim();
  const destinationMissing = !String(destinationInput.value || "").trim();
  titleInput.setCustomValidity(titleMissing ? window.t("trip.setup.validation.title.required") : "");
  destinationInput.setCustomValidity(destinationMissing ? window.t("trip.setup.validation.destination.required") : "");
  return {
    valid: !titleMissing && !destinationMissing,
    message: titleMissing
      ? window.t("trip.setup.validation.title.required")
      : (destinationMissing ? window.t("trip.setup.validation.destination.required") : ""),
  };
}

function validateTripBudgetInput(input) {
  if (!input) return true;
  input.setCustomValidity("");
  if (!window.BackpackerFinancial?.isValidMoney(input.value)) {
    input.setCustomValidity(window.t("trip.setup.validation.budget"));
  }
  return !input.validationMessage;
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
    endInput.setCustomValidity(window.t("trip.setup.validation.date.range"));
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
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const requiredResult = validateTripRequiredInputs();
  syncTripDateInputs();
  const validDates = validateTripDateInputs();
  const validBudget = validateTripBudgetInput(form.elements.budgetLimit);
  if (!requiredResult.valid || !validDates || !validBudget) {
    form.reportValidity();
    showToast(requiredResult.message
      || (!validDates ? window.t("trip.setup.validation.date.range") : window.t("trip.setup.validation.budget")));
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
    aiSourceText: String(data.aiSourceText || "").trim().slice(0, 30000),
    preferencesText: data.preferencesText.trim(),
  };
  if (window.BackpackerTripDates?.migrateVirtualItemDatesToRealDates) {
    state.items = window.BackpackerTripDates.migrateVirtualItemDatesToRealDates(state.items, previousTrip, state.trip);
  }
  const outOfRangeDateResult = window.BackpackerTripDates?.moveOutOfRangeItemDatesToUnscheduled?.(state.items, state.trip);
  const outOfRangeMovedCount = outOfRangeDateResult?.movedCount || 0;
  if (outOfRangeDateResult?.items) {
    state.items = outOfRangeDateResult.items;
  }
  saveState();
  closeSheet("tripSheet");
  render();
  showToast(outOfRangeMovedCount
    ? window.t("trip.setup.saved.moved", { count: outOfRangeMovedCount })
    : window.t("trip.setup.saved"));
  const changedFields = ["title", "destination", "startDate", "endDate", "currency", "budgetLimit", "preferencesText"]
    .filter((field) => String(previousTrip[field] ?? "") !== String(state.trip[field] ?? ""));
  if (changedFields.length) {
    trackEvent("trip_settings_updated", {
      ...getTripAnalyticsContext(),
      changed_fields: changedFields,
      currency_changed: previousCurrency !== data.currency,
      has_budget: Boolean(parseMoney(state.trip.budgetLimit)),
      has_dates: Boolean(state.trip.startDate && state.trip.endDate),
    });
  }
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
  showToast(window.t("trip.setup.reset.done"));
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

function buildPublishedTripState({ includeBudget = true } = {}) {
  const published = normalizeState(structuredClone(state));
  const entry = tripStore.trips.find((trip) => trip.id === published.trip.id);
  if (entry?.coverDataUrl) published.trip.coverDataUrl = entry.coverDataUrl;
  delete published.trip.aiSourceText;
  delete published.trip.preferencesText;
  delete published.trip.datePrecision;
  delete published.trip.dateSourceText;
  return includeBudget ? published : window.BackpackerFinancial.stripFinancialFields(published);
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
    state: buildPublishedTripState({ includeBudget }),
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
  if (record.shareId && record.shareId !== existing?.shareId) {
    trackEvent("trip_share_created", {
      ...getTripAnalyticsContext(),
      collaboration_id: record.shareId,
      actor_role: "owner",
      access_mode: "view",
      share_source: "link",
    });
  }
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
    state: buildPublishedTripState({ includeBudget }),
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
  // Осиротевшую запись обновлять некуда: строки этого владельца в базе нет.
  // Публикуем заново — адрес ссылки при этом меняется, поэтому происходит
  // это только по действию человека, а не в фоне.
  if (existing?.shareId && existing.token && !existing.revoked && !existing.orphaned) {
    return updatePublishedTripShare({ includeBudget: options.includeBudget ?? existing.includeBudget });
  }
  return publishTripShare(options);
}

// Осечки фоновой синхронизации бывают разные и лечатся по-разному, а прежде
// любая из них показывала один и тот же чип — и показывала его на каждое
// сохранение, пока причина оставалась. Причину при этом гасил пустой catch,
// поэтому разобрать её было нечем.
function classifyTripShareSyncError(error) {
  const code = String(error?.message || "");
  const status = Number(error?.status) || 0;
  // Supabase не настроен — сообщать не о чем: ссылки в такой сборке нет.
  if (code === "supabase_not_configured") return "silent";
  // Строку опубликованной поездки ищут по владельцу, а владелец здесь —
  // анонимная личность браузера. Стоит ей смениться, и строка не находится:
  // локально всё цело, а опубликованная копия молча перестаёт обновляться.
  // Само это не пройдёт, поэтому синхронизацию дальше не гоняем.
  //
  // Опознаём строго по коду в ответе, а не по одному лишь 404. Голая
  // четырёхсотка приходит и когда функции нет по адресу — не выложили,
  // переименовали, маршрут увело. Считать это потерянной ссылкой значит
  // у всех разом остановить синхронизацию здоровых ссылок и попросить
  // создать их заново; такую осечку надо переживать как временную.
  if (code === "share_not_found") return "orphaned";
  // Сеть, перегрузка, пятисотка — попробуем ещё раз, молча. Сюда же голая
  // четырёхсотка без кода: код потерянной ссылки разобран выше, а значит
  // здесь адрес функции, а не ссылка, и переживать это надо как временное.
  if (!status || status === 404 || status === 408 || status === 429 || status >= 500) return "retry";
  return "final";
}

function reportTripShareSyncFailure(kind, error) {
  const record = getTripShareRecord();
  if (record) {
    // Причина ложится в запись: на телефоне консоли нет, а строка состояния
    // в шторке ссылки есть.
    saveTripShareRecord({ ...record, orphaned: kind === "orphaned", lastSyncError: String(error?.message || kind) });
    renderTripLinkOptions();
  }
  // Один и тот же повод не повторяем: чип на каждое сохранение — это шум,
  // из-за которого перестают читать и настоящие сообщения.
  if (tripShareSyncReported === kind) return;
  tripShareSyncReported = kind;
  showToast(
    kind === "orphaned"
      ? window.t("share.link.sync.orphaned")
      : window.t("share.link.sync.error"),
  );
}

function schedulePublishedTripSync({ attempt = 0 } = {}) {
  const record = getTripShareRecord();
  if (!record?.shareId || record.revoked || record.orphaned || isReadOnlyMode()) return;
  window.clearTimeout(tripShareSyncTimer);
  tripShareSyncTimer = window.setTimeout(async () => {
    if (tripShareSyncInFlight) {
      schedulePublishedTripSync({ attempt });
      return;
    }
    tripShareSyncInFlight = true;
    try {
      await updatePublishedTripShare();
      tripShareSyncReported = "";
      const synced = getTripShareRecord();
      if (synced?.lastSyncError) saveTripShareRecord({ ...synced, lastSyncError: "", orphaned: false });
    } catch (error) {
      const kind = classifyTripShareSyncError(error);
      console.warn("Опубликованная поездка не обновилась:", error);
      if (kind === "silent") return;
      if (kind === "retry" && attempt < TRIP_SHARE_SYNC_RETRIES) {
        window.setTimeout(() => schedulePublishedTripSync({ attempt: attempt + 1 }), TRIP_SHARE_SYNC_RETRY_MS * (attempt + 1));
        return;
      }
      reportTripShareSyncFailure(kind, error);
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
    // Осечка синхронизации живёт здесь, а не только в чипе: чип исчезает, а
    // вопрос «почему не обновляется» остаётся, и на телефоне ответить на
    // него больше негде.
    const orphaned = Boolean(record?.orphaned);
    status.classList.toggle("error", !isSupabaseConfigured() || orphaned);
    status.textContent = !isSupabaseConfigured()
      ? window.t("share.link.status.not.configured")
      : orphaned
        ? window.t("share.link.status.orphaned")
        : hasActiveLink
          ? window.t("share.link.status.active")
          : window.t("share.link.status.empty");
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
    showToast(window.t("share.link.opened"));
    trackEvent("share_method_selected", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "link", method: "link_access" });
  } catch {
    renderTripLinkOptions();
    showToast(window.t(isSupabaseConfigured() ? "share.link.open.error" : "share.link.supabase.missing"));
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
    showToast(window.t("share.link.copy.done"));
    trackEvent("share_completed", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "link", method: "clipboard" });
  } catch {
    renderTripLinkOptions();
    showToast(window.t(isSupabaseConfigured() ? "share.link.copy.error" : "share.link.supabase.missing"));
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
    showToast(window.t("share.link.updated"));
  } catch {
    showToast(window.t("share.link.update.error"));
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
    showToast(window.t("share.link.revoke.error"));
    return;
  }
  saveTripShareRecord({
    ...record,
    revoked: true,
  });
  const input = $("#tripShareLinkInput");
  if (input) input.value = "";
  showToast(window.t("share.link.revoked"));
}

function buildShareText(compact = false) {
  const totals = getTotals();
  const lines = [
    `Backpacker: ${state.trip.title}`,
    `${formatPlanDate(state.trip.startDate)}–${formatPlanDate(state.trip.endDate)} · ${state.trip.destination}`,
    "",
  ];
  if (canShowBudget()) {
    lines.push(
      window.t("share.text.budget.title"),
      window.t("share.text.budget.limit", { amount: formatBudgetMoney(totals.budgetLimit) }),
      window.t("share.text.budget.paid", { amount: formatBudgetMoney(totals.paidTotal) }),
      window.t("share.text.budget.booked", { amount: formatBudgetMoney(totals.confirmedOutstanding) }),
      window.t("share.text.budget.available", { amount: formatBudgetMoney(totals.remainingConfirmed) }),
      window.t("share.text.budget.backup", { amount: formatBudgetMoney(totals.additionalTotal) }),
      window.t("share.text.budget.total", { amount: formatBudgetMoney(totals.possibleTotal) }),
      window.t("share.text.budget.remaining", { amount: formatBudgetMoney(totals.remainingAll) }),
      "",
    );
  }
  getTripDates().forEach((date, index) => {
    const items = state.items.filter((item) => item.date === date && item.status !== "skipped").sort(sortItems);
    lines.push(window.t("share.text.day", { day: index + 1, date: formatPlanDate(date) }));
    if (!items.length) lines.push(window.t("share.text.day.empty"));
    items.forEach((item) => {
      const priceText = canShowBudget() ? ` · ${formatBudgetMoney(item.price)}` : "";
      lines.push(`- ${item.startTime ? `${item.startTime} ` : ""}${item.title} · ${getPlanStatusLabel(item.status)}${priceText}`);
    });
    lines.push("");
  });
  const unscheduled = state.items.filter((item) => !item.date && item.status !== "skipped");
  if (unscheduled.length) {
    lines.push(window.t("share.text.unscheduled"));
    unscheduled.forEach((item) => {
      const priceText = canShowBudget() ? ` · ${formatBudgetMoney(item.price)}` : "";
      lines.push(`- ${item.title} · ${getPlanStatusLabel(item.status)}${priceText}`);
    });
  }
  return compact ? lines.filter(Boolean).join("\n") : lines.join("\n");
}

function getExportLocale() {
  return window.BackpackerI18n?.getLocale?.() === "en" ? "en" : "ru";
}

function exportT(key, params = {}) {
  return window.t(`export.${key}`, params);
}

function formatExportDate(dateString, options = {}) {
  const virtualIndex = getVirtualDayIndex(dateString);
  if (virtualIndex) return exportT("day.label", { number: virtualIndex });
  if (!dateString) return exportT("unscheduled");
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return exportT("unscheduled");
  return window.BackpackerI18n.formatDate(date, {
    day: "numeric",
    month: "long",
    ...options,
  });
}

function formatExportMoney(value = 0) {
  const amount = Math.round(Number(value) || 0);
  const currency = state.trip.currency || "";
  const symbol = getExportLocale() === "en" && currency === "RSD"
    ? "RSD"
    : currencySymbol(currency);
  return `${window.BackpackerI18n.formatNumber(amount, { maximumFractionDigits: 0 })} ${symbol}`.trim();
}

function formatExportTableCell(value) {
  if (typeof value !== "number") return value;
  return window.BackpackerI18n.formatNumber(value, { maximumFractionDigits: 2 });
}

function formatExportDuration(minutes) {
  return formatPlanDurationText(minutes);
}

function formatExportTripDateRange(startDate, endDate) {
  if (startDate && endDate) {
    return exportT("trip.date.range", {
      start: formatExportDate(startDate),
      end: formatExportDate(endDate),
    });
  }
  if (startDate) return exportT("trip.date.from", { date: formatExportDate(startDate) });
  if (endDate) return exportT("trip.date.until", { date: formatExportDate(endDate) });
  return exportT("trip.date.missing");
}

function formatExportTripDayCount(trip) {
  return window.t("plan.trip.days", { count: getTripDayCount(trip) });
}

function getExportTypeLabel(type) {
  return getPlanTypeLabel(type);
}

function getExportStatusLabel(status) {
  return getPlanStatusLabel(status);
}

function getExportPriorityLabel(priority) {
  const key = `item.editor.priority.${priority}`;
  const label = window.t(key);
  return label === key ? window.t("item.editor.priority.nice") : label;
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
    return `${exportT("day.label", { number: index + 1 })}\t${formatExportDate(date)}\t${formatExportMoney(total)}`;
  });
  return [[exportT("column.day"), exportT("column.date"), exportT("column.amount")].join("\t"), ...rows].join("\n");
}

function escapeCsvValue(value = "") {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildEstimateRows(presentation = {}) {
  const participants = state.trip.participants;
  const {
    dayLabel = exportT("column.day"),
    itemLabel = exportT("estimate.column.item"),
    categoryLabel = exportT("estimate.column.category"),
    totalColumnLabel = exportT("column.total"),
    undatedLabel = exportT("unscheduled"),
    totalRowLabel = exportT("total"),
    dateFormatter = formatExportDate,
    typeFormatter = getExportTypeLabel,
    participantFormatter = (participant) => (
      participant.isSelf && participant.name === "Я"
        ? window.t("item.editor.participant.self")
        : participant.name
    ),
  } = presentation;
  const header = [dayLabel, itemLabel, categoryLabel, totalColumnLabel, ...participants.map(participantFormatter)];
  const rows = [...state.items]
    .filter(isActiveCost)
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") || sortItems(a, b))
    .map((item) => {
      const allocations = getItemAllocations(item);
      const allocationByParticipant = new Map(allocations.map((allocation) => [allocation.participantId, parseMoney(allocation.amount)]));
      return [
        item.date ? dateFormatter(item.date) : undatedLabel,
        item.title,
        typeFormatter(item.type),
        getItemAllocationTotal(item),
        ...participants.map((participant) => allocationByParticipant.get(participant.id) || 0),
      ];
    });
  const totals = participants.map((participant, index) => rows.reduce((sum, row) => sum + parseMoney(row[index + 4]), 0));
  rows.push([totalRowLabel, "", "", rows.reduce((sum, row) => sum + parseMoney(row[3]), 0), ...totals]);
  return {
    header,
    rows,
    columnWeights: [1.1, 1.6, 1.5, 1, ...participants.map(() => 1)],
  };
}

function buildEstimateCsv() {
  const { header, rows } = buildEstimateRows();
  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(";")).join("\n");
}

function buildPlanRows() {
  const header = [
    exportT("column.day"),
    exportT("column.date"),
    exportT("itinerary.column.time"),
    exportT("itinerary.column.item"),
    exportT("itinerary.column.type"),
    exportT("itinerary.column.status"),
    exportT("itinerary.column.price"),
    exportT("itinerary.column.link"),
  ];
  const rows = [];
  getTripDates().forEach((date, index) => {
    state.items
      .filter((item) => item.date === date && item.status !== "skipped")
      .sort(sortItems)
      .forEach((item) => {
        rows.push([
          exportT("day.label", { number: index + 1 }),
          formatExportDate(date),
          item.startTime || "",
          item.title,
          getExportTypeLabel(item.type),
          getExportStatusLabel(item.status),
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
        exportT("unscheduled"),
        "",
        item.startTime || "",
        item.title,
        getExportTypeLabel(item.type),
        getExportStatusLabel(item.status),
        parseMoney(item.price),
        item.link || "",
      ]);
    });
  return {
    header,
    rows,
    columnWeights: [1.4, 1, 0.8, 1.7, 1.7, 1.3, 1, 0.75],
  };
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

function buildSpreadsheetHtml(title, table, sheetName = title) {
  const headerHtml = table.header.map((cell) => `<th>${escapeSpreadsheetValue(cell)}</th>`).join("");
  const textColumnIndexes = table.header
    .map((cell, index) => (cell === exportT("itinerary.column.time") ? index : -1))
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
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeSpreadsheetValue(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
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

function downloadSpreadsheet(fileName, title, table, sheetName = title) {
  downloadTextFile(
    fileName,
    `\uFEFF${buildSpreadsheetHtml(title, table, sheetName)}`,
    "application/vnd.ms-excel;charset=utf-8",
  );
}

function downloadEstimate() {
  if (!canShowBudget()) {
    showToast(window.t("budget.export.estimate.hidden"));
    return;
  }
  const name = `${slugifyFileName(state.trip.title)}-estimate.xls`;
  downloadSpreadsheet(name, exportT("estimate.title"), buildEstimateRows(), exportT("estimate.sheet"));
  showToast(window.t("budget.export.estimate.downloaded"));
  trackEvent("export_completed", { ...getTripAnalyticsContext(), export_type: "estimate", format: "xls" });
}

function downloadPlan() {
  const name = `${slugifyFileName(state.trip.title)}-plan.xls`;
  downloadSpreadsheet(name, exportT("itinerary.title"), buildPlanRows(), exportT("itinerary.sheet"));
  showToast(window.t("budget.export.plan.downloaded"));
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
        <h2 id="exportFormatTitle">${escapeHtml(window.t("budget.export.format.title"))}</h2>
        <div class="export-format-actions">
          <button class="export-format-button" type="button" data-export-format="pdf">PDF</button>
          <button class="export-format-button" type="button" data-export-format="xls">XLS</button>
        </div>
        <button class="export-format-cancel" type="button" data-export-cancel>${escapeHtml(window.t("budget.export.format.cancel"))}</button>
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
    showToast(window.t("budget.export.pdf.module.error"));
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
  const columnWeights = Array.isArray(table.columnWeights) && table.columnWeights.length === columnCount
    ? table.columnWeights
    : Array(columnCount).fill(1);
  const columnWeightTotal = columnWeights.reduce((total, weight) => total + weight, 0);
  const columnWidths = columnWeights.map((weight) => maxWidth * weight / columnWeightTotal);
  const lineHeight = 14;
  const cellPadding = 5;
  const rowFont = "400 10px Arial, sans-serif";
  const headerFont = "700 10px Arial, sans-serif";

  function wrapCellText(text, width) {
    const words = String(text ?? "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    const splitLongWord = (word) => {
      const chunks = [];
      let chunk = "";
      Array.from(word).forEach((character) => {
        const test = `${chunk}${character}`;
        if (chunk && ctx.measureText(test).width > width) {
          chunks.push(chunk);
          chunk = character;
        } else {
          chunk = test;
        }
      });
      if (chunk) chunks.push(chunk);
      return chunks;
    };
    words.forEach((word) => {
      if (ctx.measureText(word).width > width) {
        if (line) {
          lines.push(line);
          line = "";
        }
        const chunks = splitLongWord(word);
        lines.push(...chunks.slice(0, -1));
        line = chunks.at(-1) || "";
        return;
      }
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
      ...row.map((cell, index) => wrapCellText(formatExportTableCell(cell), columnWidths[index] - cellPadding * 2).length),
    );
    return Math.max(26, linesCount * lineHeight + cellPadding * 2);
  }

  function drawRow(row, rowY, rowHeight, font, fillStyle = "#ffffff") {
    ctx.font = font;
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, rowY, maxWidth, rowHeight);
    let cellX = x;
    row.forEach((cell, index) => {
      const columnWidth = columnWidths[index];
      ctx.strokeStyle = "#9aa6a3";
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, rowY, columnWidth, rowHeight);
      ctx.fillStyle = "#1f2423";
      wrapCellText(formatExportTableCell(cell), columnWidth - cellPadding * 2).forEach((line, lineIndex) => {
        ctx.fillText(line, cellX + cellPadding, rowY + cellPadding + 10 + lineIndex * lineHeight);
      });
      cellX += columnWidth;
    });
  }

  function drawPageTitle() {
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillStyle = "#1f2423";
    ctx.fillText(title, x, y);
    y += 28;
    ctx.font = "400 12px Arial, sans-serif";
    ctx.fillStyle = "#66716f";
    ctx.fillText(`${state.trip.title} · ${formatExportTripDateRange(state.trip.startDate, state.trip.endDate)}`, x, y);
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
  showToast(window.t("budget.export.pdf.downloaded"));
}

async function chooseAndDownloadEstimate() {
  if (!canShowBudget()) {
    showToast(window.t("budget.export.estimate.hidden"));
    return;
  }
  const format = await chooseExportFormat();
  if (!format) return;
  if (format === "xls") {
    downloadEstimate();
  } else {
    const previewWindow = window.open("", "_blank");
    previewWindow?.document.write(`<p>${escapeHtml(window.t("budget.export.pdf.preparing"))}</p>`);
    await downloadPdfFile(`${slugifyFileName(state.trip.title)}-estimate.pdf`, exportT("estimate.title"), buildEstimateRows(), previewWindow);
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
    previewWindow?.document.write(`<p>${escapeHtml(window.t("budget.export.pdf.preparing"))}</p>`);
    await downloadPdfFile(`${slugifyFileName(state.trip.title)}-plan.pdf`, exportT("itinerary.title"), buildPlanRows(), previewWindow);
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
    const headerHeight = options.includeBudget
      ? (hasGroupParticipants ? 184 : 164)
      : (hasGroupParticipants ? 104 : 84);
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
    drawPdfWrappedText(ctx, state.trip.title || exportT("trip.title.fallback"), margin + 66, y + 31, contentWidth - 76, 25, 1);
    ctx.font = "700 12px Arial, sans-serif";
    ctx.fillStyle = "#66716f";
    const meta = `${state.trip.destination || exportT("trip.destination.missing")} · ${formatExportTripDateRange(state.trip.startDate, state.trip.endDate)} · ${formatExportTripDayCount(state.trip)}`;
    drawPdfWrappedText(ctx, meta, margin + 66, y + 56, contentWidth - 76, 15, 1);

    if (options.includeBudget) {
      ctx.fillStyle = "rgba(255, 253, 248, 0.78)";
      roundRect(ctx, margin + 180, y + 74, contentWidth - 190, 30, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(18, 54, 61, 0.18)";
      ctx.stroke();
      ctx.fillStyle = "#12363d";
      ctx.font = "800 13px Arial, sans-serif";
      ctx.fillText(exportT("financial.summary", { amount: formatExportMoney(totals.budgetLimit) }), margin + 194, y + 94);

      const cardGap = 8;
      const cardWidth = (contentWidth - cardGap * 2) / 3;
      const cardY = y + 114;
      drawPdfMetricCard(margin, cardY, cardWidth, 42, exportT("financial.paid"), formatExportMoney(totals.paidTotal), "paid");
      drawPdfMetricCard(margin + cardWidth + cardGap, cardY, cardWidth, 42, exportT("financial.booked"), formatExportMoney(totals.confirmedOutstanding));
      drawPdfMetricCard(margin + (cardWidth + cardGap) * 2, cardY, cardWidth, 42, exportT("financial.available"), formatExportMoney(totals.remainingConfirmed));
    }
    if (hasGroupParticipants) {
      const participantsY = options.includeBudget ? y + 175 : y + 91;
      ctx.fillStyle = "#66716f";
      ctx.font = "800 11px Arial, sans-serif";
      ctx.fillText(exportT("participants"), margin + 8, participantsY);
      ctx.fillStyle = "#1f2423";
      ctx.font = "700 11px Arial, sans-serif";
      drawPdfWrappedText(
        ctx,
        state.trip.participants.map((participant) => participant.name).join(" · "),
        margin + 84,
        participantsY,
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
    const height = hasGroupParticipants ? 208 : 190;
    await ensureSpace(height);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, margin, y, contentWidth, height - 12, 8);
    ctx.fill();
    ctx.strokeStyle = "#ded8cc";
    ctx.stroke();
    ctx.fillStyle = "#1f2423";
    ctx.font = "800 15px Arial, sans-serif";
    ctx.fillText(exportT("financial.title"), margin + 14, y + 24);
    const budgetRows = [
      [exportT("financial.limit"), formatExportMoney(totals.budgetLimit)],
      [exportT("financial.paid"), formatExportMoney(totals.paidTotal)],
      [exportT("financial.booked"), formatExportMoney(totals.confirmedOutstanding)],
      [exportT("financial.available"), formatExportMoney(totals.remainingConfirmed)],
      [exportT("financial.backup"), formatExportMoney(totals.additionalTotal)],
      [exportT("financial.possible"), formatExportMoney(totals.possibleTotal)],
      [exportT("financial.remaining"), formatExportMoney(totals.remainingAll)],
    ];
    ctx.font = "700 11px Arial, sans-serif";
    budgetRows.forEach((row, index) => {
      const rowY = y + 48 + index * 18;
      ctx.fillStyle = "#66716f";
      ctx.textAlign = "left";
      ctx.fillText(row[0], margin + 14, rowY);
      ctx.fillStyle = "#1f2423";
      ctx.textAlign = "right";
      ctx.fillText(row[1], margin + contentWidth - 14, rowY);
    });
    ctx.textAlign = "left";
    if (hasGroupParticipants) {
      const rowY = y + 48 + budgetRows.length * 18;
      ctx.fillStyle = "#66716f";
      ctx.fillText(exportT("participants"), margin + 14, rowY);
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
      paid: exportT("status.mark.paid"),
      fixed: exportT("status.mark.fixed"),
      want: exportT("status.mark.want"),
      maybe: exportT("status.mark.maybe"),
      backup: exportT("status.mark.backup"),
      skipped: exportT("status.mark.skipped"),
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
    const typeLabel = getExportTypeLabel(item.type).toUpperCase();
    const maxTypeLabelWidth = baseWidth - padding * 2 - 38;
    let typeLabelFontSize = 18;
    ctx.font = `800 ${typeLabelFontSize}px Arial, sans-serif`;
    while (typeLabelFontSize > 11 && ctx.measureText(typeLabel).width > maxTypeLabelWidth) {
      typeLabelFontSize -= 1;
      ctx.font = `800 ${typeLabelFontSize}px Arial, sans-serif`;
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(typeLabel, baseWidth - padding, 28);
    ctx.textAlign = "left";

    const price = options.includeBudget && parseMoney(item.price) ? formatExportMoney(item.price) : "--";
    const priceWidth = Math.max(78, Math.min(100, ctx.measureText(price).width + 20));
    drawPdfPricePill(price, baseWidth - padding - priceWidth, localBodyY + 17, priceWidth);

    ctx.fillStyle = "#1f2423";
    ctx.font = "800 14px Arial, sans-serif";
    drawPdfWrappedText(ctx, item.title, padding, localBodyY + 22, baseWidth - padding * 2 - priceWidth - 10, 17, 2);
    ctx.fillStyle = accent;
    ctx.font = "900 italic 13px Arial, sans-serif";
    ctx.fillText(formatExportDuration(item.durationMinutes), padding, localBodyY + 64);
    drawPdfTimeSlots(item, padding, localBodyY + 73, slotFill);
    ctx.fillStyle = accent;
    ctx.font = "900 italic 13px Arial, sans-serif";
    ctx.fillText(exportT("item.date"), padding, localBodyY + 124);
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
  await drawBudget();

  for (const [index, date] of getTripDates().entries()) {
    const items = state.items.filter((item) => item.date === date && item.status !== "skipped").sort(sortItems);
    await ensureSpace(60);
    drawSectionTitle(exportT("day.label", { number: index + 1 }), formatExportDate(date));
    if (items.length) {
      await drawItemGrid(items);
    } else {
      ctx.font = "700 12px Arial, sans-serif";
      ctx.fillStyle = "#66716f";
      ctx.fillText(exportT("day.empty"), margin, y);
      y += 28;
    }
  }

  const undated = state.items.filter((item) => !item.date && item.status !== "skipped").sort(sortItems);
  if (options.includeUndated && undated.length) {
    await ensureSpace(60);
    drawSectionTitle(exportT("unscheduled"), exportT("unscheduled.subtitle"));
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
  if (downloadButton) downloadButton.textContent = window.t(isBusy && label === "download" ? "share.pdf.preparing" : "share.pdf.download");
  if (shareButton) shareButton.textContent = window.t(isBusy && label === "share" ? "share.pdf.preparing" : "share.pdf.share");
}

async function prepareTripPdfExport(deliveryMethod) {
  if (tripPdfGenerating) return;
  const options = getTripPdfOptions();
  const itemCount = getTripPdfItemCount(options);
  if (!itemCount) {
    showToast(window.t("share.pdf.empty"));
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
    trackTripPdfExportFailed(deliveryMethod, classifyTripPdfGenerationFailure(error));
    showToast(window.t("share.pdf.create.error"));
    finishTripPdfExport();
    return;
  }
  const fileName = getTripPdfFileName();
  // `export_completed` deliberately does not fire here. A built Blob is not a
  // delivered document: the save sheet can still be dismissed, the share sheet
  // cancelled, the write refused. The callers below fire it once delivery has
  // actually happened, so the funnel counts exports that reached the user.
  return { blob, fileName, optionProps };
}

function trackTripPdfExportCompleted(deliveryMethod, optionProps) {
  trackEvent("export_completed", {
    ...getTripAnalyticsContext(),
    export_type: "trip_pdf",
    delivery_method: deliveryMethod,
    ...optionProps,
  });
}

function trackTripPdfExportFailed(deliveryMethod, failureReasonBucket) {
  trackEvent("export_failed", {
    ...getTripAnalyticsContext(),
    export_type: "trip_pdf",
    delivery_method: deliveryMethod,
    failure_reason_bucket: failureReasonBucket,
  });
}

function finishTripPdfExport() {
  tripPdfGenerating = false;
  setTripPdfButtonsBusy(false);
}

async function downloadTripPdf() {
  const result = await prepareTripPdfExport("download");
  if (!result) return;
  try {
    if (hasPlatformFileAction("savePdf")) {
      const outcome = await runPlatformFileAction("savePdf", [result.fileName, result.blob]);
      // Dismissing the save sheet is a decision, not a fault: no toast, no event.
      if (outcome.status === "cancelled") return;
      if (outcome.status === "failure") {
        trackTripPdfExportFailed("download", "native_save");
        showToast(window.t("share.pdf.save.error"));
        return;
      }
    } else {
      downloadBlobFile(result.fileName, result.blob);
    }
    trackTripPdfExportCompleted("download", result.optionProps);
    showToast(window.t("share.pdf.saved"));
  } finally {
    finishTripPdfExport();
  }
}

async function shareTripPdf() {
  // The native sheet wins over `navigator.canShare`: inside a shell the web
  // share API may exist and still be the wrong door.
  if (hasPlatformFileAction("sharePdf")) {
    const result = await prepareTripPdfExport("share");
    if (!result) return;
    try {
      const outcome = await runPlatformFileAction("sharePdf", [result.fileName, result.blob]);
      if (outcome.status === "cancelled") return;
      if (outcome.status === "failure") {
        trackTripPdfExportFailed("share", "native_share");
        showToast(window.t("share.pdf.send.error"));
        return;
      }
      trackEvent("share_completed", { ...getTripAnalyticsContext(), share_format: "pdf", method: "native_share" });
      trackTripPdfExportCompleted("share", result.optionProps);
      showToast(window.t("share.pdf.sent"));
    } finally {
      finishTripPdfExport();
    }
    return;
  }

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
        text: window.t("share.pdf.description"),
        files: [file],
      });
      trackEvent("share_completed", { ...getTripAnalyticsContext(), share_format: "pdf", method: "web_share" });
      trackTripPdfExportCompleted(deliveryMethod, result.optionProps);
      showToast(window.t("share.pdf.sent"));
    } else {
      downloadBlobFile(result.fileName, result.blob);
      trackTripPdfExportCompleted(deliveryMethod, result.optionProps);
      showToast(window.t("share.pdf.download.fallback"));
    }
  } catch (error) {
    // A dismissed share sheet raises AbortError. It was never a failure, and it
    // is not a completed export either — neither event fires.
    if (error?.name !== "AbortError") {
      trackTripPdfExportFailed(deliveryMethod, "share_api");
      showToast(window.t("share.pdf.create.error"));
    }
  } finally {
    finishTripPdfExport();
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
  showToast(window.t("share.text.copied"));
  trackEvent("share_completed", { ...getTripAnalyticsContext(), share_context: "trip", share_format: "text", method: "clipboard" });
}

async function shareApp() {
  const url = getCanonicalAppShareUrl();
  const shareData = {
    title: "Backpacker",
    text: window.t("share.app.copy"),
    url,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      trackEvent("app_shared");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const copied = await copyText(`${shareData.text}\n${url}`);
  if (!copied) return;
  showToast(window.t("share.app.copied"));
  trackEvent("app_shared");
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
    showToast(window.t("home.install.already"));
    trackEvent("pwa_install_clicked", { already_installed: true });
    return;
  }

  if (isAppleMobileBrowser()) {
    renderIosInstallOnboarding();
    showToast(window.t("home.install.ios.hint"));
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

  showToast(window.t("home.install.browser.hint"));
  trackEvent("pwa_install_clicked", { prompt_available: false });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(window.t("share.copy.done"));
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) showToast(window.t("share.copy.done"));
    return copied;
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

// Сплэш снимался сразу, как только startApp доходил до этой строки — в
// локальном режиме это несколько десятков миллисекунд, и увидеть его было
// физически нельзя. Экран запуска держится минимум эту паузу от загрузки
// страницы; если приложение поднималось дольше, задержка не добавляется.
const APP_SPLASH_MIN_MS = 900;
const appSplashOpenedAt = Date.now();

function hideAppSplash() {
  const splash = $("#appSplash");
  if (!splash) return;
  const left = APP_SPLASH_MIN_MS - (Date.now() - appSplashOpenedAt);
  if (left > 0) {
    window.setTimeout(hideAppSplash, left);
    return;
  }
  splash.classList.add("hidden");
}

function showIntroScreen(trigger = "first_open") {
  currentScreen = "intro";
  onboardingExitTracked = false;
  $("#introScreen").classList.remove("hidden");
  $("#homeScreen").classList.add("hidden");
  $("#ideasScreen")?.classList.add("hidden");
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
  const hasReferralMarker = hasAppReferralMarker();
  const hadExistingSession = hasReferralMarker
    ? await hadExistingSupabaseSessionBeforeReferralLanding()
    : true;
  trackAppOpen();
  const recoverableUser = await handleRecoverableAuthCallback();
  if (hasReferralMarker) await captureAppReferralArrival({ hadExistingSession });
  const splashStatus = $("#appSplashStatus");
  if (splashStatus && getSharePayloadFromUrl()) splashStatus.textContent = window.t("share.readonly.opening");
  readOnlyShare = await loadReadOnlyShareFromUrl();
  if (readOnlyShare) {
    if (readOnlyShare.invalid) showToast(window.t("share.readonly.invalid"));
    state = readOnlyShare.state;
    hideAppSplash();
    showTripScreen();
    return;
  }
  privateTripSyncState.ready = true;
  if (recoverableUser?.hasEmailIdentity) {
    await syncPrivateTripsWithCloud({ silent: true }).catch(() => null);
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
  $("#ideasScreen")?.classList.add("hidden");
  $(".app-shell").classList.add("hidden");
  renderHome();
  loadMyProfile({ createSession: false }).catch(() => {});
  syncPrivateTripsWithCloud({ silent: true }).catch(() => {});
  renderIosInstallOnboarding();
  refreshReceivedTrips();
  trackEvent("home_opened", { trip_count: getUserTripCount(), ...(source ? { source } : {}) });
}

function showIdeasScreen() {
  currentScreen = "ideas";
  $("#introScreen").classList.add("hidden");
  $("#homeScreen").classList.add("hidden");
  $("#ideasScreen")?.classList.remove("hidden");
  $(".app-shell").classList.add("hidden");
  renderIdeasScreen();
  loadTravelIdeas({ silent: ideasState.loaded }).catch(() => {});
  trackEvent("ideas_opened", { loaded: ideasState.loaded });
}

function showTripScreen(options = {}) {
  currentScreen = "trip";
  $("#introScreen").classList.add("hidden");
  $("#homeScreen").classList.add("hidden");
  $("#ideasScreen")?.classList.add("hidden");
  $(".app-shell").classList.remove("hidden");
  $("#editTripButton").hidden = isReadOnlyMode();
  $("#shareButton").hidden = false;
  $$("[data-action='add']").forEach((button) => {
    button.hidden = Boolean(isReadOnlyMode() && (readOnlyShare?.invalid || readOnlyShare?.isOwner || readOnlyShare?.isAuthor));
  });
  renderSaveReceivedTripButton();
  render();
  if (options.refreshProposals !== false) refreshAuthorExpenseProposals();
  if (isReadOnlyMode()) {
    refreshShareProposalContext();
    refreshItemProposalContext();
  }
}

function openTrip(tripId, options = {}) {
  const entry = tripStore.trips.find((trip) => trip.id === tripId);
  if (!entry) return;
  readOnlyShare = null;
  state = normalizeState(structuredClone(entry.state));
  if (options.persistNavigation !== false) {
    try {
      localStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, tripId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Opening still works even without persistence.
    }
  }
  switchView(currentView);
  showTripScreen({ refreshProposals: options.refreshProposals });
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
  // Each step owns its own status node, and only the visible one is on screen.
  [$("#tripDraftStatus"), $("#tripDraftDocumentsStatus")].forEach((status) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  });
}

function renderTripDraftAiSheet() {
  // Addressed by id, not by class: the resume step reuses the same grid class for its buttons.
  const choice = $("#tripDraftChoiceStep");
  const inputStep = $("#tripDraftInputStep");
  const previewStep = $("#tripDraftPreviewStep");
  const voiceControls = $("#tripDraftVoiceControls");
  const textModeButton = $("#tripDraftTextModeButton");
  const voiceModeButton = $("#tripDraftVoiceModeButton");
  const recordButton = $("#tripDraftRecordButton");
  const parseButton = $("#tripDraftParseButton");
  const createButton = $("#tripDraftCreateButton");
  const recordingIndicator = $("#tripDraftRecordingIndicator");
  const title = $("#tripDraftAiTitle");
  if (!choice || !inputStep || !previewStep) return;

  choice.classList.toggle("hidden", tripDraftAiState.mode !== "choice");
  $("#tripDraftResumeStep")?.classList.toggle("hidden", tripDraftAiState.mode !== "resume");
  $("#tripDraftDocumentsStep")?.classList.toggle("hidden", tripDraftAiState.mode !== "documents");
  if (tripDraftAiState.mode === "documents") renderTripDraftDocumentsStep();
  inputStep.classList.toggle("hidden", tripDraftAiState.mode !== "input");
  previewStep.classList.toggle("hidden", tripDraftAiState.mode !== "preview");
  voiceControls?.classList.toggle("hidden", tripDraftAiState.mode !== "input");
  recordingIndicator?.classList.toggle("hidden", !tripDraftAiState.isRecording);
  if (textModeButton) textModeButton.disabled = !TRIP_DRAFT_AI_ENABLED;
  if (voiceModeButton) voiceModeButton.disabled = !TRIP_DRAFT_AI_ENABLED;
  if (title) title.textContent = ["choice", "resume"].includes(tripDraftAiState.mode)
    ? window.t("trip.setup.create.title")
    : tripDraftT("title");
  if (recordButton) recordButton.textContent = tripDraftAiState.isRecording ? tripDraftT("voice.stop") : tripDraftT("voice.record");
  if (parseButton) {
    parseButton.disabled = tripDraftAiState.isBusy || !TRIP_DRAFT_AI_ENABLED;
    parseButton.textContent = tripDraftAiState.isBusy ? tripDraftT("input.parsing") : tripDraftT("input.parse");
  }
  if (createButton) {
    createButton.disabled = tripDraftAiState.isBusy || tripDraftAiState.isCreating || !tripDraftAiState.draft;
    createButton.textContent = tripDraftAiState.isCreating ? tripDraftT("preview.creating") : tripDraftT("preview.create");
  }
}

function createEmptyTripDraftAiState() {
  return {
    mode: "choice", inputMode: "text", isBusy: false, isCreating: false, isRecording: false,
    draft: null, sourceText: "", mediaRecorder: null, chunks: [], resumeMode: "",
    // Booking Pack keeps real File objects in memory and only descriptors on disk.
    bookingPackFiles: [], bookingPackMissing: [], isBookingPack: false,
  };
}

function getBookingPackCore() {
  return window.BackpackerTripDraftAiCore;
}

function describeBookingPackFile(entry) {
  return {
    sourceFileId: entry.sourceFileId,
    fileName: entry.fileName,
    fileSize: entry.fileSize,
    mimeType: entry.mimeType,
  };
}

function addBookingPackFiles(fileList) {
  const core = getBookingPackCore();
  const existing = [...tripDraftAiState.bookingPackFiles];
  const seen = new Set(existing.map((entry) => core.getBookingPackFileKey(entry)));
  const rejected = [];
  let totalBytes = existing.reduce((sum, entry) => sum + entry.fileSize, 0);

  Array.from(fileList || []).forEach((file) => {
    const mimeType = String(file.type || "").toLowerCase();
    const descriptor = { fileName: file.name, fileSize: file.size, mimeType };
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      rejected.push(tripDraftT("documents.validation.unsupported", { name: file.name }));
      return;
    }
    if (file.size > core.BOOKING_PACK_MAX_FILE_BYTES) {
      rejected.push(tripDraftT("documents.validation.file.large", { name: file.name }));
      return;
    }
    // Deduplicating on the same triple used to match files back after a reload keeps that
    // key unique inside a pack.
    if (seen.has(core.getBookingPackFileKey(descriptor))) return;
    if (existing.length >= core.BOOKING_PACK_MAX_FILES) {
      rejected.push(tripDraftT("documents.validation.files.many", { name: file.name, count: core.BOOKING_PACK_MAX_FILES }));
      return;
    }
    if (totalBytes + file.size > core.BOOKING_PACK_MAX_TOTAL_BYTES) {
      rejected.push(tripDraftT("documents.validation.pack.large", { name: file.name }));
      return;
    }
    seen.add(core.getBookingPackFileKey(descriptor));
    totalBytes += file.size;
    existing.push({
      ...descriptor,
      sourceFileId: globalThis.crypto?.randomUUID?.() || `file-${Date.now()}-${existing.length}`,
      file,
    });
  });

  tripDraftAiState = { ...tripDraftAiState, bookingPackFiles: existing };
  return rejected;
}

// After a reload the descriptors survive but the File objects do not. Matching them back is
// what makes the pack usable again; anything unmatched is reported, never guessed.
function reconcileBookingPackFiles(fileList) {
  const core = getBookingPackCore();
  const picked = Array.from(fileList || []);
  const { matched, missing } = core.matchBookingPackFiles(tripDraftAiState.bookingPackFiles, picked);
  const files = tripDraftAiState.bookingPackFiles.map((entry) => (
    entry.file ? entry : { ...entry, file: matched[entry.sourceFileId] || null }
  ));
  tripDraftAiState = {
    ...tripDraftAiState,
    bookingPackFiles: files,
    bookingPackMissing: files.filter((entry) => !entry.file).map(describeBookingPackFile),
  };
  return missing;
}

function getBookingPackMissingFiles() {
  return tripDraftAiState.bookingPackFiles.filter((entry) => !entry.file);
}

// Drafts are per identity so one browser never shows another account's unfinished trip.
// Without a uid nothing is written or read: there is deliberately no anonymous bucket.
function renderTripDraftDocumentsStep() {
  const list = $("#tripDraftDocumentsList");
  const missingNote = $("#tripDraftDocumentsMissing");
  const parseButton = $("#tripDraftDocumentsParseButton");
  if (!list) return;
  const files = tripDraftAiState.bookingPackFiles;
  const missing = getBookingPackMissingFiles();
  const core = getBookingPackCore();

  list.innerHTML = files.length
    ? files.map((entry, index) => `
      <article class="trip-draft-document-row${entry.file ? "" : " is-missing"}">
        <div class="trip-draft-document-copy">
          <span class="trip-draft-document-name" title="${escapeAttr(entry.fileName)}">${escapeHtml(entry.fileName)}</span>
          <span class="trip-draft-document-meta">${escapeHtml(getTripItemAttachmentsCore()?.formatAttachmentSize?.(entry.fileSize) || "")}${entry.file ? "" : ` · ${escapeHtml(tripDraftT("documents.file.missing"))}`}</span>
        </div>
        <button class="ghost-button compact" type="button" data-booking-pack-remove="${index}">${escapeHtml(tripDraftT("documents.remove"))}</button>
      </article>
    `).join("")
    : `<p class="trip-draft-document-empty">${escapeHtml(tripDraftT("documents.empty"))}</p>`;

  if (missingNote) {
    missingNote.classList.toggle("hidden", missing.length === 0);
    // After a reload the descriptors are there but the files are not; say so plainly.
    if (missing.length) {
      missingNote.textContent = tripDraftT("documents.missing", { count: missing.length });
    }
  }
  if (parseButton) {
    const ready = files.some((entry) => entry.file);
    parseButton.disabled = tripDraftAiState.isBusy || !ready;
    parseButton.textContent = tripDraftAiState.isBusy ? tripDraftT("documents.parsing") : tripDraftT("documents.parse");
  }
}

function handleTripDraftDocumentsSelection(fileList) {
  // A restored pack is being completed, not extended: match the picked files back first.
  if (getBookingPackMissingFiles().length) {
    reconcileBookingPackFiles(fileList);
  } else {
    const rejected = addBookingPackFiles(fileList);
    if (rejected.length) setTripDraftAiStatus(rejected.join("; "), true);
    else setTripDraftAiStatus("");
  }
  saveTripDraftPending();
  renderTripDraftDocumentsStep();
}

function startTripDraftDocumentsMode() {
  if (!TRIP_DRAFT_AI_ENABLED) return;
  tripDraftAiState = { ...tripDraftAiState, mode: "documents", isBookingPack: true, isCreating: false };
  setTripDraftAiStatus("");
  renderTripDraftAiSheet();
}

async function parseBookingPackDocuments() {
  if (tripDraftAiState.isBusy) return;
  const entries = tripDraftAiState.bookingPackFiles.filter((entry) => entry.file);
  if (!entries.length) {
    setTripDraftAiStatus(tripDraftT("documents.validation.required"), true);
    return;
  }
  const comment = $("#tripDraftDocumentsComment")?.value.trim() || "";
  tripDraftAiState = { ...tripDraftAiState, isBusy: true, sourceText: comment, isBookingPack: true };
  setTripDraftAiStatus(tripDraftT("documents.parsing"));
  renderTripDraftAiSheet();
  trackEvent("trip_draft_ai_generation_started", { mode: "documents" });
  try {
    const files = [];
    for (const entry of entries) {
      files.push({
        sourceFileId: entry.sourceFileId,
        fileName: entry.fileName,
        mimeType: entry.mimeType,
        dataUrl: await blobToDataUrl(entry.file),
      });
    }
    const payload = await callTripDraftAiFunction("parse_documents", {
      files,
      comment,
      schemaVersion: getBookingPackCore().BOOKING_PACK_SCHEMA_VERSION,
      today: getClientTodayIsoDate(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    });
    // Slice 1 guardrails do not apply: there is no typed text to ground against. Evidence
    // rules already ran on the server. Chronology still applies to the extracted dates.
    const draft = normalizeTripDraftResponse(payload, comment, { applyGuardrails: false, applyChronology: true });
    tripDraftAiState = { ...tripDraftAiState, isBusy: false, mode: "preview", draft };
    saveTripDraftPending();
    renderTripDraftPreview(draft);
    setTripDraftAiStatus("");
    renderTripDraftAiSheet();
    trackEvent("trip_draft_ai_generation_completed", { mode: "documents", result: "success" });
  } catch (error) {
    tripDraftAiState = { ...tripDraftAiState, isBusy: false };
    const message = {
      documents_too_large: tripDraftT("documents.error.pack.large"),
      too_many_documents: tripDraftT("documents.error.files.many"),
      unsupported_document_type: tripDraftT("documents.error.unsupported"),
      supabase_not_configured: tripDraftT("documents.error.unavailable"),
    }[error.message] || tripDraftT("documents.error.parse");
    setTripDraftAiStatus(message, true);
    renderTripDraftAiSheet();
    trackEvent("trip_draft_ai_generation_failed", { mode: "documents", result: "failed", error_reason_bucket: "unknown" });
  }
}

function getTripDraftPendingKey() {
  const userId = String(getCurrentRecoverableAuthUser()?.id || "");
  return userId ? `${TRIP_DRAFT_PENDING_KEY_PREFIX}:${userId}` : "";
}

function getTripDraftPendingSourceText() {
  if (tripDraftAiState.mode === "input") {
    return String($("#tripDraftTextInput")?.value || tripDraftAiState.sourceText || "");
  }
  return String(tripDraftAiState.sourceText || "");
}

// An explicit whitelist, never a copy of the state: a future transient field cannot leak
// into storage by accident, and raw audio has no path here at all.
function saveTripDraftPending() {
  const key = getTripDraftPendingKey();
  if (!key) return;
  const { mode, inputMode, draft, isBusy, isCreating, isRecording } = tripDraftAiState;
  if (isBusy || isCreating || isRecording) return;
  if (mode !== "input" && mode !== "preview" && mode !== "documents") return;
  const sourceText = getTripDraftPendingSourceText();
  // A Booking Pack has files and a draft to protect even when the comment is empty.
  const hasBookingPackWork = Boolean(tripDraftAiState.isBookingPack)
    && (tripDraftAiState.bookingPackFiles.length > 0 || Boolean(draft));
  if (!sourceText.trim() && !hasBookingPackWork) return;
  try {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: TRIP_DRAFT_AI_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      mode,
      inputMode: inputMode === "voice" ? "voice" : "text",
      sourceText,
      draft: mode === "preview" ? draft : null,
      isBookingPack: Boolean(tripDraftAiState.isBookingPack),
      // Descriptors only. File contents and base64 are never written to storage.
      bookingPackFiles: tripDraftAiState.bookingPackFiles.map(describeBookingPackFile),
    }));
  } catch {
    // Persistence is best-effort; the draft still lives in memory for this session.
  }
}

function scheduleTripDraftPendingSave(delay = 600) {
  window.clearTimeout(tripDraftPendingSaveTimer);
  tripDraftPendingSaveTimer = window.setTimeout(() => {
    tripDraftPendingSaveTimer = null;
    saveTripDraftPending();
  }, delay);
}

// A pending debounce must never swallow the last edit before an async call takes the state over.
function flushTripDraftPendingSave() {
  window.clearTimeout(tripDraftPendingSaveTimer);
  tripDraftPendingSaveTimer = null;
  saveTripDraftPending();
}

function clearTripDraftPending() {
  window.clearTimeout(tripDraftPendingSaveTimer);
  tripDraftPendingSaveTimer = null;
  const key = getTripDraftPendingKey();
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to recover from: the draft is already gone from memory.
  }
}

function readTripDraftPending() {
  const key = getTripDraftPendingKey();
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const sourceText = String(parsed.sourceText || "");
    const bookingPackFiles = Array.isArray(parsed.bookingPackFiles)
      ? parsed.bookingPackFiles.filter((entry) => entry && entry.sourceFileId)
      : [];
    const draft = parsed.draft && typeof parsed.draft === "object" ? parsed.draft : null;
    if (!sourceText.trim() && !bookingPackFiles.length && !draft) return null;
    return {
      schemaVersion: String(parsed.schemaVersion || ""),
      updatedAt: String(parsed.updatedAt || ""),
      mode: parsed.mode === "preview" ? "preview" : parsed.mode === "documents" ? "documents" : "input",
      inputMode: parsed.inputMode === "voice" ? "voice" : "text",
      sourceText,
      draft,
      isBookingPack: Boolean(parsed.isBookingPack),
      bookingPackFiles,
    };
  } catch {
    return null;
  }
}

function restoreTripDraftPending(pending) {
  const input = $("#tripDraftTextInput");
  if (pending.schemaVersion !== TRIP_DRAFT_AI_SCHEMA_VERSION) {
    // The traveller's own words outlive a contract change; a parsed draft does not.
    tripDraftAiState = { ...tripDraftAiState, mode: "input", inputMode: pending.inputMode, sourceText: pending.sourceText, draft: null };
    if (input) input.value = pending.sourceText;
    setTripDraftAiStatus(tripDraftT("resume.restored.source"));
    return;
  }
  // Re-normalize rather than trust storage, but without guardrails: hand-typed prices are
  // the traveller's own and are not present in the original description.
  const draft = pending.draft
    ? normalizeTripDraftResponse({ draft: pending.draft }, pending.sourceText, { applyGuardrails: false })
    : null;
  tripDraftAiState = {
    ...tripDraftAiState,
    mode: "resume",
    inputMode: pending.inputMode,
    sourceText: pending.sourceText,
    draft,
    isBookingPack: Boolean(pending.isBookingPack),
    // The File objects did not survive the reload; only the descriptors did.
    bookingPackFiles: (pending.bookingPackFiles || []).map((entry) => ({ ...entry, file: null })),
    bookingPackMissing: pending.bookingPackFiles || [],
    resumeMode: draft && pending.mode === "preview" ? "preview" : pending.isBookingPack ? "documents" : "input",
  };
}

function continueTripDraftPending() {
  const target = tripDraftAiState.resumeMode === "preview" && tripDraftAiState.draft ? "preview" : "input";
  const input = $("#tripDraftTextInput");
  if (input) input.value = tripDraftAiState.sourceText;
  tripDraftAiState = { ...tripDraftAiState, mode: target };
  if (target === "preview") renderTripDraftPreview(tripDraftAiState.draft);
  renderTripDraftAiSheet();
}

function restartTripDraftPending() {
  if (!window.confirm(tripDraftT("resume.confirm.restart"))) return;
  clearTripDraftPending();
  tripDraftAiState = createEmptyTripDraftAiState();
  const input = $("#tripDraftTextInput");
  if (input) input.value = "";
  setTripDraftAiStatus("");
  renderTripDraftPreview(null);
  renderTripDraftAiSheet();
}

function openTripDraftAiSheet() {
  const pending = readTripDraftPending();
  tripDraftAiState = createEmptyTripDraftAiState();
  const input = $("#tripDraftTextInput");
  if (input) input.value = "";
  setTripDraftAiStatus("");
  renderTripDraftPreview(null);
  if (pending) restoreTripDraftPending(pending);
  renderTripDraftAiSheet();
  openSheet("tripDraftAiSheet");
  trackEvent("trip_create_sheet_opened", { creation_source: "home" });
}

function startTripDraftTextMode(mode = "text") {
  if (!TRIP_DRAFT_AI_ENABLED) return;
  tripDraftAiState = { ...tripDraftAiState, mode: "input", inputMode: mode, draft: null, isCreating: false };
  setTripDraftAiStatus(mode === "voice" ? tripDraftT("voice.hint") : "");
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

function getTripDraftRecordingOptions() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
  ];
  const mimeType = candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type));
  return mimeType ? { mimeType } : {};
}

async function toggleTripDraftRecording() {
  if (!TRIP_DRAFT_AI_ENABLED) return;
  if (tripDraftAiState.isRecording && tripDraftAiState.mediaRecorder) {
    tripDraftAiState.mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setTripDraftAiStatus(tripDraftT("voice.unsupported"), true);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, getTripDraftRecordingOptions());
    tripDraftAiState = { ...tripDraftAiState, mediaRecorder: recorder, chunks: [], isRecording: true };
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) tripDraftAiState.chunks.push(event.data);
    });
    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      tripDraftAiState = { ...tripDraftAiState, isRecording: false, mediaRecorder: null, isBusy: true };
      renderTripDraftAiSheet();
      setTripDraftAiStatus(tripDraftT("voice.transcribing"));
      try {
        const blob = new Blob(tripDraftAiState.chunks, { type: recorder.mimeType || "audio/webm" });
        const audioDataUrl = await blobToDataUrl(blob);
        const payload = await callTripDraftAiFunction("transcribe", { audioDataUrl });
        const input = $("#tripDraftTextInput");
        if (input) input.value = [input.value.trim(), payload.text || ""].filter(Boolean).join(input.value.trim() ? "\n\n" : "");
        tripDraftAiState = { ...tripDraftAiState, inputMode: "voice" };
        setTripDraftAiStatus(tripDraftT("voice.ready"));
        // A dictated minute is the most expensive thing to lose, so it is persisted at once.
        saveTripDraftPending();
        trackEvent("trip_draft_voice_transcribed", { ok: true });
      } catch (error) {
        const message = error.message === "invalid_audio"
          ? tripDraftT("voice.invalid")
          : tripDraftT("voice.error");
        setTripDraftAiStatus(message, true);
        trackEvent("trip_draft_voice_transcribed", { ok: false, error_reason_bucket: error.message === "invalid_audio" ? "invalid_audio" : "unknown" });
      } finally {
        tripDraftAiState = { ...tripDraftAiState, isBusy: false, chunks: [] };
        renderTripDraftAiSheet();
      }
    });
    recorder.start();
    setTripDraftAiStatus(tripDraftT("voice.listening"));
    renderTripDraftAiSheet();
  } catch {
    setTripDraftAiStatus(tripDraftT("voice.microphone.error"), true);
  }
}

function normalizeTripDraftItemType(type = "") {
  const value = String(type || "").toLowerCase();
  return itemTypes.some(([key]) => key === value) ? value : "idea";
}

function isTransportTicketText(value = "") {
  return /(?:^|[^\p{L}\p{N}])(самолет|самолёт|авиа|аэро|рейс|перел[её]т|поезд|электричк|автобус|трансфер|такси|метро|трамва|паром|катер|теплоход|машин|авто|аренд|вокзал|аэропорт)/iu.test(String(value || ""));
}

function normalizeTripDraftItemTypeForItem(item = {}) {
  const rawType = String(item.type || "").toLowerCase();
  const titleAndNotes = `${item.title || ""} ${item.notes || ""} ${item.locationText || ""}`;
  if (["plane", "flight", "train", "bus", "car", "taxi", "transfer", "ferry", "boat", "transport"].includes(rawType)) {
    return "transport";
  }
  if (rawType === "ticket") {
    return isTransportTicketText(titleAndNotes) ? "transport" : "idea";
  }
  return normalizeTripDraftItemType(rawType);
}

function normalizeTripDraftDate(value = "") {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(`${raw}T12:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return "";
  }
  return raw;
}

function normalizeTripDraftTime(value = "") {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function normalizeTripDraftDatePrecision(value = "", startDate = "", endDate = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "approximate") return startDate || endDate ? "approximate" : "none";
  if (normalized === "exact") return startDate || endDate ? "exact" : "none";
  return startDate || endDate ? "exact" : "none";
}

function extractApproximateDateSourceText(text = "") {
  const month = "(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)";
  const period = "(?:(?:перв(?:ой|ую)|втор(?:ой|ую))\\s+половин[аеу]|середин[аеу]|конц[аеу]|начал[аеу])";
  const duration = "(?:\\s+на\\s+(?:(?:\\d{1,2}\\s*[-–—]\\s*)?\\d{1,2}\\s*(?:день|дня|дней|дн(?:я|ей|\\.)?|недел[юияь])|неделю))?";
  const match = String(text || "").match(new RegExp(`(?:в|во)\\s+${period}\\s+${month}${duration}`, "iu"));
  return match ? match[0].trim().slice(0, 160) : "";
}

function extractTripDayCountFromSourceText(text = "") {
  const source = String(text || "").toLowerCase();
  const dayWord = "(?:день|дня|дней|дн(?:я|ей|\\.)?)";
  const rangeMatch = source.match(new RegExp(`(?:на\\s*)?(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s*${dayWord}`, "iu"));
  if (rangeMatch) {
    return normalizeTripDayCount(Math.max(Number(rangeMatch[1]), Number(rangeMatch[2])), 0);
  }
  const singleMatch = source.match(new RegExp(`(?:на\\s*)?(\\d{1,2})\\s*${dayWord}`, "iu"));
  if (singleMatch) {
    return normalizeTripDayCount(Number(singleMatch[1]), 0);
  }
  const weekMatch = source.match(/(?:^|[^\p{L}\p{N}])(?:на\s*)?(?:неделю|1\s*недел[юяи])(?:$|[^\p{L}\p{N}])/iu);
  if (weekMatch) return 7;
  const weekRangeMatch = source.match(/(?:^|[^\p{L}\p{N}])(?:на\s*)?(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*недел[юияь](?:$|[^\p{L}\p{N}])/iu);
  if (weekRangeMatch) {
    return normalizeTripDayCount(Math.max(Number(weekRangeMatch[1]), Number(weekRangeMatch[2])) * 7, 0);
  }
  const weekSingleMatch = source.match(/(?:^|[^\p{L}\p{N}])(?:на\s*)?(\d{1,2})\s*недел[юияь](?:$|[^\p{L}\p{N}])/iu);
  if (weekSingleMatch) {
    return normalizeTripDayCount(Number(weekSingleMatch[1]) * 7, 0);
  }
  return 0;
}

function getMaxTripDraftDayIndex(items = []) {
  return items.reduce((max, item) => {
    const dayIndex = normalizeTripDayCount(item?.dayIndex, 0);
    const dateIndex = getVirtualDayIndex(item?.date || "");
    return Math.max(max, dayIndex, dateIndex);
  }, 0);
}

function getTripDraftDateFromDayIndex(startDate = "", dayIndex = 0) {
  const start = normalizeTripDraftDate(startDate);
  const index = normalizeTripDayCount(dayIndex, 0);
  if (!start || index <= 0) return "";
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + index - 1);
  return date.toISOString().slice(0, 10);
}

// The traveller's own calendar day, not UTC: near midnight those differ, and this value
// is what the model uses to resolve "в октябре" to a year.
function getClientTodayIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTripDraftAiCore() {
  return window.BackpackerTripDraftAiCore;
}

// applyGuardrails must stay off when re-normalizing the preview form: those values are the
// traveller's own edits, and grounding them against the original description would erase
// every price and budget they typed by hand.
function normalizeTripDraftResponse(payload = {}, sourceText = "", { applyGuardrails = true, applyChronology = applyGuardrails } = {}) {
  const core = getTripDraftAiCore();
  const rawDraft = payload.draft || payload;
  // Re-run the guardrails on the client: the server already applied them, but the draft
  // must not depend on trusting the response over the wire.
  const draft = applyGuardrails ? (core?.applyDraftGuardrails?.(rawDraft, sourceText) || rawDraft) : rawDraft;
  const trip = draft.trip || {};
  const startDate = normalizeTripDraftDate(trip.startDate);
  const endDate = normalizeTripDraftDate(trip.endDate);
  const items = Array.isArray(draft.items) ? draft.items : [];
  const modelDayCount = normalizeTripDayCount(trip.dayCount, 0);
  const sourceDayCount = extractTripDayCountFromSourceText(sourceText);
  const maxItemDayIndex = getMaxTripDraftDayIndex(items);
  const dayCount = startDate || endDate
    ? getTripDayCount({ startDate, endDate })
    : Math.max(1, modelDayCount, sourceDayCount, maxItemDayIndex);
  const approximateDateSourceText = extractApproximateDateSourceText(sourceText);
  const datePrecision = approximateDateSourceText && (startDate || endDate)
    ? "approximate"
    : normalizeTripDraftDatePrecision(trip.datePrecision, startDate, endDate);
  const dateSourceText = datePrecision === "approximate" ? String(trip.dateSourceText || approximateDateSourceText || "").trim().slice(0, 160) : "";
  // Chronology settles every card's day from the traveller's own signals before the mapping
  // below consumes dayIndex. Skipped for preview edits, where the day is the user's choice.
  const chronology = applyChronology && core?.applyTripChronology
    ? core.applyTripChronology({ items, questions: draft.questions, trip: { startDate, endDate, dayCount }, locale: getTripDraftLocale() })
    : { items, questions: draft.questions };
  const scheduledItems = Array.isArray(chronology.items) ? chronology.items : items;
  const questions = Array.isArray(chronology.questions) ? chronology.questions.filter(Boolean).slice(0, 5) : [];
  const normalizedItems = scheduledItems.slice(0, 80).map((item, index) => {
    const fallbackTitle = tripDraftT("preview.item.default", { number: index + 1 });
    return {
      title: String(item.title || fallbackTitle).trim().slice(0, 120) || fallbackTitle,
      type: normalizeTripDraftItemTypeForItem(item),
      status: statuses.some(([key]) => key === item.status) ? item.status : DEFAULT_ITEM_STATUS,
      priority: priorities.some(([key]) => key === item.priority) ? item.priority : DEFAULT_ITEM_PRIORITY,
      date: normalizeTripDraftItemDate(item.date, { startDate, endDate, dayCount }),
      startTime: normalizeTripDraftTime(item.startTime),
      durationMinutes: Math.max(0, Math.min(1440, parseMoney(item.durationMinutes))),
      price: Math.max(0, parseMoney(item.price)),
      priceConfidence: core?.normalizePriceConfidence?.(item.priceConfidence) || "unknown",
      priceSourceText: String(item.priceSourceText || "").trim().slice(0, 160),
      // Booking Pack fields travel with the draft so the preview can show the quote and the
      // confirmation step can bind files. They are dropped when a TripItem is created.
      evidenceText: String(item.evidenceText || "").trim().slice(0, core?.BOOKING_PACK_MAX_EVIDENCE_CHARS || 160),
      documentCurrency: core?.normalizeDocumentCurrency?.(item.documentCurrency) || "",
      priceKind: core?.PRICE_KIND_VALUES?.includes(item.priceKind) ? item.priceKind : "",
      sourceFileIds: Array.isArray(item.sourceFileIds) ? item.sourceFileIds.filter(Boolean) : [],
      sourcePage: Number.isFinite(Number(item.sourcePage)) ? Math.trunc(Number(item.sourcePage)) : null,
      paidAmount: 0,
      link: String(item.link || "").trim().slice(0, 500),
      locationText: String(item.locationText || "").trim().slice(0, 160),
      notes: String(item.notes || "").trim().slice(0, 1000),
    };
  });
  const quantityAdjustedItems = window.BackpackerTripDraftQuantities?.applyExplicitItemQuantities?.(
    sourceText,
    normalizedItems,
    { contextText: trip.destination, maxItems: 80 },
  ) || normalizedItems;
  return {
    trip: {
      title: String(trip.title || tripDraftT("preview.trip.default")).trim().slice(0, 80) || tripDraftT("preview.trip.default"),
      destination: String(trip.destination || "").trim().slice(0, 120),
      startDate,
      endDate: startDate && endDate && endDate < startDate ? startDate : endDate,
      dayCount,
      datePrecision,
      dateSourceText,
      currency: getSupportedCurrencies().includes(trip.currency) ? trip.currency : "RUB",
      budgetLimit: parseMoney(trip.budgetLimit),
      // A level is never derived from the sum and a sum is never derived from the level:
      // whichever the traveller did not say stays empty.
      budgetLevel: core?.normalizeBudgetLevel?.(trip.budgetLevel) || "unknown",
      budgetSourceText: String(trip.budgetSourceText || "").trim().slice(0, 160),
      preferencesText: String(trip.preferencesText || "").trim().slice(0, 4000),
    },
    items: quantityAdjustedItems,
    questions,
  };
}

function renderTripDraftOptionList(options, selectedValue) {
  return options.map(([value, label]) => `<option value="${escapeAttr(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function getTripDraftBudgetLevelLabel(level) {
  const normalized = ["low", "medium", "high"].includes(level) ? level : "unknown";
  return tripDraftT(`preview.budget.level.${normalized}`);
}

function renderTripDraftBudgetLevelOptions(selectedValue) {
  return ["unknown", "low", "medium", "high"]
    .map((value) => `<option value="${escapeAttr(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(getTripDraftBudgetLevelLabel(value))}</option>`)
    .join("");
}

// The level and the sum are independent claims. Neither is inferred from the other, so the
// note only reports what the traveller actually said.
function renderTripDraftBudgetNote(trip = {}) {
  if (trip.budgetLevel === "unknown" && !trip.budgetLimit) return "";
  const parts = [];
  if (trip.budgetLevel && trip.budgetLevel !== "unknown") {
    parts.push(tripDraftT("preview.budget.part.level", { level: getTripDraftBudgetLevelLabel(trip.budgetLevel) }));
  }
  if (trip.budgetLimit) parts.push(tripDraftT("preview.budget.part.amount"));
  const formattedParts = new Intl.ListFormat(getTripDraftLocale(), { style: "long", type: "conjunction" }).format(parts);
  const source = trip.budgetSourceText ? tripDraftT("preview.budget.source", { text: trip.budgetSourceText }) : "";
  return `<p class="trip-draft-budget-note">${escapeHtml(tripDraftT("preview.budget.summary", { parts: formattedParts, source }))}</p>`;
}

function renderTripDraftPriceNote(item = {}, tripCurrency = "") {
  const core = getBookingPackCore();
  // A number is only meaningful in its own currency. Converting it would invent a fact, so
  // the amount stays visible and explicitly out of the budget.
  if (item.documentCurrency && !core?.isBookingPackPriceBudgetEligible?.(item, tripCurrency)) {
    const heading = tripDraftT("preview.price.currency.mismatch", { documentCurrency: item.documentCurrency, tripCurrency });
    const evidence = item.evidenceText ? tripDraftT("preview.price.document.source", { text: item.evidenceText }) : "";
    return `<p class="trip-draft-price-note is-mismatch"><strong>${escapeHtml(heading)}</strong>${escapeHtml(tripDraftT("preview.price.currency.hint"))}${escapeHtml(evidence)}</p>`;
  }
  // A value read out of the traveller's own document: shown with its quote so they can
  // check it against the file. Until they press create it is extracted, not confirmed.
  if (item.evidenceText) {
    return `<p class="trip-draft-price-note is-extracted"><strong>${escapeHtml(tripDraftT("preview.price.document"))}</strong>${escapeHtml(tripDraftT("preview.price.document.source", { text: item.evidenceText }))}</p>`;
  }
  if (item.priceConfidence === "estimate" && item.priceSourceText) {
    return `<p class="trip-draft-price-note is-estimate">${escapeHtml(tripDraftT("preview.price.estimate", { text: item.priceSourceText }))}</p>`;
  }
  if (item.priceConfidence === "unknown") {
    return `<p class="trip-draft-price-note">${escapeHtml(tripDraftT("preview.price.unknown"))}</p>`;
  }
  return "";
}

function renderTripDraftCurrencyOptions(selectedValue) {
  return getSupportedCurrencies()
    .map((currency) => `<option value="${escapeAttr(currency)}"${currency === selectedValue ? " selected" : ""}>${escapeHtml(currency)}</option>`)
    .join("");
}

function renderTripDraftDayField(draft, item) {
  if (!draft.trip.startDate && !draft.trip.endDate && draft.trip.dayCount > 0) {
    const options = [
      `<option value="">${escapeHtml(tripDraftT("preview.day.unscheduled"))}</option>`,
      ...Array.from({ length: normalizeTripDayCount(draft.trip.dayCount) }, (_, index) => {
        const value = createVirtualDayDate(index + 1);
        return `<option value="${escapeAttr(value)}"${item.date === value ? " selected" : ""}>${escapeHtml(tripDraftT("preview.day.number", { number: index + 1 }))}</option>`;
      }),
    ].join("");
    return `<label class="field">${escapeHtml(tripDraftT("preview.field.day"))}<select data-draft-item-field="date">${options}</select></label>`;
  }
  return `<label class="field">${escapeHtml(tripDraftT("preview.field.day"))}<input type="date" data-draft-item-field="date" value="${escapeAttr(item.date)}" /></label>`;
}

function normalizeTripDraftItemDate(value = "", trip = {}) {
  const raw = String(value || "").trim();
  if (isVirtualDayDate(raw) && !trip.startDate && !trip.endDate && getVirtualDayIndex(raw) <= normalizeTripDayCount(trip.dayCount)) {
    return raw;
  }
  return normalizeTripDraftDate(raw);
}

function renderTripDraftPreview(draft) {
  const box = $("#tripDraftPreviewBox");
  if (!box) return;
  if (!draft) {
    box.innerHTML = "";
    return;
  }
  const sourceText = tripDraftAiState.sourceText || $("#tripDraftTextInput")?.value || "";
  const localizedItemTypes = itemTypes.map(([value]) => [value, getPlanTypeLabel(value)]);
  const approximateDateNote = draft.trip.datePrecision === "approximate"
    ? `<p class="trip-draft-date-note"><strong>${escapeHtml(tripDraftT("preview.date.approximate"))}</strong>${draft.trip.dateSourceText ? escapeHtml(tripDraftT("preview.date.source", { text: draft.trip.dateSourceText })) : ""}${escapeHtml(tripDraftT("preview.date.hint"))}</p>`
    : "";
  box.innerHTML = `
    <article class="trip-draft-preview-card">
      <h3>${escapeHtml(tripDraftT("preview.trip"))}</h3>
      <div class="trip-draft-field-grid">
        <label class="field">${escapeHtml(tripDraftT("preview.field.title"))}<input data-draft-trip-field="title" value="${escapeAttr(draft.trip.title)}" /></label>
        <label class="field">${escapeHtml(tripDraftT("preview.field.destination"))}<input data-draft-trip-field="destination" value="${escapeAttr(draft.trip.destination)}" /></label>
        <label class="field">${escapeHtml(tripDraftT("preview.field.start"))}<input type="date" data-draft-trip-field="startDate" value="${escapeAttr(draft.trip.startDate)}" /></label>
        <label class="field">${escapeHtml(tripDraftT("preview.field.end"))}<input type="date" data-draft-trip-field="endDate" value="${escapeAttr(draft.trip.endDate)}" /></label>
        <label class="field">${escapeHtml(tripDraftT("preview.field.currency"))}<select data-draft-trip-field="currency">${renderTripDraftCurrencyOptions(draft.trip.currency)}</select></label>
        <label class="field">${escapeHtml(tripDraftT("preview.field.budget"))}<input inputmode="numeric" data-draft-trip-field="budgetLimit" value="${escapeAttr(draft.trip.budgetLimit ? draft.trip.budgetLimit : "")}" /></label>
        <label class="field">${escapeHtml(tripDraftT("preview.field.budget.level"))}<select data-draft-trip-field="budgetLevel">${renderTripDraftBudgetLevelOptions(draft.trip.budgetLevel)}</select></label>
      </div>
      ${renderTripDraftBudgetNote(draft.trip)}
      ${approximateDateNote}
      <label class="field wide trip-draft-preferences-field">${escapeHtml(tripDraftT("preview.field.preferences"))}<textarea rows="4" data-draft-trip-field="preferencesText">${escapeHtml(draft.trip.preferencesText || "")}</textarea></label>
    </article>
    <details class="trip-draft-source">
      <summary>${escapeHtml(tripDraftT("preview.source"))}</summary>
      <textarea id="tripDraftPreviewSourceText" rows="5">${escapeHtml(sourceText)}</textarea>
      <div class="trip-draft-source-actions">
        <button class="ghost-button compact" type="button" data-trip-draft-action="edit-source">${escapeHtml(tripDraftT("preview.source.edit"))}</button>
        <button class="ghost-button compact" type="button" data-trip-draft-action="rebuild">${escapeHtml(tripDraftT("preview.rebuild"))}</button>
      </div>
    </details>
    <article class="trip-draft-preview-card">
      <h3>${escapeHtml(tripDraftT("preview.items"))}</h3>
      <div class="trip-draft-items-editor">
        ${draft.items.length ? draft.items.map((item, index) => `
          <section class="trip-draft-item-editor" data-draft-item-index="${index}">
            <div class="trip-draft-item-header">
              <strong>${escapeHtml(item.title || tripDraftT("preview.item.default", { number: index + 1 }))}</strong>
              <button class="ghost-button compact" type="button" data-trip-draft-action="delete-item" data-draft-item-index="${index}">${escapeHtml(tripDraftT("preview.item.delete"))}</button>
            </div>
            <label class="field wide">${escapeHtml(tripDraftT("preview.field.title"))}<input data-draft-item-field="title" value="${escapeAttr(item.title)}" /></label>
            <div class="trip-draft-field-grid">
              <label class="field">${escapeHtml(tripDraftT("preview.field.type"))}<select data-draft-item-field="type">${renderTripDraftOptionList(localizedItemTypes, item.type)}</select></label>
              ${renderTripDraftDayField(draft, item)}
              <label class="field">${escapeHtml(tripDraftT("preview.field.time"))}<input type="time" data-draft-item-field="startTime" value="${escapeAttr(item.startTime)}" /></label>
              <label class="field">${escapeHtml(tripDraftT("preview.field.price"))}<input inputmode="numeric" data-draft-item-field="price" value="${escapeAttr(item.price ? item.price : "")}" placeholder="${escapeAttr(item.priceConfidence === "unknown" ? tripDraftT("preview.field.price.placeholder") : "")}" /></label>
            </div>
            ${renderTripDraftPriceNote(item, draft.trip.currency)}
            <label class="field wide">${escapeHtml(tripDraftT("preview.field.notes"))}<textarea rows="3" data-draft-item-field="notes">${escapeHtml(item.notes || "")}</textarea></label>
          </section>
        `).join("") : `<p>${escapeHtml(tripDraftT("preview.items.empty"))}</p>`}
      </div>
    </article>
    ${draft.questions.length ? `<article class="trip-draft-preview-card"><h3>${escapeHtml(tripDraftT("preview.questions"))}</h3><ul>${draft.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></article>` : ""}
  `;
}

function collectTripDraftPreviewForm() {
  const box = $("#tripDraftPreviewBox");
  const current = tripDraftAiState.draft;
  if (!box || !current) return null;
  const sourceTextForPreview = tripDraftAiState.sourceText || "";
  const readTripField = (field) => box.querySelector(`[data-draft-trip-field="${field}"]`)?.value || "";
  const nextStartDate = readTripField("startDate");
  const nextEndDate = readTripField("endDate");
  const dateRangeChanged = nextStartDate !== (current.trip.startDate || "") || nextEndDate !== (current.trip.endDate || "");
  const items = Array.from(box.querySelectorAll(".trip-draft-item-editor[data-draft-item-index]")).map((container, index) => {
    const original = current.items[index] || {};
    const readItemField = (field) => container.querySelector(`[data-draft-item-field="${field}"]`)?.value || "";
    const nextPrice = Math.max(0, parseMoney(readItemField("price")));
    // A price the traveller typed is theirs, so it becomes confirmed. Clearing the field
    // returns the card to "unknown" rather than asserting the event is free.
    const priceChanged = nextPrice !== Math.max(0, parseMoney(original.price));
    const priceConfidence = !nextPrice ? "unknown" : priceChanged ? "confirmed" : (original.priceConfidence || "confirmed");
    return {
      ...original,
      title: readItemField("title").trim() || original.title || tripDraftT("preview.item.default", { number: index + 1 }),
      type: normalizeTripDraftItemType(readItemField("type") || original.type),
      date: normalizeTripDraftItemDate(readItemField("date"), current.trip),
      startTime: normalizeTripDraftTime(readItemField("startTime")),
      price: nextPrice,
      priceConfidence,
      priceSourceText: priceConfidence === "estimate" ? original.priceSourceText || "" : "",
      notes: readItemField("notes").trim().slice(0, 1000),
      paidAmount: 0,
    };
  });
  return normalizeTripDraftResponse({
    draft: {
      trip: {
        title: readTripField("title").trim(),
        destination: readTripField("destination").trim(),
        startDate: nextStartDate,
        endDate: nextEndDate,
        dayCount: current.trip.dayCount,
        datePrecision: dateRangeChanged ? "exact" : current.trip.datePrecision,
        dateSourceText: dateRangeChanged ? "" : current.trip.dateSourceText,
        currency: readTripField("currency") || "RUB",
        budgetLimit: readTripField("budgetLimit"),
        budgetLevel: readTripField("budgetLevel") || "unknown",
        budgetSourceText: current.trip.budgetSourceText || "",
        preferencesText: readTripField("preferencesText").trim(),
      },
      items,
      questions: current.questions || [],
    },
  }, sourceTextForPreview, { applyGuardrails: false });
}

function syncTripDraftPreviewStateFromForm() {
  const nextDraft = collectTripDraftPreviewForm();
  if (!nextDraft) return null;
  tripDraftAiState = { ...tripDraftAiState, draft: nextDraft };
  saveTripDraftPending();
  return nextDraft;
}

function handleTripDraftPreviewAction(event) {
  const actionButton = event.target.closest("[data-trip-draft-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.tripDraftAction;
  if (action === "delete-item") {
    const draft = syncTripDraftPreviewStateFromForm();
    const index = Number(actionButton.dataset.draftItemIndex);
    if (!draft || Number.isNaN(index)) return;
    draft.items.splice(index, 1);
    tripDraftAiState = { ...tripDraftAiState, draft };
    renderTripDraftPreview(draft);
    return;
  }
  if (action === "edit-source") {
    const sourceText = $("#tripDraftPreviewSourceText")?.value ?? tripDraftAiState.sourceText;
    const input = $("#tripDraftTextInput");
    if (input) input.value = sourceText;
    tripDraftAiState = { ...tripDraftAiState, mode: "input", sourceText };
    renderTripDraftAiSheet();
    return;
  }
  if (action === "rebuild") {
    const sourceText = $("#tripDraftPreviewSourceText")?.value.trim() || "";
    if (!sourceText) {
      setTripDraftAiStatus(tripDraftT("input.validation.required"), true);
      return;
    }
    if (tripDraftAiState.draft && !window.confirm(tripDraftT("input.confirm.rebuild"))) return;
    const input = $("#tripDraftTextInput");
    if (input) input.value = sourceText;
    tripDraftAiState = { ...tripDraftAiState, mode: "input", sourceText };
    parseTripDraftText();
  }
}

async function parseTripDraftText() {
  if (!TRIP_DRAFT_AI_ENABLED) return;
  if (tripDraftAiState.isBusy) return;
  const input = $("#tripDraftTextInput");
  const text = input?.value.trim() || "";
  if (!text) {
    setTripDraftAiStatus(tripDraftT("input.validation.required"), true);
    input?.focus();
    return;
  }
  // Flush before the async call: isBusy blocks saving, so a debounce still in flight
  // would otherwise drop the traveller's last edit.
  tripDraftAiState = { ...tripDraftAiState, sourceText: text };
  flushTripDraftPendingSave();
  tripDraftAiState = { ...tripDraftAiState, isBusy: true, sourceText: text };
  setTripDraftAiStatus(tripDraftT("input.status.parsing"));
  renderTripDraftAiSheet();
  trackEvent("trip_draft_ai_generation_started", { mode: tripDraftAiState.inputMode === "voice" ? "voice" : "text" });
  try {
    const payload = await callTripDraftAiFunction("parse", {
      text,
      schemaVersion: TRIP_DRAFT_AI_SCHEMA_VERSION,
      // The model has no reliable notion of today, so the client states it.
      today: getClientTodayIsoDate(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    });
    const draft = normalizeTripDraftResponse(payload, text);
    tripDraftAiState = { ...tripDraftAiState, isBusy: false, mode: "preview", draft, sourceText: text };
    saveTripDraftPending();
    renderTripDraftPreview(draft);
    setTripDraftAiStatus("");
    renderTripDraftAiSheet();
    trackEvent("trip_draft_ai_generation_completed", { mode: tripDraftAiState.inputMode === "voice" ? "voice" : "text", result: "success" });
  } catch (error) {
    tripDraftAiState = { ...tripDraftAiState, isBusy: false };
    setTripDraftAiStatus(error.message === "supabase_not_configured" ? tripDraftT("input.error.unavailable") : tripDraftT("input.error.parse"), true);
    renderTripDraftAiSheet();
    trackEvent("trip_draft_ai_generation_failed", { mode: tripDraftAiState.inputMode === "voice" ? "voice" : "text", result: "failed", error_reason_bucket: error.message === "supabase_not_configured" ? "network" : "unknown" });
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
      dayCount: normalizeTripDayCount(draft.trip.dayCount, getTripDayCount(draft.trip)),
      datePrecision: draft.trip.datePrecision,
      dateSourceText: draft.trip.dateSourceText,
      currency: draft.trip.currency,
      budgetLimit: draft.trip.budgetLimit,
      budgetLevel: draft.trip.budgetLevel,
      budgetSourceText: draft.trip.budgetSourceText,
      preferencesText: draft.trip.preferencesText,
      aiSourceText: String(tripDraftAiState.sourceText || "").trim(),
      participants: [selfParticipant],
    },
    items: draft.items.map((item, index) => {
      const order = orderByDate.get(item.date || "") || 0;
      orderByDate.set(item.date || "", order + 1);
      // A document priced in another currency never contributes a number: converting would
      // invent a fact, and writing it as-is would state the wrong one.
      const priceConfidence = getBookingPackCore()?.resolveConfirmedPriceConfidence?.(item, draft.trip.currency)
        || item.priceConfidence;
      const price = priceConfidence === "unknown" ? 0 : item.price;
      return {
        id: `item-${Date.now()}-${index}`,
        title: item.title,
        type: item.type,
        status: item.status,
        priority: item.priority,
        date: item.date,
        startTime: item.startTime,
        durationMinutes: item.durationMinutes,
        price,
        // An unknown price is not a free event: it carries no allocation, so it never
        // enters the budget as a confirmed zero. Pressing create is also what turns a value
        // extracted from a document into a confirmed one; the quote behind it is dropped.
        priceConfidence,
        priceSourceText: item.priceKind ? "" : item.priceSourceText,
        paidAmount: item.paidAmount,
        participantId: selfParticipant.id,
        allocations: priceConfidence !== "unknown" && price > 0
          ? [{ participantId: selfParticipant.id, amount: price }]
          : [],
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

// Uploads never abort the batch: one bad file must not silently swallow the rest, and the
// trip already exists by this point. Failures are reported and retryable in place.
async function attachBookingPackDocuments(entry, draft, skippedCount = 0) {
  const byId = new Map(tripDraftAiState.bookingPackFiles.filter((file) => file.file).map((file) => [file.sourceFileId, file]));
  const jobs = [];
  draft.items.forEach((item, index) => {
    const tripItem = entry.state.items[index];
    if (!tripItem) return;
    (item.sourceFileIds || []).forEach((sourceFileId) => {
      const pack = byId.get(sourceFileId);
      // One document can back several cards, so it is attached to each of them.
      if (pack) jobs.push({ tripItemId: tripItem.id, file: pack.file, fileName: pack.fileName });
    });
  });
  if (!jobs.length) {
    showToast(skippedCount
      ? tripDraftT("toast.created.attachments.skipped", { count: skippedCount })
      : tripDraftT("toast.created"));
    return;
  }

  showToast(tripDraftT("toast.attachments.uploading"));
  const failed = [];
  try {
    await ensureSupabaseOwnerSession();
    for (const job of jobs) {
      try {
        await getTripItemAttachmentsClientApi().uploadTripItemAttachment(
          getSupabaseClient(),
          { tripId: entry.id, tripItemId: job.tripItemId },
          job.file,
        );
      } catch {
        failed.push(job);
      }
    }
  } catch {
    jobs.forEach((job) => failed.push(job));
  }

  bookingPackFailedUploads = failed.map((job) => ({ ...job, tripId: entry.id }));
  renderBookingPackUploadNotice();
  const total = failed.length + skippedCount;
  if (!total) showToast(tripDraftT("toast.attachments.done"));
  else showToast(tripDraftT("toast.attachments.failed", { count: total }));
}

async function retryBookingPackUploads() {
  if (!bookingPackFailedUploads.length) return;
  const pending = [...bookingPackFailedUploads];
  const failed = [];
  try {
    await ensureSupabaseOwnerSession();
    for (const job of pending) {
      try {
        await getTripItemAttachmentsClientApi().uploadTripItemAttachment(
          getSupabaseClient(),
          { tripId: job.tripId, tripItemId: job.tripItemId },
          job.file,
        );
      } catch {
        failed.push(job);
      }
    }
  } catch {
    pending.forEach((job) => failed.push(job));
  }
  bookingPackFailedUploads = failed;
  renderBookingPackUploadNotice();
  showToast(failed.length
    ? tripDraftT("toast.attachments.retry.failed", { count: failed.length })
    : tripDraftT("toast.attachments.retry.done"));
}

function renderBookingPackUploadNotice() {
  const notice = $("#bookingPackUploadNotice");
  if (!notice) return;
  const count = bookingPackFailedUploads.length;
  notice.classList.toggle("hidden", count === 0);
  if (!count) return;
  const names = bookingPackFailedUploads.map((job) => job.fileName).join(", ");
  $("#bookingPackUploadSummary").textContent = tripDraftT("attachments.notice", { count, names });
}

async function createTripFromAiDraft() {
  if (!tripDraftAiState.draft || tripDraftAiState.isCreating) return;
  const previewSourceText = $("#tripDraftPreviewSourceText")?.value.trim();
  if (typeof previewSourceText === "string" && previewSourceText !== String(tripDraftAiState.sourceText || "").trim()) {
    setTripDraftAiStatus(tripDraftT("preview.error.source.changed"), true);
    return;
  }
  const draft = syncTripDraftPreviewStateFromForm();
  if (!draft) return;
  // A restored Booking Pack may have lost its files. The trip is never blocked forever:
  // the traveller either goes back for the files or creates the trip without them.
  const missingFiles = tripDraftAiState.isBookingPack ? getBookingPackMissingFiles() : [];
  if (missingFiles.length) {
    const names = missingFiles.map((entry) => entry.fileName).join(", ");
    const proceed = window.confirm(tripDraftT("preview.confirm.missing.files", { count: missingFiles.length, names }));
    if (!proceed) {
      tripDraftAiState = { ...tripDraftAiState, mode: "documents" };
      setTripDraftAiStatus(tripDraftT("preview.missing.files.back"));
      renderTripDraftAiSheet();
      return;
    }
  }
  tripDraftAiState = { ...tripDraftAiState, isCreating: true, draft };
  renderTripDraftAiSheet();
  try {
    const entry = createTripEntryFromDraft(draft);
    tripStore.trips.push(entry);
    persistTripStore(tripStore);
    // The draft became a real trip, so the protected copy has nothing left to protect.
    clearTripDraftPending();
    closeSheet("tripDraftAiSheet");
    openTrip(entry.id);
    if (tripDraftAiState.isBookingPack) await attachBookingPackDocuments(entry, draft, missingFiles.length);
    else showToast(tripDraftT("toast.created"));
    trackEvent("trip_draft_ai_confirmed", { mode: tripDraftAiState.inputMode === "voice" ? "voice" : "text", result: "success" });
    trackEvent("trip_created", {
      ...getTripAnalyticsContext(entry.state.trip),
      trip_id: entry.id,
      trip_origin: "user_created",
      creation_source: "ai_draft",
      trip_count_after_create: getUserTripCount(),
      is_second_user_trip: getUserTripCount() >= 2,
    });
    entry.state.items.forEach((item) => {
      trackEvent("item_created", {
        ...getTripAnalyticsContext(entry.state.trip),
        item_id: item.id,
        ...getItemAnalyticsFlags(item),
        creation_source: "ai_draft",
      });
    });
    checkTripMilestones();
  } catch {
    tripDraftAiState = { ...tripDraftAiState, isCreating: false, draft };
    renderTripDraftAiSheet();
    setTripDraftAiStatus(tripDraftT("preview.error.create"), true);
    trackEvent("trip_draft_ai_generation_failed", { mode: tripDraftAiState.inputMode === "voice" ? "voice" : "text", result: "failed", error_reason_bucket: "save" });
  }
}

function createNewTrip(creationSource = "home") {
  const entry = createBlankTripEntry();
  entry.state.trip.title = window.t("trip.setup.default.title");
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
    showToast(window.t("home.trip.cover.updated"));
    trackEvent("trip_cover_updated", getTripAnalyticsContext(entry.state.trip));
  } catch {
    showToast(window.t("home.trip.cover.failed"));
  }
}

function deleteTrip(tripId) {
  const entry = tripStore.trips.find((trip) => trip.id === tripId);
  if (!entry || entry.isDemo) return;
  const title = entry.state.trip.title || window.t("home.trip.delete.fallback");
  if (!window.confirm(window.t("home.trip.delete.confirm", { title }))) return;

  queuePrivateTripDeletion(tripId);
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
  showToast(window.t("home.trip.deleted"));
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

// Позиция вставки считается по геометрии соседей, а не по тому, что оказалось
// под пальцем. Иначе живой предпросмотр невозможен: карточка встаёт на место
// падения, попадает под палец сама, и раскладка начинает колебаться между
// двумя положениями. Перетаскиваемая карточка из замера исключена — поэтому у
// раскладки есть единственное устойчивое состояние, к которому она сходится.
function getInsertionReference(zone, x, y) {
  const cards = [...zone.children].filter(
    (child) => child.dataset?.dragId && child.dataset.dragId !== draggedItemId,
  );
  return (
    cards.find((card) => {
      const rect = card.getBoundingClientRect();
      // Допуск в половину высоты: в ленте дня карточки в одну строку, и
      // правило сводится к сравнению по X; в сетке «Без даты» строки
      // сравниваются раньше горизонтали.
      if (y < rect.top) return true;
      if (y > rect.bottom) return false;
      return x < rect.left + rect.width / 2;
    }) || null
  );
}

function getDropDataFromPoint(x, y, fallbackTarget = null) {
  const zone = getDropZoneFromPoint(x, y, fallbackTarget);
  if (!zone) return null;
  const reference = getInsertionReference(zone, x, y);
  return {
    date: zone.dataset.dropDate || "",
    beforeItemId: reference?.dataset.dragId || null,
    zone,
  };
}

// Пустая лента дня заметно ниже ленты с карточками. Если увести карточку из
// её дня по-настоящему, день схлопывается, всё ниже подпрыгивает под пальцем
// и цель уезжает из-под него — ровно то, от чего страхует пункт 4 эталона.
// Поэтому исходное место остаётся занятым: габарит берётся у самой карточки
// мелким клоном, поэтому совпадает точно и переживёт правку её размеров.
function ensureOriginSlot(drag) {
  if (drag.originSlot) return drag.originSlot;
  const slot = drag.card.cloneNode(false);
  slot.removeAttribute("data-drag-id");
  slot.removeAttribute("draggable");
  slot.removeAttribute("id");
  slot.classList.remove("dragging-source");
  slot.classList.add("drag-origin-slot");
  drag.originSlot = slot;
  return slot;
}

// Карточка живьём встаёт туда, куда упадёт, и раздвигает соседей: результат
// виден до того, как палец отпущен. Двигается сама карточка, а не заглушка, —
// внутри одной ленты это и есть тот самый сдвиг соседа, без лишних объектов.
function previewDropPosition(drag, data) {
  if (!drag?.card || !data?.zone) return;
  const card = drag.card;
  const leavingOrigin = data.zone !== drag.originParent;
  if (leavingOrigin && !drag.originSlot?.isConnected && drag.originParent?.isConnected) {
    drag.originParent.insertBefore(ensureOriginSlot(drag), drag.originNext);
  }
  if (!leavingOrigin && drag.originSlot?.isConnected) drag.originSlot.remove();

  const reference = data.beforeItemId
    ? [...data.zone.children].find((child) => child.dataset?.dragId === data.beforeItemId)
    : null;
  if (reference) {
    if (reference.previousElementSibling !== card) data.zone.insertBefore(card, reference);
    return;
  }
  if (data.zone.lastElementChild !== card) data.zone.appendChild(card);
}

// Место-заглушка снимается при любом исходе: и когда карточка доехала, и
// когда перетаскивание отменили.
function clearOriginSlot(drag) {
  drag?.originSlot?.remove();
  if (drag) drag.originSlot = null;
}

// Падения не случилось — карточку надо вернуть туда, где она стояла. После
// успешного moveItem это лишнее: он перерисовывает список целиком.
function restoreDragOrigin(drag) {
  if (!drag?.card || !drag.originParent?.isConnected) return;
  drag.originParent.insertBefore(drag.card, drag.originNext);
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
  let desktopDrag = null;

  function cleanupDesktopDrag({ moved = false } = {}) {
    clearOriginSlot(desktopDrag);
    if (!moved) restoreDragOrigin(desktopDrag);
    desktopDrag = null;
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
    desktopDrag = { card, originParent: card.parentElement, originNext: card.nextElementSibling };
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
    if (data) {
      markDropZone(data.zone);
      previewDropPosition(desktopDrag, data);
    }
  });

  document.addEventListener("dragenter", (event) => {
    if (!draggedItemId) return;
    event.preventDefault();
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (data) {
      markDropZone(data.zone);
      previewDropPosition(desktopDrag, data);
    }
  });

  document.addEventListener("drop", (event) => {
    if (!draggedItemId) return;
    const data = getDropDataFromPoint(event.clientX, event.clientY, event.target);
    if (!data) return;
    event.preventDefault();
    moveItem(draggedItemId, data.date, data.beforeItemId, "drag_desktop");
    finishDragClickGuard();
    cleanupDesktopDrag({ moved: true });
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

    clearOriginSlot(drag);
    let moved = false;
    if (drop && drag.active && event) {
      const data = getDropDataFromPoint(event.clientX, event.clientY);
      if (data) {
        moveItem(drag.id, data.date, data.beforeItemId, "drag_touch");
        moved = true;
      }
      finishDragClickGuard();
    }
    if (!moved) restoreDragOrigin(drag);

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
      originParent: card.parentElement,
      originNext: card.nextElementSibling,
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
    if (data) {
      markDropZone(data.zone);
      previewDropPosition(pointerDrag, data);
    }
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

function bindLanguageSelector() {
  const select = $("#languageSelect");
  const i18n = window.BackpackerI18n;
  if (!select || !i18n) return;

  select.value = i18n.getPreference();
  select.addEventListener("change", () => {
    const previousPreference = i18n.getPreference();
    if (!i18n.setLocalePreference(select.value)) {
      select.value = previousPreference;
      return;
    }
    window.location.reload();
  });
}

function bindEvents() {
  bindLanguageSelector();
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
      if (isReadOnlyMode()) openItemProposalSheet().catch(() => showToast(window.t("share.proposal.item.open.error")));
      else openItemSheet();
      return;
    }

    const tripDraftResumeButton = event.target.closest("[data-trip-draft-resume]");
    if (tripDraftResumeButton) {
      event.preventDefault();
      event.stopPropagation();
      if (tripDraftResumeButton.dataset.tripDraftResume === "continue") continueTripDraftPending();
      else restartTripDraftPending();
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
      } else if (mode === "documents") {
        startTripDraftDocumentsMode();
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

    const ideaCollectionButton = event.target.closest("[data-idea-collection]");
    if (ideaCollectionButton) {
      ideasState.activeCollectionKey = ideaCollectionButton.dataset.ideaCollection || "all";
      renderIdeasScreen();
      return;
    }

    const ideaCardButton = event.target.closest("[data-open-idea]");
    if (ideaCardButton) {
      openIdeaSheet(ideaCardButton.dataset.openIdea || "");
      return;
    }

    if (event.target.closest("[data-ideas-retry]")) {
      loadTravelIdeas();
      return;
    }

    if (event.target.closest("[data-open-idea-form]")) {
      openIdeaSheet();
      return;
    }

    if (event.target.closest("[data-open-idea-collection-form]")) {
      openIdeaCollectionSheet();
      return;
    }

    const closeTarget = event.target.closest("[data-close]");
    if (closeTarget) {
      if (closeTarget.dataset.close === "item") {
        event.preventDefault();
        event.stopPropagation();
        dismissItemSheet("close");
        return;
      }
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
        showToast(window.t("share.proposal.expense.name.required"));
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

  document.addEventListener("error", (event) => {
    if (!event.target?.matches?.(".idea-thumb-image")) return;
    event.target.closest(".idea-card-thumb")?.classList.add("image-broken");
  }, true);

  $("#trainerTripCard").addEventListener("click", () => openTrip("trainer-kazan"));
  $("#trainerTripCard").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTrip("trainer-kazan");
    }
  });
  $("#createTripButton").addEventListener("click", openTripDraftAiSheet);
  $("#openIdeasButton")?.addEventListener("click", showIdeasScreen);
  $("#ideasBackButton")?.addEventListener("click", () => showHomeScreen("ideas_back"));
  $("#ideasFabAddButton")?.addEventListener("click", () => openIdeaSheet());
  $("#ideaForm")?.addEventListener("submit", submitIdeaForm);
  $("#ideaAddToTripButton")?.addEventListener("click", openTravelIdeaDestinationPicker);
  $("#ideaArchiveButton")?.addEventListener("click", archiveCurrentIdea);
  $("#ideaNewCollectionButton")?.addEventListener("click", openIdeaCollectionSheet);
  $("#ideaCollectionForm")?.addEventListener("submit", submitIdeaCollectionForm);
  $("#tripDraftBackButton")?.addEventListener("click", () => {
    if (tripDraftAiState.isRecording) return;
    tripDraftAiState = { ...tripDraftAiState, mode: "choice", draft: null };
    setTripDraftAiStatus("");
    renderTripDraftAiSheet();
  });
  $("#tripDraftTextInput")?.addEventListener("input", () => scheduleTripDraftPendingSave());
  $("#tripDraftRecordButton")?.addEventListener("click", () => {
    // Recording blocks saving, so anything already typed is written before it starts.
    if (!tripDraftAiState.isRecording) flushTripDraftPendingSave();
    toggleTripDraftRecording();
  });
  $("#tripDraftParseButton")?.addEventListener("click", parseTripDraftText);
  $("#tripDraftDocumentsAddButton")?.addEventListener("click", () => {
    const input = $("#tripDraftDocumentsInput");
    if (!input) return;
    input.value = "";
    input.click();
  });
  $("#tripDraftDocumentsInput")?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    const files = input.files;
    if (files?.length) handleTripDraftDocumentsSelection(files);
    input.value = "";
  });
  $("#tripDraftDocumentsParseButton")?.addEventListener("click", parseBookingPackDocuments);
  $("#tripDraftDocumentsBackButton")?.addEventListener("click", () => {
    if (tripDraftAiState.isBusy) return;
    tripDraftAiState = { ...tripDraftAiState, mode: "choice" };
    setTripDraftAiStatus("");
    renderTripDraftAiSheet();
  });
  $("#tripDraftDocumentsList")?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-booking-pack-remove]");
    if (!removeButton) return;
    const index = Number(removeButton.dataset.bookingPackRemove);
    tripDraftAiState = {
      ...tripDraftAiState,
      bookingPackFiles: tripDraftAiState.bookingPackFiles.filter((entry, entryIndex) => entryIndex !== index),
    };
    saveTripDraftPending();
    renderTripDraftDocumentsStep();
  });
  $("#bookingPackUploadRetryButton")?.addEventListener("click", retryBookingPackUploads);
  $("#bookingPackUploadDismissButton")?.addEventListener("click", () => {
    bookingPackFailedUploads = [];
    renderBookingPackUploadNotice();
  });
  $("#tripDraftEditTextButton")?.addEventListener("click", () => {
    tripDraftAiState = { ...tripDraftAiState, mode: "input" };
    renderTripDraftAiSheet();
  });
  $("#tripDraftCreateButton")?.addEventListener("click", createTripFromAiDraft);
  $("#tripDraftPreviewBox")?.addEventListener("click", handleTripDraftPreviewAction);
  $("#refreshProposalsButton").addEventListener("click", refreshAuthorExpenseProposals);
  $("#introNextButton").addEventListener("click", () => showIntroSlide(1));
  $("#introSecondNextButton").addEventListener("click", () => showIntroSlide(2));
  $("#introStartButton").addEventListener("click", finishIntro);
  $("#coverInput").addEventListener("change", saveSelectedCover);
  $("#homeShareButton").addEventListener("click", openHomeShareSheet);
  $("#homeProfileButton")?.addEventListener("click", () => openProfileSheet(null));
  $("#profileForm")?.addEventListener("submit", submitProfileForm);
  $("#recoverableAuthUpgradeForm")?.addEventListener("submit", submitRecoverableAuthUpgradeForm);
  $("#recoverableAuthLoginForm")?.addEventListener("submit", submitRecoverableAuthLoginForm);
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
  $("#showTrainerButton")?.addEventListener("click", () => {
    setHomeTrainerHidden(false);
    renderHomeSupport();
  });
  $("#syncConflictCloseButton")?.addEventListener("click", () => dismissPrivateTripSyncConflicts());
  $("#homeTelegramButton")?.addEventListener("click", () => trackEvent("feedback_channel_opened", { channel: "telegram", source: "home_support" }));
  $("#feedbackButton").addEventListener("click", () => trackEvent("feedback_channel_opened", { channel: "telegram" }));
  $("#homeButton").addEventListener("click", () => showHomeScreen("trip_bottom_bar"));
  $("#itemForm").addEventListener("submit", saveItem);
  $("#itemForm").elements.title.addEventListener("input", (event) => validateItemTitleInput(event.currentTarget));
  $("#itemForm").elements.date.addEventListener("input", (event) => validateItemDateInput(event.currentTarget));
  ["price", "paidAmount"].forEach((name) => {
    $("#itemForm").elements[name].addEventListener("input", (event) => validateMoneyInput(event.currentTarget));
  });
  $("#itemProposalForm")?.addEventListener("submit", submitItemProposal);
  $("#copyItemButton").addEventListener("click", openCardCopySheet);
  $("#resetItemButton").addEventListener("click", resetCurrentItemForm);
  $("#deleteItemButton").addEventListener("click", deleteCurrentItem);
  $("#itemAttachmentAddButton")?.addEventListener("click", () => {
    const input = $("#itemAttachmentInput");
    input.value = "";
    input.click();
  });
  $("#itemAttachmentInput")?.addEventListener("change", (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;
    input.value = "";
    if (file) uploadCurrentTripItemAttachment(file);
  });
  $("#itemAttachmentsSection")?.addEventListener("click", handleTripItemAttachmentsClick);
  $("#cardCopyBackButton").addEventListener("click", goBackCardCopyStep);
  $("#cardCopyConfirmButton").addEventListener("click", confirmCardCopy);
  $("#itemForm").elements.link.addEventListener("input", () => {
    updateOpenLinkButton();
    if (!linkIntakeState.isLoading) {
      linkIntakeState = { ...linkIntakeState, draft: null, status: "", error: "", previewOnlyImageUrl: "" };
    }
    renderLinkIntakePanel();
  });
  $("#linkIntakePreviewButton")?.addEventListener("click", previewLinkIntakeFromForm);
  $("#openLinkButton").addEventListener("click", openItemLink);
  $("#editTripButton").addEventListener("click", openTripSheet);
  $("#tripMeta").addEventListener("click", openTripSheet);
  $("#tripBudgetMeta").addEventListener("click", openTripSheet);
  $("#tripForm").addEventListener("submit", saveTrip);
  $("#tripForm").elements.title.addEventListener("input", validateTripRequiredInputs);
  $("#tripForm").elements.destination.addEventListener("input", validateTripRequiredInputs);
  $("#tripForm").elements.budgetLimit.addEventListener("input", (event) => validateTripBudgetInput(event.currentTarget));
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
  $("#currencySwapButton").addEventListener("click", swapCurrencyDirection);
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

async function bootstrapApp() {
  try {
    await window.BackpackerI18n?.init();
  } catch {
    // The existing Russian DOM copy remains the safe startup fallback.
  }

  bindEvents();
  setupDonationFlow();
  renderProductVersionInfo();
  switchView(currentView);
  render();
  initializeExtensionConnectBridge();
  subscribeRecoverableAuthChanges();
  window.setTimeout(startApp, 520);
  refreshExchangeRates();
}

bootstrapApp();

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
  if (itemSheetIgnoreNextPop) {
    itemSheetIgnoreNextPop = false;
    return;
  }
  if ($("#itemSheet")?.classList.contains("open") && itemCreateContext.returnScreenOnCancel) {
    dismissItemSheet("back", { fromPopState: true });
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
