/* KIDCRIT JARTAP1 (Atlas 11:51 PM CT) · node --test scripts/qa/jartap1.test.mjs
   The jar box sat over chores (Ainsley 5, Hayes 9 at 1280/1640): a chore tap opened the jar view, which then owned the screen.
   Now the jar host takes no pointer events over the world, the world canvas hit-tests chores FIRST, and the jar opens only
   inside its painted shape. Static/no-browser: geometry from the keep-out export and the r8 proof, real jar-engine.js in a vm. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const GEOM = JSON.parse(rd("scripts/qa/jartap1-geom.json"));
const ov = (a, j) => !(a[2] <= j[0] || a[0] >= j[2] || a[3] <= j[1] || a[1] >= j[3]);

function loadJar() {
  const noop = () => {};
  const el = () => ({ className: "", style: {}, setAttribute: noop, getContext: () => null, addEventListener: noop, classList: { add: noop } });
  const ctx = vm.createContext({ console, Math, Date, navigator: { userAgent: "node", hardwareConcurrency: 8 }, location: { search: "" },
    document: { createElement: el, querySelector: () => null, addEventListener: noop }, matchMedia: () => ({ matches: false }),
    performance: { now: () => 0 }, requestAnimationFrame: noop, Image: function () {} });
  ctx.window = ctx; ctx.addEventListener = noop;
  vm.runInContext(rd("jar-engine.js"), ctx, { filename: "jar-engine.js" });
  return ctx;
}
function fakeJar(ctx, kid, box) {
  const J = ctx.JarEngine; assert.ok(J, "JarEngine global");
  /* reach the prototype without a DOM: borrow visibleRect/hits from the source by building a bare object */
  const src = rd("jar-engine.js");
  assert.match(src, /Jar\.prototype\.visibleRect = function/);
  assert.match(src, /Jar\.prototype\.hits = function/);
  const proto = vm.runInContext("(function(){var o={};" + src.match(/Jar\.prototype\.visibleRect = function[\s\S]*?\n  };\n  Jar\.prototype\.hits = function[\s\S]*?\n  };/)[0].replace(/Jar\.prototype/g, "o") + ";return o})()", ctx);
  const o = Object.create(proto); o.kid = kid;
  o.cv = { getBoundingClientRect: () => ({ left: box[0], top: box[1], width: box[2], height: box[3] }) };
  return o;
}

test("the bug is real: keep-out chore hit boxes overlap the jar box (Ainsley chore 5, Hayes chore 9 at 1280 and 1640)", () => {
  const K = GEOM.keepout.boards;
  for (const sz of ["1280x800", "1640x820"]) {
    const a = K["ainsley@" + sz], h = K["hayes@" + sz];
    assert.ok(a.choreHit.filter((c) => ov(c.slice(1), a.jar)).map((c) => c[0]).includes(4), "ainsley " + sz);
    assert.ok(h.choreHit.filter((c) => ov(c.slice(1), h.jar)).map((c) => c[0]).includes(8), "hayes " + sz);
  }
});

test("over the world the jar host and canvas take no pointer events, so every chore point reaches the world canvas", () => {
  const css = rd("kid-world.css");
  assert.match(css, /body\.kw-on \.kw-jar-host, body\.kw-on \.kw-jar-host \.je-jar-cv \{ pointer-events: none; \}/);
  /* it comes after the DAYPICK2 list that turned pointer events back on for .kw-jar-host */
  assert.ok(css.lastIndexOf("pointer-events: none; }") > css.indexOf(".kw-jar-host, .kw-drawer"));
});

test("a world tap resolves a chore BEFORE the jar: onWorldJarClick bails on any chore hit, onWorldDown is unchanged", () => {
  const js = rd("kid-world.js");
  const f = js.match(/function onWorldJarClick\(ev\) \{[\s\S]*?\n  \}/)[0];
  assert.match(f, /if \(!ev\.isTrusted \|\| hitQuest\(ev\)\) return;/);
  assert.match(f, /jar\.hits\(ev\.clientX, ev\.clientY\)/);
  assert.match(js, /cv\.addEventListener\("click", onWorldJarClick\)/);
  assert.match(js, /cv\.addEventListener\("pointerdown", onWorldDown\)/);
});

test("the jar answers only inside its painted shape (vm, real jar-engine.js): every chore centre at 440/1280/1640 outside the shape is ignored", () => {
  const ctx = loadJar(); let outside = 0; const inside = [];
  for (const [key, b] of Object.entries(GEOM.boards)) {
    const [kid, sz] = key.split("@");
    if (!["440x956", "1280x800", "1640x820"].includes(sz)) continue;
    b.chores.forEach(([x, y, box], i) => {
      const jar = fakeJar(ctx, kid, box), v = jar.visibleRect();
      assert.ok(v.left >= box[0] && v.right <= box[0] + box[2] && v.bottom <= box[1] + box[3], key + " shape inside box");
      const inBox = x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3];
      if (!inBox) { assert.equal(jar.hits(x, y), false, key + " " + x + "," + y); outside++; } else inside.push(key + "#" + (i + 1));
    });
  }
  assert.ok(outside >= 70, "checked " + outside + " chore centres outside the jar box");
  /* centres INSIDE the box are still chores: onWorldJarClick returns on hitQuest first (test above). The proof saw these under the jar: */
  for (const want of ["ainsley@1280x800#5", "hayes@1280x800#9", "hayes@1640x820#9"]) assert.ok(inside.includes(want), want + " in " + inside);
  const el = GEOM.boards["hayes@1280x800"].elAtChore[8]; assert.equal(el, "CANVAS.je-jar-cv", "before JARTAP1 the jar canvas owned Hayes chore 9");
});

test("Ainsley's record jar is round: a box corner is not the jar", () => {
  const ctx = loadJar(); const j = fakeJar(ctx, "ainsley", [539, 540, 150, 160]);
  assert.equal(j.hits(539 + 75, 540 + 80), true);
  assert.equal(j.hits(541, 542), false);
});

test("the jar's own click handler ignores a trusted tap outside its shape (non-world layout)", () => {
  const src = rd("jar-engine.js");
  assert.match(src, /if \(e && e\.clientX != null && e\.isTrusted !== false && !self\.hits\(e\.clientX, e\.clientY\)\) return;/);
});

test("kid pages load the JARTAP1 bytes (cache tokens)", () => {
  for (const k of ["harris", "hayes", "ainsley"]) {
    const h = rd("kid-" + k + ".html");
    for (const f of ["jar-engine.js", "kid-world.js", "kid-world.css", "house-fresh.js", "house-nomoney.js"])
      assert.match(h, new RegExp(f.replace(".", "\\.") + (f === "kid-world.js" ? "\\?v=HAYESJAR1" : f === "kid-world.css" || f === "house-nomoney.js" ? "\\?v=DAYPKG1" : "\\?v=JARTAP1")), k + " " + f); /* HAYESJAR1 re-bumped kid-world.js; DAYPKG1 re-bumped kid-world.css (token only); DAYPKG1 v2e re-bumps house-nomoney.js on purpose (v2d changed its kid guard) */
  }
});
