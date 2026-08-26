const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sourceContract = require("../analytics-source-contract.js");
const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const workerSource = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");

function functionSource(name) {
  const startMatch = new RegExp(`(?:async\\s+)?function ${name}\\(`).exec(appSource);
  const start = startMatch?.index ?? -1;
  assert.ok(start >= 0, `${name} should exist`);
  const rest = appSource.slice(start + 1);
  const nextMatch = /\n(?:async\s+)?function /.exec(rest);
  const end = nextMatch ? start + 1 + nextMatch.index : appSource.length;
  return appSource.slice(start, end);
}

test("source schema and event contract versions are independent and loaded before app", () => {
  assert.equal(sourceContract.ANALYTICS_SCHEMA_VERSION, "2026-08-26.1");
  assert.equal(sourceContract.EVENT_CONTRACT_VERSION, "0.2");
  assert.ok(indexSource.indexOf("analytics-source-contract.js") < indexSource.indexOf("app.js?v=app-shared-20260826"));
  assert.match(workerSource, /backpacker-pwa-v128/);
  assert.match(workerSource, /analytics-source-contract\.js\?v=app-shared-20260826/);
});

async function runAppShare({ share, copied = true }) {
  const events = [];
  const sandbox = {
    navigator: { share },
    window: {
      location: {
        origin: "https://dphnll.github.io",
        pathname: "/Backpacker_demo/",
        protocol: "https:",
      },
      t: () => "share text",
    },
    copyText: async () => copied,
    showToast() {},
    trackEvent(name, props) {
      events.push({ name, props });
    },
  };
  vm.runInNewContext(`${functionSource("shareApp")}; this.shareApp = shareApp;`, sandbox);
  await sandbox.shareApp();
  return events;
}

async function runCopyText({ clipboardWorks, legacyCopied }) {
  const toasts = [];
  const textarea = { remove() {}, select() {}, value: "" };
  const sandbox = {
    navigator: { clipboard: { writeText: async () => {
      if (!clipboardWorks) throw new Error("clipboard unavailable");
    } } },
    document: {
      body: { appendChild() {} },
      createElement: () => textarea,
      execCommand: () => legacyCopied,
    },
    window: { t: () => "copied" },
    showToast: (message) => toasts.push(message),
  };
  vm.runInNewContext(`${functionSource("copyText")}; this.copyText = copyText;`, sandbox);
  return { copied: await sandbox.copyText("canonical app link"), toasts };
}

test("app Share emits once only after confirmed Web Share or clipboard success", async () => {
  assert.deepEqual(await runAppShare({ share: async () => {} }), [{ name: "app_shared", props: undefined }]);
  assert.deepEqual(await runAppShare({
    share: async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); },
  }), []);
  assert.deepEqual(await runAppShare({
    share: async () => { throw new Error("share failed"); },
    copied: true,
  }), [{ name: "app_shared", props: undefined }]);
  assert.deepEqual(await runAppShare({ share: undefined, copied: false }), []);
  assert.deepEqual(await runCopyText({ clipboardWorks: true }), { copied: true, toasts: ["copied"] });
  assert.deepEqual(await runCopyText({ clipboardWorks: false, legacyCopied: true }), { copied: true, toasts: ["copied"] });
  assert.deepEqual(await runCopyText({ clipboardWorks: false, legacyCopied: false }), { copied: false, toasts: [] });
});

test("app_shared has no event properties or share content", () => {
  assert.deepEqual(sourceContract.sanitizeEventProperties("app_shared", {
    url: "https://private.example.test",
    title: "private title",
    text: "private text",
    method: "clipboard",
  }), {});
  assert.deepEqual(sourceContract.getMissingRequiredProperties("app_shared", {}), []);
});

test("canonical Supabase capture receives the privacy and source-time envelope", () => {
  const context = functionSource("getAnalyticsContext");
  const track = functionSource("trackEvent");
  assert.match(context, /event_contract_version: ANALYTICS_EVENT_CONTRACT_VERSION/);
  assert.match(context, /identity_type: getAnalyticsIdentityType\(\)/);
  assert.match(context, /"\$geoip_disable": true/);
  assert.match(track, /source_event_timestamp: new Date\(\)\.toISOString\(\)/);
  assert.match(track, /sanitizeEventProperties\(name, props\)/);
  assert.match(track, /sanitizeContractEventPayload\(name, rawPayload\)/);
  assert.match(track, /missingRequired\.length[\s\S]*return/);
  assert.match(track, /writeSupabaseAnalyticsEvent\(name, payload\)/);
  assert.doesNotMatch(track, /posthog|sendBeacon|sendPostHogEvent/i);
});

