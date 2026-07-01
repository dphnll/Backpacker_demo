// =============================================================================
// PostHog → Google Sheets metrics sync
// Spreadsheet: Backpacker Research (1jQsMqIkejdyxpD7mHI2IqwViAXUTNVFqqJXRiFM17Hk)
// Target sheet: PostHog_метрики
//
// Script Properties (Extensions → Apps Script → Project Settings):
//   POSTHOG_PERSONAL_API_KEY  — personal API key, starts with phx_...
//                               NOT the project capture key (phc_...)
//   POSTHOG_PROJECT_ID        — numeric project ID (visible in PostHog URL)
//   POSTHOG_HOST              — optional, default: https://eu.posthog.com
//   ANALYTICS_SCHEMA_VERSIONS — optional, comma-separated allow-list of
//                               analytics_schema_version values core metrics
//                               should count, e.g. "2026-06-25.1,2026-07-01.1"
//                               Falls back to DEFAULT_SCHEMA_VERSIONS when unset.
// =============================================================================

var SPREADSHEET_ID  = "1jQsMqIkejdyxpD7mHI2IqwViAXUTNVFqqJXRiFM17Hk";
var METRICS_SHEET   = "PostHog_метрики";
var SCHEMA_VERSION  = "2026-07-01.1"; // current primary schema version

var PROP_API_KEY           = "POSTHOG_PERSONAL_API_KEY";
var PROP_PROJECT_ID        = "POSTHOG_PROJECT_ID";
var PROP_HOST              = "POSTHOG_HOST";
var PROP_SCHEMA_VERSIONS   = "ANALYTICS_SCHEMA_VERSIONS";
var DEFAULT_HOST           = "https://eu.posthog.com";
// Core metrics must keep counting the historical schema alongside the current
// one so the transition to a new analytics_schema_version does not drop
// production events out of the weekly sync.
var DEFAULT_SCHEMA_VERSIONS = ["2026-06-25.1", "2026-07-01.1"];

var MANUAL_COLS = ["main_observation", "main_problem", "decision_for_next_week"];

// Minimal feature-adoption columns (July observation release). These count
// only the current analytics_schema_version — the underlying events never
// existed under the older schema, so there is nothing to backfill.
var NEW_FEATURE_COLUMNS = [
  "users_item_copied",
  "users_text_share_completed",
  "users_pdf_export_completed",
  "pdf_export_failed_events",
  "users_item_form_reset"
];

var HEADERS = [
  "period_start",
  "period_end",
  "period_label",
  "synced_at",
  "new_anon_users",
  "first_value_funnel_started",
  "first_value_funnel_completed",
  "first_value_conversion_7d_pct",
  "working_plan_funnel_started",
  "working_plan_funnel_completed",
  "working_plan_conversion_14d_pct",
  "trainer_users",
  "trainer_action_users",
  "trainer_to_own_trip_7d",
  "users_trip_first_value_reached",
  "users_trip_working_plan_reached",
  "app_versions",
  "users_item_copied",
  "users_text_share_completed",
  "users_pdf_export_completed",
  "pdf_export_failed_events",
  "users_item_form_reset",
  "main_observation",
  "main_problem",
  "decision_for_next_week"
];

// =============================================================================
// MENU
// =============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PostHog Sync")
    .addItem("Test PostHog connection",  "testPostHogConnection")
    .addItem("Preview sync",             "previewSync")
    .addItem("Sync metrics now",         "syncMetrics")
    .addSeparator()
    .addItem("Install daily trigger",    "installDailyTrigger")
    .addItem("Remove analytics triggers","removeAnalyticsTriggers")
    .addSeparator()
    .addItem("Show integration status",  "showIntegrationStatus")
    .addToUi();
}

// =============================================================================
// PUBLIC COMMANDS
// =============================================================================

