// node livinghouse/tests/lh-l4.test.mjs
// Layer 4: date gates, crypt moments, idle cinema, collect-only rhythm. Synthetic fixtures only.
import { assertSealed } from "../../scripts/qa/temp-home.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

assertSealed();
const req = createRequire(import.meta.url);
const dir = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const src = (f) => fs.readFileSync(dir + f, "utf8");
const Packs = req("../scene-packs.js");
const Cinema = req("../cinema.js");
const Crypt = req("../crypt.js");
const Rhythm = req("../rhythm.js");
const Rules = req("../lh-rules.js");

const at = (iso) => new Date(iso);

// --- date gates (the Date is the only clock; these are the ?now= fixtures) ---
{
  const p = Packs.forDate(at("2026-10-23T18:00:00-05:00"));
  assert.equal(p.id, "october");
  assert.equal(p.countdown, false);
  assert.equal(p.street, false);
  assert.equal(p.glow, false);
  assert.equal(p.art, "present");
  assert.equal(p.plate, "october-night");
  assert.equal(p.leaves, true);
}
{
  const p = Packs.forDate(at("2026-10-24T18:00:00-05:00"));
  assert.equal(p.id, "october-count");
  assert.equal(p.countdown, true);
  assert.equal(p.days, 7);
  assert.equal(p.street, false);
}
{
  const p = Packs.forDate(at("2026-10-28T06:30:00-05:00"));
  assert.equal(p.id, "october-count");
  assert.equal(p.days, 3);
  assert.equal(p.street, false);
}
{
  const p = Packs.forDate(at("2026-10-31T18:00:00-05:00"));
  assert.equal(p.id, "october-street");
  assert.equal(p.street, true);
  assert.equal(p.glow, true);
  assert.equal(p.countdown, false);
  assert.equal(p.art, "present");
  assert.equal(p.streetArt, "missing");
}
{
  const p = Packs.forDate(at("2026-11-01T18:00:00-06:00"));
  assert.equal(p.id, "november");
  assert.equal(p.plate, "november-harvest");
  assert.equal(p.art, "missing");
  assert.match(p.why, /november/);
  assert.equal(p.leaves, false);
  assert.equal(p.countdown, false);
}
{
  const p = Packs.forDate(at("2026-12-01T18:00:00-06:00"));
  assert.equal(p.id, "december");
  assert.equal(p.plate, "december-snow");
  assert.equal(p.art, "missing");
  assert.match(p.why, /december/);
}
assert.equal(Packs.forDate(at("2026-01-15T12:00:00-06:00")).id, "base");
assert.equal(Packs.forDate(new Date(NaN)).id, "base");
assert.ok(!/Date\.now\(\)|new Date\(\)/.test(src("scene-packs.js")), "scene packs do not read the wall clock");

