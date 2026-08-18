const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CONNECT_MESSAGE_TYPE,
  ExtensionConnectUiError,
  assertNoCredentialInUrl,
  buildCredentialBridgeMessage,
  parseExtensionConnectRequest,
  resolveExtensionConnectFunctionUrl,
  stripExtensionConnectParams,
} = require("../extension-connect-ui-core.js");

const EXTENSION_ID = "okpfmpplfciccfddgibkcoliemfimifc";
const UNLISTED_EXTENSION_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CLIENT_KEY = "bpx_ext_client_123456";
const NONCE = "0123456789abcdef0123456789abcdef";
const CREDENTIAL = `bpxc_v1_${"a".repeat(64)}`;
const ACCOUNT = { email: "owner@example.com" };

test("parses and normalizes a safe Extension Connect request", () => {
  assert.deepEqual(
    parseExtensionConnectRequest(`https://dphnll.github.io/Backpacker_demo/?extensionConnect=1&extensionId=${EXTENSION_ID}&clientKey=BPX_EXT_CLIENT_123456&nonce=${NONCE}`),
    {
      extensionId: EXTENSION_ID,
      clientKey: CLIENT_KEY,
      nonce: NONCE,
    },
  );
});

test("returns null when the URL is not an Extension Connect request", () => {
  assert.equal(parseExtensionConnectRequest("https://dphnll.github.io/Backpacker_demo/"), null);
});

test("rejects unsafe bridge identifiers before UI can send a credential", () => {
  for (const href of [
    `https://app.test/?extensionConnect=1&extensionId=bad&clientKey=${CLIENT_KEY}&nonce=${NONCE}`,
    `https://app.test/?extensionConnect=1&extensionId=${EXTENSION_ID}&clientKey=x&nonce=${NONCE}`,
    `https://app.test/?extensionConnect=1&extensionId=${EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=short`,
  ]) {
    assert.throws(() => parseExtensionConnectRequest(href), ExtensionConnectUiError);
  }
});

test("rejects every well-formed Extension ID except the official CWS item", () => {
  assert.throws(
    () => parseExtensionConnectRequest(`https://app.test/?extensionConnect=1&extensionId=${UNLISTED_EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=${NONCE}`),
    (error) => error instanceof ExtensionConnectUiError && error.code === "untrusted_extension_id",
  );
});

test("keeps non-production Extension IDs available only for local smoke", () => {
  assert.equal(
    parseExtensionConnectRequest(`http://127.0.0.1:4181/?extensionConnect=1&extensionId=${UNLISTED_EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=${NONCE}`).extensionId,
    UNLISTED_EXTENSION_ID,
  );
  assert.equal(
    parseExtensionConnectRequest(`http://localhost:4181/?extensionConnect=1&extensionId=${UNLISTED_EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=${NONCE}`).extensionId,
    UNLISTED_EXTENSION_ID,
  );
});

test("credential bridge message contains no owner id or Supabase session token", () => {
  const request = parseExtensionConnectRequest(`https://app.test/?extensionConnect=1&extensionId=${EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=${NONCE}`);
  const message = buildCredentialBridgeMessage({
    request,
    account: ACCOUNT,
    credential: CREDENTIAL,
    connection: { clientKey: CLIENT_KEY, expiresAt: "2026-10-17T10:00:00.000Z" },
  });
  assert.deepEqual(message, {
    type: CONNECT_MESSAGE_TYPE,
    schemaVersion: 1,
    nonce: NONCE,
    clientKey: CLIENT_KEY,
    credential: CREDENTIAL,
    connection: {
      clientKey: CLIENT_KEY,
      expiresAt: "2026-10-17T10:00:00.000Z",
    },
    account: { email: "owner@example.com" },
  });
  assert.equal(Object.hasOwn(message, "ownerUserId"), false);
  assert.equal(Object.hasOwn(message, "accessToken"), false);
});

test("credential bridge message requires a safe account email but never internal owner ids", () => {
  const request = parseExtensionConnectRequest(`https://app.test/?extensionConnect=1&extensionId=${EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=${NONCE}`);
  assert.throws(
    () => buildCredentialBridgeMessage({
      request,
      credential: CREDENTIAL,
      connection: { clientKey: CLIENT_KEY, expiresAt: "2026-10-17T10:00:00.000Z" },
    }),
    /invalid_account/,
  );
  const message = buildCredentialBridgeMessage({
    request,
    account: { email: " OWNER@EXAMPLE.COM " },
    credential: CREDENTIAL,
    connection: { clientKey: CLIENT_KEY, expiresAt: "2026-10-17T10:00:00.000Z" },
  });
  assert.deepEqual(message.account, { email: "owner@example.com" });
  assert.equal(JSON.stringify(message).includes("owner_user_id"), false);
});

test("connect URL cleanup keeps only ordinary app params and never carries credentials", () => {
  const cleaned = stripExtensionConnectParams(`https://app.test/?trip=1&extensionConnect=1&extensionId=${EXTENSION_ID}&clientKey=${CLIENT_KEY}&nonce=${NONCE}`);
  assert.equal(cleaned, "https://app.test/?trip=1");
  assert.equal(assertNoCredentialInUrl(cleaned), true);
  assert.throws(() => assertNoCredentialInUrl(`https://app.test/?credential=${CREDENTIAL}`), /credential_url_leak/);
});

test("resolves production Extension Connect endpoint from the configured Supabase project URL", () => {
  assert.equal(
    resolveExtensionConnectFunctionUrl({ url: "https://dzypqopspfuingvistkm.supabase.co/" }),
    "https://dzypqopspfuingvistkm.supabase.co/functions/v1/extension-connect",
  );
});

test("allows only explicit local Extension Connect function overrides for local smoke", () => {
  assert.equal(
    resolveExtensionConnectFunctionUrl({
      url: "https://dzypqopspfuingvistkm.supabase.co",
      extensionConnectFunctionUrl: " http://127.0.0.1:54321/functions/v1/extension-connect/ ",
    }),
    "http://127.0.0.1:54321/functions/v1/extension-connect",
  );
  assert.equal(
    resolveExtensionConnectFunctionUrl({
      url: "https://dzypqopspfuingvistkm.supabase.co",
      extensionConnectFunctionUrl: "https://evil.test/functions/v1/extension-connect",
    }),
    "https://dzypqopspfuingvistkm.supabase.co/functions/v1/extension-connect",
  );
  assert.equal(
    resolveExtensionConnectFunctionUrl({
      url: "https://dzypqopspfuingvistkm.supabase.co",
      extensionConnectFunctionUrl: "http://127.0.0.1:54321/functions/v1/extension-connect?token=bad",
    }),
    "https://dzypqopspfuingvistkm.supabase.co/functions/v1/extension-connect",
  );
});