function testPostHogConnection() {
  var ui = SpreadsheetApp.getUi();
  try {
    var cfg = loadConfig_();
    var res = runHogQL_(cfg, "SELECT 1 + 1 AS sanity");
    if (res && res.results && res.results.length > 0 && Number(res.results[0][0]) === 2) {
      ui.alert("PostHog connection OK",
        "Query API responded correctly.\nProject: [configured]\nHost: " + cfg.host,
        ui.ButtonSet.OK);
    } else {
      ui.alert("Unexpected response",
        "Query returned: " + JSON.stringify(res).substring(0, 300),
        ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert("Connection failed", String(e.message || e), ui.ButtonSet.OK);
  }
}

function previewSync() {
  runSync_(true);
}

function syncMetrics() {
  runSync_(false);
}

function installDailyTrigger() {
  var ui = SpreadsheetApp.getUi();
  var already = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === "syncMetrics";
  });
  if (already.length > 0) {
    ui.alert("Already installed", "A daily trigger for syncMetrics already exists.", ui.ButtonSet.OK);
    return;
  }
  ScriptApp.newTrigger("syncMetrics").timeBased().everyDays(1).atHour(7).create();
  ui.alert("Trigger installed", "syncMetrics will run daily at 07:00.", ui.ButtonSet.OK);
}

function removeAnalyticsTriggers() {
  var ui = SpreadsheetApp.getUi();
  var found = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === "syncMetrics";
  });
  if (found.length === 0) {
    ui.alert("Nothing to remove", "No syncMetrics triggers are installed.", ui.ButtonSet.OK);
    return;
  }
  found.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ui.alert("Triggers removed", "Removed " + found.length + " trigger(s).", ui.ButtonSet.OK);
}

function showIntegrationStatus() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties().getProperties();
  var lines = [
    "=== Script Properties ===",
    "  " + PROP_API_KEY    + ": " + (props[PROP_API_KEY]    ? "SET (hidden)" : "⚠ MISSING"),
    "  " + PROP_PROJECT_ID + ": " + (props[PROP_PROJECT_ID] ? "SET"          : "⚠ MISSING"),
    "  " + PROP_HOST       + ": " + (props[PROP_HOST]       || "(default: " + DEFAULT_HOST + ")"),
    "  " + PROP_SCHEMA_VERSIONS + ": " + getAllowedSchemaVersions_().join(", ") + (props[PROP_SCHEMA_VERSIONS] ? "" : " (default)"),
    "",
    "=== Triggers ==="
  ];
  var triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === "syncMetrics";
  });
  lines.push("  syncMetrics: " + (triggers.length > 0 ? triggers.length + " active" : "none"));
  lines.push("");
  lines.push("=== Sheet ===");
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(METRICS_SHEET);
    lines.push("  '" + METRICS_SHEET + "': " + (sheet
      ? "exists, " + Math.max(0, sheet.getLastRow() - 1) + " data row(s)"
      : "not yet created"));
  } catch (e) {
    lines.push("  Could not open spreadsheet: " + e.message);
  }
  ui.alert("Integration status", lines.join("\n"), ui.ButtonSet.OK);
}

// =============================================================================
// CORE SYNC
// =============================================================================

function runSync_(previewOnly) {
  // SpreadsheetApp.getUi() throws when called from a time-based trigger (no UI
  // context). Detect availability first so the trigger path uses Logger instead.
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (_) {}

  try {
    var cfg    = loadConfig_();
    var period = previousISOWeek_();
    var m      = fetchAllMetrics_(cfg, period.start, period.end);
    var fm     = fetchFeatureMetrics_(cfg, period.start, period.end);
    NEW_FEATURE_COLUMNS.forEach(function(key) { m[key] = fm[key]; });

    if (previewOnly) {
      if (ui) showPreview_(m, period);
      return;
    }

    var sheet = getOrCreateMetricsSheet_();
    upsertRow_(sheet, m, period);

    var msg = "Metrics for " + period.label + " saved to '" + METRICS_SHEET + "'.";
    if (ui) {
      ui.alert("Sync complete", msg, ui.ButtonSet.OK);
    } else {
      Logger.log("Sync complete: " + msg);
    }
  } catch (e) {
    var err = String(e.message || e);
    if (ui) {
      ui.alert("Sync failed", err, ui.ButtonSet.OK);
    } else {
      Logger.log("Sync failed: " + err);
    }
  }
}

