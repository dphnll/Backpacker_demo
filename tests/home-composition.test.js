const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Line endings are normalised: git rewrites them on checkout, and multi-line
// selector lookups below would stop matching depending on the working copy.
const stylesSource = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8").replace(/\r\n/g, "\n");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8").replace(/\r\n/g, "\n");

// A selector can carry more than one rule in this stylesheet, so every body is
// collected and searched together.
function ruleBody(selector) {
  const needle = `${selector} {`;
  const bodies = [];
  for (let at = stylesSource.indexOf(needle); at !== -1; at = stylesSource.indexOf(needle, at + 1)) {
    bodies.push(stylesSource.slice(at, stylesSource.indexOf("}", at)));
  }
  assert.notEqual(bodies.length, 0, `${selector} must exist`);
  return bodies.join("\n");
}

test("dragging a card and scrolling a day are left untouched", () => {
  // The whole composition pass is CSS. These are the properties the drag and the
  // horizontal day strip depend on; a redesign must never reach them.
  const start = stylesSource.indexOf("ГЛАВНАЯ И ОСТАЛЬНЫЕ ЭКРАНЫ · композиция");
  assert.notEqual(start, -1, "the composition layer must be present");
  const layer = stylesSource.slice(start);

  const forbidden = [
    /\.item-card\b[^{]*\{[^}]*\bzoom:/,
    /\.item-card\b[^{]*\{[^}]*\btouch-action:/,
    /\.item-card\b[^{]*\{[^}]*\buser-select:/,
    /\.item-card\b[^{]*\{[^}]*\bcursor:/,
    // position was named in the safety comment and missing from this list; the
    // drag ghost is a clone of the card, so a bare rule on it outranked
    // .drag-ghost by source order. See drag-ghost-cascade.test.js.
    /\.item-card\b[^{]*\{[^}]*\bposition:/,
    /\.day-items\b[^{]*\{[^}]*\boverflow-x:/,
    /\.day-items\b[^{]*\{[^}]*\btouch-action:/,
    /\.day-items\b[^{]*\{[^}]*\bdisplay:/,
  ];
  forbidden.forEach((pattern) => {
    assert.doesNotMatch(layer, pattern, `the layer must not touch ${pattern}`);
  });
});

test("nothing is layered over the trip screen", () => {
  // The trip screen carries the card drag and the horizontal day strip, and
  // both were declared untouchable. A full-screen background layer was the one
  // structural thing this pass added there, so it is gone: colour and type
  // only. The home screen keeps its map — no drag lives on it.
  const start = stylesSource.indexOf("ГЛАВНАЯ И ОСТАЛЬНЫЕ ЭКРАНЫ · композиция");
  const layer = stylesSource.slice(start);
  assert.doesNotMatch(layer, /\.app-shell::before/, "no background layer on the trip screen");
  assert.doesNotMatch(layer, /\.ideas-screen::before/, "no background layer on the ideas screen");
  assert.doesNotMatch(
    layer,
    /\.app-shell > \*[^{]*\{[^}]*position: relative/,
    "children of the trip shell must keep the position they were given",
  );
  assert.match(ruleBody(".home-screen::before"), /opacity/, "the home screen keeps its map");
});

test("one green across the app", () => {
  // Every filled control reads --active-button-gradient, so a per-element fix
  // always left some screen behind. The token itself carries the brand colour.
  assert.match(
    ruleBody(".app-shell,\n.ideas-screen,\n.sheet"),
    /--active-button-gradient: #2f5d55/,
  );
  assert.match(ruleBody(".home-screen #createTripButton"), /background: var\(--a-brand\)/);
  assert.match(ruleBody(".home-screen"), /--a-brand: #2f5d55/);
});

test("photo treatment lives in one place", () => {
  // The trainer builds its sepia from background layers and trip covers use a
  // filter; both read the same tokens so they cannot drift apart.
  const body = ruleBody(".home-screen");
  assert.match(body, /--a-photo-tone:/);
  assert.match(body, /--a-photo-filter:/);
  assert.match(ruleBody(".home-screen .trainer-card"), /var\(--a-photo-tone\)/);
});

test("the trainer repeats the trip card exactly", () => {
  // A trainer that looks different teaches something the traveller will not see.
  const body = ruleBody(".home-screen .trainer-card");
  assert.match(body, /padding: 18px 16px 16px/);
  assert.match(body, /border-radius: 18px/);
  assert.match(ruleBody(".home-screen .trip-list-card"), /border-radius: 18px/);
});

test("icons drawn as glyphs or filled paths still take the ink colour", () => {
  // The gear is a pseudo-element with a hardcoded white and an id selector, the
  // paper plane fills its own paths — neither followed the button colour.
  assert.match(ruleBody("#editTripButton::before"), /color: var\(--a-ink-soft/);
  assert.match(
    ruleBody(".app-shell .header-actions svg,\n.app-shell .header-actions svg *"),
    /fill: currentColor/,
  );
});

test("both bottom bars are the same object", () => {
  const nav = ruleBody(".app-shell .bottom-nav");
  assert.match(nav, /border-radius: 8px/);
  assert.match(nav, /linear-gradient\(#f7f2e8 0%, #f4eee2 100%\)/);
});

test("budget labels do not repeat their own group heading", () => {
  // Inside a group already titled «Идеи, хотелки, запас» the long forms wrapped
  // to three lines next to a short number.
  assert.match(appSource, /<span>Запас<\/span>/);
  assert.match(appSource, /<span>Всего с запасом<\/span>/);
  assert.match(appSource, /<span>Остаток с запасом<\/span>/);
  assert.doesNotMatch(appSource, /<span>Остаток с учётом идей, хотелок, запаса<\/span>/);
  // The copied estimate and the PDF carry the same wording.
  assert.match(appSource, /`Всего с запасом: \$\{formatMoney\(totals\.possibleTotal\)\}`/);
});
