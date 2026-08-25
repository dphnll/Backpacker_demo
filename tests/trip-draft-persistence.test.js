const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

function functionSource(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? appSource.indexOf(`function ${nextName}`, start) : -1;
  return appSource.slice(start, end === -1 ? undefined : end);
}

test("the draft is stored per identity and never under an anonymous bucket", () => {
  assert.match(appSource, /TRIP_DRAFT_PENDING_KEY_PREFIX = "backpacker\.tripDraftAi\.pending\.v1"/);
  const source = functionSource("getTripDraftPendingKey", "getTripDraftPendingSourceText");
  assert.match(source, /getCurrentRecoverableAuthUser\(\)\?\.id/);
  assert.match(source, /userId \? `\$\{TRIP_DRAFT_PENDING_KEY_PREFIX\}:\$\{userId\}` : ""/);
  assert.doesNotMatch(appSource, /pending\.v1:anonymous|"anonymous"/);
});

test("nothing is written or read without a resolved identity", () => {
  ["saveTripDraftPending", "readTripDraftPending", "clearTripDraftPending"].forEach((name) => {
    const source = functionSource(name, null).split("\n").slice(0, 12).join("\n");
    assert.match(source, /if \(!key\) return/, `${name} must bail out without a key`);
  });
});

test("only the whitelist is persisted, never the state object", () => {
  const source = functionSource("saveTripDraftPending", "scheduleTripDraftPendingSave");
  // Audio and transient flags must have no path into storage at all.
  ["mediaRecorder", "chunks", "audioDataUrl", "resumeMode"].forEach((field) => {
    assert.doesNotMatch(source, new RegExp(`${field}:`), `${field} must not be persisted`);
  });
  assert.doesNotMatch(source, /JSON\.stringify\(tripDraftAiState\)/, "the state object must never be serialized wholesale");
  ["schemaVersion", "updatedAt", "mode", "inputMode", "sourceText", "draft"].forEach((field) => {
    assert.match(source, new RegExp(`${field}[,:]`), `${field} belongs to the whitelist`);
  });
});

test("a half-updated state is never written", () => {
  const source = functionSource("saveTripDraftPending", "scheduleTripDraftPendingSave");
  assert.match(source, /if \(isBusy \|\| isCreating \|\| isRecording\) return/);
  assert.match(source, /if \(mode !== "input" && mode !== "preview" && mode !== "documents"\) return/);
});

test("any non-empty text is protected, with no minimum length", () => {
  const source = functionSource("saveTripDraftPending", "scheduleTripDraftPendingSave");
  // A Booking Pack is worth protecting even with an empty comment, so the text check alone
  // no longer decides whether to write.
  assert.match(source, /if \(!sourceText\.trim\(\) && !hasBookingPackWork\) return/);
  // The 20-character floor belongs to the parser, not to persistence.
  assert.doesNotMatch(source, /length < 20|length >= 20/);
});

test("a pending debounce is flushed before an async call takes over", () => {
  assert.match(functionSource("flushTripDraftPendingSave", "clearTripDraftPending"), /clearTimeout[\s\S]*saveTripDraftPending\(\)/);
  const parse = functionSource("parseTripDraftText", "createTripEntryFromDraft");
  assert.ok(
    parse.indexOf("flushTripDraftPendingSave()") < parse.indexOf("isBusy: true"),
    "the flush must happen before isBusy blocks saving",
  );
  assert.match(appSource, /if \(!tripDraftAiState\.isRecording\) flushTripDraftPendingSave\(\)/);
});

test("the draft is saved at every point where work would otherwise be lost", () => {
  assert.match(appSource, /addEventListener\("input", \(\) => scheduleTripDraftPendingSave\(\)\)/);
  assert.match(functionSource("syncTripDraftPreviewStateFromForm", "handleTripDraftPreviewAction"), /saveTripDraftPending\(\)/);
  const parse = functionSource("parseTripDraftText", "createTripEntryFromDraft");
  assert.match(parse, /mode: "preview", draft, sourceText: text \};\s*\n\s*saveTripDraftPending\(\)/);
});

