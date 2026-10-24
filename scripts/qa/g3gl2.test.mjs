/* G3GL2 · Alfred P3s on G3GL1: an Ori world hands its WebGL context back on destroy, and the gate's unsafe-SwiftShader
   flag is documented as loopback-only (the gate serves this repo on 127.0.0.1 and loads nothing else). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("WP.destroy calls WEBGL_lose_context.loseContext once and survives a context that is already gone", () => {
  const src = read("ori/ori-scene.js");
  const m = src.match(/WP\.destroy = function \(\) \{[\s\S]*?\n?\s*this\.S = null; this\.host\.innerHTML = ""; \};/);
  assert.ok(m, "destroy body found");
  const run = (gl) => {
    const ctx = { cancelAnimationFrame() {}, WP: {}, out: null };
    vm.runInNewContext(m[0], ctx);
    const w = { raf: 0, ro: null, S: { gl }, host: { innerHTML: "x" } };
    ctx.WP.destroy.call(w);
    return w;
  };
  let lost = 0;
  const w = run({ getExtension: (n) => (n === "WEBGL_lose_context" ? { loseContext: () => lost++ } : null) });
  assert.equal(lost, 1); assert.equal(w.S, null); assert.equal(w.dead, true); assert.equal(w.host.innerHTML, "");
  assert.doesNotThrow(() => run({ getExtension: () => { throw new Error("lost"); } }));
  assert.doesNotThrow(() => run(null));
});

test("gate3: unsafe SwiftShader is justified as loopback-only, and every page the gate opens is 127.0.0.1", () => {
  const g = read("scripts/qa/gate3-ori-layout.mjs");
  assert.match(g, /--enable-unsafe-swiftshader/);
  assert.match(g, /acceptable ONLY because this gate loads loopback pages/);
  const gotos = [...g.matchAll(/page\.goto\(([^,]+),/g)].map((x) => x[1]);
  assert.ok(gotos.length > 0);
  for (const u of gotos) assert.match(u, /^"http:\/\/127\.0\.0\.1:" \+ PORT|^url$/, u);
});
