const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (name) =>
  fs.readFileSync(path.join(__dirname, "..", name), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");

const app = read("app.js");
const styles = read("styles.css");

function functionBody(name) {
  const start = new RegExp(`\\nfunction ${name}\\(`).exec(app);
  assert.notEqual(start, null, `${name} must exist`);
  const rest = app.slice(start.index + 1);
  const next = /\n(?:async\s+)?function /.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

test("the insertion point ignores the card being dragged", () => {
  // This is the whole reason the live preview can exist. The card is moved to
  // where it would land, so it ends up under the finger itself; if it were
  // measured, the computed position would flip between two states every frame
  // and the strip would shudder. Excluding it makes the layout a fixed point.
  const body = functionBody("getInsertionReference");
  assert.match(body, /child\.dataset\.dragId !== draggedItemId/);
  // Geometry, not "whatever is under the pointer": the old rule could not
  // place a card after the last one in a full strip, and it oscillated.
  assert.match(body, /getBoundingClientRect/);
  assert.match(body, /rect\.left \+ rect\.width \/ 2/);
  assert.doesNotMatch(functionBody("getDropDataFromPoint"), /elementFromPoint/);
});

test("the day a card came from keeps its height", () => {
  // An empty day strip is far shorter than one holding cards. Without a
  // stand-in the origin collapses the moment the card leaves, every day below
  // jumps up, and the drop target moves out from under the finger — the exact
  // failure this preview would otherwise cause.
  const body = functionBody("ensureOriginSlot");
  assert.match(body, /cloneNode\(false\)/, "the footprint is taken from the card itself");
  assert.match(body, /removeAttribute\("data-drag-id"\)/, "a measured stand-in would reintroduce the oscillation");
  assert.match(functionBody("previewDropPosition"), /leavingOrigin/);
  const css = styles.slice(styles.indexOf(".item-card.drag-origin-slot {"));
  assert.match(css.slice(0, css.indexOf("}")), /pointer-events: none/);
});

test("no drag ends with the card or the stand-in left behind", () => {
  // Both input paths have to clean up: touch drags run through
  // cleanupPointerDrag, mouse drags through cleanupDesktopDrag.
  assert.match(app, /clearOriginSlot\(drag\);\n\s*let moved = false;/);
  assert.match(app, /if \(!moved\) restoreDragOrigin\(drag\);/);
  assert.match(app, /clearOriginSlot\(desktopDrag\);\n\s*if \(!moved\) restoreDragOrigin\(desktopDrag\);/);
  // A successful drop re-renders the list, so restoring would fight the render.
  assert.match(functionBody("moveItem"), /render\(\);/);
});

test("the drag ghost is promoted to its own layer", () => {
  // The ghost clones a card, and the card carries a gradient perforation and
  // layered shadows. Without this the browser repaints all of it on every
  // pointer move.
  const start = styles.indexOf(".item-card.drag-ghost {");
  const body = styles.slice(start, styles.indexOf("}", start));
  assert.match(body, /will-change: transform/);
});
