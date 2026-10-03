/* OCT8 8 · the Us together eruption canvas is sized in the tile's own CSS px under house-zoom's CSS zoom. */
import test from "node:test"; import assert from "node:assert/strict";
import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const E = createRequire(import.meta.url)(path.join(ROOT, "house-us-erupt.js"));
const tile = (cssW, zoom) => ({ offsetWidth: cssW, getBoundingClientRect: () => ({ width: cssW * zoom }) });
test("fitToZoom divides the canvas box by the tile's zoom", () => {
  const cv = { style: { width: "1600px", height: "2600px" } };
  E.fitToZoom(tile(500, 2), cv);
  assert.equal(cv.style.width, "800px"); assert.equal(cv.style.height, "1300px");
});
test("fitToZoom leaves an unzoomed tile alone and tolerates no canvas", () => {
  const cv = { style: { width: "1600px", height: "2600px" } };
  E.fitToZoom(tile(500, 1), cv); assert.equal(cv.style.width, "1600px");
  assert.equal(E.fitToZoom(tile(500, 2), null), null);
});
test("still erupts only on the Us together rule", () => {
  assert.equal(E.shouldErupt({ usTogether: { lit: true } }), true);
  assert.equal(E.shouldErupt({ usTogether: { lit: false } }), false);
  assert.equal(E.shouldErupt(null), false);
});
