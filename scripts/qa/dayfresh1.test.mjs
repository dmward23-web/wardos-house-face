/* KIDCRIT DAYFRESH1 (Atlas R4: a fresh Monday showing a chore done is RED) · node --test scripts/qa/dayfresh1.test.mjs
   Loads the real kids-data.js on a faked America/Chicago clock with one shared localStorage. Sunday taps must not show on
   Monday. Root cause: getCheck migrated the legacy flat blob house-checkoffs:chores-v2 (no day in it, written on every
   today-check, never cleared) into any day key that had no entry yet, so a fresh day showed old checks done. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
const DATA = { kids: { hayes: { quests: [{ id: "hay-bed" }, { id: "hay-dishes" }, { id: "hay-room", cadence: "weekly" }] },
  harris: { quests: [{ id: "har-bed" }] }, ainsley: { quests: [{ id: "ain-bed" }] } } };

function boardAt(isoUtc, store) {
  const fixed = Date.parse(isoUtc);
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  }
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URLSearchParams, console, setTimeout, clearTimeout, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { readyState: "loading", addEventListener() {}, dispatchEvent() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {}, toggle() {} } } },
    addEventListener() {}, location: { search: "", hash: "", pathname: "/" },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(SRC, ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = DATA;
  return ctx.WardKids;
}

const SUN_NOON = "2026-10-25T17:00:00Z";     /* Sun Oct 25 12:00 CT (CDT) */
const SUN_2359 = "2026-10-26T04:59:00Z";     /* Sun Oct 25 23:59 CT */
const MON_0001 = "2026-10-26T05:01:00Z";     /* Mon Oct 26 00:01 CT */
const MON_0700 = "2026-10-26T12:00:00Z";     /* Mon Oct 26 07:00 CT */

test("the faked clock lands on the right Chicago day either side of midnight", () => {
  const s = {};
  assert.equal(boardAt(SUN_2359, s).DAY_ISO, "2026-10-25");
  assert.equal(boardAt(MON_0001, s).DAY_ISO, "2026-10-26");
});

test("R4: daily chores tapped Sunday are NOT done on a fresh Monday (00:01 and 07:00 CT)", () => {
  const s = {};
  const sun = boardAt(SUN_NOON, s);
  sun.setCheck("hay-bed", true, DATA);
  sun.setCheck("hay-dishes", true, DATA);
  sun.setCheck("har-bed", true, DATA);
  sun.setCheck("ain-bed", true, DATA);
  assert.equal(sun.getCheck("hay-bed", DATA), true, "Sunday shows its own tap");
  for (const t of [MON_0001, MON_0700]) {
    const mon = boardAt(t, s);
    for (const id of ["hay-bed", "hay-dishes", "har-bed", "ain-bed"]) assert.equal(mon.getCheck(id, DATA), false, id + " done=1 on a fresh Monday at " + t);
    assert.equal(mon.getCheck("hay-bed", DATA, "2026-10-25"), true, "Sunday's tap is still Sunday's");
  }
});

test("R4: a device already holding a stale legacy blob (written by the live build) still opens Monday clean", () => {
  const s = { "house-checkoffs:chores-v2": JSON.stringify({ "hay-bed": true, "har-bed": true, "ain-bed": true, "hay-room": true }) };
  const mon = boardAt(MON_0700, s);
  for (const id of ["hay-bed", "har-bed", "ain-bed", "hay-room"]) assert.equal(mon.getCheck(id, DATA), false, id + " came back from the legacy blob");
  assert.equal(Object.keys(s).some((k) => /^house-checkoffs:(hayes|harris|ainsley):2026-10-26$/.test(k)), false, "no Monday key is minted from the blob");
});

test("weekly chores keep the Fri-to-Fri week: Saturday's weekly tap still counts Monday, Sunday daily does not", () => {
  const s = {};
  const sat = boardAt("2026-10-24T17:00:00Z", s);   /* Saturday noon CT; the week opens the Friday before */
  sat.setCheck("hay-room", true, DATA);
  sat.setCheck("hay-bed", true, DATA);
  const mon = boardAt(MON_0700, s);
  assert.equal(mon.weekStartIso(), "2026-10-23");
  assert.equal(mon.getCheck("hay-room", DATA), true, "weekly chore is done for the week");
  assert.equal(mon.getCheck("hay-bed", DATA), false, "daily chore resets");
});

test("Monday taps write only Monday's key; undo clears it", () => {
  const s = {};
  const mon = boardAt(MON_0700, s);
  mon.setCheck("hay-bed", true, DATA);
  assert.equal(mon.getCheck("hay-bed", DATA), true);
  mon.setCheck("hay-bed", false, DATA);
  assert.equal(mon.getCheck("hay-bed", DATA), false);
  assert.equal("house-checkoffs:chores-v2" in s, false, "the legacy blob is no longer written");
});
