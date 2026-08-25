const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/^\uFEFF/, "");
const appSource = read("app.js");
const dictionaries = {
  ru: JSON.parse(read("locales/ru.json")),
  en: JSON.parse(read("locales/en.json")),
};

function functionSource(name) {
  const startMatch = new RegExp(`(?:async\\s+)?function ${name}\\(`).exec(appSource);
  const start = startMatch?.index ?? -1;
  assert.ok(start >= 0, `${name} should exist`);
  const rest = appSource.slice(start + 1);
  const nextMatch = /\n(?:async\s+)?function /.exec(rest);
  const end = nextMatch ? start + 1 + nextMatch.index : appSource.length;
  return appSource.slice(start, end);
}

function translator(locale) {
  return (key, params = {}) => String(dictionaries[locale][key] || key).replace(
    /\{([A-Za-z0-9_]+)\}/g,
    (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

function createElement() {
  return {
    attributes: {},
    classList: { toggle() {} },
    disabled: false,
    hidden: false,
    onclick: null,
    textContent: "",
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

function renderConnectState(locale, state, {
  account = null,
  recoverableStatus = "",
  upgradeSending = false,
} = {}) {
  const selectors = {
    "#extensionConnectCard": createElement(),
    "#extensionConnectTitle": createElement(),
    "#extensionConnectStatus": createElement(),
    "#extensionConnectConfirmButton": createElement(),
    "#extensionConnectDismissButton": createElement(),
    "#extensionConnectSummary": createElement(),
    "#extensionConnectIdentityForm": createElement(),
    "#extensionConnectIdentityEmailLabel": createElement(),
    "#extensionConnectEmailButton": createElement(),
  };
  const dollar = (selector) => selectors[selector] || null;
  const run = new Function(
    "$",
    "ensureExtensionConnectCard",
    "extensionConnectState",
    "getCurrentRecoverableAuthUser",
    "recoverableAuthState",
    "renderHomeProfile",
    "dismissExtensionConnectCard",
    "window",
    `${functionSource("renderExtensionConnectCard")}; renderExtensionConnectCard();`,
  );
  run(
    dollar,
    () => selectors["#extensionConnectCard"],
    { request: { extensionId: "okpfmpplfciccfddgibkcoliemfimifc" }, error: "", ...state },
    () => account,
    { status: recoverableStatus, upgradeSending },
    () => {},
    () => {},
    { t: translator(locale) },
  );
  return selectors;
}

function callErrorCopy(locale, error) {
  const run = new Function(
    "window",
    `${functionSource("getExtensionConnectErrorCopy")}; return getExtensionConnectErrorCopy;`,
  );
  return run({ t: translator(locale) })(error);
}

function callLinkErrorState(locale, error) {
  const run = new Function(
    "window",
    `${functionSource("getExtensionConnectLinkErrorState")}; return getExtensionConnectLinkErrorState;`,
  );
  return run({ t: translator(locale) })(error);
}

function callRuntimeErrorState(locale, error) {
  const run = new Function(
    "window",
    `${functionSource("getExtensionConnectErrorCopy")}; ${functionSource("getExtensionConnectRuntimeErrorState")}; return getExtensionConnectRuntimeErrorState;`,
  );
  return run({ t: translator(locale) })(error);
}

test("Extension Connect locale contract is complete and English has no Cyrillic", () => {
  const russianKeys = Object.keys(dictionaries.ru).filter((key) => key.startsWith("extension.connect.")).sort();
  const englishKeys = Object.keys(dictionaries.en).filter((key) => key.startsWith("extension.connect.")).sort();

  assert.deepEqual(englishKeys, russianKeys);
  assert.equal(russianKeys.length, 38);
  for (const key of russianKeys) {
    assert.notEqual(dictionaries.ru[key].trim(), "", `empty ru key: ${key}`);
    assert.notEqual(dictionaries.en[key].trim(), "", `empty en key: ${key}`);
    assert.doesNotMatch(dictionaries.en[key], /[А-Яа-яЁё]/, `Cyrillic in English key: ${key}`);
  }
});

test("Connect error mapping covers auth, handoff, edge, network, and generic states in both locales", () => {
  const cases = [
    [new Error("supabase_not_configured"), "extension.connect.error.supabase"],
    [Object.assign(new Error("unauthorized"), { status: 401 }), "extension.connect.error.auth.required"],
    [new Error("recoverable_identity_required"), "extension.connect.error.auth.required"],
    [new Error("extension_channel_unavailable"), "extension.connect.error.channel.unavailable"],
    [new Error("extension_handoff_timeout"), "extension.connect.error.handoff.timeout"],
    [new Error("extension_rejected:bad_nonce"), "extension.connect.error.link.expired"],
    [new Error("extension_rejected:bad_origin"), "extension.connect.error.origin"],
    [new Error("extension_rejected:bad_account"), "extension.connect.error.account"],
    [new Error("extension_rejected:unknown"), "extension.connect.error.rejected"],
    [new Error("Failed to fetch"), "extension.connect.error.network"],
    [new Error("unexpected"), "extension.connect.error.generic"],
  ];

  for (const locale of ["ru", "en"]) {
    for (const [error, key] of cases) {
      assert.equal(callErrorCopy(locale, error), dictionaries[locale][key]);
    }
  }
});

test("malformed, untrusted, and expired requests have distinct localized terminal states", () => {
  assert.deepEqual(callLinkErrorState("en", { code: "invalid_nonce" }), {
    status: "link_invalid",
    error: dictionaries.en["extension.connect.error.link.invalid"],
  });
  assert.deepEqual(callLinkErrorState("en", { code: "untrusted_extension_id" }), {
    status: "link_untrusted",
    error: dictionaries.en["extension.connect.error.link.untrusted"],
  });
  assert.deepEqual(callRuntimeErrorState("en", new Error("extension_rejected:bad_nonce")), {
    status: "link_expired",
    error: dictionaries.en["extension.connect.error.link.expired"],
  });
  assert.equal(callRuntimeErrorState("en", new Error("network failure")).status, "error");
});

test("English idle, identity, connected, retry, and blocked-link UI states stay fully English", () => {
  const idle = renderConnectState("en", { status: "idle" });
  assert.equal(idle["#extensionConnectTitle"].textContent, "Connect the Extension?");
  assert.equal(idle["#extensionConnectConfirmButton"].textContent, "Connect");
  assert.equal(idle["#extensionConnectDismissButton"].textContent, "Not now");

  const identity = renderConnectState("en", { status: "identity_required" });
  assert.equal(identity["#extensionConnectIdentityForm"].hidden, false);
  assert.equal(identity["#extensionConnectIdentityEmailLabel"].textContent, "Access email");
  assert.equal(identity["#extensionConnectEmailButton"].textContent, "Send link");
  assert.equal(identity["#extensionConnectConfirmButton"].hidden, true);

  const connected = renderConnectState("en", { status: "connected" }, {
    account: { hasEmailIdentity: true, email: "owner@example.com" },
  });
  assert.equal(connected["#extensionConnectTitle"].textContent, "Extension connected");
  assert.equal(connected["#extensionConnectStatus"].textContent, "Ideas from the Extension will be saved for owner@example.com.");
  assert.equal(connected["#extensionConnectConfirmButton"].textContent, "Connected");
  assert.equal(connected["#extensionConnectConfirmButton"].disabled, true);
  assert.equal(connected["#extensionConnectDismissButton"].textContent, "Close");

  const retry = renderConnectState("en", {
    status: "error",
    error: dictionaries.en["extension.connect.error.network"],
  });
  assert.equal(retry["#extensionConnectConfirmButton"].textContent, "Try again");
  assert.equal(retry["#extensionConnectConfirmButton"].disabled, false);
  assert.equal(retry["#extensionConnectStatus"].attributes.role, "alert");

  const untrusted = renderConnectState("en", {
    status: "link_untrusted",
    error: dictionaries.en["extension.connect.error.link.untrusted"],
  });
  assert.equal(untrusted["#extensionConnectTitle"].textContent, "Untrusted Extension");
  assert.equal(untrusted["#extensionConnectConfirmButton"].hidden, true);
  assert.equal(untrusted["#extensionConnectDismissButton"].textContent, "Close");

  const visibleCopy = Object.values({ idle, identity, connected, retry, untrusted })
    .flatMap((state) => Object.values(state).map((element) => element.textContent))
    .join(" ");
  assert.doesNotMatch(visibleCopy, /[А-Яа-яЁё]/);
});

test("Russian Connect UI keeps the accepted Russian flow", () => {
  const identity = renderConnectState("ru", { status: "identity_required" });
  assert.equal(identity["#extensionConnectTitle"].textContent, "Подключить расширение?");
  assert.equal(identity["#extensionConnectIdentityEmailLabel"].textContent, "Email для доступа");
  assert.equal(identity["#extensionConnectEmailButton"].textContent, "Отправить ссылку");

  const connected = renderConnectState("ru", { status: "connected" });
  assert.equal(connected["#extensionConnectTitle"].textContent, "Расширение подключено");
  assert.equal(connected["#extensionConnectDismissButton"].textContent, "Закрыть");
});

test("Connect implementation has no hardcoded Cyrillic UI strings", () => {
  const names = [
    "getExtensionConnectErrorCopy",
    "getExtensionConnectLinkErrorState",
    "getExtensionConnectRuntimeErrorState",
    "ensureExtensionConnectCard",
    "renderExtensionConnectCard",
    "submitExtensionConnectIdentityForm",
    "connectBackpackerExtension",
    "initializeExtensionConnectBridge",
  ];

  for (const name of names) {
    const executableSource = functionSource(name)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(executableSource, /[А-Яа-яЁё]/, `${name} contains hardcoded Cyrillic`);
  }
});

test("Connect modal has a labelled dialog contract and viewport-safe mobile geometry", () => {
  const source = functionSource("ensureExtensionConnectCard");
  assert.match(source, /setAttribute\("role", "dialog"\)/);
  assert.match(source, /setAttribute\("aria-modal", "true"\)/);
  assert.match(source, /aria-labelledby", "extensionConnectTitle"/);
  assert.match(source, /aria-describedby", "extensionConnectSummary extensionConnectStatus"/);
  assert.match(source, /width:100%;min-width:0;max-width:420px/);
  assert.match(source, /max-height:calc\(100dvh - 32px\);overflow:auto/);
  assert.match(source, /id="extensionConnectTitle" tabindex="-1"/);
  assert.match(source, /aria-live="polite" aria-atomic="true"/);
});
