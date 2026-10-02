// DAYWIN1 · node scripts/wall/day-windows.test.mjs
// The wall reads the day's real data for ITS OWN clock: Atlas's morning run lists the house day's mode windows
// (house-mode.json timeline) and every leave still ahead (next-up.json upcoming); the wall picks the window / leave
// that covers its clock. An evening file never stands in for the morning (from later than the clock = not shown),
// and nothing ahead = nothing shown (no placeholder).
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { computeHouseMode, loadInputs, DEFAULTS } from "../house-mode.mjs";
import { computeNextUp } from "../next-up.mjs";
const require = createRequire(import.meta.url);
const S = require("../../house-wall-status.js");
const LS = require("../../house-wall-lists.js");
const K = require("../../house-wall-kid.js");
const R = LS.compileRenames(JSON.parse(fs.readFileSync(new URL("../../config/display-rename.json", import.meta.url))));
const F = (d, f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${d}/${f}`, import.meta.url)));
const at = (s) => Date.parse(s);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

// the Fri Oct 2 5:47 AM CT run (real calendar, generators unchanged in rules)
const hm = F("oct02-0547", "house-mode.json"), nu = F("oct02-0547", "next-up.json"), ks = F("oct02-0547", "kid-seats.json");
t("6:45 AM: today's mode window = School day", () => assert.equal(S.readHouseMode(hm, { now: at("2026-10-02T06:45:00-05:00") }).key, "school-day"));
t("3:30 PM: same morning file, the later window = Kids away", () => assert.equal(S.readHouseMode(hm, { now: at("2026-10-02T15:30:00-05:00") }).key, "kids-away"));
t("6:45 AM: next leave = the 8:10 drop-off", () => assert.equal(LS.leaveLine(nu, at("2026-10-02T06:45:00-05:00"), R).copy, "Leave 8:10."));
t("3:30 PM: no leave ahead today -> nothing (no placeholder)", () => assert.equal(LS.leaveLine(nu, at("2026-10-02T15:30:00-05:00"), R), null));
t("6:45 AM and 3:30 PM: the kid-seats law is today's", () => {
  for (const c of ["2026-10-02T06:45:00-05:00", "2026-10-02T15:30:00-05:00"]) assert.ok(K.law(ks, at(c)), c);
});
t("an evening file never reads in the morning (from later than the clock)", () => {
  const eve = F("oct01-data", "house-mode.json"), morning = at("2026-10-01T06:45:00-05:00");
  assert.equal(S.readHouseMode(eve, { now: morning }), null);
  assert.equal(S.readHouseMode({ ...hm, generatedAt: "2026-10-02T20:05:00-05:00" }, { now: at("2026-10-02T06:45:00-05:00") }), null);
  assert.equal(LS.leaveLine({ ...nu, generatedAt: "2026-10-02T20:05:00-05:00" }, at("2026-10-02T06:45:00-05:00"), R), null);
  assert.equal(K.law({ ...ks, generatedAt: "2026-10-02T20:05:00-05:00" }, at("2026-10-02T06:45:00-05:00")), null);
});
t("yesterday's file -> nothing", () => {
  assert.equal(S.readHouseMode(hm, { now: at("2026-10-03T06:45:00-05:00") }), null);
  assert.equal(LS.leaveLine(nu, at("2026-10-03T06:45:00-05:00"), R), null);
});
t("a timeline with no window covering the clock -> nothing", () =>
  assert.equal(S.readHouseMode({ ...hm, timeline: [{ mode: "school-day", label: "School day", since: "2026-10-02T06:00:00-05:00", until: "2026-10-02T07:00:00-05:00" }] }, { now: at("2026-10-02T08:00:00-05:00") }), null));
t("legacy file without upcoming keeps the 6h freshness rule", () => {
  const legacy = { ...nu }; delete legacy.upcoming;
  assert.equal(LS.leaveLine(legacy, at("2026-10-02T06:45:00-05:00"), R).copy, "Leave 8:10.");
  assert.equal(LS.leaveLine({ ...legacy, generatedAt: "2026-10-02T00:30:00-05:00" }, at("2026-10-02T06:45:00-05:00"), R), null);
});

// generator invariants on whatever calendar is in data/ right now
const inp = loadInputs({ ...DEFAULTS, override: "/nonexistent" });
for (const c of ["T06:00:00", "T12:00:00", "T19:30:00"]) {
  const now = at(new Date().toISOString().slice(0, 10) + c + "-05:00");
  t(`house-mode timeline is contiguous and starts at the current mode (${c.slice(1, 6)})`, () => {
    const o = computeHouseMode({ ...inp, now });
    assert.ok(Array.isArray(o.timeline) && o.timeline.length >= 1);
    assert.equal(o.timeline[0].mode, o.mode); assert.equal(o.timeline[0].until, o.until);
    for (let i = 1; i < o.timeline.length; i++) assert.equal(o.timeline[i].since, o.timeline[i - 1].until);
  });
  t(`next-up upcoming is sorted, all ahead, first = next (${c.slice(1, 6)})`, () => {
    const o = computeNextUp({ ...inp, now });
    assert.ok(Array.isArray(o.upcoming));
    assert.deepEqual(o.upcoming[0] || null, o.next);
    for (let i = 0; i < o.upcoming.length; i++) {
      assert.ok(Date.parse(o.upcoming[i].leaveIso) >= Math.floor(now / 60000) * 60000);
      if (i) assert.ok(Date.parse(o.upcoming[i].leaveIso) >= Date.parse(o.upcoming[i - 1].leaveIso));
    }
  });
}
console.log(`day-windows: ${n} tests PASS`);
