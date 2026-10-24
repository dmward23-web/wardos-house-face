/* PORCH1 · node --test scripts/qa/porch1.test.mjs: burst gaps 8-20 s, blackout 0.5-1.5 s, reduced motion stays calm, opacity only */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const P = createRequire(import.meta.url)("../../wg-porch.js");
function seq(...v) { let i = 0; return () => v[i++ % v.length]; }
test("burst interval is always within 8-20 s", () => {
  assert.equal(P.nextGap(0), 8000); assert.equal(P.nextGap(0.999999), 20000);
  for (let i = 0; i < 2000; i++) { const g = P.nextGap(); assert.ok(g >= 8000 && g <= 20000, String(g)); }
});
test("blackout, when it happens, is full dark for 0.5-1.5 s", () => {
  let seen = 0;
  for (let i = 0; i < 3000; i++) for (const [o, ms] of P.plan()) if (o === 0) { seen++; assert.ok(ms >= 500 && ms <= 1500, String(ms)); }
  assert.ok(seen > 0, "an occasional blackout occurs");
  const forced = P.plan(seq(0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01, 0.999999)); const b = forced.find((s) => s[0] === 0);
  assert.ok(b && b[1] >= 500 && b[1] <= 1500);
});
test("reduced motion: no flicker, no blackout, only a slow dim", () => {
  for (let i = 0; i < 50; i++) { const p = P.plan(Math.random, true); assert.ok(p.every(([o, ms]) => o >= 0.8 && (ms === 0 || ms >= 2000)), JSON.stringify(p)); }
});
test("every burst ends lit; the layer only animates opacity and never takes taps", () => {
  for (let i = 0; i < 200; i++) assert.equal(P.plan().at(-1)[0], 1);
  const js = fs.readFileSync(new URL("../../wg-porch.js", import.meta.url), "utf8"), css = fs.readFileSync(new URL("../../wg-porch.css", import.meta.url), "utf8");
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, ""), /style\.(transform|left|top|width|height|filter)\b/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(fs.readFileSync(new URL("../../wg-spook.js", import.meta.url), "utf8"), /WGPorch\.burst\(\)/, "a spook beat can force a burst");
});
/* Alfred gate (Oct 23 7:25 PM) */
const R = (f) => fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8");
test("GATE · no more than 3 flashes a second: every dip + recover takes at least 334 ms", () => {
  for (let i = 0; i < 2000; i++) { const p = P.plan(); for (let j = 0; j + 1 < p.length - 1; j += 2) if (p[j][0] < 0.8 && p[j][0] > 0) assert.ok(p[j][1] + p[j + 1][1] >= 334, JSON.stringify(p)); }
});
test("GATE · porch blackouts are local: the script only ever changes .wg-porch opacity", () => {
  const js = R("wg-porch.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(js, /querySelector\("\.wg-porch"\)/);
  assert.equal((js.match(/\.style\.opacity/g) || []).length, 1);
  assert.doesNotMatch(js, /documentElement\.style|body\.style|\.wg-spook/);
});
test("GATE · no harsh full-screen flash: full-screen spook layers stay soft (alpha <= .25) and white never fills the screen", () => {
  const css = R("wg-spook.css");
  for (const rule of css.split("}")) if (/inset:\s*0/.test(rule)) for (const a of rule.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/g)) assert.ok(+a[1] <= 0.25, rule.trim());
  assert.doesNotMatch(css, /background(-color)?:\s*(#fff\b|#ffffff|white)/i);
});
test("GATE · reduced motion: a scare is a minimal fade only; the porch stays steady or slow", async () => {
  const S = createRequire(import.meta.url)("../../wg-spook.js");
  const pol = new S.Policy(); const d = pol.decide(Date.parse("2026-10-23T20:00:00-05:00"), { muted: false, reduced: true, rand: () => 0.3 });
  assert.ok(d && d.minimal, "minimal beat");
  assert.match(R("wg-spook.css"), /prefers-reduced-motion|\.min\b/);
  assert.ok(P.plan(Math.random, true).every(([o, ms]) => o >= 0.8 && (ms === 0 || ms >= 2000)));
});
test("GATE · kid boards stay gentle: no camera scares or voice lines load on kid boards, and every line is kid-safe", () => {
  for (const k of ["ainsley", "hayes", "harris"]) assert.doesNotMatch(R("kid-" + k + ".html"), /wg-spook/);
  const S = createRequire(import.meta.url)("../../wg-spook.js");
  for (const l of S.LINES) assert.doesNotMatch(l, /\b(kill|die|dead|blood|murder|scream|hurt|eat you|monster under)\b/i, l);
});
test("GATE · never static: porch bursts, sign sway, gusts and tap nudges are all live", () => {
  assert.match(R("wg-porch.js"), /function loop\(\)/);
  const sw = R("wg-sway.js"); assert.match(sw, /setTimeout\(gust/); assert.match(sw, /pointerdown/);
  if (fs.existsSync(new URL("../../livinghouse/index.html", import.meta.url))) assert.match(R("livinghouse/index.html"), /class="wg-porch"/);
});

/* PORCH2 · the smoothed flicker curve (Prism's 24 fps porchlight-flicker-curve.json shape) never tops 3 flashes a second */
test("PORCH2: smooth() low-passes a harsh 24 fps curve to <= 3 flashes/s, stays soft, loops", async () => {
  const C = (await import("../../wg-porch.js")).default;
  const harsh = []; for (let i = 0; i < 192; i++) harsh.push(i % 2 ? 0.3 : 1);   /* 12 Hz square wave: worst case */
  assert.ok(C.flashes(harsh, 24) > 3, "fixture is harsh");
  const s = C.smooth(harsh, 24, 3, 8);
  assert.equal(s.length, 64);
  assert.ok(C.flashes(s, 8) <= 3, "smoothed <= 3 flashes/s");
  assert.ok(s.every((v) => v >= 0.6 && v <= 1), "never a blackout from the hum");
  const dip = Array(192).fill(0.92); dip[40] = 0.35; dip[42] = 0.5;   /* the raw Prism jump */
  const d = C.smooth(dip, 24, 3, 8);
  assert.ok(Math.min(...d) > 0.8, "single-frame dips are softened");
  assert.deepEqual(C.smooth([], 24), []); assert.deepEqual(C.smooth([NaN, "x"], 24), []);
});
test("PORCH2: the hum is skipped under reduced motion and only loads a listed curve", () => {
  const src = fs.readFileSync(new URL("../../wg-porch.js", import.meta.url), "utf8");
  assert.match(src, /function hum\(\) \{ if \(!curve \|\| !curve\.length \|\| reduced\(\)\) return;/);
  assert.match(src, /A\.have\["backgrounds\/porchlight-flicker-curve\.json"\]/);
});
