const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  IdentityBridgeError,
  assertNoSecretsInPendingIntent,
  getIdentityBridgeState,
  restorePendingExtensionConnectIntent,
  serializePendingExtensionConnectIntent,
} = require("../identity-bridge-core.js");

const REQUEST = {
  extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  clientKey: "bpx_ext_client_123456",
  nonce: "0123456789abcdef0123456789abcdef",
};

test("anonymous user with Extension Connect request requires identity bridge", () => {
  const state = getIdentityBridgeState({
    user: {
      id: "owner-anon",
      isAnonymous: true,
      hasEmailIdentity: false,
      providers: [],
    },
    extensionConnectRequest: REQUEST,
  });

  assert.equal(state.status, "identity_required");
  assert.equal(state.reason, "anonymous_owner");
  assert.equal(state.connectAllowed, false);
  assert.equal(state.identityRequired, true);
  assert.deepEqual(state.request, REQUEST);
});

test("linked email user with Extension Connect request can connect", () => {
  const state = getIdentityBridgeState({
    user: {
      id: "owner-1",
      email: "owner@example.com",
      isAnonymous: false,
      hasEmailIdentity: true,
      providers: ["email"],
    },
    extensionConnectRequest: REQUEST,
  });

  assert.equal(state.status, "connect_allowed");
  assert.equal(state.connectAllowed, true);
  assert.equal(state.identityRequired, false);
  assert.equal(state.user.id, "owner-1");
  assert.equal(state.user.email, "owner@example.com");
});

test("missing Extension Connect request does not require identity bridge", () => {
  const state = getIdentityBridgeState({
    user: {
      id: "owner-anon",
      isAnonymous: true,
      providers: [],
    },
  });

  assert.equal(state.status, "no_extension_connect_request");
  assert.equal(state.connectAllowed, false);
  assert.equal(state.identityRequired, false);
});

test("pending Extension Connect intent serializes and restores without secrets", () => {
  const serialized = serializePendingExtensionConnectIntent(REQUEST, {
    createdAt: "2026-07-20T10:00:00.000Z",
  });

  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("refresh_token"), false);
  assert.equal(serialized.includes("bpxc_v1_"), false);
  assert.equal(serialized.includes("service_role"), false);
  assert.equal(serialized.includes("credential"), false);

  const restored = restorePendingExtensionConnectIntent(serialized, {
    now: new Date("2026-07-20T10:05:00.000Z"),
  });
  assert.deepEqual(restored, {
    schemaVersion: 1,
    createdAt: "2026-07-20T10:00:00.000Z",
    request: REQUEST,
  });
});

test("pending Extension Connect intent rejects secret-like values and expires", () => {
  assert.throws(
    () => assertNoSecretsInPendingIntent({ credential: "bpxc_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    IdentityBridgeError,
  );

  const serialized = serializePendingExtensionConnectIntent(REQUEST, {
    createdAt: "2026-07-20T10:00:00.000Z",
  });
  assert.equal(
    restorePendingExtensionConnectIntent(serialized, {
      now: new Date("2026-07-20T10:16:00.000Z"),
    }),
    null,
  );
});

test("pending Extension Connect intent rejects malformed identifiers", () => {
  assert.throws(
    () => serializePendingExtensionConnectIntent({ ...REQUEST, nonce: "short" }),
    IdentityBridgeError,
  );
  assert.throws(
    () => restorePendingExtensionConnectIntent({
      schemaVersion: 1,
      createdAt: "2026-07-20T10:00:00.000Z",
      request: { ...REQUEST, extensionId: "bad" },
    }, { now: new Date("2026-07-20T10:01:00.000Z") }),
    IdentityBridgeError,
  );
});

test("Backpacker Extension Connect gates Edge call behind Identity Bridge", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const flowStart = source.indexOf("async function connectBackpackerExtension()");
  assert.notEqual(flowStart, -1);
  const flowSource = source.slice(flowStart, source.indexOf("function initializeExtensionConnectBridge()", flowStart));
  const gateIndex = flowSource.indexOf("requireRecoverableIdentityForExtensionConnect(request)");
  const edgeIndex = flowSource.indexOf("callExtensionConnectFunction(\"connect\"");

  assert.notEqual(gateIndex, -1);
  assert.notEqual(edgeIndex, -1);
  assert.ok(gateIndex < edgeIndex);
  assert.match(flowSource, /identityState\.identityRequired/);
  assert.match(flowSource, /status:\s*"identity_required"/);
});

test("pending Extension Connect intent storage uses safe browser payload", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const storageStart = source.indexOf("function storePendingExtensionConnectIntent");
  assert.notEqual(storageStart, -1);
  const storageSource = source.slice(storageStart, source.indexOf("async function requireRecoverableIdentityForExtensionConnect", storageStart));

  assert.match(storageSource, /serializePendingExtensionConnectIntent\(request\)/);
  assert.match(storageSource, /window\.sessionStorage/);
  assert.match(storageSource, /window\.localStorage/);
  assert.match(storageSource, /storage\?\.setItem/);
  assert.doesNotMatch(storageSource, /credential/);
  assert.doesNotMatch(storageSource, /access_token/);
  assert.doesNotMatch(storageSource, /refresh_token/);
});