function showPreview_(m, period) {
  var ui = SpreadsheetApp.getUi();
  var lines = [
    "Period: " + period.label,
    "start=" + period.start + "  end=" + period.end,
    "",
    "new_anon_users:                   " + m.new_anon_users,
    "first_value_funnel_started:       " + m.first_value_funnel_started,
    "first_value_funnel_completed:     " + m.first_value_funnel_completed,
    "first_value_conversion_7d_pct:    " + m.first_value_conversion_7d_pct + "%",
    "working_plan_funnel_started:      " + m.working_plan_funnel_started,
    "working_plan_funnel_completed:    " + m.working_plan_funnel_completed,
    "working_plan_conversion_14d_pct:  " + m.working_plan_conversion_14d_pct + "%",
    "trainer_users:                    " + m.trainer_users,
    "trainer_action_users:             " + m.trainer_action_users,
    "trainer_to_own_trip_7d:           " + m.trainer_to_own_trip_7d,
    "users_trip_first_value_reached:   " + m.users_trip_first_value_reached,
    "users_trip_working_plan_reached:  " + m.users_trip_working_plan_reached,
    "app_versions:                     " + m.app_versions,
    "",
    "users_item_copied:                " + m.users_item_copied,
    "users_text_share_completed:       " + m.users_text_share_completed,
    "users_pdf_export_completed:       " + m.users_pdf_export_completed,
    "pdf_export_failed_events:         " + m.pdf_export_failed_events,
    "users_item_form_reset:            " + m.users_item_form_reset,
    "",
    "[PREVIEW — nothing was written]"
  ];
  ui.alert("Preview: " + period.label, lines.join("\n"), ui.ButtonSet.OK);
}

// =============================================================================
// CONFIG
// =============================================================================

function loadConfig_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  var missing = [];
  if (!p[PROP_API_KEY])    missing.push(PROP_API_KEY);
  if (!p[PROP_PROJECT_ID]) missing.push(PROP_PROJECT_ID);
  if (missing.length > 0) {
    throw new Error(
      "Missing Script Properties: " + missing.join(", ") + ".\n" +
      "Extensions → Apps Script → Project Settings → Script Properties."
    );
  }
  return {
    apiKey:    p[PROP_API_KEY],
    projectId: p[PROP_PROJECT_ID],
    host:      (p[PROP_HOST] || DEFAULT_HOST).replace(/\/+$/, "")
  };
}

// =============================================================================
// POSTHOG QUERIES
// =============================================================================