test("contract success payloads contain only the approved common envelope and event allowlist", () => {
  const payload = sourceContract.sanitizeContractEventPayload("idea_saved", {
    anon_user_id: "anon-1",
    session_id: "session-1",
    analytics_schema_version: "2026-08-26.1",
    event_contract_version: "0.2",
    app_version: "1.1.2.80",
    environment: "production",
    is_internal_user: false,
    is_test_user: false,
    identity_type: "anonymous_browser",
    source_event_timestamp: "2026-08-25T12:00:00.000Z",
    "$geoip_disable": true,
    idea_id: "idea-1",
    capture_source: "extension",
    screen: "ideas",
    display_mode: "browser",
    title: "Private captured title",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "$geoip_disable", "analytics_schema_version", "anon_user_id", "app_version", "capture_source",
    "environment", "event_contract_version", "idea_id", "identity_type", "is_internal_user",
    "is_test_user", "session_id", "source_event_timestamp",
  ].sort());
  assert.equal(JSON.stringify(payload).includes("Private"), false);
});

test("core allowlist strips content and normalizes controlled values", () => {
  const safe = sourceContract.sanitizeEventProperties("item_created", {
    trip_id: "trip-1",
    trip_origin: "unexpected",
    item_id: "item-1",
    creation_source: "travel_idea",
    source_idea_id: "idea-1",
    title: "Secret title",
    notes: "Secret notes",
    url: "https://example.test/private",
    exact_date: "2026-08-25",
    arbitrary: "not in contract",
    has_note: true,
  });
  assert.deepEqual(safe, {
    trip_id: "trip-1",
    trip_origin: "user_created",
    item_id: "item-1",
    creation_source: "idea",
    source_idea_id: "idea-1",
    has_note: true,
  });
  assert.equal(JSON.stringify(safe).includes("Secret"), false);
  assert.equal(JSON.stringify(safe).includes("example.test"), false);
});

test("opaque identifiers and idea correlation are contract-bound", () => {
  const idea = sourceContract.sanitizeEventProperties("idea_saved", {
    idea_id: "idea:5d8a-1",
    capture_source: "extension",
    title: "Must not cross",
  });
  assert.deepEqual(idea, { idea_id: "idea:5d8a-1", capture_source: "extension" });
  assert.deepEqual(sourceContract.sanitizeEventProperties("idea_add_to_trip_started", {
    idea_id: "idea:5d8a-1",
    capture_source: "browser_extension",
  }), { idea_id: "idea:5d8a-1", capture_source: "extension" });
  const invalid = sourceContract.sanitizeEventProperties("idea_saved", {
    idea_id: "Idea title with spaces",
    capture_source: "future-free-text-source",
  });
  assert.deepEqual(invalid, { capture_source: "other" });
  const manualItem = sourceContract.sanitizeEventProperties("item_created", {
    trip_id: "trip-1", trip_origin: "user_created", item_id: "item-1",
    creation_source: "manual", source_idea_id: "idea-1",
  });
  assert.equal(manualItem.source_idea_id, undefined);
});

test("required contract properties reject malformed success events", () => {
  const missingShare = sourceContract.getMissingRequiredProperties("trip_share_created", {
    trip_id: "trip-1", actor_role: "owner", access_mode: "view", share_source: "link",
  });
  assert.deepEqual(missingShare, ["collaboration_id"]);
  const validIdea = sourceContract.getMissingRequiredProperties("idea_saved", {
    idea_id: "idea-1", capture_source: "manual",
  });
  assert.deepEqual(validIdea, []);
});

