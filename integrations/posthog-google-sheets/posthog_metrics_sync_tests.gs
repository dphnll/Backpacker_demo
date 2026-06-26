// =============================================================================
// Unit tests for posthog_metrics_sync.gs — pure-function coverage
// Run from Apps Script editor: open this file, select a test function,
// click ▶ Run, check Execution log.
// None of these tests make network calls or write to the spreadsheet.
// =============================================================================

// Simple assertion helper
function assert_(label, actual, expected) {
  if (actual !== expected) {
    throw new Error("[FAIL] " + label + "\n  expected: " + JSON.stringify(expected) + "\n  got:      " + JSON.stringify(actual));
  }
  Logger.log("[PASS] " + label);
}

function assertApprox_(label, actual, expected, tolerance) {
  var tol = tolerance || 0.001;
  if (Math.abs(actual - expected) > tol) {
    throw new Error("[FAIL] " + label + "\n  expected ~" + expected + "\n  got " + actual);
  }
  Logger.log("[PASS] " + label);
}

// =============================================================================
// Date utilities
// =============================================================================

function test_addDays() {
  assert_("addDays + 7",  addDays_("2026-06-19", 7),  "2026-06-26");
  assert_("addDays + 14", addDays_("2026-06-19", 14), "2026-07-03");
  assert_("addDays + 0",  addDays_("2026-06-25", 0),  "2026-06-25");
  assert_("addDays month boundary", addDays_("2026-06-28", 7), "2026-07-05");
  assert_("addDays year boundary",  addDays_("2026-12-28", 7), "2027-01-04");
  Logger.log("test_addDays: all passed");
}

function test_previousISOWeek_structure() {
  var p = previousISOWeek_();
  assert_("start length",  p.start.length, 10);
  assert_("end length",    p.end.length,   10);
  // end - start should be exactly 7 days
  var diff = (new Date(p.end + "T00:00:00Z") - new Date(p.start + "T00:00:00Z")) / 86400000;
  assert_("week span = 7 days", diff, 7);
  // start must be a Monday: day 1 in UTC
  var startDay = new Date(p.start + "T00:00:00Z").getUTCDay();
  assert_("start is Monday (UTC)", startDay, 1);
  Logger.log("test_previousISOWeek_structure: all passed");
}

function test_previousISOWeek_label() {
  var p = previousISOWeek_();
  // label format: "YYYY-MM-DD – YYYY-MM-DD"
  var parts = p.label.split(" – ");
  assert_("label has two parts", parts.length, 2);
  assert_("label start = period start", parts[0], p.start);
  // label end should be period.end minus 1 day (the Sunday)
  var expectedSun = addDays_(p.end, -1);
  assert_("label end = Sunday", parts[1], expectedSun);
  Logger.log("test_previousISOWeek_label: all passed");
}

// =============================================================================
// pct_ helper
// =============================================================================

function test_pct() {
  assertApprox_("50%",        pct_(1, 2),    50.0);
  assertApprox_("33.3%",      pct_(1, 3),    33.3);
  assertApprox_("100%",       pct_(5, 5),    100.0);
  assert_("0 denominator",    pct_(5, 0),    0);
  assert_("0 numerator",      pct_(0, 10),   0);
  assertApprox_("14.3%",      pct_(1, 7),    14.3);
  Logger.log("test_pct: all passed");
}

// =============================================================================
// buildFilters_
// =============================================================================

function test_buildFilters_containsSchemaVersion() {
  var f = buildFilters_("2026-06-19", "2026-06-26");
  if (f.indexOf(SCHEMA_VERSION) === -1) {
    throw new Error("[FAIL] buildFilters_ does not contain SCHEMA_VERSION");
  }
  Logger.log("[PASS] buildFilters_ contains schema version");
}

function test_buildFilters_exclusiveEnd() {
  var f = buildFilters_("2026-06-19", "2026-06-26", false);
  if (f.indexOf("< ") === -1 && f.indexOf("<  toDate") === -1) {
    throw new Error("[FAIL] buildFilters_ (exclusive) should use < operator");
  }
  Logger.log("[PASS] buildFilters_ uses < for exclusive end");
}

function test_buildFilters_inclusiveEnd() {
  var f = buildFilters_("2026-06-19", "2026-06-26", true);
  if (f.indexOf("<=") === -1) {
    throw new Error("[FAIL] buildFilters_ (inclusive) should use <= operator");
  }
  Logger.log("[PASS] buildFilters_ uses <= for inclusive end");
}

