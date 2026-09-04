const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

// A selector can carry more than one rule in this stylesheet — colours in one
// place, geometry in another — so every body is collected, not just the first.
function ruleBody(selector) {
  const needle = `${selector} {`;
  const bodies = [];
  for (let at = stylesSource.indexOf(needle); at !== -1; at = stylesSource.indexOf(needle, at + 1)) {
    bodies.push(stylesSource.slice(at, stylesSource.indexOf("}", at)));
  }
  assert.notEqual(bodies.length, 0, `${selector} must exist`);
  return bodies.join("\n");
}

function elementMarkup(id) {
  const start = htmlSource.indexOf(`id="${id}"`);
  assert.notEqual(start, -1, `#${id} must exist in the markup`);
  const open = htmlSource.lastIndexOf("<", start);
  return htmlSource.slice(open, htmlSource.indexOf("</button>", start));
}

test("the trip header shows a back control, not the brand logo", () => {
  const markup = elementMarkup("homeButton");
  assert.match(markup, /aria-label="На главную"/, "the control must still say where it goes");
  assert.match(markup, /<svg/, "an arrow icon replaces the logo image");
  assert.doesNotMatch(markup, /<img/, "the logo image read as decoration, not as a control");
  assert.equal(htmlSource.includes('class="brand-logo"'), false, "the logo image is gone from the header");
});

test("the back control is sized and filled like the other header buttons", () => {
  const body = ruleBody(".brand-home-button");
  assert.match(body, /width: 40px/);
  assert.match(body, /height: 40px/);
  assert.match(body, /background: var\(--active-button-gradient\)/);
  assert.match(body, /box-shadow: var\(--active-button-shadow\)/);
  // The reserved column equals the 40px control. The following gap then matches
  // the header's outer inset: 16px normally and 12px on narrow screens.
  const row = ruleBody(".brand-row");
  assert.match(row, /grid-template-columns: 40px minmax\(0, 1fr\) auto/);
  assert.match(row, /gap: 16px/);
  assert.match(row, /gap: 12px/);
});

test("both back controls draw the same arrow", () => {
  // The Ideas screen kept a text arrow at a different size, so the two
  // back controls did not look like the same control.
  const start = stylesSource.indexOf(".ideas-back-button svg {");
  assert.notEqual(start, -1, "both back controls must share one icon rule");
  const body = stylesSource.slice(start, stylesSource.indexOf("}", start));
  assert.match(body, /stroke-width: 2\.6/);
  assert.match(body, /width: 24px/);

  const ideas = elementMarkup("ideasBackButton");
  assert.match(ideas, /<svg/, "the Ideas control must use the icon, not a text arrow");
  assert.doesNotMatch(ideas, /←/, "the text arrow ignored the icon weight and size");
  assert.match(ruleBody(".ideas-back-button"), /width: 40px/);
});

test("the currency calculator can swap its direction in one press", () => {
  assert.match(htmlSource, /id="currencySwapButton"/, "the control must exist");
  assert.match(
    appSource,
    /\$\("#currencySwapButton"\)\.addEventListener\("click", swapCurrencyDirection\)/,
    "the control must be wired",
  );

  const start = appSource.indexOf("function swapCurrencyDirection");
  assert.notEqual(start, -1, "the handler must exist");
  const handler = appSource.slice(start, appSource.indexOf("\n}", start));
  // Reads one value aside before overwriting it — otherwise both selects end
  // up holding the same currency and the result silently becomes 1:1.
  assert.match(handler, /const previousFrom = fromSelect\.value/);
  assert.match(handler, /fromSelect\.value = toSelect\.value/);
  assert.match(handler, /toSelect\.value = previousFrom/);
  assert.match(handler, /renderCurrencyCalculator\(\)/, "the result must refresh after the swap");
});

test("the swap control sits between the two selects", () => {
  // The calculator keeps a middle column for it, so the control stays next to
  // both currencies instead of hanging on a row of its own underneath.
  assert.match(
    ruleBody(".currency-card"),
    /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/,
  );
  const body = ruleBody(".currency-swap-button");
  assert.match(body, /align-self: end/, "it lines up with the selects, not with their labels");
  // Square, and the same height as a currency slot, so the row reads as one band.
  assert.match(body, /width: 42px/);
  assert.match(body, /height: 42px/);

  // Markup order decides the columns, so the control has to sit between the
  // two labels rather than after them.
  const from = htmlSource.indexOf('id="currencyFrom"');
  const swap = htmlSource.indexOf('id="currencySwapButton"');
  const to = htmlSource.indexOf('id="currencyTo"');
  assert.ok(from < swap && swap < to, "the swap control must be placed between the two selects");
});

test("currency labels are centred over their own select", () => {
  assert.match(ruleBody(".currency-card .field"), /text-align: center/);
  // The amount spans the whole card, so centring it would leave its label adrift.
  assert.match(ruleBody(".currency-card .field.wide"), /text-align: left/);
});

test("the icon-only swap control still announces itself", () => {
  const markup = elementMarkup("currencySwapButton");
  assert.match(markup, /aria-label="Поменять валюты местами"/, "arrows alone are not a name");
  assert.match(markup, /title="Поменять валюты местами"/);
});

test("help and product info share one text rhythm", () => {
  // Matched from the last selector of the group so the assertion does not
  // depend on how the selector list is wrapped or on the line endings.
  const start = stylesSource.indexOf("#productInfoSheet details li {");
  assert.notEqual(start, -1, "help and product info must share one list rule");
  const listBody = stylesSource.slice(start, stylesSource.indexOf("}", start));
  assert.match(listBody, /color: var\(--ink\)/, "list items were set in muted brown");
  assert.match(listBody, /font-size: 14px/, "list items ran two points larger than the paragraphs");
  assert.match(listBody, /margin-bottom: 8px/, "items ran together without spacing");

  const paraStart = stylesSource.indexOf("#productInfoSheet details p,");
  assert.notEqual(paraStart, -1, "paragraphs must share one rule too");
  assert.match(
    stylesSource.slice(paraStart, stylesSource.indexOf("}", paraStart)),
    /margin: 0 0 14px/,
    "paragraphs ran together without spacing",
  );
});
