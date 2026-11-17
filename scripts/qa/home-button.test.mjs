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

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function writesHome(rel) {
  const file = path.join(ROOT, rel.split("?")[0].split("#")[0]);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const src = stripComments(fs.readFileSync(file, "utf8"));
  return /document\.write\s*\([\s\S]{0,300}house-home\.js/.test(src);
}

test("every non-hub route loads the stage or the kid world that paints .wardos-home", () => {
  const stage = stripComments(fs.readFileSync(path.join(ROOT, "wardos-stage.js"), "utf8"));
  const css = stripComments(fs.readFileSync(path.join(ROOT, "wardos-stage.css"), "utf8"));
  const home = stripComments(fs.readFileSync(path.join(ROOT, "house-home.js"), "utf8"));
  assert.match(stage, /className = "wardos-home"/);
  assert.match(stage, /aria-label", "Home"/);
  assert.match(home, /className = "wardos-home"/);
  assert.match(home, /left: "48px"/);
  assert.match(home, /top: "48px"/);
  assert.match(home, /width: "96px"/);
  assert.match(home, /height: "96px"/);
  assert.match(home, /home-key-light\.svg/);
  assert.match(css, /min-width: 96px/);
  assert.match(css, /min-height: 96px/);
  for (const route of ROUTES) {
    const html = fs.readFileSync(path.join(ROOT, route), "utf8");
    const loads = html.includes("wardos-stage.js") || html.includes("kid-world.js") || html.includes("mercury-run.js");
    assert.equal(loads, true, route + " has no Home installer");
    const direct = /house-home\.js/.test(html);
    const via = [...html.matchAll(/\bsrc="([^"]+\.js[^"]*)"/g)].some((m) => writesHome(m[1]));
    assert.equal(direct || via, true, route + " does not load house-home.js");
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
