const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (name) =>
  fs.readFileSync(path.join(__dirname, "..", name), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");

const styles = read("styles.css");
const app = read("app.js");

test("the launch screen carries the map and stays long enough to be seen", () => {
  // Two different screens are called "the splash". The one the system draws is
  // built from background_color and the manifest icon and cannot carry an
  // image at all; this is the app's own, and it is the only one we can compose.
  const start = styles.indexOf(".app-splash::before {");
  assert.notEqual(start, -1, "the splash needs its map layer");
  const body = styles.slice(start, styles.indexOf("}", start));
  assert.match(body, /url\("\.\/assets\/map-home\.jpg"\)/, "same map as the home screen");
  assert.match(body, /position: absolute/, "an absolute layer, so it is not a grid cell and cannot move the logo");

  // Without a floor the splash was dismissed a few dozen milliseconds after
  // load: the map was rendered and never seen.
  const floor = /const APP_SPLASH_MIN_MS = (\d+);/.exec(app);
  assert.notEqual(floor, null, "the splash needs a minimum display time");
  assert.ok(Number(floor[1]) >= 600, `${floor[1]}ms is too short to read`);
  assert.match(app, /window\.setTimeout\(hideAppSplash, left\)/, "the floor has to defer, not block");
});
