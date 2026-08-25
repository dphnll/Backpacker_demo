const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  callPlatformFileAction,
  getPlatformFileBoundary,
  isPlatformFileActionAvailable,
  normalizePlatformFileResult,
} = require("../platform-file-boundary-core.js");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");

function functionSource(name) {
  const startMatch = new RegExp(`(?:async\\s+)?function ${name}\\(`).exec(appSource);
  const start = startMatch?.index ?? -1;
  assert.ok(start >= 0, `${name} should exist`);
  const rest = appSource.slice(start + 1);
  const nextMatch = /\n(?:async\s+)?function /.exec(rest);
  const end = nextMatch ? start + 1 + nextMatch.index : appSource.length;
  return appSource.slice(start, end);
}

/**
 * Strips comments so that assertions about order and absence look at code only.
 * The comments around this boundary deliberately name `export_completed` and
 * `navigator.canShare` while explaining why they are where they are, and a test
 * that reads prose would pass or fail on the wording.
 */
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function scopeWith(boundary) {
  return { BackpackerPlatformFiles: boundary };
}

test("no boundary at all means every action is unavailable, so the browser path stays in charge", () => {
  assert.equal(getPlatformFileBoundary({}), null);
  assert.equal(isPlatformFileActionAvailable("savePdf", {}), false);
  assert.equal(isPlatformFileActionAvailable("sharePdf", {}), false);
  assert.equal(isPlatformFileActionAvailable("openRemoteDocument", {}), false);
  // A boundary object that only implements one action leaves the others alone.
  const partial = scopeWith({ savePdf: () => ({ status: "success" }) });
  assert.equal(isPlatformFileActionAvailable("savePdf", partial), true);
  assert.equal(isPlatformFileActionAvailable("sharePdf", partial), false);
  // Anything that is not one of the three known actions is never available.
  assert.equal(isPlatformFileActionAvailable("deleteEverything", scopeWith({ deleteEverything: () => ({}) })), false);
});

test("native success, cancellation and failure each normalize to their own result", async () => {
  const success = await callPlatformFileAction("savePdf", [], scopeWith({ savePdf: async () => ({ status: "success" }) }));
  assert.deepEqual(success, { status: "success" });

  const cancelled = await callPlatformFileAction("sharePdf", [], scopeWith({ sharePdf: async () => ({ status: "cancelled" }) }));
  assert.deepEqual(cancelled, { status: "cancelled" });

  const failure = await callPlatformFileAction(
    "savePdf",
    [],
    scopeWith({ savePdf: async () => ({ status: "failure", code: "no_space" }) }),
  );
  assert.deepEqual(failure, { status: "failure", code: "no_space" });
});

test("a malformed answer is a failure, never an accidental success", () => {
  for (const malformed of [undefined, null, "success", 42, [], { status: "done" }, { status: undefined }]) {
    assert.deepEqual(
      normalizePlatformFileResult(malformed),
      { status: "failure", code: "invalid_result" },
      `${JSON.stringify(malformed)} should not pass as a result`,
    );
  }
});

test("a native exception becomes a failure instead of escaping to the caller", async () => {
  const thrown = await callPlatformFileAction("savePdf", [], scopeWith({
    savePdf: () => {
      throw new Error("java.lang.SecurityException: /storage/emulated/0 denied");
    },
  }));
  assert.deepEqual(thrown, { status: "failure", code: "native_error" });

  const rejected = await callPlatformFileAction("sharePdf", [], scopeWith({
    sharePdf: async () => Promise.reject(new Error("boom")),
  }));
  assert.deepEqual(rejected, { status: "failure", code: "native_error" });

  // Calling an action that is not there is a failure too, not a silent success.
  assert.deepEqual(await callPlatformFileAction("savePdf", [], {}), { status: "failure", code: "invalid_result" });
});

test("failure codes are sanitised before they can reach analytics", async () => {
  const cases = [
    ["NO_SPACE", "no_space"],
    ["  disk_full  ", "disk_full"],
    ["/storage/emulated/0/Download/plan.pdf", "unspecified"],
    ["код-с-пробелами и кириллицей", "unspecified"],
    [undefined, "unspecified"],
    ["x".repeat(41), "unspecified"],
  ];
  for (const [code, expected] of cases) {
    const result = await callPlatformFileAction("savePdf", [], scopeWith({
      savePdf: async () => ({ status: "failure", code }),
    }));
    assert.deepEqual(result, { status: "failure", code: expected }, `code ${String(code)}`);
  }
});

test("the boundary receives only a URL, or a file name and a Blob — never product objects", async () => {
  const seen = [];
  const scope = scopeWith({
    openRemoteDocument: async (...args) => {
      seen.push(["openRemoteDocument", args]);
      return { status: "success" };
    },
    savePdf: async (...args) => {
      seen.push(["savePdf", args]);
      return { status: "success" };
    },
  });
  const blob = { size: 10, type: "application/pdf" };
  await callPlatformFileAction("openRemoteDocument", ["https://example.test/signed"], scope);
  await callPlatformFileAction("savePdf", ["plan.pdf", blob], scope);

  assert.deepEqual(seen[0], ["openRemoteDocument", ["https://example.test/signed"]]);
  assert.deepEqual(seen[1], ["savePdf", ["plan.pdf", blob]]);
});

test("the web core never imports a native SDK and never names a mobile platform", () => {
  const coreSource = fs.readFileSync(path.join(__dirname, "..", "platform-file-boundary-core.js"), "utf8");
  for (const forbidden of ["@capacitor", "capacitor", "cordova", "android", "ios", "requestPermission"]) {
    assert.doesNotMatch(coreSource.toLowerCase(), new RegExp(forbidden.toLowerCase()), `core mentions ${forbidden}`);
  }
});

