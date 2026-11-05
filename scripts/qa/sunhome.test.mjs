/* SUNHOME1 · Sunday Nov 8 2026 home gate (node only).
   Season coat, chore independence, honest kid/hub chrome, climate hero is not a self-loop.
   No browser, no device writes, no secrets. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const req = createRequire(import.meta.url);
const Season = req(path.join(ROOT, "month-theme/season-math.js"));
const Packs = req(path.join(ROOT, "livinghouse/scene-packs.js"));
const FX = JSON.parse(rd("scripts/qa/fixtures/hayesjar1c-week.json"));
const at = (iso) => new Date(iso);

test("SUNHOME1 season: Nov 8 is cold harvest with no flakes yet, late November meets December snow", () => {
  const sun = Season.decide(at("2026-11-08T15:00:00-06:00"));
  assert.equal(sun.id, "november");
  assert.ok(sun.cold > 0.2 && sun.cold < 0.3, "Nov 8 cold " + sun.cold);
  assert.equal(sun.flakes, 0);
  assert.equal(sun.lit, 0);
  assert.equal(sun.windows, 2);
  const late = Season.decide(at("2026-11-30T12:00:00-06:00"));
  const dec = Season.decide(at("2026-12-01T12:00:00-06:00"));
  assert.equal(late.flakes, 1);
  assert.equal(dec.flakes, 1, "December keeps the late-November flake field");
  assert.ok(dec.snow >= 0.35 && dec.snow <= late.snow + 0.35);
  assert.equal(dec.lit, 1);
  assert.equal(Season.decide(at("2026-12-08T12:00:00-06:00")).lit, 8);
  assert.equal(Season.decide(at("2026-12-25T12:00:00-06:00")).lit, 25);
  assert.equal(Season.decide(at("2026-12-31T12:00:00-06:00")).lit, 25);
  assert.equal(Season.decide(at("2026-10-31T18:00:00-05:00")).id, "other");
});

test("SUNHOME1 scene pack: November and December are a layered coat, October is unchanged", () => {
  const nov = Packs.forDate(at("2026-11-08T15:00:00-06:00"));
  assert.equal(nov.id, "november");
  assert.equal(nov.art, "layered");
  assert.equal(nov.why, "");
  assert.equal(nov.plate, "november-harvest");
  assert.equal(nov.flakes, 0);
  assert.ok(nov.cold > 0.2);
  const dec = Packs.forDate(at("2026-12-25T18:00:00-06:00"));
  assert.equal(dec.id, "december");
  assert.equal(dec.art, "layered");
  assert.equal(dec.lit, 25);
  assert.equal(dec.flakes, 1);
  assert.equal(Packs.forDate(at("2026-10-31T18:00:00-05:00")).id, "october-street");
  assert.equal(Packs.forDate(at("2026-10-15T12:00:00-05:00")).art, "present");
});

test("SUNHOME1 overlay: coat is pointer-safe, video src still waits for caps, season script is on the boards", () => {
  const mo = rd("month-theme/month-overlay.js");
  assert.match(mo, /MonthSeason/);
  assert.match(mo, /pointer-events:none|km-layer/);
  assert.doesNotMatch(mo, /v\.src = base/);
  assert.match(mo, /v\.src = v\.dataset\.src/);
  assert.match(mo, /caps\.json/);
  assert.match(rd("month-theme/month-overlay.css"), /pointer-events:\s*none/);
  for (const f of ["sheet-index.html", "kid-hayes.html", "kid-ainsley.html", "kid-harris.html", "mercury-run.html", "livinghouse/index.html", "wall.html"]) {
    assert.match(rd(f), /season-math\.js\?v=SUNHOME1/, f);
  }
});

test("SUNHOME1 chrome: no baked kid schedule, no money tile, no fake LIVE, climate hero is not a self link loop", () => {
  const hub = rd("sheet-index.html");
  assert.doesNotMatch(hub, /Show me the Money|payday|School hearing|Flag practice/);
  assert.doesNotMatch(hub, /data-who-meta>LIVE/);
  assert.match(hub, /Quiet for now\./);
  assert.match(hub, /tile-label">Jars</);
  const home = rd("sheet-google-home.html");
  assert.doesNotMatch(home, /Climate LIVE|LIVE · NO STILL|5 cams · LIVE/);
  assert.match(home, /Waiting on the house/);
  assert.match(home, /house-sensi-ctl\.js\?v=SUNHOME1/);
  assert.match(rd("house-sensi-ctl.js"), /getElementById\("sensi-hero"\)/);
  assert.match(rd("house-sensi-ctl.js"), /preventDefault\(\)/);
  assert.match(rd("house-sensi-ctl.js"), /has not reported that setpoint/);
  assert.doesNotMatch(rd("sheet-chores.html"), /LIVE taps/);
  assert.match(rd("kid-world.js"), /Resting — your list comes back soon\./);
  assert.doesNotMatch(rd("kid-world.js"), /data-pebble[\s\S]{0,80}ainsley|ainsley[\s\S]{0,40}kid-pebble/);
  assert.match(rd("kid-world.css"), /body\.theme-ainsley \.kid-pebble \{ display: none/);
});

function bootKids(map) {
  const fixed = Date.parse("2026-11-08T18:00:00-06:00");
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  }
  const document = {
    readyState: "loading", visibilityState: "visible", addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    documentElement: { setAttribute() {}, getAttribute: () => null, classList: { add() {}, remove() {}, toggle() {} } }
  };
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: map, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document,
    location: { search: "", hash: "", pathname: "/kid-hayes.html", href: "https://house.test/kid-hayes.html", reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {}, fetch: () => new Promise(() => {})
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(rd("kids-data.js"), ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = FX.data;
  return ctx.WardKids;
}
function mem() {
  const map = {};
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    key: (i) => Object.keys(map)[i] ?? null,
    get length() { return Object.keys(map).length; },
    _map: map
  };
}

test("SUNHOME1 chores: three kids stay independent, undo keeps the other tap, a new day is clear, hire does not fill the jar", () => {
  const store = mem();
  const wk = bootKids(store);
  assert.equal(wk.DAY_ISO, "2026-11-08");
  assert.equal(wk.hayesJar1Locked("hay-backpack", "2026-11-08"), false, "the October lock is over before Sunday");
  assert.equal(wk.getCheck("hay-bed", FX.data, "2026-11-08"), false);
  wk.setCheck("hay-bed", true, FX.data, "2026-11-08");
  wk.setCheck("hay-dishes", true, FX.data, "2026-11-08");
  wk.setCheck("har-bed", true, FX.data, "2026-11-08");
  assert.equal(wk.getCheck("hay-bed", FX.data, "2026-11-08"), true);
  assert.equal(wk.getCheck("hay-dishes", FX.data, "2026-11-08"), true);
  assert.equal(wk.getCheck("har-bed", FX.data, "2026-11-08"), true);
  assert.equal(wk.getCheck("ain-bed", FX.data, "2026-11-08"), false);
  wk.setCheck("hay-bed", false, FX.data, "2026-11-08");
  assert.equal(wk.getCheck("hay-bed", FX.data, "2026-11-08"), false, "undo");
  assert.equal(wk.getCheck("hay-dishes", FX.data, "2026-11-08"), true, "the other chore stays");
  assert.equal(wk.getCheck("har-bed", FX.data, "2026-11-08"), true, "Harris stays");
  assert.equal(wk.getCheck("hay-dishes", FX.data, "2026-11-09"), false, "next day is a new list");
  const again = bootKids(store);
  assert.equal(again.getCheck("hay-dishes", FX.data, "2026-11-08"), true, "reload keeps the tap");
  assert.equal(again.getCheck("hay-bed", FX.data, "2026-11-08"), false, "reload keeps the undo");
  const ains = bootKids(mem());
  ains.setCheck("ain-babysit", true, FX.data, "2026-11-08");
  const view = ains.getBankView("ainsley", FX.data);
  assert.equal(view.week, 0, "an optional hire does not fill the jar");
  assert.equal(view.mustComplete, false);
  const raw = JSON.stringify(store._map);
  assert.equal(raw.includes("$"), false);
  assert.match(store._map["house-checkoffs:hayes:2026-11-08"], /hay-dishes/);
  assert.doesNotMatch(store._map["house-checkoffs:hayes:2026-11-08"], /har-bed/);
});

test("SUNHOME1 run: lamps and December drag are in the world, November does not change the roll", () => {
  const src = rd("mercury-run.js");
  assert.match(src, /ward-run-lamps:/);
  assert.match(src, /id === "december"/);
  assert.match(src, /warmth\(\)/);
  assert.doesNotMatch(src, /NEED KEY|payday/);
});
