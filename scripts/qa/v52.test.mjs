/* V52 · Prism batch 5 idle loops: listed clip only behind caps video, listed poster as fallback, unlisted keeps night-media */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../../livinghouse/cinema.js");
const B = "../night/media/art/halloween/";
const all = { "v52/loop-night-wall.mp4": 1, "posters/loop-night-wall-poster.webp": 1, "posters/loop-phone-poster.webp": 1 };
test("listed v52 clip plays only when caps video is true", () => {
  const on = C.consider(70000, { caps: true, art: all, artBase: B });
  assert.equal(on.src, B + "v52/loop-night-wall.mp4"); assert.equal(on.posterUrl, B + "posters/loop-night-wall-poster.webp");
  const off = C.consider(70000, { caps: false, art: all, artBase: B });
  assert.equal(off.video, false); assert.equal(off.src, ""); assert.equal(off.posterUrl, B + "posters/loop-night-wall-poster.webp");
});
test("poster-only listing keeps the night-media clip (no 404 for an unlisted v52 file)", () => {
  const r = C.consider(70000, { caps: true, art: all, artBase: B, phone: true, lit: true });
  assert.equal(r.src, C.PHONE); assert.equal(r.posterUrl, B + "posters/loop-phone-poster.webp");
});
test("no art list, reduced motion and not-idle behave as before", () => {
  assert.equal(C.consider(70000, { caps: true }).src, C.WALL);
  assert.equal(C.consider(70000, { caps: true, art: all, artBase: B, reduced: true }).on, false);
  assert.equal(C.consider(10, { caps: true, art: all, artBase: B }).on, false);
});