test("opening the sheet no longer discards a saved draft unconditionally", () => {
  const source = functionSource("openTripDraftAiSheet", "startTripDraftTextMode");
  assert.match(source, /const pending = readTripDraftPending\(\)/);
  assert.match(source, /if \(pending\) restoreTripDraftPending\(pending\)/);
  assert.ok(
    source.indexOf("readTripDraftPending()") < source.indexOf("createEmptyTripDraftAiState()"),
    "the stored draft must be read before the state is reset",
  );
});

test("an incompatible contract restores only the traveller's own text", () => {
  const source = functionSource("restoreTripDraftPending", "continueTripDraftPending");
  assert.match(source, /pending\.schemaVersion !== TRIP_DRAFT_AI_SCHEMA_VERSION/);
  const branch = source.slice(source.indexOf("!== TRIP_DRAFT_AI_SCHEMA_VERSION"), source.indexOf("return;"));
  assert.match(branch, /mode: "input"/);
  assert.match(branch, /draft: null/, "a draft built by another contract must not be restored");
  assert.match(branch, /tripDraftT\("resume\.restored\.source"\)/);
});

test("a restored draft is re-normalized without guardrails", () => {
  // Guardrails ground values in the original description; hand-typed prices are not in it.
  assert.match(
    functionSource("restoreTripDraftPending", "continueTripDraftPending"),
    /normalizeTripDraftResponse\(\{ draft: pending\.draft \}, pending\.sourceText, \{ applyGuardrails: false \}\)/,
  );
});

test("the resume choice lives inside the existing sheet", () => {
  assert.match(htmlSource, /id="tripDraftResumeStep"/);
  assert.match(htmlSource, /data-trip-draft-resume="continue"/);
  assert.match(htmlSource, /data-trip-draft-resume="restart"/);
  // No third destructive action and no home-screen card were added.
  assert.doesNotMatch(htmlSource, /data-trip-draft-resume="delete"/);
  assert.doesNotMatch(appSource, /tripDraftResumeCard|renderTripDraftResumeNotice/);
  assert.match(appSource, /tripDraftAiState\.mode !== "resume"/);
});

test("restarting always confirms and then clears the stored draft", () => {
  const source = functionSource("restartTripDraftPending", "openTripDraftAiSheet");
  assert.match(source, /window\.confirm\(/);
  assert.ok(source.indexOf("window.confirm(") < source.indexOf("clearTripDraftPending()"), "confirm precedes the deletion");
  assert.match(source, /createEmptyTripDraftAiState\(\)/);
});

test("creating the trip clears the protected copy", () => {
  const source = functionSource("createTripFromAiDraft", null).slice(0, 3000);
  assert.ok(
    source.indexOf("persistTripStore(tripStore)") < source.indexOf("clearTripDraftPending()"),
    "the protected copy is cleared once the trip exists",
  );
});

test("persistence adds no analytics events carrying draft content", () => {
  const events = appSource.match(/trackEvent\("trip_draft[^"]*"[^)]*\)/g) || [];
  events.forEach((call) => {
    assert.doesNotMatch(call, /sourceText|draft\b|text:/, `analytics must not carry draft content: ${call}`);
  });
  assert.doesNotMatch(appSource, /trackEvent\("trip_draft_pending|trackEvent\("trip_draft_restored/);
});

test("no server storage and no cross-device sync were introduced", () => {
  const names = ["saveTripDraftPending", "readTripDraftPending", "clearTripDraftPending", "restoreTripDraftPending"];
  names.forEach((name) => {
    const source = functionSource(name, null).split("\n").slice(0, 40).join("\n");
    assert.doesNotMatch(source, /supabase|getSupabaseClient|schedulePrivateTripSync/i, `${name} must stay local`);
  });
});
