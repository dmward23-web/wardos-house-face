/* KIDCRIT UNDO2 · node --test scripts/qa/hayesundo.test.mjs
   Hayes (kid2) undoes a done chest on the SECOND tap, like Harris and Ainsley. Runs the real kid-world onWorldDown and the real
   hayes-loot KidUndoGate (extracted from the files) on a faked clock: tap 1 checks, a loot pop starts, tap 2 at 1.5s un-checks.
   GATE1 swallowed tap 2 while the pop played (2.4s) and only armed "Tap again to undo", so Hayes needed a third tap. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function block(src, startMarker) {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, "marker not found: " + startMarker);
  let depth = 0, j = src.indexOf("{", i);
  for (; j < src.length; j++) { if (src[j] === "{") depth++; else if (src[j] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(i, j + 1);
}

function world() {
  const kw = read("kid-world.js"), hl = read("hayes-loot.js");
  const onDown = block(kw, "function onWorldDown(ev)");
  const gate = block(hl, "global.KidUndoGate = function") + ";";
  const busy = hl.includes("function busy()") ? block(hl, "function busy()") : "";
  const hold = (hl.match(/var VICTORY_HOLD_S = [^;]+;/) || [""])[0];
  const clock = { ms: 0 };
  const btn = { done: false, clicks: 0 };
  btn.classList = { contains: (c) => c === "done" && btn.done };
  btn.click = () => { btn.done = !btn.done; btn.clicks++; };
  const q = { btn, x: 10, y: 10, label: "Shower" };
  const ctx = vm.createContext({ clock, q, console });
  vm.runInContext(`
    var performance = { now: function () { return clock.ms; } };
    var t0 = 0; function now() { return (performance.now() - t0) / 1000; }
    var victoryAt = -1, pops = [], undoArm = null, feed = null, burstAt = 0;
    var bg = { hits: [q], t0: 0 };
    var global = { KidWorld: null, HouseSfx: null, JarEngine: null };
    var KidWorld = null, HouseSfx = null;
    function hitQuest() { return q; }
    function flyToJar() {} function clearHold() {}
    var lastHit = { q: null, at: 0 };
    var document = { dispatchEvent: function () { pops.push({ t0: now() }); } };   /* kw:feed -> hayes-loot adds a pop */
    function CustomEvent(n, o) { this.type = n; this.detail = o && o.detail; }
    ${hold}
    ${busy}
    ${gate}
    ${onDown}
    function tapAt(s) { clock.ms = s * 1000; onWorldDown({ isTrusted: true, clientX: 1, clientY: 1 }); return q.btn.done; }
    function victory(s) { victoryAt = s; }
  `, ctx);
  return ctx;
}

test("Hayes: tap 1 checks, tap 2 (1.5s later, loot pop still playing) un-checks", () => {
  const w = world();
  assert.equal(w.tapAt(0), true, "first tap checks the chest");
  assert.equal(w.pops.length, 1, "the check started a loot pop");
  assert.equal(w.tapAt(1.5), false, "the second tap undoes it (GATE1 needed a third tap)");
});

test("Hayes: the 1s double-tap guard still keeps a fumble from undoing a fresh check", () => {
  const w = world();
  assert.equal(w.tapAt(0), true);
  assert.equal(w.tapAt(0.4), true, "a tap inside 1s is ignored");
  assert.equal(w.tapAt(1.6), false, "the next deliberate tap undoes");
});

test("Hayes: check, undo, check again all on single taps (no third tap anywhere)", () => {
  const w = world();
  assert.equal(w.tapAt(0), true);
  assert.equal(w.tapAt(1.2), false);
  assert.equal(w.tapAt(2.4), true);
  assert.equal(w.tapAt(3.6), false);
  assert.equal(w.q.btn.clicks, 4);
});

test("Hayes: the victory panel holds an undo while it shows, never forever when frames stop", () => {
  const w = world();
  assert.equal(w.tapAt(0), true);
  w.victory(1.0);                 /* jar filled: panel opens (victoryAt is only cleared by the paint loop or the closing tap) */
  assert.equal(w.tapAt(2.0), true, "a tap while the panel shows does not undo");
  assert.equal(w.tapAt(8.0), false, "no paint loop ran (hidden tab), yet undo is not held past the panel's 5.6s life");
});
