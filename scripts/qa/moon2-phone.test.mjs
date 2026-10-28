/* MOON2 · the 440 phone shows the real moon. Alfred noon-final 10/25 (moon1_delta.tracked_condition_thu): "At 440 the moon is drawn
   off-frame (inFrame false) on every night slot, so phones show no moon." Cause: SC.phone.moon is the wall moon pushed through the porch
   crop PM, x = (259 - 380) * 1.3293 = -160.8, and the phone night plate has no baked disc anywhere. MOON2 gives the phone P.moonIn (an
   in-frame spot in the open sky, top right) and P.moonArt (the wall poster's own disc); MOON1.mask paints that disc there with lighten and
   then masks it to the real phase, exactly as on the wall. Moon down: nothing is painted. The wall keeps its baked disc (no moonIn).
   No browser: MOON1 runs against a recording 2d context. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BEGIN = "// MOON1 · real moon (begin)", END = "// MOON1 · real moon (end)";
const block = (f) => { const s = read(f), i = s.indexOf(BEGIN), j = s.indexOf(END); assert.ok(i > 0 && j > i, f + ": MOON1 block"); return s.slice(i, j); };
const ms = (d) => Date.parse(d);
/* a 2d context that records what it is asked to do */
const ctx = (W, H) => { const log = []; const c = { canvas: { width: W, height: H }, log, save() {}, restore() {}, beginPath() {}, closePath() {}, arc() {}, lineTo() {}, fill() { log.push(["fill", c.globalCompositeOperation]); }, clip() {}, fillRect() {},
  getImageData: () => ({ data: new Uint8ClampedArray(64).fill(10) }), createRadialGradient: () => ({ addColorStop() {} }),
  drawImage(...a) { log.push(["draw", c.globalCompositeOperation, ...a.slice(1)]); }, globalAlpha: 1, globalCompositeOperation: "source-over", filter: "none", fillStyle: "" }; return c; };
const document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx(0, 0) }) };
const M = new Function("CELL", "document", block("night/scene.html") + ";return MOON1")({ lat: 38.9, lon: -94.7 }, document);
const phoneP = () => { const s = read("night/scene.html"); const m = s.match(/emb:110,bs:1,moonIn:\[([\d.,]+)\],moonArt:\[([\d.,]+)\],/); assert.ok(m, "SC.phone carries moonIn and moonArt"); return { moon: [-160.8453, 119.502, 54.53], moonIn: m[1].split(",").map(Number), moonArt: m[2].split(",").map(Number) }; };
const ART = { src: "media/poster/v52-loop-wall.webp", naturalWidth: 1280, naturalHeight: 720 };

test("static: both pages carry the same MOON2 phone spot, the moon art is the wall poster, the scene token is MOON2", () => {
  assert.equal(block("night/scene.html"), block("wall.html"), "MOON1/MOON2 helpers byte-identical");
  for (const [f, pre] of [["night/scene.html", "media/poster/"], ["wall.html", "night/media/poster/"]]) { const s = read(f);
    assert.equal(s.split("emb:110,bs:1,moonIn:[368,30,20],moonArt:[260.4,95.6,44.5],").length, 2, f + ": phone only, once");
    assert.ok(!/wall:\{[^\n]*moonIn/.test(s), f + ": the wall plate keeps its baked disc");
    assert.ok(s.includes("MART.src='" + pre + "v52-loop-wall.webp'"), f + ": art path");
    assert.match(s, /envNow\(\),mode==='phone'\?moonArt:null\)\}catch\(e\)\{\}/, f + ": only the phone hands in the art (lazily, as a getter)"); }
  assert.match(read("night/night-host.js"), /pass\.set\("v", "MOON2"\)/);
  const P = phoneP(), [x, y, r] = P.moonIn; assert.ok(x - r * 1.9 > 0 && x + r * 1.9 <= 440 && y - r > 0 && y + r * 1.9 < 956 * 0.2 && y + r <= 54, "whole disc and halo inside the 440x956 plate, top band, disc above the y~59 sheet header card " + P.moonIn);
});

