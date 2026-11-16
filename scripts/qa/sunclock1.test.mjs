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
const SHEET = rd("sheet-index.html");
const TILES = ["ainsley", "hayes", "harris", "dan"];
const TILE_RULES = [];
{
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(SHEET))) {
    if (!/background-image/.test(m[2])) continue;
    if (!/\.tile\.(ainsley|hayes|harris|dan)\b/.test(m[1])) continue;
    const url = (m[2].match(/url\("([^"]+)"\)/) || [])[1] || "";
    if (url) TILE_RULES.push({ sel: m[1], url });
  }
}
function tileUrl(phase, id) {
  const hits = TILE_RULES.filter((r) => {
    if (!new RegExp("\\.tile\\." + id + "\\b").test(r.sel)) return false;
    const night = r.sel.includes('[data-nov-phase="night"]');
    return night ? phase === "night" : true;
  });
  return hits.length ? hits[hits.length - 1].url : "";
}
function heroKind(src) {
  if (/hub-window-night-/.test(src)) return "night";
  if (/hub-window-dusk-/.test(src)) return "dusk";
  if (/hub-window-day-/.test(src)) return "day";
  return "none:" + src;
}

let sunPhase = null;
function boot(iso) {
  const props = {}, attrs = {};
  const img = { src: "", alt: "" };
  const hero = { querySelector: (s) => (s === "img" ? img : null), appendChild() {} };
  const html = { setAttribute(k, v) { attrs[k] = String(v); }, getAttribute: (k) => attrs[k], style: { setProperty(k, v) { props[k] = v; } } };
  const body = { hasAttribute: () => false, firstChild: null, insertBefore() {}, appendChild() {} };
  const mk = () => ({ id: "", className: "", style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {} });
  const people = TILES.map((id) => ({ id, className: "tile " + id, style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }));
  const document = {
    documentElement: html, body, readyState: "complete",
    currentScript: { src: "http://hub.local/month-theme/month-overlay.js?v=SUNCLOCK1" },
    createElement: mk,
    querySelector: (s) => (s === ".hub-window" ? hero : null),
    querySelectorAll: (s) => (String(s).includes(".tile") ? people : []),
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
  for (const el of people) el.style.backgroundImage = 'url("' + tileUrl(phase, el.id) + '")';
  const tileSrcs = people.map((el) => (el.style.backgroundImage.match(/url\("([^"]+)"\)/) || [])[1] || "");
  const nightTile = (src) => /-night/.test(src);
  const tiles = tileSrcs.length === 4 && tileSrcs.every(nightTile) ? "night" : tileSrcs.length === 4 && tileSrcs.every((src) => src && !nightTile(src)) ? "day" : "mixed:" + tileSrcs.join(",");
  return {
    phase,
    heroSrc: img.src,
    hero: heroKind(img.src),
    bg: /wall-night\.webp/.test(props["--wg-hubbg"] || "") ? "night" : "day",
    tiles,
    tileSrcs
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
      const wantHero = r.phase === "night" ? "night" : r.phase === "dusk" ? "dusk" : "day";
      const wantRest = r.phase === "night" ? "night" : "day";
      assert.equal(r.hero, wantHero, ct(t) + " " + JSON.stringify(r));
      assert.equal(r.bg, wantRest, ct(t) + " " + JSON.stringify(r));
      assert.equal(r.tiles, wantRest, ct(t) + " " + JSON.stringify(r));
      assert.equal(r.tileSrcs.length, 4, ct(t));
      for (const src of r.tileSrcs) {
        if (r.phase === "night") assert.match(src, /-night/, ct(t) + " " + src);
        else assert.doesNotMatch(src, /-night/, ct(t) + " " + src);
      }
    }
  }
});

test("noon uses the day hero file and 4:55 PM uses the dusk hero file", () => {
  const noon = boot("2026-11-15T12:30:00-06:00");
  assert.equal(noon.phase, "morning");
  assert.match(noon.heroSrc, /hub-window-day-/);
  assert.equal(noon.hero, "day");
  assert.equal(noon.tiles, "day");
  const dusk = boot("2026-11-15T16:55:00-06:00");
  assert.equal(dusk.phase, "dusk");
  assert.match(dusk.heroSrc, /hub-window-dusk-/);
  assert.equal(dusk.hero, "dusk");
  assert.equal(dusk.tiles, "day");
  for (const src of dusk.tileSrcs) assert.doesNotMatch(src, /-night/);
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
  const dusk = boot("2026-11-15T16:50:00-06:00");
  assert.equal(dusk.phase, "dusk", "dusk = the last 20 min before sunset");
  assert.match(dusk.heroSrc, /hub-window-dusk-/, "dusk hero is the dusk file");
  assert.deepEqual([dusk.hero, dusk.bg, dusk.tiles], ["dusk", "day", "day"], "dusk hero, day plate, non-night tiles");
  assert.equal(boot("2026-11-15T16:40:00-06:00").phase, "morning", "dusk = the last 20 min before sunset");
});
