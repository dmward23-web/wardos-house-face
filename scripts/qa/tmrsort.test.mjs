/* TMRSORT1 · node --test scripts/qa/tmrsort.test.mjs
   The hub Tomorrow list (house-board-strip.js tomorrowPeek) reads in clock order: all-day rows first, then timed rows
   by start; a bare "game" is not a kid item. Fixture only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
function strip() {
  const fixed = Date.parse("2026-10-16T20:08:00-05:00");
  class FDate extends Date { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
  const el = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } };
  const document = { readyState: "loading", addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: el, body: el, createElement: () => el, head: el };
  const ctx = vm.createContext({ document, Date: FDate, Intl, console, Math, String, Number, Object, Array, RegExp, JSON, Error, Promise, setTimeout() {}, clearTimeout() {}, setInterval() {}, fetch: () => new Promise(() => {}), localStorage: { getItem: () => null, setItem() {} }, location: { search: "", pathname: "/sheet-index.html", hash: "" }, matchMedia: () => ({ matches: false, addEventListener() {} }), navigator: {} });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-board-strip.js"), "utf8"), ctx);
  return ctx.HouseBoardStrip;
}
const cal = {
  status: "live", asOfIso: "2026-10-16",
  upcomingLeaves: [
    { summary: "Game 3: Owls @ Hawks (Sec 101 Row C 7-8)", start: "2026-10-17T19:00:00-05:00", end: "2026-10-17T22:00:00-05:00" }, // privacy-scan:allow seat_code
    { summary: "Hayes flag — Elm Falcons vs Pena · Field 8 · 5:15–6:15", start: "2026-10-17T16:45:00-05:00", end: "2026-10-17T18:15:00-05:00" },
    { summary: "Flight to Springfield (XY 1234)", start: "2026-10-17T15:30:00-05:00", end: "2026-10-17T17:00:00-05:00" }, // privacy-scan:allow flight_number
    { summary: "Harris flag — vs Owls (home) · game 8:30", start: "2026-10-17T08:00:00-05:00", end: "2026-10-17T09:30:00-05:00" },
    { summary: "Dan+Partner CLE weekend", start: "2026-10-17", allDay: true },
  ],
};
test("Tomorrow reads all-day first, then by start time; the Owls game is not ahead of the 3:30 flight", () => {
  const S = strip();
  assert.ok(S && S.tomorrowPeek, "tomorrowPeek exported");
  const t = S.tomorrowPeek(cal, { iso: "2026-10-16" });
  const names = t.items.map((e) => e.summary.split(" ")[0] + " " + (e.summary.split(" ")[1] || ""));
  assert.deepEqual(JSON.parse(JSON.stringify(t.items.map((e) => e.start))), ["2026-10-17", "2026-10-17T08:00:00-05:00", "2026-10-17T15:30:00-05:00", "2026-10-17T16:45:00-05:00", "2026-10-17T19:00:00-05:00"], names.join(" | "));
});