function fetchAllMetrics_(cfg, start, end) {
  var end7d  = addDays_(end, 7);
  var end14d = addDays_(end, 14);

  var baseFilters = buildFilters_(start, end);

  // ── 1. New anonymous users ────────────────────────────────────────────────
  var new_anon = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'app_opened'",
    "  AND (" +
      "properties.is_returning_user = false OR " +
      "properties.is_returning_user = 'false'" +
    ")",
    "  AND " + baseFilters
  ].join("\n"));

  // ── 2. First value funnel started (trip_created, user_created) ────────────
  var fv_started = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trip_created'",
    "  AND properties.trip_origin = 'user_created'",
    "  AND " + baseFilters
  ].join("\n"));

  // ── 3. First value funnel completed (trip_first_value_reached in period) ──
  var fv_completed = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trip_first_value_reached'",
    "  AND " + baseFilters
  ].join("\n"));

  // ── 4. First value 7-day conversion numerator ─────────────────────────────
  // Users who created a user trip in period AND reached first_value by end+7d
  var fv_conv_num = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trip_created'",
    "  AND properties.trip_origin = 'user_created'",
    "  AND " + baseFilters,
    "  AND distinct_id IN (" + inSubquery_("trip_first_value_reached", start, end7d) + ")"
  ].join("\n"));

  // ── 5. Working plan funnel completed ──────────────────────────────────────
  var wp_completed = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trip_working_plan_reached'",
    "  AND " + baseFilters
  ].join("\n"));

  // ── 6. Working plan 14-day conversion numerator ───────────────────────────
  // Users who reached first_value in period AND working_plan by end+14d
  var wp_conv_num = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trip_first_value_reached'",
    "  AND " + baseFilters,
    "  AND distinct_id IN (" + inSubquery_("trip_working_plan_reached", start, end14d) + ")"
  ].join("\n"));

  // ── 7. Trainer users ──────────────────────────────────────────────────────
  var trainer_users = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trainer_opened'",
    "  AND " + baseFilters
  ].join("\n"));

  // ── 8. Trainer action users ───────────────────────────────────────────────
  var trainer_action = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trainer_action_completed'",
    "  AND " + baseFilters
  ].join("\n"));

  // ── 9. Trainer → own trip within 7 days ───────────────────────────────────
  var trainer_to_trip = queryScalar_(cfg, [
    "SELECT countDistinct(distinct_id)",
    "FROM events",
    "WHERE event = 'trainer_opened'",
    "  AND " + baseFilters,
    "  AND distinct_id IN (",
    "    SELECT DISTINCT distinct_id FROM events",
    "    WHERE event = 'trip_created'",
    "      AND properties.trip_origin = 'user_created'",
    "      AND " + buildFilters_(start, end7d, true),
    "  )"
  ].join("\n"));

  // ── 10. App versions ─────────────────────────────────────────────────────
  var ver_result = runHogQL_(cfg, [
    "SELECT DISTINCT toString(properties.app_version) AS v",
    "FROM events",
    "WHERE event = 'app_opened'",
    "  AND isNotNull(properties.app_version)",
    "  AND properties.app_version != ''",
    "  AND " + baseFilters,
    "ORDER BY v"
  ].join("\n"));
  var versions = (ver_result && ver_result.results)
    ? ver_result.results.map(function(r) { return String(r[0] || ""); }).filter(Boolean).join(", ")
    : "";

  return {
    new_anon_users:                  new_anon,
    first_value_funnel_started:      fv_started,
    first_value_funnel_completed:    fv_completed,
    first_value_conversion_7d_pct:   pct_(fv_conv_num, fv_started),
    working_plan_funnel_started:     fv_completed,   // started = reached first_value
    working_plan_funnel_completed:   wp_completed,
    working_plan_conversion_14d_pct: pct_(wp_conv_num, fv_completed),
    trainer_users:                   trainer_users,
    trainer_action_users:            trainer_action,
    trainer_to_own_trip_7d:          trainer_to_trip,
    users_trip_first_value_reached:  fv_completed,
    users_trip_working_plan_reached: wp_completed,
    app_versions:                    versions
  };
}

// ── Feature-adoption metrics (single combined query) ────────────────────────
// All five feature columns come from one HogQL request instead of five
// separate ones — they only count the current analytics_schema_version,
// since these events never existed under the older schema.
function buildFeatureMetricsQuery_(start, end) {
  return [
    "SELECT",
    "  countDistinctIf(distinct_id, event = 'item_created' AND properties.creation_method = 'copy') AS users_item_copied,",
    "  countDistinctIf(distinct_id, event = 'share_completed' AND properties.share_format = 'text' AND (properties.share_context = 'trip' OR isNull(properties.share_context))) AS users_text_share_completed,",
    "  countDistinctIf(distinct_id, event = 'export_completed' AND properties.export_type = 'trip_pdf') AS users_pdf_export_completed,",
    "  countIf(event = 'export_failed' AND properties.export_type = 'trip_pdf') AS pdf_export_failed_events,",
    "  countDistinctIf(distinct_id, event = 'item_form_reset') AS users_item_form_reset",
    "FROM events",
    "WHERE properties.environment = 'production'",
    "  AND properties.is_internal_user = false",
    "  AND properties.is_test_user = false",
    "  AND properties.analytics_schema_version = '" + SCHEMA_VERSION + "'",
    "  AND event IN ('item_created', 'share_completed', 'export_completed', 'export_failed', 'item_form_reset')",
    "  AND toDate(timestamp) >= toDate('" + start + "')",
    "  AND toDate(timestamp) <  toDate('" + end + "')"
  ].join("\n");
}

