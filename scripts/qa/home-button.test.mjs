/* HOME17 · one Home control: house icon, top-left, at least 96 stage px, on every non-hub route. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROUTES = [
  "kid-ainsley.html",
  "kid-hayes.html",
  "kid-harris.html",
  "sheet-chores.html",
  "month.html",
  "sheet-lights.html",
  "sheet-google-home.html",
  "sheet-groceries.html",
  "sheet-weekend.html",
  "sheet-win.html",
  "sheet-today.html",
  "sheet-spotify.html",
  "nest-webrtc.html",
  "mercury-run.html"
];

test("every non-hub route loads the stage or the kid world that paints .wardos-home", () => {
  const stage = fs.readFileSync(path.join(ROOT, "wardos-stage.js"), "utf8");
  const world = fs.readFileSync(path.join(ROOT, "kid-world.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "wardos-stage.css"), "utf8");
  assert.match(stage, /className = "wardos-home"/);
  assert.match(stage, /aria-label", "Home"/);
  assert.match(world, /class="kw-home wardos-home"/);
  assert.match(world, /home-key-light\.svg/);
  assert.match(css, /min-width: 96px/);
  assert.match(css, /min-height: 96px/);
  for (const route of ROUTES) {
    const html = fs.readFileSync(path.join(ROOT, route), "utf8");
    const loads = html.includes("wardos-stage.js") || html.includes("kid-world.js") || html.includes("mercury-run.js");
    assert.equal(loads, true, route + " has no Home installer");
  }
  const game = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  assert.match(game, /home-key-light\.svg/);
  assert.match(game, /aria-label="Home"/);
  assert.match(game, /merc-home/);
});

test("the header is not a second Home control", () => {
  const hdr = fs.readFileSync(path.join(ROOT, "house-hdr-home.js"), "utf8");
  assert.match(hdr, /return;/);
  assert.doesNotMatch(hdr.split("return;")[0], /addEventListener\("click"/);
});
