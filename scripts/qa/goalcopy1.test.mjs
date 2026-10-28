/* GOALCOPY1 (Atlas 8:18 PM CT) · node --test scripts/qa/goalcopy1.test.mjs
   When the jar reaches its goal with no reward text set (Ainsley: the builder drops her bankGoal), the goal-hit banner reads
   exactly "Goal reached. Show Dad." Kid copy law: no em dash, no arrow, no star, no digit, no $. Runs the real celebrateGoal
   from house-sfx.js on a stub DOM. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "house-sfx.js"), "utf8");
const EXACT = "Goal reached. Show Dad.";
const BANNED = /[\u2014\u2013\u2192\u2605\u2606*$%\d]|--|->/;

function block(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i > 0, name + " present");
  let d = 0, j = SRC.indexOf("{", i);
  for (let k = j; k < SRC.length; k++) { if (SRC[k] === "{") d++; else if (SRC[k] === "}" && --d === 0) return SRC.slice(i, k + 1); }
  throw new Error("unbalanced " + name);
}
function bannerFor(reward) {
  const fb = SRC.match(/var GOAL_FALLBACK = ("[^"]*");/);
  assert.ok(fb, "GOAL_FALLBACK declared");
  const made = [];
  const ctx = vm.createContext({
    made, window: { setTimeout() {} },
    document: { createElement: () => { const n = { className: "", innerHTML: "", remove() {} }; made.push(n); return n; }, body: { classList: { add() {} } } },
  });
  vm.runInContext(`var GOAL_FALLBACK = ${fb[1]};
    function sfxGoal() {} function reducedMotion() { return false; } function celebrateClear() {} function theme() { return "t"; }
    function ensureLayer() { return { appendChild() {} }; }
    ${block("celebrateGoal")}
    celebrateGoal(${JSON.stringify(reward)});`, ctx);
  const b = made.find((n) => /vfx-goal-banner/.test(n.className));
  assert.ok(b, "banner built");
  const sub = b.innerHTML.match(/<div class='g-sub'>([\s\S]*?)<\/div>/);
  return { sub: sub && sub[1], html: b.innerHTML };
}

test("no reward text: the goal banner reads exactly 'Goal reached. Show Dad.'", () => {
  for (const r of [undefined, null, ""]) assert.equal(bannerFor(r).sub, EXACT);
});
test("the fallback carries no em dash, arrow, star, digit or $ (kid copy law), and the old line is gone", () => {
  assert.doesNotMatch(EXACT, BANNED);
  const fb = SRC.match(/var GOAL_FALLBACK = "([^"]*)";/)[1];
  assert.equal(fb, EXACT);
  assert.doesNotMatch(fb, BANNED);
  assert.doesNotMatch(bannerFor("").html, /[\u2014\u2605$\d]/);
  assert.doesNotMatch(SRC, /Ask Dad for your reward/);
});
test("a set reward text still shows as before (no other copy change)", () => {
  assert.equal(bannerFor("Pick the movie").sub, "Pick the movie");
  assert.match(bannerFor("").html, /<div class='g-title'>UNLOCKED!!!<\/div>/);
});
test("every page that loads house-sfx carries one fresh token", () => {
  const tok = new Set();
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith(".html"))) {
    for (const m of fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/house-sfx\.js\?v=([A-Za-z0-9]+)"/g)) tok.add(m[1]);
  }
  assert.equal(tok.size, 1, [...tok].join(","));
  assert.ok(!tok.has("MERGE1C"), "MERGE1C served the old banner bytes");
});
