/* Breakfast bar: checks survive reload and route changes, undo, and a Chicago midnight rollover.
   ?now= pins the day. Weekly storage stays. Today's key does not. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const DAILY = ["hay-bed", "hay-backpack", "hay-dishes", "hay-empty", "hay-trash", "hay-postgame", "hay-shower", "har-bed", "har-backpack", "ain-bed"];
const WEEKLY = "hay-room";
const DATA = { kids: { hayes: { quests: [] }, harris: { quests: [] }, ainsley: { quests: [] }, dan: { quests: [] } } };

function boot(search, map, page) {
  const storage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    key: (i) => Object.keys(map)[i] || null,
    get length() { return Object.keys(map).length; }
  };
  const document = {
    readyState: "complete",
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    documentElement: { style: { setProperty() {} }, setAttribute() {}, getAttribute() { return null; }, classList: { add() {} } },
    body: { getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {} }, appendChild() {} }
  };
  const ctx = {
    Intl, Date, URL, URLSearchParams, console, performance: { now: () => 0 },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    localStorage: storage,
    sessionStorage: { getItem: () => null, setItem() {} },
    document,
    location: { search, pathname: "/" + page + ".html", href: "http://house.test/" + page + ".html" + search, hash: "" },
    history: { replaceState() {} },
    fetch: () => new Promise(() => {}),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("livinghouse/clock.js"), ctx, { filename: "clock.js" });
  vm.runInContext(read("house-scene.js"), ctx, { filename: "house-scene.js" });
  vm.runInContext(read("house-clock.js"), ctx, { filename: "house-clock.js" });
  vm.runInContext(read("kids-data.js"), ctx, { filename: "kids-data.js" });
  vm.runInContext(read("jar-engine.js"), ctx, { filename: "jar-engine.js" });
  ctx.WardKids._data = DATA;
  return ctx;
}

test("ten checks, one undo, reload, and a route change keep the same day counts", () => {
  const map = {};
  const day = boot("?now=2026-11-10T23:30:00-06:00&freeze=1", map, "sheet-chores");
  assert.equal(day.WardKids.DAY_ISO, "2026-11-10");
  DAILY.forEach((id) => day.WardKids.setCheck(id, true, DATA));
  assert.equal(DAILY.filter((id) => day.WardKids.getCheck(id, DATA)).length, 10);
  day.WardKids.setCheck(DAILY[0], false, DATA);
  assert.equal(day.WardKids.getCheck(DAILY[0], DATA), false);
  assert.equal(DAILY.filter((id) => day.WardKids.getCheck(id, DATA)).length, 9);
  day.WardKids.setCheck(WEEKLY, true, DATA);
  const weekKey = day.WardKids.checkKeyFor(WEEKLY, DATA);
  assert.match(weekKey, /:week:/);
  const reloaded = boot("?now=2026-11-10T23:30:00-06:00&freeze=1", map, "sheet-chores");
  assert.equal(DAILY.filter((id) => reloaded.WardKids.getCheck(id, DATA)).length, 9);
  const other = boot("?now=2026-11-10T23:30:00-06:00&freeze=1", map, "kid-hayes");
  assert.equal(other.WardKids.getCheck("hay-backpack", DATA), true);
  assert.equal(other.WardKids.getCheck(WEEKLY, DATA), true);
  const st = other.JarEngine.choreState("hayes");
  assert.ok(st.todayDone >= 1 && st.shown > 0, JSON.stringify(st));
});

test("?now= just after Chicago midnight clears today and keeps yesterday and the week", () => {
  const map = {};
  const eve = boot("?now=2026-11-10T23:30:00-06:00&freeze=1", map, "sheet-chores");
  eve.WardKids.setCheck("hay-bed", true, DATA);
  eve.WardKids.setCheck(WEEKLY, true, DATA);
  const weekKey = eve.WardKids.checkKeyFor(WEEKLY, DATA);
  const weekBlob = map[weekKey];
  const morn = boot("?now=2026-11-11T00:30:00-06:00&freeze=1", map, "kid-hayes");
  assert.equal(morn.WardKids.DAY_ISO, "2026-11-11");
  assert.equal(morn.WardKids.getCheck("hay-bed", DATA), false);
  assert.equal(morn.WardKids.getCheck("hay-bed", DATA, "2026-11-10"), true);
  assert.equal(morn.WardKids.getCheck(WEEKLY, DATA), true);
  assert.equal(map[weekKey], weekBlob);
  assert.equal(morn.JarEngine.choreState("hayes").todayDone, 0);
  assert.equal(morn.WardKids.checkKeyFor(WEEKLY, DATA), weekKey);
});

test("the overnight reload is armed for Chicago midnight, not the machine zone", () => {
  const ctx = {
    fetch: () => Promise.resolve({ ok: false, text: () => Promise.resolve("") }),
    document: {
      readyState: "loading",
      addEventListener() {},
      querySelectorAll() { return []; },
      hidden: false
    },
    location: { search: "", pathname: "/sheet-chores.html", hash: "", replace() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    Date,
    Intl,
    addEventListener() {}
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-fresh.js"), ctx, { filename: "house-fresh.js" });
  assert.equal(ctx.HouseFresh.ctMidnightMs("2026-11-11"), Date.parse("2026-11-11T06:00:00Z"));
  const before = new Date("2026-11-11T05:50:00Z").getTime();
  const wait = ctx.HouseFresh.ctMidnightMs("2026-11-11") + 1000 - before;
  assert.ok(wait > 9 * 60 * 1000 && wait < 12 * 60 * 1000, wait);
});
