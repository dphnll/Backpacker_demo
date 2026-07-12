const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const core = require("../link-intake-ui-core.js");

const repoRoot = path.resolve(__dirname, "..");

test("create mode with empty URL keeps Link Intake button available and blocks backend locally", () => {
  const button = core.createLinkIntakeButtonState({ isLoading: false });
  assert.equal(button.disabled, false);
  assert.equal(button.text, "Собрать по ссылке");

  const request = core.createLinkIntakePreviewRequest("");
  assert.equal(request.shouldCallBackend, false);
  assert.equal(request.error, "Вставьте корректную ссылку");
});

test("valid URL is allowed to start the existing preview pipeline", () => {
  const request = core.createLinkIntakePreviewRequest("https://example.com/place");
  assert.equal(request.shouldCallBackend, true);
  assert.equal(request.url, "https://example.com/place");
  assert.equal(request.error, "");
});

test("success then failure clears stale auto-filled fields and invalidates preview data", () => {
  const before = { link: "", title: "", type: "idea", locationText: "", price: "" };
  const after = {
    link: "https://example.com/first",
    title: "First place",
    type: "other",
    locationText: "Old location",
    price: "100",
  };
  const snapshot = core.createLinkIntakeAppliedSnapshot(before, after);
  const currentBeforeFailure = {
    link: "https://example.com/broken",
    title: "First place",
    type: "other",
    locationText: "Old location",
    price: "100",
  };

  const result = core.clearStaleLinkIntakeValues(currentBeforeFailure, snapshot);

  assert.deepEqual(result.clearedFields.sort(), ["locationText", "price", "title", "type"]);
  assert.equal(result.values.link, "https://example.com/broken");
  assert.equal(result.values.title, "");
  assert.equal(result.values.type, "idea");
  assert.equal(result.values.locationText, "");
  assert.equal(result.values.price, "");
});

test("success then manual field edits then failure preserves manual edits", () => {
  const snapshot = core.createLinkIntakeAppliedSnapshot(
    { link: "", title: "", type: "idea", locationText: "", price: "" },
    {
      link: "https://example.com/first",
      title: "First place",
      type: "other",
      locationText: "Old location",
      price: "100",
    },
  );

  const result = core.clearStaleLinkIntakeValues({
    link: "https://example.com/broken",
    title: "My edited title",
    type: "food",
    locationText: "My edited location",
    price: "100",
  }, snapshot);

  assert.deepEqual(result.clearedFields.sort(), ["price"]);
  assert.equal(result.values.title, "My edited title");
  assert.equal(result.values.type, "food");
  assert.equal(result.values.locationText, "My edited location");
});

test("success after previous success does not restore an older auto-filled draft on later failure", () => {
  const firstSnapshot = core.createLinkIntakeAppliedSnapshot(
    { link: "", title: "", type: "idea", locationText: "", price: "" },
    {
      link: "https://example.com/first",
      title: "First place",
      type: "other",
      locationText: "",
      price: "",
    },
  );
  const beforeSecondSuccess = core.clearStaleLinkIntakeValues({
    link: "https://example.com/second",
    title: "First place",
    type: "other",
    locationText: "",
    price: "",
  }, firstSnapshot).values;

  const secondSnapshot = core.createLinkIntakeAppliedSnapshot(beforeSecondSuccess, {
    link: "https://example.com/second",
    title: "Second place",
    type: "other",
    locationText: "",
    price: "",
  });
  const afterFailure = core.clearStaleLinkIntakeValues({
    link: "https://example.com/broken",
    title: "Second place",
    type: "other",
    locationText: "",
    price: "",
  }, secondSnapshot);

  assert.equal(afterFailure.values.title, "");
  assert.equal(afterFailure.values.type, "idea");
});

test("edit and read-only modes do not render Link Intake from openItemSheet", () => {
  const appSource = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  assert.match(appSource, /renderLinkIntakePanel\(\{\s*visible:\s*!itemId\s*&&\s*!isReadOnlyMode\(\)\s*\}\)/);
});

test("ordinary saveItem stays independent from Link Intake preview-only state", () => {
  const appSource = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  const start = appSource.indexOf("function saveItem(");
  const end = appSource.indexOf("function moveItem", start);
  assert.ok(start > -1, "saveItem function should exist");
  assert.ok(end > start, "next function after saveItem should be found");
  const saveItemSource = appSource.slice(start, end);
  assert.doesNotMatch(saveItemSource, /linkIntakeState|previewOnlyImageUrl|imageUrl/);
});