test("sharing success events occur only after confirmed server reads or grants", () => {
  const publish = functionSource("publishTripShare");
  assert.ok(publish.indexOf('callTripShareFunction("publish"') < publish.indexOf('trackEvent("trip_share_created"'));
  assert.ok(publish.indexOf("saveTripShareRecord(record)") < publish.indexOf('trackEvent("trip_share_created"'));
  assert.match(publish, /record\.shareId && record\.shareId !== existing\?\.shareId/);
  assert.match(publish, /collaboration_id: record\.shareId/);
  assert.doesNotMatch(publish.slice(publish.indexOf('trackEvent("trip_share_created"')), /token/);

  const publicRead = functionSource("loadReadOnlyShareFromUrl");
  assert.ok(publicRead.indexOf('callTripShareFunction("read"') < publicRead.indexOf('trackEvent("shared_trip_opened"'));
  assert.match(publicRead, /!share\.isOwner && share\.shareId && share\.sourceTripId/);
  const receivedRead = functionSource("openReceivedTrip");
  assert.ok(receivedRead.indexOf('callTripShareFunction("read_received"') < receivedRead.indexOf('trackEvent("shared_trip_opened"'));
  assert.doesNotMatch(appSource, /trackEvent\("received_trip_opened"/);
});

test("Ideas lifecycle starts only after persistence and completes through ordinary item save", () => {
  const submit = functionSource("submitIdeaForm");
  const updateIndex = submit.indexOf("await api.updateTravelIdea");
  const insertIndex = submit.indexOf("await api.insertTravelIdea");
  const savedEventIndex = submit.indexOf('trackEvent("idea_saved"');
  assert.ok(updateIndex >= 0 && updateIndex < insertIndex);
  assert.doesNotMatch(submit.slice(updateIndex, insertIndex), /trackEvent\("idea_saved"/);
  assert.ok(insertIndex < savedEventIndex);
  assert.match(submit, /idea_id: saved\.id/);
  assert.match(submit, /capture_source: saved\.source \|\| payload\.source/);
  assert.doesNotMatch(functionSource("archiveCurrentIdea"), /trackEvent\("idea_saved"/);

  const start = functionSource("openTravelIdeaDestinationPicker");
  assert.match(start, /trackEvent\("idea_add_to_trip_started"/);
  assert.match(start, /idea_id: sourceIdea\.id/);
  const draft = functionSource("openTravelIdeaItemDraft");
  assert.match(draft, /creationMethod: "idea"/);
  const save = functionSource("saveItem");
  assert.match(save, /creation_source: createContext\.creationMethod \|\| "manual"/);
  assert.match(save, /source_idea_id: createContext\.sourceIdeaId/);
});

test("meaningful actions exclude no-op saves and same-day reorder", () => {
  const saveItem = functionSource("saveItem");
  const saveTrip = functionSource("saveTrip");
  const moveItem = functionSource("moveItem");
  assert.match(saveItem, /if \(isNew \|\| changedFields\.length\)[\s\S]*trackEvent\(isNew \? "item_created" : "item_updated"/);
  assert.match(saveTrip, /if \(changedFields\.length\)[\s\S]*trackEvent\("trip_settings_updated"/);
  assert.match(moveItem, /if \(previousDate !== moving\.date\)[\s\S]*trackEvent\("item_day_changed"/);
  assert.match(moveItem, /from_bucket: previousDate \? "day" : "undated"/);
  assert.doesNotMatch(moveItem, /reordered_inside_bucket/);
});

test("AI draft and accepted proposals emit persisted item success signals", () => {
  const ai = functionSource("createTripFromAiDraft");
  assert.ok(ai.indexOf("persistTripStore(tripStore)") < ai.indexOf('trackEvent("item_created"'));
  assert.match(ai, /creation_source: "ai_draft"/);
  const proposal = functionSource("trackPersistedItemAnalyticsChanges");
  assert.match(proposal, /trackEvent\("item_created"/);
  assert.match(proposal, /trackEvent\("item_updated"/);
  assert.match(functionSource("acceptItemProposal"), /trackPersistedItemAnalyticsChanges\(previousItems, state\.items, "proposal"\)/);
  assert.match(functionSource("acceptExpenseProposal"), /trackPersistedItemAnalyticsChanges\(previousItems, state\.items, "proposal"\)/);
});

test("new success event names have one canonical emitter per lifecycle path", () => {
  assert.equal((appSource.match(/trackEvent\("app_shared"/g) || []).length, 2);
  assert.equal((appSource.match(/trackEvent\("trip_share_created"/g) || []).length, 1);
  assert.equal((appSource.match(/trackEvent\("idea_saved"/g) || []).length, 1);
  assert.equal((appSource.match(/trackEvent\("idea_add_to_trip_started"/g) || []).length, 1);
  assert.equal((appSource.match(/trackEvent\("shared_trip_opened"/g) || []).length, 2);
});
