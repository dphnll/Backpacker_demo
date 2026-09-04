const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const stylesSource = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

function ruleBody(selector) {
  const start = stylesSource.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} must exist`);
  return stylesSource.slice(start, stylesSource.indexOf("}", start));
}

test("the destination slot absorbs the spare room in a trip card", () => {
  const body = ruleBody(".trip-card-submeta > span");
  assert.match(body, /flex: 1 1 auto/);
  assert.match(body, /text-overflow: ellipsis/);
  // The old 50% cap truncated the dates and the destination at the same time.
  assert.doesNotMatch(body, /max-width: calc\(50%/);
});

test("the date slot is sized by its content and never shrinks", () => {
  assert.match(ruleBody(".trip-card-submeta > span:last-child"), /flex: 0 0 auto/);
});

test("the meta row spans the card so the dates can reach the right edge", () => {
  const body = ruleBody(".trip-card-submeta");
  assert.match(body, /justify-self: stretch/);
  assert.match(body, /width: 100%/);
  assert.match(body, /flex-wrap: nowrap/);
});

test("the trainer no longer carries its own copy of the meta layout", () => {
  // The trainer used to be the only card laid out correctly; the rule is now shared.
  assert.doesNotMatch(stylesSource, /\.trainer-card \.trip-card-submeta > span/);
});

test("days and budget stay on one shared row in every trip card", () => {
  const marker = "/* Дни и бюджет — одна общая строка во всех карточках поездки";
  const start = stylesSource.indexOf(".home-screen .home-card-meta {");
  const end = stylesSource.indexOf("/* ---------- Обложки поездок", start);
  const sharedRules = stylesSource.slice(start, end);

  assert.notEqual(stylesSource.indexOf(marker), -1, "the shared row contract must be documented");
  assert.match(sharedRules, /flex-wrap: nowrap/);
  assert.doesNotMatch(sharedRules, /flex-wrap: wrap/);
  assert.match(sharedRules, /> \*:first-child[\s\S]*flex: 1 1 auto/);
  assert.match(sharedRules, /> \*:last-child[\s\S]*flex: 0 0 auto/);
  assert.match(sharedRules, /> \*:last-child[\s\S]*white-space: nowrap/);
  assert.doesNotMatch(stylesSource, /\.trainer-card \.home-card-meta\s*\{[^}]*padding-right/);
});

test("trainer, personal and received trips use the same days-and-budget row", () => {
  assert.equal((htmlSource.match(/class="home-card-meta"/g) || []).length, 1, "trainer uses the shared row");
  assert.equal((appSource.match(/class="home-card-meta"/g) || []).length, 2, "personal and received cards use the shared row");
});

test("every trip card renders the destination before the dates", () => {
  const rows = appSource.match(/<div class="trip-card-submeta">\s*<span>[\s\S]*?<\/div>/g) || [];
  assert.ok(rows.length >= 2, "personal and received cards both render a meta row");
  rows.forEach((row) => {
    assert.equal((row.match(/<span>/g) || []).length, 2, "last-child must reliably be the date slot");
  });
});
