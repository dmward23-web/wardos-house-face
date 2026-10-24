/* DATA1 P2-8 · "for mom" goes as a whole phrase (no dangling "for (") and one school-word rule serves both feeds. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { W, rows, NAMES } from "./data1-lib.mjs";
process.env.WARDOS_NAMES = NAMES;
const cfe = await import("../cal-from-events.mjs");
test("cal-live text law strips the whole phrase", () => {
  const t = cfe.cleanText("Kids — pack sports + clothes for mom (Thu night)");
  assert.doesNotMatch(t, /\bfor\s*\(|\bmom\b/i, t);
  assert.match(t, /clothes \(Thu night\)/);
  assert.doesNotMatch(cfe.shortPlace("Kids — pack sports + clothes for mom (Thu night)"), /\bfor\s*\(|\bfor\s*$/);
});
test("board feed: same phrase rule and school word", () => {
  const wk = rows(W(), "dan", "week").map((r) => r.what);
  const p = wk.find((x) => /pack sports/.test(x));
  assert.ok(p && !/\bfor\s*\(|\bmom\b/i.test(p), p);
  assert.ok(!wk.some((x) => /\bLKMS\b/.test(x)));
  assert.equal(cfe.cleanText("LKMS PJ day"), globalThis.HouseFaceLaw.schoolWord("LKMS PJ day"));
});