// --- crypt: moments in, photo slot always empty ---
assert.deepEqual(Crypt.photoHook(), { feed: "missing", why: "photo index not approved", src: "" });
const jars = Crypt.jars([
  { t: "Item 1", month: "2026-10" },
  { t: "Kid A practice", month: "2026-10" },
  { t: "Item 1", month: "2026-10" },
  { t: "   ", month: "2026-10" },
  { t: "Item 1", month: "bad" },
  { t: "Later item", month: "2026-11" }
]);
assert.equal(jars.length, 2);
assert.equal(jars[0].label, "October");
assert.deepEqual(jars[0].items.map((i) => i.t), ["Item 1", "Kid A practice"]);
assert.equal(jars[1].label, "November");
assert.ok(!/fetch\(|drive\.google|photos\.google|snapshotUrl|gallery/i.test(src("crypt.js")), "crypt never reads a photo index");

// --- cinema ---
assert.equal(Cinema.consider(59999, { caps: true }).on, false);
assert.equal(Cinema.consider(60000, { reduced: true, caps: true }).on, false);
assert.equal(Cinema.consider(60000, { caps: false }).mode, "poster");
assert.equal(Cinema.consider(60000, { caps: false }).video, false);
assert.equal(Cinema.consider(60000, { caps: false }).src, "");
assert.equal(Cinema.consider(60000, { caps: true }).mode, "video");
assert.equal(Cinema.consider(60000, { caps: true, phone: true }).src, Cinema.PHONE);
const allow = JSON.parse(fs.readFileSync(root + "night/media/allow.json", "utf8"))["night/media"];
for (const name of [Cinema.WALL, Cinema.PHONE]) {
  const base = name.replace("../night/media/", "");
  assert.ok(allow.includes(base), base + " is on the proxy allow list");
  assert.equal(fs.existsSync(root + "night/media/" + base), false, "no video file in git: " + base);
}
assert.ok(fs.existsSync(root + Cinema.POSTER_W.replace("../", "")), "wall poster is in git");
assert.ok(!/Date\.now\(\)|new Date\(\)/.test(src("cinema.js")));

// --- rhythm collect-only ---
function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const store = mem();
let log = Rhythm.observe(null, store);
assert.equal(log.mode, "collect");
assert.equal(log.act, false);
assert.equal(log.lights, false);
assert.equal(log.clouds, false);
assert.deepEqual(log.rows, []);
log = Rhythm.observe({ wd: 3, min: 14 * 60 + 10, title: "Item 1" }, store);
assert.deepEqual(log.rows, [{ wd: 3, min: 850 }]);
assert.ok(!store.getItem(Rhythm.KEY).includes("Item 1"), "titles are not stored");
log = Rhythm.observe({ wd: 3, min: 850 }, store);
assert.equal(log.rows.length, 1, "the same slot is not logged twice");
log = Rhythm.observe({ wd: 5, min: 1 }, store);
assert.equal(log.rows.length, 2);
assert.deepEqual(Rhythm.decide(), { act: false, lights: false, clouds: false, mode: "collect" });
assert.equal(Rhythm.observe({ wd: 9, min: 10 }, store).rows.length, 2, "a junk weekday is ignored");
assert.ok(!/Date\.now\(\)|new Date\(\)/.test(src("rhythm.js")));

// --- page wiring ---
const js = src("lh.js"), html = src("index.html"), css = src("lh.css");
assert.match(js, /LHScenePacks\.forDate\(n\)/);
assert.match(js, /LHCinema\.consider/);
assert.match(js, /LHCrypt\.jars/);
assert.match(js, /LHCrypt\.photoHook/);
assert.match(js, /LHRhythm\.observe/);
assert.match(js, /LHRhythm\.decide\(\)/);
assert.ok(!/lh-path|storm/.test(js), "rhythm never lights a path or draws a cloud");
assert.match(html, /id="lh-count"/);
assert.match(html, /id="lh-crypt"/);
assert.match(html, /class="lh-crypt-photo"/);
assert.match(html, /id="lh-cinema"/);
assert.match(html, /id="lh-plate"/);
for (const tag of html.match(/<video[^>]*>/g) || []) {
  assert.doesNotMatch(tag, /\ssrc=/, tag);
  assert.match(tag, /poster=/, tag);
  assert.match(tag, /onerror=/, tag);
}
assert.ok(html.indexOf('src="scene-packs.js') < html.indexOf('src="lh.js'));
assert.ok(!/drive\.google|photos\.google|snapshotUrl|gallery|fetch\(/.test(src("crypt.js")), "crypt.js has no photo read");
assert.ok(!/drive\.google|photos\.google|gallery/.test(js + html));
for (const t of ["No harvest yet", "No snow yet", "No photo feed yet", "No moments yet", "Crypt", "Close"]) {
  assert.equal(/\bplate\b/i.test(t), false, "user-facing line has no plate jargon: " + t);
  assert.equal(Rules.stateText(t), false, t);
}
assert.match(css, /prefers-reduced-motion/);
assert.match(js, /caps\.json/);
assert.ok(!/Date\.now\(\)|new Date\(\)/.test(js.replace(/new Date\([^)]+\)/g, "")), "lh.js still has no bare clock read");

console.log("lh-l4: ok");
