const assert = require("node:assert/strict");
const test = require("node:test");

const core = require("../group-trip-core.js");

const ANON_UID = "11111111-1111-4111-8111-111111111111";
const OTHER_UID = "22222222-2222-4222-8222-222222222222";
const SHARE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("old trips remain personal when the marker is absent", () => {
  assert.equal(core.isGroupTripState({ trip: { id: "trip-old" } }), false);
  assert.equal(core.isGroupTripState({ trip: { id: "trip-new", isGroupTrip: true } }), true);
});

test("pending join stores only whitelisted routing fields and expires", () => {
  const intent = core.createPendingGroupTripIntent({
    action: "join",
    shareId: SHARE_ID,
    authFlow: "upgrade",
    expectedUserId: ANON_UID,
    createdAt: "2026-09-04T10:00:00.000Z",
  });
  const serialized = core.serializePendingGroupTripIntent(intent);
  assert.deepEqual(Object.keys(JSON.parse(serialized)).sort(), [
    "action", "authFlow", "createdAt", "expectedUserId", "schemaVersion", "shareId",
  ]);
  assert.equal(serialized.includes("token"), false);
  assert.equal(core.restorePendingGroupTripIntent(serialized, { now: "2026-09-04T10:14:59.000Z" }).shareId, SHARE_ID);
  assert.equal(core.restorePendingGroupTripIntent(serialized, { now: "2026-09-04T10:15:01.000Z" }), null);
});

test("pending Group publish survives serialization with only its local trip id", () => {
  const serialized = core.serializePendingGroupTripIntent(core.createPendingGroupTripIntent({
    action: "publish_group",
    tripId: "trip-local-42",
    authFlow: "login",
    createdAt: "2026-09-04T10:00:00.000Z",
  }));
  assert.deepEqual(JSON.parse(serialized), {
    schemaVersion: 1,
    action: "publish_group",
    tripId: "trip-local-42",
    authFlow: "login",
    createdAt: "2026-09-04T10:00:00.000Z",
  });
  assert.equal(core.restorePendingGroupTripIntent(serialized, { now: "2026-09-04T10:05:00.000Z" }).tripId, "trip-local-42");
});

test("ordinary-to-organizer intent preserves only the safe mode switch marker", () => {
  const intent = core.createPendingGroupTripIntent({
    action: "publish_group",
    tripId: "trip-local-42",
    authFlow: "login",
    switchFrom: "ordinary",
  });
  assert.equal(intent.switchFrom, "ordinary");
  assert.equal(core.restorePendingGroupTripIntent(core.serializePendingGroupTripIntent(intent)).switchFrom, "ordinary");
  assert.equal(core.createPendingGroupTripIntent({
    action: "join",
    shareId: SHARE_ID,
    authFlow: "login",
    switchFrom: "ordinary",
  }).switchFrom, undefined);
});

test("pending intent rejects secret-bearing or descriptive fields", () => {
  const base = {
    schemaVersion: 1,
    action: "join",
    shareId: SHARE_ID,
    authFlow: "upgrade",
    expectedUserId: ANON_UID,
    createdAt: "2026-09-04T10:00:00.000Z",
  };
  assert.throws(() => core.normalizePendingGroupTripIntent({ ...base, rawToken: "secret" }), /unsafe_intent_field/);
  assert.throws(() => core.normalizePendingGroupTripIntent({ ...base, destination: "Kazan" }), /unsafe_intent_field/);
});

test("anonymous upgrade requires the same uid, returning login may change uid", () => {
  const durableUser = (id) => ({ id, isAnonymous: false, identities: [{ provider: "email" }] });
  const upgrade = core.createPendingGroupTripIntent({
    action: "join", shareId: SHARE_ID, authFlow: "upgrade", expectedUserId: ANON_UID,
  });
  assert.equal(core.getPendingGroupTripResumeDecision(upgrade, durableUser(ANON_UID)).resumeAllowed, true);
  assert.equal(core.getPendingGroupTripResumeDecision(upgrade, durableUser(OTHER_UID)).status, "uid_mismatch");
  const login = core.withPendingGroupTripAuthFlow(upgrade, "login");
  assert.equal(core.getPendingGroupTripResumeDecision(login, durableUser(OTHER_UID)).resumeAllowed, true);
});

test("anonymous identity cannot resume group work", () => {
  const intent = core.createPendingGroupTripIntent({
    action: "publish_group", tripId: "trip-1", authFlow: "upgrade", expectedUserId: ANON_UID,
  });
  assert.equal(core.getPendingGroupTripResumeDecision(intent, {
    id: ANON_UID, isAnonymous: true, providers: ["anonymous"],
  }).status, "identity_required");
});

test("invalid pending state never restores", () => {
  assert.equal(core.restorePendingGroupTripIntent("not-json"), null);
  assert.equal(core.restorePendingGroupTripIntent(JSON.stringify({ schemaVersion: 1, action: "join" })), null);
});
