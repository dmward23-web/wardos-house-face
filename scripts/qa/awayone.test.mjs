/* AWAYONE1 · node --test scripts/qa/awayone.test.mjs
   Atlas ruling: away has ONE source of truth (away-filter.js on cal-months withDan), and there is ONE dress-up
   law (house-face-law.js DRESS) shared by the glass and the data scripts. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(import.meta.url);
const AF = require(path.join(ROOT, "away-filter.js"));
require(path.join(ROOT, "house-face-law.js"));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("hub away window end comes from away-filter (synthetic cal-months: back Mon 10/26, feed changeMin 900)", () => {
  AF.setMonths({ ...JSON.parse(read("scripts/qa/fixtures/private/cal-months.synthetic.json")), changeMin: 900 });
  for (const t of ["2026-10-18T15:00:00-05:00", "2026-10-20T16:00:00-05:00", "2026-10-26T14:59:00-05:00"]) {
    assert.equal(new Date(AF.awayUntil(Date.parse(t))).toISOString(), "2026-10-26T20:00:00.000Z", t);
  }
  assert.equal(AF.awayUntil(Date.parse("2026-10-26T15:00:00-05:00")), 0, "home again at the 3:00 PM switch");
  assert.equal(AF.awayUntil(Date.parse("2026-10-18T14:00:00-05:00")), 0, "before the away window");
});

test("no changeMin in the feed: no hour is assumed, the window ends at the first home day's midnight", () => {
  const j = JSON.parse(read("scripts/qa/fixtures/private/cal-months.synthetic.json")); delete j.changeMin;
  AF.setMonths(j);
  assert.equal(new Date(AF.awayUntil(Date.parse("2026-10-20T16:00:00-05:00"))).toISOString(), "2026-10-26T05:00:00.000Z");
  assert.equal(AF.awayUntil(Date.parse("2026-10-26T14:59:00-05:00")), 0, "a home day without changeMin is not away (switch-day hide covers kid items)");
});

test("no second away path: no homeWeek / cal.away reads on the glass, no away flag written to cal-live", () => {
  for (const f of ["house-hub-tiles-bind.js", "house-board-strip.js", "kid-world.js"]) {
    assert.doesNotMatch(read(f), /homeWeek|cal\.away|\.away\.untilIso/, f);
    assert.match(read(f), /AwayFilter/, f);
  }
  assert.doesNotMatch(read("scripts/cal-from-events.mjs"), /\baway\s*=\s*\{|^\s*away,\s*$/m);
});

test("one dress-up law: scripts and board strip use house-face-law.js DRESS, no private copy", () => {
  for (const f of ["scripts/calendar-refresh.mjs", "scripts/cal-from-events.mjs", "house-board-strip.js"]) {
    assert.doesNotMatch(read(f), /DRESS_RE\s*=\s*\//, `${f} keeps its own dress regex`);
  }
  const D = globalThis.HouseFaceLaw.DRESS;
  for (const s of ["Elm Yellow Day", "Hayes + Harris — Elm Orange Day", "Coug Fest wear green", "pajama day", "spirit week", "dress-up day"]) assert.ok(D.test(s), s);
  for (const s of ["Elm field trip", "Rays vs Guardians, Game 4", "Hayes flag football · 6:15", "Dad: Park concert"]) assert.ok(!D.test(s), s);
});
