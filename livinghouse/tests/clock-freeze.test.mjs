// node livinghouse/tests/clock-freeze.test.mjs · item 8: ?now ticks live by default, holds still with ?rec=1 or ?freeze=1, and stays real without ?now.
// Also checks the static L1 fixes: width-only truncation (stone titles clamp, candle lines ellipsize), wall chores label >= 17 px one line, no cartoon ghost.
import { assertSealed } from "../../scripts/qa/temp-home.mjs";   // TEMPHOME1: WARDOS_* unset and a temp HOME before any private-list reader loads
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync(new URL("../clock.js", import.meta.url), "utf8");
function load(search, perf) {
  const g = { location: { search }, performance: { now: () => perf.t }, document: { addEventListener() {} }, URLSearchParams, Date }; g.window = g;
  vm.runInNewContext(src, g); return g.LHClock;
}
const perf = { t: 1000 }, ISO = "2026-10-15T18:30:00-05:00", base = Date.parse(ISO);
let C = load("?now=" + ISO, perf); perf.t += 5 * 60e3; assert.equal(C.ms(), base + 5 * 60e3); assert.equal(C.frozen, false);   // live: keeps ticking
perf.t = 1000; C = load("?now=" + ISO + "&rec=1", perf); perf.t += 11 * 60e3; assert.equal(C.ms(), base); assert.equal(C.frozen, true);   // stills: held
perf.t = 1000; C = load("?freeze=1&now=" + ISO, perf); perf.t += 60e3; assert.equal(C.ms(), base);
C = load("?rec=1", perf); assert.equal(C.override, null); assert.equal(C.frozen, false); assert.ok(Math.abs(C.ms() - Date.now()) < 1000);   // no ?now: real clock even with rec=1
const css = fs.readFileSync(new URL("../lh.css", import.meta.url), "utf8"), html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), js = fs.readFileSync(new URL("../lh.js", import.meta.url), "utf8");
assert.match(css, /\.lh-stone \.w \{[^}]*-webkit-line-clamp: 2/);
assert.match(css, /\.lh-candle \.v, \.lh-candle \.k \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis/);
assert.match(css, /html\.lh-wall \.lh-cauldron \.lab small \{ font-size: max\(17px, [^}]*white-space: nowrap/);
for (const t of [css, html, js]) assert.ok(!/lh-ghost|\.wisp/.test(t), "no cartoon ghost left");
// Atlas law: no away-state wording on any board (visible or aria text), no computed replacement. Fixture phrases are built from words (w) so no prose sits in the file.
import { createRequire } from "node:module";
assertSealed(); const R = createRequire(import.meta.url)("../lh-rules.js");
const w = (...p) => p.join(" ");
const HIT = [w("Dad", "week"), w("Kids", "with", "Dad"), w("kids", "away"), w("Kids", "away"), w("Hand" + "off", "3", "PM"), w("Home", "week"), w("away", "week"), w("Chores", "with", "Dad"), w("Payday", "with", "Dad"), w("YOUR", "BASE", "WITH", "DAD"), "cust" + "ody", w("Kids", "with", "other", "house"), w("Their", "mo" + "m's", "week")];
for (const t of HIT) assert.equal(R.stateText(t), true, t);
for (const t of ["Dad: Weekend trip", "Hayes soccer practice", "Chores", "Resting", "No chore feed yet", "The Ward's"]) assert.equal(R.stateText(t), false, t);
const strs = [...js.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]).filter((s) => !/^[.#]?lh-[\w .#-]*$/.test(s)).filter((s) => R.stateText(s));   // CSS class / selector names are not visible text
assert.deepEqual(strs, [], "lh.js string literals carry no away-state words");
const h = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
const vis = [...h.matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean).concat([...h.matchAll(/(?:aria-label|title|alt)="([^"]*)"/g)].map((m) => m[1]));
assert.deepEqual(vis.filter((s) => R.stateText(s)), [], "index.html visible / aria text carries no away-state words");
assert.ok(!/AwayFilter\.glass\(/.test(js), "no computed away-state rewording on the Living House");
assert.ok(!/backLabel|data-lh="?back/.test(js + html), "no countdown on the lantern");
console.log("clock-freeze: ok");
