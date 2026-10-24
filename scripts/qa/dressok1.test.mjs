/* DRESSOK1 (Dan 2026-10-23): PJ / spirit / costume days show; Red Day shows as a marker; no "wear <colour>" prompt. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dressFree } from "../cal-from-events.mjs";
createRequire(import.meta.url)("../../house-face-law.js");
const L = globalThis.HouseFaceLaw;
test("PJ day row survives the feed (her board + hub read this feed)", () => {
  const rows = dressFree([{ summary: "Ainsley — LKMS PJ day (no costumes at school)", start: "2026-10-30" }]);
  assert.equal(rows.length, 1);
  assert.equal(L.isDressDay(rows[0].summary), false);
});
test("spirit and costume days show", () => {
  for (const s of ["Spirit Day", "Costume parade", "Spirit week"]) assert.equal(L.isDressDay(s), false, s);
});
test("Red Day shows as a marker, never with a wear prompt", () => {
  assert.equal(dressFree([{ summary: "Red Day — wear red" }]).length, 1);
  assert.equal(L.isColorDay("Red Day"), true);
  assert.doesNotMatch(L.faceText("Red Day — wear red"), /wear/i);
  assert.doesNotMatch(L.faceText("Red Day (wear red)"), /wear/i);
});
