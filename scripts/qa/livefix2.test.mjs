/* LIVEFIX2 · Atlas ruling (b), narrow: on an away day the Dan-only views (sheet-dan.html, data-dad-only) still show the kid
   rows Dan attends or acts on (conferences, school-closure notices, school events marked as Dan's); practices, skate
   nights and every other kid row stay hidden. Shared, wall and kid boards keep the away law unchanged.
   Synthetic stand-ins only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "away-filter.js"), "utf8");
function load(dadOnly) {
  const doc = { querySelector: (sel) => (dadOnly && /data-dad-only/.test(sel) ? {} : null), readyState: "complete" };
  const ctx = { window: null, document: doc, location: { search: "?now=2026-10-20T19:00:00-05:00" }, URLSearchParams, Intl, Date, JSON, Response: undefined };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(SRC, ctx);
  const AF = ctx.AwayFilter;
  AF.setMonths({ days: { "2026-10-20": { withDan: false }, "2026-10-21": { withDan: false }, "2026-10-22": { withDan: false }, "2026-10-23": { withDan: true } } });
  return AF;
}
const at = (h) => "2026-10-21T" + h + ":00-05:00";
const ROWS = () => ({ status: "live", upcomingLeaves: [
  { summary: "Harris · Smith conference (VIRTUAL) · 4:00", start: at("16:00") },
  { summary: "Hayes · QXS parent-teacher conference · 4:30", start: at("16:30") },
  { summary: "No School", start: "2026-10-22", allDay: true },
  { summary: "Harris flag practice · 5:30-6:30", start: at("17:30") },
  { summary: "Hayes + Harris · Jones Skate Night · 6:00", start: at("18:00") },
] });

test("away day, Dan-only view: conferences and closure rows show; practice and skate night stay hidden", () => {
  const out = load(true).filterCalLive(ROWS()).upcomingLeaves.map((e) => e.summary);
  assert.equal(out.filter((s) => /conference/.test(s)).length, 2, out.join(" | "));
  assert.ok(out.includes("No School"), out.join(" | "));
  assert.ok(!out.some((s) => /practice|Skate/i.test(s)), out.join(" | "));
});

test("away day, wall / shared / kid boards: every kid row stays hidden (away law unchanged)", () => {
  const out = load(false).filterCalLive(ROWS()).upcomingLeaves;
  assert.deepEqual(out, []);
});