// Maps a single HogQL result row (in the exact column order of the query
// above) to a named object. Missing/short rows default every value to 0
// instead of throwing, matching "no events yet" behavior everywhere else.
function parseFeatureMetricsRow_(row) {
  var r = row || [];
  return {
    users_item_copied:          Number(r[0]) || 0,
    users_text_share_completed: Number(r[1]) || 0,
    users_pdf_export_completed: Number(r[2]) || 0,
    pdf_export_failed_events:   Number(r[3]) || 0,
    users_item_form_reset:      Number(r[4]) || 0
  };
}

function fetchFeatureMetrics_(cfg, start, end) {
  var res = runHogQL_(cfg, buildFeatureMetricsQuery_(start, end));
  var row = (res && res.results && res.results[0]) ? res.results[0] : [];
  return parseFeatureMetricsRow_(row);
}

// Reads the ANALYTICS_SCHEMA_VERSIONS Script Property (comma-separated) and
// falls back to DEFAULT_SCHEMA_VERSIONS when unset or empty, so core metrics
// keep counting both the historical and the current analytics schema.
function getAllowedSchemaVersions_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_SCHEMA_VERSIONS);
  if (!raw) return DEFAULT_SCHEMA_VERSIONS.slice();
  var versions = raw.split(",")
    .map(function(v) { return v.trim(); })
    .filter(Boolean);
  return versions.length ? versions : DEFAULT_SCHEMA_VERSIONS.slice();
}

// Builds an `analytics_schema_version IN (...)` clause from the allow-list.
// Any event tagged with a version outside this list is excluded by normal
// SQL IN semantics — no separate "unknown version" branch is needed.
function buildSchemaVersionFilter_() {
  var quoted = getAllowedSchemaVersions_().map(function(v) { return "'" + v + "'"; });
  return "properties.analytics_schema_version IN (" + quoted.join(", ") + ")";
}

// Build a shared filter clause for the primary period window.
// extendedEnd=true uses inclusive <= instead of exclusive < for the end date.
function buildFilters_(start, end, extendedEnd) {
  var endClause = extendedEnd
    ? "toDate(timestamp) <= toDate('" + end + "')"
    : "toDate(timestamp) <  toDate('" + end + "')";
  return [
    "properties.environment = 'production'",
    "properties.is_internal_user = false",
    "properties.is_test_user = false",
    buildSchemaVersionFilter_(),
    "toDate(timestamp) >= toDate('" + start + "')",
    endClause
  ].join("\n  AND ");
}

// Build an IN-subquery for a specific event within an inclusive date range.
function inSubquery_(event, start, end) {
  return [
    "",
    "  SELECT DISTINCT distinct_id FROM events",
    "  WHERE event = '" + event + "'",
    "    AND properties.environment = 'production'",
    "    AND properties.is_internal_user = false",
    "    AND properties.is_test_user = false",
    "    AND " + buildSchemaVersionFilter_(),
    "    AND toDate(timestamp) >= toDate('" + start + "')",
    "    AND toDate(timestamp) <= toDate('" + end + "')",
    ""
  ].join("\n");
}

