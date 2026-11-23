/* HOUSEAWAY1 · node --test scripts/qa/houseaway1.test.mjs
   Atlas Nov 19: the house is empty from Sun Nov 22 8:00 AM until the Fri Dec 4 pickup leave, even on days the day flag
   is a Dan day. One source stays: away-filter.js over cal-months (withDan + houseAwayIso). Synthetic fixture; the
   pickup leave here is a fixture value (2:40 PM CT, the pickup event start on the calendar Nov 19), the real one is the end of the calendar event. Both directions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(import.meta.url);
const AF = require(path.join(ROOT, "away-filter.js"));
const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/qa/fixtures/private/cal-months.houseaway.synthetic.json"), "utf8"));
const LEAVE = Date.parse("2026-12-04T14:40:00-06:00");
const HOME = ["2026-11-21T12:00:00-06:00", "2026-12-04T14:41:00-06:00"];
const AWAY = ["2026-11-22T09:00:00-06:00", "2026-11-27T16:00:00-06:00", "2026-12-03T12:00:00-06:00"];

test("with the window: home Sat Nov 21 noon and pickup leave + 1 min; away Sun 9 AM, Fri Nov 27 4 PM, Thu Dec 3 noon", () => {
  AF.setMonths(FIX);
  for (const t of HOME) { assert.equal(AF.isAwayAt(Date.parse(t)), false, t); assert.equal(AF.awayUntil(Date.parse(t)), 0, t); }
  for (const t of AWAY) { assert.equal(AF.isAwayAt(Date.parse(t)), true, t); assert.equal(AF.awayUntil(Date.parse(t)), LEAVE, t); }
  assert.equal(AF.isAwayAt(Date.parse("2026-11-22T07:59:00-06:00")), false, "a minute before the Sunday drive");
  assert.equal(AF.isAwayAt(Date.parse("2026-11-22T08:00:00-06:00")), true, "the Sunday drive");
  assert.equal(AF.isAwayAt(LEAVE - 60000), true, "a minute before the pickup leave");
  assert.equal(AF.isAwayDay("2026-11-24"), true, "a whole Dan-flag day inside the window");
  assert.equal(AF.isAwayDay("2026-11-22"), false, "the drive day is only partly inside");
  assert.equal(AF.isAwayDay("2026-11-21"), false);
});

test("without the window the same days read the old way (the test can fail: Nov 22 and Nov 27 are home by flag)", () => {
  const j = JSON.parse(JSON.stringify(FIX)); delete j.houseAwayIso;
  AF.setMonths(j);
  assert.equal(AF.isAwayAt(Date.parse(AWAY[0])), false);
  assert.equal(AF.isAwayAt(Date.parse(AWAY[1])), false);
  assert.equal(AF.isAwayAt(Date.parse(AWAY[2])), true, "Dec 3 is a flag-away day");
  assert.equal(AF.isAwayAt(Date.parse(HOME[0])), false);
});

test("junk windows are dropped; a missing feed still resets to unknown", () => {
  AF.setMonths({ ...FIX, houseAwayIso: [["x", "y"], ["2026-11-22T08:00:00-06:00"], ["2026-12-04T14:40:00-06:00", "2026-11-22T08:00:00-06:00"], "z"] });
  assert.equal(AF.isAwayAt(Date.parse(AWAY[0])), false);
  AF.setMonths({ houseAwayIso: FIX.houseAwayIso });
  assert.equal(AF.hasMonths(), false);
  assert.equal(AF.isAwayAt(Date.parse(AWAY[0])), false, "no days, no away");
});

test("the window survives the face law (nocustody.test.mjs sweeps away-filter.js itself)", () => {
  globalThis.window = globalThis;
  globalThis.document = globalThis.document || { readyState: "complete", documentElement: { getAttribute() { return null; }, setAttribute() {} } };
  require(path.join(ROOT, "house-face-law.js"));
  const out = globalThis.HouseFaceLaw.cleanFeed("cal-months", JSON.parse(JSON.stringify(FIX)));
  assert.deepEqual(out.houseAwayIso, FIX.houseAwayIso);
});

test("generator: a timed House away event becomes houseAwayIso and never a month row", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/cal-months.py"), "utf8");
  assert.match(src, /HOUSE_AWAY = re\.compile\(r"\^\(\?:Atlas:\\s\*\)\?House away\\b"/);
  assert.ok(src.indexOf("HOUSE_AWAY.match(summ)") < src.indexOf("SKIP.search(summ)"), "read before the Atlas: stub skip");
  assert.match(src, /"houseAwayIso": sorted\(house_away\)/);
});
