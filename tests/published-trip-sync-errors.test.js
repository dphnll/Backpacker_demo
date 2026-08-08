const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs
  .readFileSync(path.join(__dirname, "../app.js"), "utf8")
  .replace(/^﻿/, "")
  .replace(/\r\n/g, "\n");

function functionSource(name) {
  // `async` has to be part of the pattern: ensureTripSharePublished is async,
  // and a plain `function <name>(` lookup silently misses it.
  const start = new RegExp(`\\n(?:async )?function ${name}\\(`).exec(app);
  assert.notEqual(start, null, `${name} must exist`);
  const rest = app.slice(start.index + 1);
  const next = /\n(?:async\s+)?function /.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

// The classifier depends on nothing but the error it is handed, so it can be
// lifted out of app.js and exercised for real instead of pattern-matched.
const classify = new Function(`${functionSource("classifyTripShareSyncError")}\nreturn classifyTripShareSyncError;`)();

test("a lost browser identity is told apart from a lost network", () => {
  // The published row is looked up by owner, and the owner is this browser's
  // anonymous identity. Once it changes the row is never found again: the trip
  // still saves locally while the published copy quietly stops updating. That
  // cannot heal on its own, so it must not be retried and must not be reported
  // the same way as a network blip.
  const notFound = Object.assign(new Error("share_not_found"), { status: 404 });
  assert.equal(classify(notFound), "orphaned");
  assert.equal(classify(Object.assign(new Error("whatever"), { status: 404 })), "orphaned");

  // No status at all is a failed fetch — offline, lost signal, DNS.
  assert.equal(classify(new Error("Failed to fetch")), "retry");
  assert.equal(classify(Object.assign(new Error("boom"), { status: 500 })), "retry");
  assert.equal(classify(Object.assign(new Error("slow"), { status: 408 })), "retry");
  assert.equal(classify(Object.assign(new Error("busy"), { status: 429 })), "retry");

  // A build without Supabase has no link to keep in sync; there is nothing to
  // tell the traveller about.
  assert.equal(classify(new Error("supabase_not_configured")), "silent");

  // Anything else is a real refusal and is reported at once.
  assert.equal(classify(Object.assign(new Error("forbidden"), { status: 403 })), "final");
});

test("a transient failure is survived quietly and reported only once", () => {
  const scheduler = functionSource("schedulePublishedTripSync");
  assert.match(scheduler, /kind === "retry" && attempt < TRIP_SHARE_SYNC_RETRIES/);
  assert.match(scheduler, /if \(kind === "silent"\) return;/);
  // The swallowed cause was the reason this could not be diagnosed at all.
  assert.match(scheduler, /console\.warn\(/);
  // A cause already announced is not announced again on the next save; the
  // chip used to arrive after every single edit.
  assert.match(functionSource("reportTripShareSyncFailure"), /if \(tripShareSyncReported === kind\) return;/);
  assert.match(scheduler, /tripShareSyncReported = "";/, "a success clears the way for the next report");
});

test("an orphaned link stops syncing and can be recreated", () => {
  // Hammering an endpoint that answers 404 forever is what produced the chip
  // on every save.
  assert.match(functionSource("schedulePublishedTripSync"), /record\.revoked \|\| record\.orphaned/);
  // Recreating changes the public address, so it happens on a human action.
  assert.match(functionSource("ensureTripSharePublished"), /&& !existing\.orphaned/);
  // The reason survives the chip: a phone has no console to read.
  assert.match(functionSource("renderTripLinkOptions"), /orphaned/);
  assert.match(functionSource("reportTripShareSyncFailure"), /lastSyncError/);
});
