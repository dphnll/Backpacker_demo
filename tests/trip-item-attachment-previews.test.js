const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const core = require("../trip-item-attachments-core.js");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");

function functionSource(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? appSource.indexOf(`function ${nextName}`, start) : -1;
  return appSource.slice(start, end === -1 ? undefined : end);
}

test("only the supported image types are previewable", () => {
  ["image/jpeg", "image/png", "image/webp"].forEach((mime) => {
    assert.equal(core.isPreviewableAttachment(mime), true, `${mime} should preview`);
  });
  ["application/pdf", "", null, undefined, "text/html"].forEach((mime) => {
    assert.equal(core.isPreviewableAttachment(mime), false, `${String(mime)} must not preview`);
  });
  // Every previewable type must still be an accepted attachment type.
  Object.keys(core.MIME_TYPES).filter(core.isPreviewableAttachment).forEach((mime) => {
    assert.ok(core.MIME_TYPES[mime], `${mime} must stay a supported attachment type`);
  });
});

test("a photo row leads with a thumbnail and a file row does not", () => {
  const source = functionSource("renderTripItemAttachments", "loadTripItemAttachments");
  assert.match(source, /isPreviewableAttachment\?\.\(attachment\.mimeType\)/);
  assert.match(source, /item-attachment-thumb/);
  assert.match(source, /previewable \? " has-thumb" : ""/);
  // The thumbnail is a real button so it is reachable by keyboard, not a div with a role.
  assert.match(source, /<button class="item-attachment-thumb/);
  assert.match(source, /data-attachment-open="\$\{escapeAttr\(attachment\.id\)\}"/);
});

test("previews are fetched after render rather than inlined into the row", () => {
  const render = functionSource("renderTripItemAttachments", "loadTripItemAttachments");
  assert.match(render, /ensureTripItemAttachmentPreviews\(\)/);
  const ensure = functionSource("ensureTripItemAttachmentPreviews", "renderTripItemAttachments");
  // Re-entry would refetch on every redraw, and a stale item must not overwrite fresh state.
  assert.match(ensure, /tripItemAttachmentsPreviewsInFlight/);
  assert.match(ensure, /requestVersion !== tripItemAttachmentsRequestVersion/);
  assert.match(ensure, /tripItemAttachmentsState\.itemId !== itemId/);
  // One failed preview must not take out the others.
  assert.match(ensure, /catch \{/);
});

test("a preview URL is renewed before the signed URL lapses", () => {
  assert.match(appSource, /TRIP_ITEM_PREVIEW_TTL_SECONDS = 600/);
  assert.match(appSource, /TRIP_ITEM_PREVIEW_RENEW_MS = 60 \* 1000/);
  const fresh = functionSource("getFreshTripItemAttachmentPreview", "ensureTripItemAttachmentPreviews");
  assert.match(fresh, /expiresAt - TRIP_ITEM_PREVIEW_RENEW_MS > Date\.now\(\)/);
});

test("opening a photo reuses the existing signed-url flow", () => {
  // The delegated handler already resolves data-attachment-open, so the thumb needs no new path.
  assert.match(appSource, /\$\("#itemAttachmentsSection"\)\?\.addEventListener\("click", handleTripItemAttachmentsClick\)/);
  assert.match(functionSource("handleTripItemAttachmentsClick", "uploadPendingTripItemAttachments"), /closest\("\[data-attachment-open\]"\)/);
});

test("row actions are icons so the file name keeps its width", () => {
  const source = functionSource("renderTripItemAttachments", "loadTripItemAttachments");
  // Two text buttons left almost no room for the name once a thumbnail joined the row.
  assert.doesNotMatch(source, />Открыть<\/button>/);
  assert.doesNotMatch(source, />Удалить<\/button>/);
  assert.match(source, /ATTACHMENT_OPEN_ICON/);
  assert.match(source, /ATTACHMENT_DELETE_ICON/);
  // An icon alone is not a label: every action keeps the file name for screen readers.
  assert.match(source, /item\.editor\.attachments\.open\.file[\s\S]*fileName: attachment\.fileName/);
  assert.match(source, /item\.editor\.attachments\.deleting\.file[\s\S]*item\.editor\.attachments\.delete\.file[\s\S]*fileName: attachment\.fileName/);
  assert.match(appSource, /const ATTACHMENT_OPEN_ICON = `<svg/);
  assert.match(appSource, /const ATTACHMENT_DELETE_ICON = `<svg/);
});

test("deleting an attachment still asks before it destroys anything", () => {
  // Icon-only destructive actions are safe here because the confirm names the file.
  assert.match(appSource, /window\.confirm\(window\.t\("item\.editor\.attachments\.delete\.confirm", { fileName: attachment\.fileName }\)\)/);
});

test("a photo row drops the redundant emoji and may wrap its name", () => {
  const source = functionSource("renderTripItemAttachments", "loadTripItemAttachments");
  // The thumbnail already says it is an image, so the emoji only stole width.
  assert.match(source, /\$\{previewable \? "" : "📎 "\}/);
  const start = stylesSource.indexOf(".item-attachment-row.has-thumb .item-attachment-name {");
  assert.notEqual(start, -1);
  assert.match(stylesSource.slice(start, stylesSource.indexOf("}", start)), /line-clamp: 3/);
});

test("the thumbnail keeps its aspect ratio inside a fixed square", () => {
  const start = stylesSource.indexOf(".item-attachment-thumb img {");
  assert.notEqual(start, -1);
  assert.match(stylesSource.slice(start, stylesSource.indexOf("}", start)), /object-fit: cover/);
  assert.match(stylesSource, /\.item-attachment-row\.has-thumb \{\s*grid-template-columns: auto minmax\(0, 1fr\) auto;/);
});
