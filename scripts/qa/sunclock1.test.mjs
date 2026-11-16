/* SUNCLOCK1 · ONE day/night clock for every hub art layer, driven by Overland Park sunrise/sunset (local calc, no network).
   Boots the real month-theme/season-math.js + month-overlay.js in a vm with ?now= pinned and reads what each layer picked:
   hero window <img> src, hub wall plate --wg-hubbg, and html[data-nov-phase] (which the 4 person-tile night rules key on). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const OVERLAY = rd("month-theme/season-math.js") + "\n" + rd("month-theme/month-overlay.js");

let sunPhase = null;
function boot(iso) {
  const props = {}, attrs = {};
  const img = { src: "", alt: "" };
  const hero = { querySelector: (s) => (s === "img" ? img : null), appendChild() {} };
  const html = { setAttribute(k, v) { attrs[k] = String(v); }, getAttribute: (k) => attrs[k], style: { setProperty(k, v) { props[k] = v; } } };
  const body = { hasAttribute: () => false, firstChild: null, insertBefore() {}, appendChild() {} };
  const mk = () => ({ id: "", className: "", style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {} });
  const document = {
    documentElement: html, body, readyState: "complete",
    currentScript: { src: "http://hub.local/month-theme/month-overlay.js?v=SUNCLOCK1" },
    createElement: mk,
    querySelector: (s) => (s === ".hub-window" ? hero : null),
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {}
  };
  const fixed = Date.parse(iso);
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  }
  const ctx = vm.createContext({
    document, Date: FakeDate, Intl, URLSearchParams, console,
    location: { search: "?now=" + encodeURIComponent(iso), pathname: "/sheet-index.html", href: "http://hub.local/sheet-index.html", origin: "http://hub.local" },
    innerWidth: 1920, innerHeight: 1080,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    performance: { now: () => 0 }, addEventListener() {}
  });
  ctx.window = ctx;
  vm.runInContext(OVERLAY, ctx, { filename: "month-overlay.js" });
  sunPhase = ctx.WardSunPhase;
  const phase = attrs["data-nov-phase"];
  return {
    phase,
    hero: /hub-window-night-/.test(img.src) ? "night" : /hub-window-dusk-/.test(img.src) ? "day" : "none:" + img.src,
    bg: /wall-night\.webp/.test(props["--wg-hubbg"] || "") ? "night" : "day",
    tiles: phase === "night" ? "night" : "day"
  };
}
const layers = (r) => [r.hero, r.bg, r.tiles];
const ct = (ms) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/Chicago" });

test("the 4 person-tile night rules key on html[data-nov-phase=night]", () => {
  const s = rd("sheet-index.html");
  for (const k of ["ainsley", "hayes", "harris"]) assert.match(s, new RegExp('\\[data-nov-phase="night"\\] \\.tile\\.' + k + '[^{]*\\{ background-image: url\\("month-theme/hub/kidtile-' + k + '-night-438x420\\.webp"\\)'));
  assert.match(s, /\[data-nov-phase="night"\] \.tile\.dan \{ background-image: url\("month-theme\/hub\/kidtile-dad-night-438x420\.webp"\)/);
});

test("Nov 15 2026 5:37 PM CT (after sunset): hero, wall plate and all 4 tiles are night", () => {
  const r = boot("2026-11-15T17:37:00-06:00");
  assert.equal(r.phase, "night");
  assert.deepEqual(layers(r), ["night", "night", "night"], JSON.stringify(r));
});

test("Nov 15 2026 4:30 PM CT: hero, wall plate and all 4 tiles are day", () => {
  const r = boot("2026-11-15T16:30:00-06:00");
  assert.equal(r.phase, "morning");
  assert.deepEqual(layers(r), ["day", "day", "day"], JSON.stringify(r));
});

/* The November coat (and its hero/plate/tile art) only mounts in November; in June the same clock function is checked directly. */
test("summer: the same clock says Jun 21 2026 8:00 PM CDT is day and 9:30 PM CDT is night", () => {
  boot("2026-11-15T12:00:00-06:00");
  assert.equal(typeof sunPhase, "function", "month-overlay exposes its one clock");
  assert.equal(sunPhase(new Date("2026-06-21T20:00:00-05:00")), "morning");
  assert.equal(sunPhase(new Date("2026-06-21T21:30:00-05:00")), "night");
  assert.equal(sunPhase(new Date("2026-06-21T12:00:00-05:00")), "morning");
  assert.equal(sunPhase(new Date("2026-06-21T05:00:00-05:00")), "night");
});

test("every layer agrees at every 5 min of Nov 15 and Nov 29 (one clock)", () => {
  for (const day0 of [Date.parse("2026-11-15T00:00:00-06:00"), Date.parse("2026-11-29T00:00:00-06:00")]) {
    for (let t = day0; t < day0 + 864e5; t += 5 * 6e4) {
      const r = boot(new Date(t).toISOString());
      assert.equal(new Set(layers(r)).size, 1, ct(t) + " " + JSON.stringify(r));
    }
  }
});

/* Reference: published Overland Park almanac (NOAA method), Nov 15 2026 sunrise 7:01:39 AM, sunset 5:05:05 PM CST;
   Jun 21 2026 sunset about 8:47 PM CDT. The board's night must start/end within 3 min of these. */
function firstFlip(from, to, want) {
  boot("2026-11-15T12:00:00-06:00");
  for (let t = from; t <= to; t += 6e4) if ((sunPhase(new Date(t)) === "night") === want) return t;
  return null;
}
test("night starts at sunset and ends at sunrise, within 3 min of the NOAA value", () => {
  const set = firstFlip(Date.parse("2026-11-15T16:30:00-06:00"), Date.parse("2026-11-15T17:40:00-06:00"), true);
  assert.ok(set && Math.abs(set - Date.parse("2026-11-15T17:05:05-06:00")) <= 3 * 6e4, "Nov 15 sunset " + (set && ct(set)));
  const rise = firstFlip(Date.parse("2026-11-15T06:30:00-06:00"), Date.parse("2026-11-15T07:40:00-06:00"), false);
  assert.ok(rise && Math.abs(rise - Date.parse("2026-11-15T07:01:39-06:00")) <= 3 * 6e4, "Nov 15 sunrise " + (rise && ct(rise)));
  const sset = firstFlip(Date.parse("2026-06-21T20:15:00-05:00"), Date.parse("2026-06-21T21:15:00-05:00"), true);
  assert.ok(sset && Math.abs(sset - Date.parse("2026-06-21T20:47:00-05:00")) <= 3 * 6e4, "Jun 21 sunset " + (sset && ct(sset)));
  assert.equal(boot("2026-11-15T16:50:00-06:00").phase, "dusk", "dusk = the last 20 min before sunset");
  assert.deepEqual(layers(boot("2026-11-15T16:50:00-06:00")), ["day", "day", "day"], "dusk keeps the day hero, plate and tiles");
  assert.equal(boot("2026-11-15T16:40:00-06:00").phase, "morning", "dusk = the last 20 min before sunset");
});