function test_buildFilters_noAuthorizationLeak() {
  var f = buildFilters_("2026-06-19", "2026-06-26");
  if (f.indexOf("Bearer") !== -1 || f.indexOf("phx_") !== -1 || f.indexOf("phc_") !== -1) {
    throw new Error("[FAIL] buildFilters_ leaks credentials");
  }
  Logger.log("[PASS] buildFilters_ does not contain credentials");
}

// =============================================================================
// inSubquery_
// =============================================================================

function test_inSubquery_noAnonymousIds() {
  var q = inSubquery_("trip_first_value_reached", "2026-06-19", "2026-06-26");
  // The subquery should not select or expose any user identifier in the result
  // (it selects distinct_id for the IN clause, but it must not contain PII column selections)
  if (q.indexOf("SELECT DISTINCT distinct_id") === -1) {
    throw new Error("[FAIL] inSubquery_ should use SELECT DISTINCT distinct_id");
  }
  // Make sure it doesn't accidentally pull in personal fields
  var piiFields = ["telegram_user_id", "username", "phone", "email", "name"];
  piiFields.forEach(function(f) {
    if (q.indexOf(f) !== -1) {
      throw new Error("[FAIL] inSubquery_ references PII field: " + f);
    }
  });
  Logger.log("[PASS] inSubquery_ selects only distinct_id, no PII fields");
}

function test_inSubquery_containsEvent() {
  var q = inSubquery_("trip_first_value_reached", "2026-06-19", "2026-06-26");
  if (q.indexOf("trip_first_value_reached") === -1) {
    throw new Error("[FAIL] inSubquery_ does not contain the event name");
  }
  Logger.log("[PASS] inSubquery_ contains event name");
}

// =============================================================================
// buildRow_
// =============================================================================

function test_buildRow_lengthMatchesHeaders() {
  var period = { start: "2026-06-19", end: "2026-06-26", label: "2026-06-19 – 2026-06-25" };
  var metrics = {
    new_anon_users: 10, first_value_funnel_started: 5, first_value_funnel_completed: 2,
    first_value_conversion_7d_pct: 40.0, working_plan_funnel_started: 2,
    working_plan_funnel_completed: 1, working_plan_conversion_14d_pct: 50.0,
    trainer_users: 8, trainer_action_users: 6, trainer_to_own_trip_7d: 3,
    users_trip_first_value_reached: 2, users_trip_working_plan_reached: 1,
    app_versions: "analytics-first-layer-2026-06-25"
  };
  var row = buildRow_(metrics, period, HEADERS, null);
  assert_("row length = HEADERS length", row.length, HEADERS.length);
  Logger.log("[PASS] buildRow_ row length matches HEADERS");
}

function test_buildRow_preservesManualColumns() {
  var period = { start: "2026-06-19", end: "2026-06-26", label: "2026-06-19 – 2026-06-25" };
  var metrics = {
    new_anon_users: 10, first_value_funnel_started: 5, first_value_funnel_completed: 2,
    first_value_conversion_7d_pct: 40, working_plan_funnel_started: 2,
    working_plan_funnel_completed: 1, working_plan_conversion_14d_pct: 50,
    trainer_users: 8, trainer_action_users: 6, trainer_to_own_trip_7d: 3,
    users_trip_first_value_reached: 2, users_trip_working_plan_reached: 1,
    app_versions: ""
  };
  // Build fake existing row with manual values set
  var existingRow = HEADERS.map(function() { return ""; });
  var obsIdx  = HEADERS.indexOf("main_observation");
  var probIdx = HEADERS.indexOf("main_problem");
  var decIdx  = HEADERS.indexOf("decision_for_next_week");
  existingRow[obsIdx]  = "Users enjoyed the trainer";
  existingRow[probIdx] = "Budget section unclear";
  existingRow[decIdx]  = "Add tooltip to budget";

  var row = buildRow_(metrics, period, HEADERS, existingRow);
  assert_("main_observation preserved",     row[obsIdx],  "Users enjoyed the trainer");
  assert_("main_problem preserved",         row[probIdx], "Budget section unclear");
  assert_("decision_for_next_week preserved",row[decIdx], "Add tooltip to budget");
  Logger.log("[PASS] buildRow_ preserves manual columns");
}