test("phone, moon up (Thu Oct 29 10:30 PM CT, waning 0.83): in frame, the wall disc painted (lighten) at the phone spot, then the dark side masked", () => {
  const P = phoneP(), c = ctx(440, 956); let asked = 0; const info = M.mask(c, P, 1, 1, 1, ms("2026-10-30T03:30:00Z"), () => { asked++; return ART; });
  assert.equal(info.up, true); assert.equal(info.inFrame, true); assert.equal(info.painted, true); assert.equal(asked, 1);
  assert.deepEqual([info.cx, info.cy, info.r], [368, 30, 20]); assert.ok(info.fraction > .8 && info.fraction < .86 && !info.waxing, "waning 83% " + info.fraction);
  const d = c.log.find((l) => l[0] === "draw"); assert.ok(d && d[1] === "lighten", "painted with lighten " + JSON.stringify(c.log.slice(0, 3)));
  assert.ok(c.log.some((l) => l[0] === "fill" && l[1] === "darken"), "then the dark side is masked");
  const at2 = c.log.findIndex((l) => l[0] === "fill" && l[1] === "darken"), at1 = c.log.findIndex((l) => l[0] === "draw"); assert.ok(at1 < at2, "paint before mask");
  const s2 = 2; const c2 = ctx(880, 1912); const i2 = M.mask(c2, P, s2, s2, 1, ms("2026-10-30T03:30:00Z"), () => ART); assert.deepEqual([i2.cx, i2.cy, i2.r], [736, 60, 40], "scales with the plate (2x footage)");
});

test("phone, moon down (Thu Oct 29 8:15 PM CT): nothing painted, nothing fetched", () => {
  const c = ctx(440, 956); let asked = 0; const info = M.mask(c, phoneP(), 1, 1, 1, ms("2026-10-30T01:15:00Z"), () => { asked++; return ART; });
  assert.equal(info.up, false); assert.equal(info.painted, false); assert.equal(asked, 0); assert.equal(c.log.length, 0, "the phone sky is untouched " + JSON.stringify(c.log));
});

test("phone, art not loaded yet: no paint and no mask (nothing to mask), retried on the next composite", () => {
  const c = ctx(440, 956); const info = M.mask(c, phoneP(), 1, 1, 1, ms("2026-10-30T03:30:00Z"), () => null);
  assert.equal(info.inFrame, true); assert.equal(info.painted, false); assert.equal(c.log.length, 0);
});

test("wall unchanged: baked disc masked in place, src ignored", () => {
  const c = ctx(1280, 720); let asked = 0; const info = M.mask(c, { moon: [259, 90, 41] }, 1, 1, 1, ms("2026-10-30T03:30:00Z"), () => { asked++; return ART; });
  assert.deepEqual([info.cx, info.cy, info.r, info.inFrame, info.painted, asked], [259, 90, 41, true, false, 0]);
  assert.ok(!c.log.some((l) => l[0] === "draw"), "nothing painted on the wall");
});

test("every Prism phase night Oct 26 to Nov 1: phone moon in frame and painted whenever up (9 PM and 11:30 PM CT); phase within MOON1's mean-month bound of Prism's ephem rows", () => {
  /* Prism phase-rows.json (ephem % lit at 02:00 UT = 9 PM CDT). MOON1 uses the mean synodic month, which drifts from the true phase
     as the week wanes: +0.3 on Oct 26 growing to +7.7 points on Nov 1 (MOON2 receipt, reported; not changed here). */
  const rows = { "10-26": 98.71, "10-27": 94.88, "10-28": 88.51, "10-29": 80.0, "10-30": 69.89, "10-31": 58.84, "11-01": 47.05 };
  let up = 0; for (const [d, k] of Object.entries(rows)) { const t9 = ms("2026-" + d + "T05:00:00Z") + 864e5 - 3 * 36e5;
    const f = M.at(t9).fraction * 100; assert.ok(f >= k - 0.5 && f - k < 8, d + " 9 PM: " + f.toFixed(2) + " vs Prism " + k);
    for (const t of [t9, t9 + 2.5 * 36e5]) { const c = ctx(440, 956), info = M.mask(c, phoneP(), 1, 1, 1, t, () => ART);
      assert.equal(info.inFrame, true, d); assert.equal(info.painted, info.up, d + " painted iff up");
      if (info.up) { up++; assert.equal(info.waxing, false, d + " waning, lit on the left"); } else assert.equal(c.log.length, 0, d + " down: untouched"); } }
  assert.ok(up >= 9, "the moon is up for most of these slots: " + up);
});
