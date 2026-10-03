/* JARHERO3 · the Us together eruption really fires when Atlas's rule is met, and never otherwise.
   (1) house-us-erupt.js end to end with a stub page: fetch data/kid-seats.json -> JarMercury.eruptUsTogether(tile, true).
   (2) Prism's real jar-mercury.js: eruptUsTogether(tile, true) paints a canvas on the tile; false / missing -> null.
   Ainsley's jar / trusted state never changes whether it fires (it is not an input anywhere). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function el(tag) {
  const e = { tagName: tag.toUpperCase(), style: {}, children: [], attrs: {}, className: "", isConnected: true, parentNode: null,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 240, right: 600, bottom: 240 }; } };
  if (tag === "canvas") e.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
  return e;
}
function page(seats, erupt) {
  const tile = el("section"); tile.id = "us-board";
  const head = el("head");
  const document = { readyState: "complete", head, documentElement: el("html"), getElementById: (id) => (id === "us-board" ? tile : head.children.find((c) => c.id === id) || null), createElement: el, addEventListener() {} };
  const win = { document, JarMercury: { eruptUsTogether: erupt }, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(seats) }) };
  win.window = win;
  return { win, tile };
}
async function runErupt(seats) {
  const calls = [];
  const { win, tile } = page(seats, (t, fam) => { calls.push([t, fam]); return null; });
  vm.runInNewContext(read("house-us-erupt.js"), { window: win, globalThis: win, Promise, Date, setTimeout });
  await new Promise((r) => setTimeout(r, 20));
  return { calls, tile, win };
}
const lit = { usTogether: { closes: 10, available: 12, unlockAt: 10, lit: true } };
const off = { usTogether: { closes: 9, available: 12, unlockAt: 10, lit: false } };

test("house-us-erupt: rule met -> eruptUsTogether(tile, true) once; the tile clips it", async () => {
  const { calls, tile, win } = await runErupt(lit);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], tile); assert.equal(calls[0][1], true);
  assert.ok(win.document.getElementById("us-erupt-clip"), "clip style present while it can fire");
});
test("house-us-erupt: rule not met / no data -> nothing at all", async () => {
  for (const s of [off, null, {}, { usTogether: { lit: "true" } }]) assert.equal((await runErupt(s)).calls.length, 0);
});
test("house-us-erupt: Ainsley's jar / trusted state never changes whether it fires", async () => {
  for (const ain of [{ jar: "trusted", trustedWith: "Sunday dinner" }, { jar: "empty" }, { level: 1 }, { hunger: 1 }]) {
    const a = await runErupt({ ...lit, seats: { ainsley: ain }, lit: [{ kid: "ainsley", trustedWith: "Sunday dinner" }] });
    const b = await runErupt({ ...off, seats: { ainsley: ain }, lit: [{ kid: "ainsley", trustedWith: "Sunday dinner" }] });
    assert.equal(a.calls.length, 1); assert.equal(a.calls[0][1], true); assert.equal(b.calls.length, 0);
  }
});
test("Prism's jar-mercury.js: eruptUsTogether(tile, true) paints on the tile; anything but true -> null", () => {
  const raf = [];
  const g = { document: { createElement: el, addEventListener() {}, hidden: false, documentElement: el("html") }, devicePixelRatio: 1,
    getComputedStyle: () => ({ position: "static", getPropertyValue: () => "" }), matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: (f) => raf.push(f), performance: { now: () => 0 }, addEventListener() {}, setTimeout, clearTimeout };
  g.window = g; g.globalThis = g;
  const sandbox = { window: g, globalThis: g, document: g.document, performance: g.performance, requestAnimationFrame: g.requestAnimationFrame, getComputedStyle: g.getComputedStyle, matchMedia: g.matchMedia, setTimeout, clearTimeout, Math, Date };
  vm.runInNewContext(read("jar-mercury.js"), sandbox);
  const J = g.JarMercury; assert.equal(typeof J.eruptUsTogether, "function");
  for (const v of [false, undefined, 1, "true", null]) { const t = el("section"); assert.equal(J.eruptUsTogether(t, v), null); assert.equal(t.children.length, 0); }
  const t = el("section"), cv = J.eruptUsTogether(t, true);
  assert.ok(cv && cv.className === "jm-erupt", "a canvas"); assert.equal(t.children[0], cv, "on the tile"); assert.ok(raf.length >= 1, "animates");
  assert.equal(J.mount.length >= 1, true);
});