function queryScalar_(cfg, sql) {
  var res = runHogQL_(cfg, sql);
  if (!res || !res.results || res.results.length === 0) return 0;
  return Number(res.results[0][0]) || 0;
}

function pct_(num, denom) {
  if (!denom || denom === 0) return 0;
  return Math.round((num / denom) * 1000) / 10;  // one decimal, e.g. 33.3
}

// POST to the PostHog HogQL Query API. Errors are thrown, never silenced.
// Authorization header is never logged.
function runHogQL_(cfg, sql) {
  var url = cfg.host + "/api/projects/" + cfg.projectId + "/query/";

  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + cfg.apiKey },
    payload: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
    muteHttpExceptions: true,
    followRedirects: true
  };

  var response;
  try {
    response = UrlFetchApp.fetch(url, options);
  } catch (networkErr) {
    throw new Error("PostHog network error (timeout or DNS): " + networkErr.message);
  }

  var code = response.getResponseCode();

  if (code === 200) {
    var body = response.getContentText();
    try {
      var parsed = JSON.parse(body);
      if (!parsed.results) {
        throw new Error("PostHog response has no 'results' field: " + body.substring(0, 200));
      }
      return parsed;
    } catch (parseErr) {
      throw new Error("PostHog returned non-JSON (200): " + response.getContentText().substring(0, 200));
    }
  }

  // Error codes — safe messages only, no credential leakage
  if (code === 401) throw new Error(
    "PostHog 401 Unauthorized.\n" +
    "Check " + PROP_API_KEY + " in Script Properties.\n" +
    "Use a Personal API key (phx_...), not the project capture key (phc_...)."
  );
  if (code === 403) throw new Error(
    "PostHog 403 Forbidden.\n" +
    "The API key does not have access to project " + cfg.projectId + "."
  );
  if (code === 429) throw new Error(
    "PostHog 429 Rate limited. Wait a few minutes and retry."
  );
  if (code === 500) throw new Error(
    "PostHog 500 Internal Server Error. Try again later."
  );
  throw new Error(
    "PostHog HTTP " + code + ": " + response.getContentText().substring(0, 300)
  );
}

// =============================================================================
// SHEET OPERATIONS
// =============================================================================

function getOrCreateMetricsSheet_() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(METRICS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(METRICS_SHEET);
    var hdr = sheet.getRange(1, 1, 1, HEADERS.length);
    hdr.setValues([HEADERS]);
    hdr.setFontWeight("bold");
    hdr.setBackground("#E8F0FE");
    hdr.setFontColor("#111827");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 150);
  }
  return sheet;
}

function upsertRow_(sheet, m, period) {
  ensurePostHogHeaders_(sheet);

  var colCount = Math.max(sheet.getLastColumn(), HEADERS.length);
  var rawHeaders = sheet.getRange(1, 1, 1, colCount).getValues()[0];
  var headers = rawHeaders.map(function(h) { return String(h); });

  var existing = findRowByPeriod_(sheet, period.start, period.end, headers);

  if (existing > 0) {
    var currentData = sheet.getRange(existing, 1, 1, headers.length).getValues()[0];
    var row = buildRow_(m, period, headers, currentData);
    sheet.getRange(existing, 1, 1, headers.length).setValues([row]);
  } else {
    var newRow = buildRow_(m, period, headers, null);
    sheet.appendRow(newRow);
  }
}

