const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Git rewrites line endings on checkout, and the rule scanner below counts
// braces across lines. Comments go first: a rule's selector begins right after
// the previous closing brace, so the comment above it would be read as part of
// the selector — which is how the first version of this test passed against the
// very bug it was written to catch.
const source = fs
  .readFileSync(path.join(__dirname, "../styles.css"), "utf8")
  .replace(/^﻿/, "")
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// The ghost is a cloneNode of the card, so it carries both classes and every
// .item-card rule lands on it. Resolving the cascade for that pair is the only
// way to see which declaration actually wins — reading any single rule lies.
const GHOST_CLASSES = ["item-card", "drag-ghost"];

function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) {
        selector = css.slice(start, i);
        start = i + 1;
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        // An at-block (@media, @supports) has rules of its own inside; its
        // "selector" starts with @ and its body is skipped.
        if (!selector.trim().startsWith("@")) {
          rules.push({ selector: selector.trim(), body: css.slice(start, i), at: rules.length });
        }
        start = i + 1;
      }
    }
  }
  return rules;
}

// Only compound selectors built purely from the ghost's own classes can match a
// clone sitting directly on <body>. Anything with a combinator, an element, an
// id or a foreign class cannot, and is ignored.
function matchesGhost(selectorList) {
  return selectorList.split(",").some((part) => {
    const compound = part.trim();
    if (!compound || /[ >+~:[\]#]/.test(compound)) return false;
    const classes = compound.split(".").filter(Boolean);
    if (compound[0] !== ".") return false;
    return classes.every((name) => GHOST_CLASSES.includes(name));
  });
}

function specificity(selectorList) {
  return Math.max(
    ...selectorList
      .split(",")
      .map((part) => part.trim())
      .filter((part) => matchesGhost(part))
      .map((part) => part.split(".").filter(Boolean).length),
  );
}

function declarations(body) {
  const out = new Map();
  body.split(";").forEach((chunk) => {
    const at = chunk.indexOf(":");
    if (at === -1) return;
    const name = chunk.slice(0, at).trim();
    if (!name || name.startsWith("/*") || name.startsWith("--")) return;
    out.set(name, chunk.slice(at + 1).trim().replace(/\s+/g, " "));
  });
  return out;
}

// Winning declaration for the ghost: highest specificity, then last in the file.
function resolveGhost(property) {
  let winner = null;
  topLevelRules(source)
    .filter((rule) => matchesGhost(rule.selector))
    .forEach((rule) => {
      const value = declarations(rule.body).get(property);
      if (value === undefined) return;
      const weight = specificity(rule.selector);
      if (!winner || weight > winner.weight || (weight === winner.weight && rule.at > winner.at)) {
        winner = { value, weight, at: rule.at, selector: rule.selector };
      }
    });
  return winner;
}

test("the drag ghost keeps the properties that make it fly", () => {
  // position is the one that broke it: the ghost fell out of fixed positioning
  // into document flow, landed far below the fold, and the traveller saw only
  // the day strip highlight — the card never lifted off the finger.
  const expected = {
    position: "fixed",
    "z-index": "50",
    "pointer-events": "none",
    opacity: "0.92",
  };
  Object.entries(expected).forEach(([property, value]) => {
    const winner = resolveGhost(property);
    assert.notEqual(winner, null, `nothing declares ${property} for the ghost`);
    assert.equal(
      winner.value,
      value,
      `${property} resolves to "${winner.value}" from "${winner.selector}" — the ghost needs ${value}`,
    );
  });
});

test("a bare .item-card rule never outranks the ghost's own", () => {
  // Any later rule on the bare class silently outranks .drag-ghost by source
  // order. The guard is a two-class selector, so ordering stops mattering; this
  // test fails the moment someone adds a bare rule the guard does not cover.
  const ghostOwned = ["position", "z-index", "pointer-events", "opacity"];
  const rules = topLevelRules(source).filter((rule) => matchesGhost(rule.selector));
  const guardAt = rules.findIndex((rule) => specificity(rule.selector) >= 2);
  assert.notEqual(guardAt, -1, "the two-class guard rule must exist");
  const guard = declarations(rules[guardAt].body);
  rules
    .filter((rule) => specificity(rule.selector) === 1 && !/drag-ghost/.test(rule.selector))
    .forEach((rule) => {
      declarations(rule.body).forEach((_value, property) => {
        if (!ghostOwned.includes(property)) return;
        assert.ok(
          guard.has(property),
          `"${rule.selector}" sets ${property} on every card including the ghost, and the guard does not restore it`,
        );
      });
    });
});
