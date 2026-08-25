const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");

function functionSource(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = nextName ? appSource.indexOf(`function ${nextName}`, start) : -1;
  return appSource.slice(start, end === -1 ? undefined : end);
}

test("TripItem form exposes the attachment states and supported file types", () => {
  const notesIndex = htmlSource.indexOf('textarea name="notes"');
  const attachmentsIndex = htmlSource.indexOf('id="itemAttachmentsSection"');
  const actionsIndex = htmlSource.indexOf('<div class="form-actions">', attachmentsIndex);
  assert.ok(notesIndex < attachmentsIndex && attachmentsIndex < actionsIndex);
  assert.match(htmlSource, /id="itemAttachmentsList"/);
  assert.match(htmlSource, /id="itemAttachmentInput"[\s\S]*accept="application\/pdf,image\/jpeg,image\/png,image\/webp,/);
  assert.match(htmlSource, /data-i18n="item\.editor\.attachments\.add"/);
  assert.ok(htmlSource.indexOf("trip-item-attachments-core.js") < htmlSource.indexOf("app.js"));
  assert.ok(htmlSource.indexOf("trip-item-attachments-client.js") < htmlSource.indexOf("app.js"));
});

test("attachments are available while creating and remote rows load only for an existing TripItem", () => {
  const open = functionSource("openItemSheet", "fillSelects");
  assert.match(open, /resetTripItemAttachmentsState\(trackedItem\)/);
  assert.match(open, /if \(trackedItem\) loadTripItemAttachments\(\)/);

  const render = functionSource("renderTripItemAttachments", "loadTripItemAttachments");
  assert.match(render, /Boolean\(tripItemAttachmentsState\.tripId\) && !isReadOnlyMode\(\)/);
  assert.match(render, /item\.editor\.attachments\.empty/);
  assert.match(render, /item\.editor\.attachments\.loading/);
  assert.match(render, /item\.editor\.attachments\.pending/);
  assert.match(render, /data-attachment-pending-remove/);
  assert.match(render, /data-attachment-open/);
  assert.match(render, /data-attachment-delete/);
});

test("new-card files stay pending until save, then upload through the attachment client", () => {
  const upload = functionSource("uploadCurrentTripItemAttachment", "uploadPendingTripItemAttachments");
  assert.match(upload, /if \(!itemId\)/);
  assert.match(upload, /validateAttachmentFile\(file\)/);
  assert.match(upload, /pendingFiles:/);

  const pendingUpload = functionSource("uploadPendingTripItemAttachments", "openTripItemAttachment");
  assert.match(pendingUpload, /ensureSupabaseOwnerSession\(\)/);
  assert.match(pendingUpload, /uploadTripItemAttachment/);
  assert.match(pendingUpload, /pendingFiles: tripItemAttachmentsState\.pendingFiles\.filter/);

  const save = functionSource("saveItem", "getItemFormChangedFields");
  assert.match(appSource, /async function saveItem/);
  assert.match(save, /saveState\(\)[\s\S]*await uploadPendingTripItemAttachments\(item\)/);
  assert.match(save, /item\.editor\.attachments\.saved\.partial/);
  assert.match(save, /closeItemSheetAfterSave\(\)/);
});

test("file selection for an existing card uploads immediately and keeps the sheet stable", () => {
  const upload = functionSource("uploadCurrentTripItemAttachment", "uploadPendingTripItemAttachments");
  assert.match(upload, /ensureSupabaseOwnerSession\(\)/);
  assert.match(upload, /uploadTripItemAttachment/);
  assert.match(upload, /attachments: \[\.\.\.tripItemAttachmentsState\.attachments, attachment\]/);
  assert.match(upload, /catch \(error\)[\s\S]*error:/);
  assert.match(upload, /finally[\s\S]*uploading: false/);

  const bind = functionSource("bindEvents");
  assert.match(bind, /#itemAttachmentAddButton/);
  assert.match(bind, /#itemAttachmentInput/);
  assert.match(bind, /uploadCurrentTripItemAttachment\(file\)/);
  assert.match(bind, /#itemAttachmentsSection/);
  assert.match(bind, /handleTripItemAttachmentsClick/);
});

test("open uses a short-lived signed URL and delete delegates to the owner-scoped client", () => {
  const open = functionSource("openTripItemAttachment", "deleteCurrentTripItemAttachment");
  assert.match(open, /createTripItemAttachmentSignedUrl/);
  assert.match(open, /attachment,[\s\S]*120/);
  assert.match(open, /previewWindow\.opener = null/);

  const remove = functionSource("deleteCurrentTripItemAttachment", "handleTripItemAttachmentsClick");
  assert.match(remove, /window\.confirm/);
  assert.match(remove, /deleteTripItemAttachment/);
  assert.match(remove, /attachments\.filter/);
  assert.doesNotMatch(appSource, /getPublicUrl\s*\(/);
});

test("closing or saving an item clears transient attachment state", () => {
  const closeAfterSave = functionSource("closeItemSheetAfterSave", "dismissItemSheet");
  const dismiss = functionSource("dismissItemSheet", "saveItem");
  const save = functionSource("saveItem", "resetCurrentItemForm");
  assert.match(closeAfterSave, /resetTripItemAttachmentsState\(\)/);
  assert.match(dismiss, /resetTripItemAttachmentsState\(\)/);
  assert.match(dismiss, /tripItemAttachmentsState\.uploading/);
  assert.match(save, /tripItemAttachmentsState\.uploading/);
});

test("TripItem footer button labels are centered exactly", () => {
  assert.match(
    stylesSource,
    /#itemForm \.form-actions \.primary-button,[\s\S]*?#itemForm \.form-actions \.danger-button\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?text-align:\s*center;/,
  );
});

test("public Trip Share snapshot cannot include attachment metadata", () => {
  const publishState = functionSource("buildPublishedTripState", "publishTripShare");
  assert.match(publishState, /normalizeState\(structuredClone\(state\)\)/);
  assert.doesNotMatch(publishState, /tripItemAttachmentsState/);
  assert.doesNotMatch(publishState, /trip_item_attachments|storage_path|signedUrl/i);

  const save = functionSource("saveItem", "resetCurrentItemForm");
  assert.doesNotMatch(save, /\n\s+attachments\s*:|storagePath|storage_path/);
});

test("PWA app shell includes both attachment runtime modules", () => {
  assert.match(serviceWorkerSource, /"\.\/trip-item-attachments-core\.js"/);
  assert.match(serviceWorkerSource, /"\.\/trip-item-attachments-client\.js"/);
});