function buildRow_(m, period, headers, existingData) {
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  var data = {
    "period_start":                   period.start,
    "period_end":                     period.end,
    "period_label":                   period.label,
    "synced_at":                      now,
    "new_anon_users":                 m.new_anon_users,
    "first_value_funnel_started":     m.first_value_funnel_started,
    "first_value_funnel_completed":   m.first_value_funnel_completed,
    "first_value_conversion_7d_pct":  m.first_value_conversion_7d_pct,
    "working_plan_funnel_started":    m.working_plan_funnel_started,
    "working_plan_funnel_completed":  m.working_plan_funnel_completed,
    "working_plan_conversion_14d_pct":m.working_plan_conversion_14d_pct,
    "trainer_users":                  m.trainer_users,
    "trainer_action_users":           m.trainer_action_users,
    "trainer_to_own_trip_7d":         m.trainer_to_own_trip_7d,
    "users_trip_first_value_reached": m.users_trip_first_value_reached,
    "users_trip_working_plan_reached":m.users_trip_working_plan_reached,
    "app_versions":                   m.app_versions,
    "users_item_copied":              m.users_item_copied || 0,
    "users_text_share_completed":     m.users_text_share_completed || 0,
    "users_pdf_export_completed":     m.users_pdf_export_completed || 0,
    "pdf_export_failed_events":       m.pdf_export_failed_events || 0,
    "users_item_form_reset":          m.users_item_form_reset || 0
  };

  // Preserve manual columns from existing row
  MANUAL_COLS.forEach(function(name) {
    var idx = headers.indexOf(name);
    if (idx >= 0 && existingData !== null && existingData[idx] !== undefined && existingData[idx] !== "") {
      data[name] = existingData[idx];
    } else {
      data[name] = "";
    }
  });

  return headers.map(function(h) { return h in data ? data[h] : ""; });
}

function findRowByPeriod_(sheet, periodStart, periodEnd, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var sIdx = headers.indexOf("period_start");
  var eIdx = headers.indexOf("period_end");
  if (sIdx < 0 || eIdx < 0) return -1;

  var sVals = sheet.getRange(2, sIdx + 1, lastRow - 1, 1).getValues();
  var eVals = sheet.getRange(2, eIdx + 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < sVals.length; i++) {
    if (String(sVals[i][0]) === periodStart && String(eVals[i][0]) === periodEnd) {
      return i + 2;
    }
  }
  return -1;
}

function ensurePostHogHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }
  migrateMissingFeatureHeaders_(sheet);
}

// A sheet synced before this release has the old header row (no feature
// columns). Insert only the columns that are actually missing, right before
// the manual columns, using insertColumnsBefore so every existing row
// (including manual notes) shifts right intact — no data is copied by hand,
// nothing is deleted, and re-running this is a no-op once headers match.
function migrateMissingFeatureHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h); });
  var missing = NEW_FEATURE_COLUMNS.filter(function(name) { return currentHeaders.indexOf(name) === -1; });
  if (missing.length === 0) return;

  var manualColIndex = currentHeaders.indexOf("main_observation") + 1; // 1-based
  if (manualColIndex <= 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    return;
  }
  sheet.insertColumnsBefore(manualColIndex, missing.length);
  sheet.getRange(1, manualColIndex, 1, missing.length).setValues([missing]);
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

// Returns the previous ISO week (Mon–Sun).
// period.end is Monday of the current week (exclusive upper bound in queries).
function previousISOWeek_() {
  var now = new Date();
  var dow = now.getDay();                         // 0=Sun, 1=Mon … 6=Sat
  var daysToCurrentMon = dow === 0 ? 6 : dow - 1;

  var currentMon = new Date(now);
  currentMon.setDate(now.getDate() - daysToCurrentMon);
  currentMon.setHours(0, 0, 0, 0);

  var prevMon = new Date(currentMon);
  prevMon.setDate(currentMon.getDate() - 7);

  var start = iso_(prevMon);
  var end   = iso_(currentMon);   // exclusive: queries use < end

  var prevSun = new Date(currentMon);
  prevSun.setDate(currentMon.getDate() - 1);
  var label = start + " – " + iso_(prevSun);

  return { start: start, end: end, label: label };
}

function addDays_(dateStr, days) {
  var d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

function iso_(date) {
  var y = date.getFullYear();
  var m = padZ_(date.getMonth() + 1);
  var d = padZ_(date.getDate());
  return y + "-" + m + "-" + d;
}

function padZ_(n) {
  return n < 10 ? "0" + n : String(n);
}
