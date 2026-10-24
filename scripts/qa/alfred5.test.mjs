import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1: a temp HOME before the private-names reader loads (the synthetic fixture keeps the check live)
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { privateNames } from "../private-dir.mjs";
assertSealed();
const R = p => fs.readFileSync(new URL("../../" + p, import.meta.url), "utf8");
test("SPOOK voice lines name no person or place", () => {
  const s = R("wg-spook.js"), lines = JSON.parse(s.match(/var LINES = (\[[\s\S]*?\]);/)[1]);
  /* person names come from the box's private-names list at run time (never a literal in this public file); "zorblax-fixture" is a synthetic stand-in so the check runs even with no list */
  const people = ["zorblax-fixture", ...Object.values(privateNames()).flat()].map((n) => String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const bad = new RegExp("\\b(" + people.join("|") + "|dad|mom|upstairs|downstairs|door|kitchen|room|house|street|school|porch|yard|basement|attic)\\b", "i");
  assert.ok(bad.test("the zorblax-fixture is near"), "fixture name is caught");
  for (const l of lines) assert.ok(!bad.test(l), l);
});
test("lightning envelope: capped, soft, <=3 flashes/s", () => {
  for (const f of ["wall.html", "night/scene.html"]) {
    const m = R(f).match(/ENV\.flash=ft<0\|\|ft>1\.4\?0:(.*?);\/\* LIGHT2/); assert.ok(m, f);
    const fn = new Function("ft", "ENV", "return " + m[1]); const E = { thun: 1 }; let mx = 0, rev = 0, d0 = 0, p = 0;
    for (let t = 0; t <= 1.4; t += 1 / 60) { const v = fn(t, E); mx = Math.max(mx, v); const d = v - p; if (d0 > 0 && d < 0) rev++; if (d) d0 = d; p = v; }
    assert.ok(mx <= .5, "cap " + mx); assert.ok(rev <= 3, "peaks " + rev);
  }
});
test("cauldron copy and family sign", () => { assert.match(R("livinghouse/lh.js"), /Nothing brewing yet/); assert.doesNotMatch(R("livinghouse/lh.js"), /lived yet/); assert.match(R("livinghouse/index.html"), />The Ward's</); });
