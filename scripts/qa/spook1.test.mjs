/* SPOOK1 · frame diff, cooldown, voice hours (5 PM to 7 AM CT only), mute, no-repeat, no phone camera, no frame upload. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../../wg-spook.js");
const SRC = fs.readFileSync(new URL("../../wg-spook.js", import.meta.url), "utf8");
const N = C.W * C.H;
const flat = (v) => new Uint8Array(N).fill(v);
test("frame diff: still frames are quiet, a moving block triggers", () => {
  const a = flat(100), b = flat(100);
  assert.equal(C.frameDiff(a, b), 0); assert.equal(C.motion(a, b), false);
  const noise = flat(100).map((v, i) => v + (i % 7) - 3); assert.equal(C.motion(a, noise), false);
  const m = flat(100); for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) m[y * C.W + x] = 220;
  assert.ok(C.frameDiff(a, m) > 0.1); assert.equal(C.motion(a, m), true);
  assert.equal(C.frameDiff(a, new Uint8Array(3)), 0);
});
test("toGray reuses its buffer", () => {
  const out = new Uint8Array(2); C.toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), out);
  assert.deepEqual([...out], [255, 0]);
});
const ct = (iso) => Date.parse(iso);
test("voice hours edges in CT, both sides of the Nov 1 DST change", () => {
  for (const [iso, speak] of [
    ["2026-10-23T16:59:00-05:00", false], ["2026-10-23T17:00:00-05:00", true],
    ["2026-10-24T06:59:00-05:00", true], ["2026-10-24T07:00:00-05:00", false],
    ["2026-11-02T16:59:00-06:00", false], ["2026-11-02T17:00:00-06:00", true],
    ["2026-11-03T06:59:00-06:00", true], ["2026-11-03T07:00:00-06:00", false],
  ]) {
    const d = new C.Policy().decide(ct(iso), { rand: () => 0.1 });
    assert.equal(d.voice, speak, iso); assert.equal(!!d.line, speak, iso);
  }
});
test("cooldown ~45 s", () => {
  const p = new C.Policy(), t = ct("2026-10-23T20:00:00-05:00");
  assert.ok(p.decide(t)); assert.equal(p.decide(t + 44000), null); assert.ok(p.decide(t + 45000));
});
test("brass mute silences the voice at night; visual still plays", () => {
  const d = new C.Policy().decide(ct("2026-10-23T20:00:00-05:00"), { muted: true });
  assert.equal(d.voice, false); assert.equal(d.line, null); assert.ok(d.beat);
});
test("reduced motion gives the minimal visual", () => {
  const d = new C.Policy().decide(ct("2026-10-23T20:00:00-05:00"), { reduced: true });
  assert.equal(d.minimal, true); assert.equal(d.beat, "lantern");
});
test("never the same line back to back; 20+ kid-safe lines", () => {
  const p = new C.Policy(); let prev = null, t = ct("2026-10-23T20:00:00-05:00");
  for (let i = 0; i < 200; i++) { const d = p.decide(t += 46000, { rand: () => 0.5 }); assert.notEqual(d.line, prev); prev = d.line; }
  assert.ok(C.LINES.length >= 20);
  for (const l of C.LINES) { assert.doesNotMatch(l, /[\u2014\u2013]|custody|mom|dad|ainsley|hayes|harris|kill|blood|die|dead/i, l); }
});
test("phone never asks for the camera; no frame data on the network", () => {
  const init = SRC.slice(SRC.indexOf("function init()"));
  assert.ok(init.indexOf("if (phone()) return;") < init.indexOf("camera()"));
  assert.doesNotMatch(SRC, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|toDataURL|toBlob|console\.(log|info|debug)/);
});
/* AMBIENT2 · spook:motion detail is numbers only {cx, cy, vx, vy, t (locked contract)}, centroid normalized 0..1 */
test("AMBIENT2 · motion payload carries numbers only, never pixels or frames", async () => {
  const { createRequire } = await import("node:module");
  const S = createRequire(import.meta.url)("../../wg-spook.js");
  const a = new Uint8Array(64 * 48), b = new Uint8Array(64 * 48);
  for (let y = 10; y < 20; y++) for (let x = 40; x < 50; x++) b[y * 64 + x] = 200;
  const c = S.centroid(a, b); assert.ok(c.cx > 0.6 && c.cx < 0.8 && c.cy > 0.2 && c.cy < 0.45, JSON.stringify(c));
  const d = S.payload(c, { cx: 0.5, cy: 0.5 }, 1761267600000);
  assert.deepEqual(Object.keys(d).sort(), ["cx", "cy", "t", "vx", "vy"]);
  for (const v of Object.values(d)) assert.equal(typeof v, "number");
  assert.ok(d.vx > 0 && d.vy < 0);
  const evil = S.payload({ cx: a, cy: "x" }, null, NaN); for (const v of Object.values(evil)) assert.equal(typeof v, "number");
  assert.equal(S.centroid(a, a), null, "no change, no event");
  const src = (await import("node:fs")).readFileSync(new URL("../../wg-spook.js", import.meta.url), "utf8");
  assert.match(src, /new CustomEvent\("spook:motion", \{ detail: C\.payload\(/, "only the numeric payload is dispatched");
});

/* SPOOK2 · ghost loop gate: video only behind caps video + a listed file, poster fallback, screen blend, off for minimal/reduced */
test("SPOOK2: ghost overlay is gated, blended, and falls back to the poster", () => {
  const js = fs.readFileSync(new URL("../../wg-spook.js", import.meta.url), "utf8"), css = fs.readFileSync(new URL("../../wg-spook.css", import.meta.url), "utf8");
  assert.match(js, /if \(A\.video && A\.have\[k \+ "\.mp4"\]\)/);
  assert.match(js, /else if \(poster\)/);
  assert.match(js, /d\.beat === "ghost" && !d\.minimal/);
  assert.match(css, /\.sp-ghostv \{[^}]*mix-blend-mode: screen/);
  assert.match(css, /\.wg-spook\.on\.min \.sp-ghostv \{ opacity: 0 !important; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.wg-spook \.sp-ghostv \{ display: none; \}/);
});
