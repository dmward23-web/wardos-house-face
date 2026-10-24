/* REALMOON1 · real home moon: known dates, orientation, DST edges, CT-midnight refresh, contract. */
import test from "node:test"; import assert from "node:assert/strict"; import { createRequire } from "node:module"; import fs from "node:fs";
const M = createRequire(import.meta.url)("../../livinghouse/moon-real.js");
M.setCell({ lat: 38.9, lon: -94.7 });   /* LIVEWX2 · the client file carries no location; the home tables below use the hub's coarse metro cell */
const near = (a, b, tol) => Math.abs(a - b) <= tol;
test("known full moons: 2026-10-26 04:12 UTC and 2024-12-15 09:02 UTC read full", () => {
  for (const d of ["2026-10-26T04:12:00Z", "2024-12-15T09:02:00Z"]) { const i = M.illumination(new Date(d)); assert.ok(i.fraction > 0.99, d + " " + i.fraction); assert.ok(near(i.phase, 0.5, 0.02), d + " " + i.phase); }
});
test("known new moons: 2026-11-09 07:02 UTC and 2025-01-29 12:36 UTC read new", () => {
  for (const d of ["2026-11-09T07:02:00Z", "2025-01-29T12:36:00Z"]) { const i = M.illumination(new Date(d)); assert.ok(i.fraction < 0.01, d + " " + i.fraction); assert.ok(i.phase < 0.03 || i.phase > 0.97, d + " " + i.phase); }
});
test("quarters: first 2026-10-18 16:12 UTC (waxing, lit right), last 2026-11-01 16:28 UTC (waning)", () => {
  const f = M.illumination(new Date("2026-10-18T16:12:00Z")), l = M.illumination(new Date("2026-11-01T16:28:00Z"));
  assert.ok(near(f.fraction, 0.5, 0.04) && f.waxing && near(f.phase, 0.25, 0.02), JSON.stringify(f));
  assert.ok(near(l.fraction, 0.5, 0.04) && !l.waxing && near(l.phase, 0.75, 0.02), JSON.stringify(l));
});
test("orientation: lh.js lit path puts the waxing limb on the right (northern hemisphere)", () => {
  const src = fs.readFileSync(new URL("../../livinghouse/lh.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function litPath"), src.indexOf("var CIRC"));
  const litPath = new Function(body + "; return litPath;")();
  const sx = (d) => { const m = /A100,100 0 0 (\d) 0,100/.exec(d); return m && m[1]; };
  assert.equal(sx(litPath(0.2)), "1", "waxing outer arc sweeps through +x (right)");
  assert.equal(sx(litPath(0.8)), "0", "waning outer arc sweeps through -x (left)");
  assert.match(src, /RealMoonMath/); assert.match(src, /realmoon:update/); assert.match(src, /cloudPct/);
});
test("home rise/set: moon up late evening 2026-10-23 CT, down at noon 2026-11-09 near new", () => {
  const a = M.state(new Date("2026-10-24T04:00:00Z")); assert.equal(a.up, true); assert.ok(a.arc > 0 && a.arc < 1); assert.ok(a.rise < new Date("2026-10-24T04:00:00Z") && a.set > new Date("2026-10-24T04:00:00Z"));
  const b = M.state(new Date("2026-11-10T04:00:00Z")); assert.equal(b.up, false); assert.equal(b.arc, null);
});
test("DST edges: CT midnight 06:00Z on 2026-03-08 (CST), 05:00Z on 03-09 and 11-01 (CDT), 06:00Z on 11-02; next refresh lands on the next civil midnight", () => {
  assert.equal(M.ctMidnight("2026-03-08").toISOString(), "2026-03-08T06:00:00.000Z");
  assert.equal(M.ctMidnight("2026-03-09").toISOString(), "2026-03-09T05:00:00.000Z");
  assert.equal(M.ctMidnight("2026-11-01").toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(M.ctMidnight("2026-11-02").toISOString(), "2026-11-02T06:00:00.000Z");
  assert.equal(M.state(new Date("2026-11-01T23:30:00-06:00")).nextMidnight.toISOString(), "2026-11-02T06:00:00.000Z");
  assert.equal(M.state(new Date("2026-03-08T12:00:00-05:00")).nextMidnight.toISOString(), "2026-03-09T05:00:00.000Z");
  assert.equal(M.state(new Date("2026-11-01T01:30:00-05:00")).day, "2026-11-01");
});
test("published home table Oct 23-25 2026: rise 4:59/5:24/5:53 PM, set 4:45/5:53/7:04 AM CT, within 2 min", () => {
  const T = { "2026-10-23": ["16:59", "04:45"], "2026-10-24": ["17:24", "05:53"], "2026-10-25": ["17:53", "07:04"] };
  const ct = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d).split(":").map(Number);
  const mins = (a) => a[0] * 60 + a[1] + (a[2] || 0) / 60;
  for (const [day, [r, s]] of Object.entries(T)) { const t = M.times(M.ctMidnight(day));
    assert.ok(t.rise && t.set, day);
    const dr = mins(ct(t.rise)) - mins(r.split(":").map(Number)), ds = mins(ct(t.set)) - mins(s.split(":").map(Number));
    assert.ok(Math.abs(dr) <= 2, day + " rise off " + dr.toFixed(2) + " min"); assert.ok(Math.abs(ds) <= 2, day + " set off " + ds.toFixed(2) + " min"); }
});
test("Oct 23 2026 9 PM CT: about 94% lit, waxing, up in the south-east; RealMoon carries alt/az/rise/set", () => {
  const s = M.state(new Date("2026-10-24T02:00:00Z")); assert.ok(near(s.fraction, 0.945, 0.015) && s.waxing && s.up, JSON.stringify(s));
  const az = (s.azimuth + 180) % 360; assert.ok(az > 100 && az < 160 && s.altitude > 30 && s.altitude < 55, az + " " + s.altitude);
  const lh = fs.readFileSync(new URL("../../livinghouse/lh.js", import.meta.url), "utf8");
  for (const k of ["visible:", "cx:", "cy:", "r:", "illum:", "phase:", "waxing:", "alt:", "az:", "ts:"]) assert.ok(lh.includes(k), k);
  assert.match(lh, /realmoon:update/);
});
test("Oct 31 2026 10 PM CT: moon down, next rise 11:30 PM CT (USNO, within 2 min), waning; Oct 24 8 PM about 98% waxing", () => {
  const s = M.state(new Date("2026-10-31T22:00:00-05:00")); assert.equal(s.up, false); assert.equal(s.waxing, false);
  assert.ok(near(s.rise.getTime(), Date.parse("2026-10-31T23:30:00-05:00"), 2 * 60e3), "rise " + s.rise.toISOString()); assert.ok(s.set > s.rise, "set follows the next rise");
  const p = M.illumination(new Date("2026-10-24T20:00:00-05:00")); assert.ok(p.waxing && near(p.fraction, 0.982, 0.01), "Oct 24 8 PM " + p.fraction);
});
test("real disc + phase mask: wg-mattes masks the NASA disc by phase index, gated on moon up, no full-disc fallback once real", () => {
  const w = fs.readFileSync(new URL("../../wg-mattes.js", import.meta.url), "utf8"), c = fs.readFileSync(new URL("../../livinghouse/lh.css", import.meta.url), "utf8");
  assert.match(w, /moon-real-disc-512/); assert.match(w, /moon-phase-mask-/); assert.match(w, /\.phase \* 30\) % 30/); assert.match(w, /realmoon:update/);
  assert.match(c, /\[data-moonreal\]\[data-moon-up="0"\] \.lh-moonface \{ opacity: 0; \}/);
});
test("LIVEWX2 · waxing flips AT the true full moon (2026-10-26 04:12 UTC = Oct 25 11:12 PM CDT, within 15 min) and the phase agrees there", () => {
  let t = Date.parse("2026-10-25T12:00:00Z"), prev = M.illumination(new Date(t)).waxing, flip = null;
  for (; t < Date.parse("2026-10-27T00:00:00Z"); t += 60e3) { const w = M.illumination(new Date(t)).waxing; if (w !== prev) { flip = t; break; } prev = w; }
  assert.ok(flip && near(flip, Date.parse("2026-10-26T04:12:00Z"), 15 * 60e3), "flip " + (flip && new Date(flip).toISOString()));
  const i = M.illumination(new Date("2026-10-26T04:12:00Z")); assert.ok(near(i.phase, 0.5, 0.005), "phase at full " + i.phase);
  assert.equal(M.illumination(new Date("2026-10-26T03:30:00Z")).waxing, true); assert.equal(M.illumination(new Date("2026-10-26T05:00:00Z")).waxing, false);
});
test("LIVEWX2 · the 25 h fall-back day (Nov 1 2026) keeps its late rise: state() at 10 PM CST reports the Nov 1 rise, not Nov 2", () => {
  const s = M.state(new Date("2026-11-01T22:00:00-06:00")); assert.equal(s.up, false);
  assert.equal(M.ctCivil(s.rise), "2026-11-01", "rise " + s.rise.toISOString()); assert.ok(near(s.rise.getTime(), Date.parse("2026-11-01T23:45:00-06:00"), 5 * 60e3), "rise " + s.rise.toISOString());
  const t0 = M.ctMidnight("2026-11-01"), r24 = M.times(t0);   /* a fixed 24 h scan stops at 11 PM CST and misses it: the bug this guards */
  assert.ok(!r24.rise || r24.rise.getTime() < t0.getTime() + 864e5, "24 h scan window");
});