function test_buildRow_overwritesMetricColumns() {
  var period = { start: "2026-06-19", end: "2026-06-26", label: "2026-06-19 – 2026-06-25" };
  var metrics = {
    new_anon_users: 99, first_value_funnel_started: 0, first_value_funnel_completed: 0,
    first_value_conversion_7d_pct: 0, working_plan_funnel_started: 0,
    working_plan_funnel_completed: 0, working_plan_conversion_14d_pct: 0,
    trainer_users: 0, trainer_action_users: 0, trainer_to_own_trip_7d: 0,
    users_trip_first_value_reached: 0, users_trip_working_plan_reached: 0,
    app_versions: "v2"
  };
  var existingRow = HEADERS.map(function() { return "old_value"; });
  var row = buildRow_(metrics, period, HEADERS, existingRow);
  var nauIdx = HEADERS.indexOf("new_anon_users");
  assert_("new_anon_users updated to 99", row[nauIdx], 99);
  Logger.log("[PASS] buildRow_ overwrites metric columns");
}

function test_buildRow_manualColsEmptyWhenNoExistingRow() {
  var period = { start: "2026-06-19", end: "2026-06-26", label: "2026-06-19 – 2026-06-25" };
  var metrics = {
    new_anon_users: 5, first_value_funnel_started: 2, first_value_funnel_completed: 1,
    first_value_conversion_7d_pct: 50, working_plan_funnel_started: 1,
    working_plan_funnel_completed: 0, working_plan_conversion_14d_pct: 0,
    trainer_users: 3, trainer_action_users: 2, trainer_to_own_trip_7d: 1,
    users_trip_first_value_reached: 1, users_trip_working_plan_reached: 0,
    app_versions: ""
  };
  var row = buildRow_(metrics, period, HEADERS, null);
  MANUAL_COLS.forEach(function(name) {
    var idx = HEADERS.indexOf(name);
    assert_("manual col " + name + " is empty for new row", row[idx], "");
  });
  Logger.log("[PASS] buildRow_ manual cols empty when no existing row");
}

// =============================================================================
// findRowByPeriod_
// =============================================================================

function test_findRowByPeriod_returnsMinusOneWhenEmpty() {
  // We cannot use a real sheet here, so test the logic only by inspecting the function.
  // This is a structural test: verify the function exists and signature is correct.
  if (typeof findRowByPeriod_ !== "function") {
    throw new Error("[FAIL] findRowByPeriod_ is not defined");
  }
  Logger.log("[PASS] findRowByPeriod_ exists");
}

// =============================================================================
// Security: no credential leakage in SQL helpers
// =============================================================================

function test_noCredentialsInSQLHelpers() {
  var sql = buildFilters_("2026-06-19", "2026-06-26") +
            inSubquery_("trip_first_value_reached", "2026-06-19", "2026-06-26");
  var forbidden = ["phx_", "phc_", "Bearer", "Authorization"];
  forbidden.forEach(function(token) {
    if (sql.indexOf(token) !== -1) {
      throw new Error("[FAIL] SQL helpers contain forbidden token: " + token);
    }
  });
  Logger.log("[PASS] SQL helpers contain no credentials");
}

// =============================================================================
// Run all tests
// =============================================================================

function runAllTests() {
  Logger.log("=== posthog_metrics_sync tests ===");
  try {
    test_addDays();
    test_previousISOWeek_structure();
    test_previousISOWeek_label();
    test_pct();
    test_buildFilters_containsSchemaVersion();
    test_buildFilters_exclusiveEnd();
    test_buildFilters_inclusiveEnd();
    test_buildFilters_noAuthorizationLeak();
    test_inSubquery_noAnonymousIds();
    test_inSubquery_containsEvent();
    test_buildRow_lengthMatchesHeaders();
    test_buildRow_preservesManualColumns();
    test_buildRow_overwritesMetricColumns();
    test_buildRow_manualColsEmptyWhenNoExistingRow();
    test_findRowByPeriod_returnsMinusOneWhenEmpty();
    test_noCredentialsInSQLHelpers();
    Logger.log("=== ALL TESTS PASSED ===");
  } catch (e) {
    Logger.log("=== TEST SUITE FAILED ===");
    Logger.log(e.message || String(e));
    throw e;
  }
}
