// SWEEP1 NOSTAR1: the house-sfx "+★N" tap fly-up never stays in a kid page DOM (Ainsley: no stars, no digits).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../../house-nomoney.js", import.meta.url), "utf8");
function load() {
  const g = { document: { readyState: "loading", addEventListener() {} } };
  vm.runInNewContext(src, { window: g, globalThis: g, document: g.document, setTimeout, clearTimeout });
  return g.HouseNoMoney;
}
function el(cls, kids = []) {
  const n = { nodeType: 1, tagName: "DIV", classList: { contains: (c) => cls.split(" ").includes(c) }, getAttribute: () => null, firstChild: null, nextSibling: null, parentNode: null };
  n.removeChild = (c) => { n.removed = (n.removed || []).concat(c); c.parentNode = null; };
  return n;
}

test("vfx-dollar fly-up is removed when scrubbed", () => {
  const nm = load();
  const parent = el("vfx-layer");
  const pop = el("vfx-float vfx-dollar vfx-ainsley");
  pop.parentNode = parent;
  nm.scrub(pop);
  assert.deepEqual(parent.removed, [pop]);
});

test("other popups (no vfx-dollar) are kept", () => {
  const nm = load();
  const parent = el("vfx-layer");
  const pop = el("vfx-float vfx-ainsley");
  pop.parentNode = parent;
  nm.scrub(pop);
  assert.equal(parent.removed, undefined);
});

test("every kid page loads house-nomoney on the DAYPKG1 token (was JARTAP1, KIDCRIT1; DAYPKG1 v2e bump: v2d changed the kid guard)", () => {
  for (const k of ["harris", "hayes", "ainsley"]) {
    const h = fs.readFileSync(new URL(`../../kid-${k}.html`, import.meta.url), "utf8");
    assert.match(h, /house-nomoney\.js\?v=DAYPKG1"/, k);
  }
});