test("the native attachment branch is taken before any about:blank window is opened", () => {
  const openSource = codeOnly(functionSource("openTripItemAttachment"));
  const nativeBranch = openSource.indexOf('hasPlatformFileAction("openRemoteDocument")');
  const blankWindow = openSource.indexOf('window.open("about:blank"');
  assert.ok(nativeBranch >= 0, "the native branch should exist");
  assert.ok(blankWindow >= 0, "the browser path should still open its own window");
  assert.ok(nativeBranch < blankWindow, "the branch must be decided before a window is created");
  assert.match(openSource, /openTripItemAttachmentThroughPlatform\(attachment\)[\s\S]*return;/);

  const platformSource = codeOnly(functionSource("openTripItemAttachmentThroughPlatform"));
  assert.doesNotMatch(platformSource, /about:blank|window\.open/);
  assert.match(platformSource, /createTripItemAttachmentSignedUrl/);
  assert.match(platformSource, /runPlatformFileAction\("openRemoteDocument", \[signedUrl\]\)/);
  assert.match(platformSource, /status === "cancelled"[\s\S]*return;/);
});

test("export_completed waits for delivery instead of firing when the Blob is built", () => {
  const prepareSource = codeOnly(functionSource("prepareTripPdfExport"));
  assert.doesNotMatch(prepareSource, /export_completed|trackTripPdfExportCompleted/);
  assert.match(prepareSource, /return \{ blob, fileName, optionProps \}/);

  // The one PDF completion event now lives in the helper, and both delivery
  // paths reach it only after the document actually went somewhere.
  assert.match(functionSource("trackTripPdfExportCompleted"), /trackEvent\("export_completed"/);
  assert.match(functionSource("downloadTripPdf"), /trackTripPdfExportCompleted\("download", result\.optionProps\)/);
  assert.match(functionSource("shareTripPdf"), /trackTripPdfExportCompleted/);
});

test("a saved PDF reports success only after the save resolved, and a cancelled save says nothing", () => {
  const source = codeOnly(functionSource("downloadTripPdf"));
  const cancelled = source.indexOf('outcome.status === "cancelled"');
  const failure = source.indexOf('outcome.status === "failure"');
  const completed = source.indexOf("trackTripPdfExportCompleted");
  const toast = source.indexOf('showToast(window.t("share.pdf.saved"))');

  assert.ok(cancelled >= 0 && failure >= 0, "both non-success outcomes are handled");
  assert.ok(cancelled < completed && failure < completed, "success reporting comes after both early exits");
  assert.ok(completed < toast, "the event precedes the toast, and both follow delivery");
  assert.match(source, /outcome\.status === "cancelled"\) return;/);
  assert.match(source, /trackTripPdfExportFailed\("download", "native_save"\)/);
  assert.match(source, /runPlatformFileAction\("savePdf", \[result\.fileName, result\.blob\]\)/);
  // No boundary keeps the old anchor-click download.
  assert.match(source, /downloadBlobFile\(result\.fileName, result\.blob\)/);
});

test("the native share sheet is consulted before navigator.canShare, and cancelling it is not a failure", () => {
  const source = codeOnly(functionSource("shareTripPdf"));
  const nativeCheck = source.indexOf('hasPlatformFileAction("sharePdf")');
  const canShare = source.indexOf("navigator.canShare");
  assert.ok(nativeCheck >= 0 && canShare >= 0);
  assert.ok(nativeCheck < canShare, "the native sheet wins over the web share probe");

  assert.match(source, /outcome\.status === "cancelled"\) return;/);
  assert.match(source, /trackTripPdfExportFailed\("share", "native_share"\)/);
  assert.match(source, /method: "native_share"/);
  // The web path keeps its own cancellation semantics: AbortError stays silent.
  assert.match(source, /error\?\.name !== "AbortError"/);
  assert.match(source, /method: "web_share"/);
});

test("the PDF is generated once per export, by the one generator", () => {
  assert.equal(codeOnly(appSource).split("buildTripPdfBlob(").length - 1, 2, "one definition, one call site");
  assert.match(functionSource("prepareTripPdfExport"), /blob = await buildTripPdfBlob\(options\)/);
  for (const name of ["downloadTripPdf", "shareTripPdf"]) {
    assert.doesNotMatch(codeOnly(functionSource(name)), /buildTripPdfBlob/, `${name} must reuse the prepared Blob`);
  }
});

test("every export outcome puts the buttons back", () => {
  assert.match(functionSource("finishTripPdfExport"), /tripPdfGenerating = false[\s\S]*setTripPdfButtonsBusy\(false\)/);
  // Generation failure resets before returning; both delivery paths reset in a
  // finally, so a cancel, a failure and a thrown share all land the same way.
  assert.match(functionSource("prepareTripPdfExport"), /finishTripPdfExport\(\);\s*\n\s*return;/);
  assert.match(functionSource("downloadTripPdf"), /\} finally \{\s*\n\s*finishTripPdfExport\(\);/);
  assert.equal(codeOnly(functionSource("shareTripPdf")).split("finishTripPdfExport();").length - 1, 2, "native and web paths both reset");
});

test("the boundary module ships with the app shell", () => {
  assert.match(indexSource, /<script src="\.\/platform-file-boundary-core\.js"><\/script>/);
  assert.match(serviceWorkerSource, /"\.\/platform-file-boundary-core\.js"/);
});
