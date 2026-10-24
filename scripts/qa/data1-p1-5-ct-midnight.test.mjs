/* DATA1 P1-5 · cal-from-events all-day dates use the shared DST-aware Chicago midnight, never a hardcoded -05:00. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NAMES } from "./data1-lib.mjs";
process.env.WARDOS_NAMES = NAMES;
const cfe = await import("../cal-from-events.mjs");
test("CDT and CST all-day dates", () => {
  assert.equal(cfe.normalizeDateField("2026-10-30").toISOString(), "2026-10-30T05:00:00.000Z");
  assert.equal(cfe.normalizeDateField("2026-11-05").toISOString(), "2026-11-05T06:00:00.000Z");
  assert.equal(cfe.startIsoLocal({ start: { date: "2026-11-05" } }), "2026-11-05T00:00:00-06:00");
  assert.equal(cfe.endIsoLocal({ end: { date: "2026-11-06" } }), "2026-11-06T00:00:00-06:00");
  assert.equal(cfe.startIsoLocal({ start: { date: "2026-10-30" } }), "2026-10-30T00:00:00-05:00");
});