test("anonymous user entering Extension Connect sees recoverable access gate", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const cardStart = source.indexOf("function ensureExtensionConnectCard()");
  assert.notEqual(cardStart, -1);
  const cardSource = source.slice(cardStart, source.indexOf("function dismissExtensionConnectCard()", cardStart));

  assert.match(cardSource, /extensionConnectIdentityForm/);
  assert.match(cardSource, /extension\.connect\.identity\.email\.label/);
  assert.match(cardSource, /extension\.connect\.summary\.identity/);
  assert.match(cardSource, /extension\.connect\.status\.identity/);
  assert.doesNotMatch(cardSource, /Credential/);
  assert.doesNotMatch(cardSource, /anonymous user/);
  assert.doesNotMatch(cardSource, /token/);
  assert.doesNotMatch(cardSource, /текущий аккаунт/);
});

test("Extension Connect connected state keeps dismiss action available", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const renderStart = source.indexOf("function renderExtensionConnectCard()");
  assert.notEqual(renderStart, -1);
  const renderSource = source.slice(renderStart, source.indexOf("function dismissExtensionConnectCard()", renderStart));

  assert.match(renderSource, /dismissButton\.disabled\s*=\s*false/);
  assert.match(renderSource, /dismissButton\.onclick\s*=\s*dismissExtensionConnectCard/);
  assert.match(renderSource, /dismissButton\.textContent\s*=\s*window\.t\(connected \|\| linkState/);
  assert.match(renderSource, /extension\.connect\.action\.close/);
  assert.match(renderSource, /extension\.connect\.action\.cancel/);
});

test("Extension Connect magic link flow stores pending intent before sending email", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const submitStart = source.indexOf("async function submitExtensionConnectIdentityForm");
  assert.notEqual(submitStart, -1);
  const submitSource = source.slice(submitStart, source.indexOf("async function connectBackpackerExtension", submitStart));
  const storeIndex = submitSource.indexOf("storePendingExtensionConnectIntent(request)");
  const sendIndex = submitSource.indexOf("client.auth.updateUser");

  assert.notEqual(storeIndex, -1);
  assert.notEqual(sendIndex, -1);
  assert.ok(storeIndex < sendIndex);
  assert.match(submitSource, /getRecoverableAuthEmailFromInput\("#extensionConnectEmailInput"\)/);
  assert.doesNotMatch(submitSource, /signInWithPassword/);
});

test("Recoverable Auth callback restores pending Extension Connect request", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const callbackStart = source.indexOf("async function handleRecoverableAuthCallback()");
  assert.notEqual(callbackStart, -1);
  const callbackSource = source.slice(callbackStart, source.indexOf("function subscribeRecoverableAuthChanges()", callbackStart));
  assert.match(callbackSource, /resumePendingExtensionConnectAfterRecoverableAuth\(user\)/);

  const resumeStart = source.indexOf("async function resumePendingExtensionConnectAfterRecoverableAuth");
  assert.notEqual(resumeStart, -1);
  const resumeSource = source.slice(resumeStart, source.indexOf("async function requireRecoverableIdentityForExtensionConnect", resumeStart));
  assert.match(resumeSource, /readPendingExtensionConnectIntent\(\)/);
  assert.match(resumeSource, /extensionConnectState\s*=\s*\{/);
  assert.match(resumeSource, /clearPendingExtensionConnectIntent\(\)/);
  assert.match(resumeSource, /connectBackpackerExtension\(\)/);
});
