const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function functionSource(name) {
  const startMatch = new RegExp(`(?:async\\s+)?function ${name}\\(`).exec(appSource);
  const start = startMatch?.index ?? -1;
  assert.ok(start >= 0, `${name} should exist`);
  const rest = appSource.slice(start + 1);
  const nextMatch = /\n(?:async\s+)?function /.exec(rest);
  const end = nextMatch ? start + 1 + nextMatch.index : appSource.length;
  return appSource.slice(start, end);
}

// The card's layout is written as an inline `display: grid`. An inline
// declaration outranks the `[hidden] { display: none }` rule that the `hidden`
// attribute depends on, and `styles.css` has no `.extension-connect-card` rule
// to override it — so hiding the card by setting `hidden` left it on screen and
// only a reload appeared to close it. These tests hold the close path to
// removing the node instead.
test("closing the extension connect card removes it instead of setting hidden", () => {
  const renderSource = functionSource("renderExtensionConnectCard");
  const noRequestBranch = renderSource.slice(0, renderSource.indexOf("ensureExtensionConnectCard()"));

  assert.match(noRequestBranch, /if \(!request\)/);
  assert.match(noRequestBranch, /existing\.remove\(\)/);
  assert.doesNotMatch(noRequestBranch, /existing\.hidden\s*=/);
  assert.doesNotMatch(noRequestBranch, /\.hidden\s*=\s*true/);
});

test("the card is still built with the inline layout that made `hidden` useless", () => {
  // Kept as a live check rather than a comment: if this inline `display` ever
  // goes away, the removal above stays correct, but anyone reintroducing
  // `hidden` should have to look at this test and think again.
  assert.match(functionSource("ensureExtensionConnectCard"), /style\.cssText\s*=\s*"[^"]*display:grid/);
});

test("both dismiss labels run the same close path, before and after connecting", () => {
  const renderSource = functionSource("renderExtensionConnectCard");

  // One handler, rewired on every render, whatever the button currently says.
  assert.match(renderSource, /dismissButton\.onclick\s*=\s*dismissExtensionConnectCard/);
  assert.match(renderSource, /dismissButton\.textContent\s*=\s*connected\s*\?\s*"Закрыть"\s*:\s*"Не сейчас"/);
  assert.match(renderSource, /dismissButton\.disabled\s*=\s*false/);
});

test("dismissing clears the request so the card cannot re-render itself", () => {
  const dismissSource = functionSource("dismissExtensionConnectCard");

  assert.match(dismissSource, /extensionConnectState\s*=\s*{[\s\S]*request:\s*null/);
  assert.match(dismissSource, /renderExtensionConnectCard\(\)/);
});

test("closing the card does not touch the connect credential flow or the URL cleanup", () => {
  const dismissSource = functionSource("dismissExtensionConnectCard");
  const connectSource = functionSource("connectBackpackerExtension");

  // URL cleanup on dismiss is unchanged: same core helper, same replaceState.
  assert.match(dismissSource, /core\?\.stripExtensionConnectParams && window\.history\?\.replaceState/);
  assert.match(dismissSource, /window\.history\.replaceState\(\{\}, document\.title, core\.stripExtensionConnectParams\(window\.location\.href\)\)/);
  // Dismissal is inert: it must not mint, send or clear a credential.
  assert.doesNotMatch(dismissSource, /callExtensionConnectFunction|sendCredentialToExtension|buildCredentialBridgeMessage/);

  // The ordinary connect flow still mints server-side and hands the credential
  // straight to the extension, then strips the params.
  assert.match(connectSource, /callExtensionConnectFunction\("connect", \{ clientKey: request\.clientKey \}\)/);
  assert.match(connectSource, /core\.buildCredentialBridgeMessage\(/);
  assert.match(connectSource, /sendCredentialToExtension\(request\.extensionId, message\)/);
  assert.match(connectSource, /core\.stripExtensionConnectParams/);
});
