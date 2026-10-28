/* KIDCRIT AINSGOAL1 (Atlas R3: Ainsley's jar shows no blank or broken goal text) · node --test scripts/qa/ainsgoal1.test.mjs
   The live builder drops Ainsley's bankGoal (the keep-and-scrub change rides the next data-builder deploy, not this package),
   so the bank falls back to a default. That default no longer carries a "Goal" placeholder, and any goal line with no text
   is hidden. Ainsley's own page carries no goal-line hook at all, so nothing there can paint empty. Synthetic data only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function kids() {
  const store = {};
  const ctx = vm.createContext({
    Intl, Date, URLSearchParams, console, setTimeout, clearTimeout,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { readyState: "loading", addEventListener() {}, dispatchEvent() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {}, toggle() {} } } },
    addEventListener() {}, location: { search: "", hash: "", pathname: "/" },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(read("kids-data.js"), ctx, { filename: "kids-data.js" });
  return ctx.WardKids;
}

function fakeRoot(selectors) {
  const els = {};
  for (const s of selectors) els[s] = { textContent: "PRE", hidden: false, style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {} };
  return {
    els,
    querySelectorAll(sel) { return sel.split(",").map((x) => x.trim()).filter((x) => els[x]).map((x) => els[x]); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
  };
}

const NO_GOAL = { kids: { ainsley: { quests: [{ id: "ain-bed" }] } } };

test("Ainsley with no bankGoal: the bank carries no 'Goal' placeholder title, blurb or reward", () => {
  const K = kids();
  const b = K.getBankView("ainsley", NO_GOAL);
  assert.equal(b.goalTitle, "");
  assert.equal(b.goalBlurb, "");
  assert.equal(b.reward, "");
});

test("a goal title/blurb line with no text is hidden (no empty label); one with text shows", () => {
  const K = kids();
  const root = fakeRoot(["[data-bank-goal-title]", "[data-bank-goal-blurb]"]);
  K.renderBank(root, K.getBankView("ainsley", NO_GOAL));
  for (const s of ["[data-bank-goal-title]", "[data-bank-goal-blurb]"]) {
    assert.equal(root.els[s].textContent, "", s);
    assert.equal(root.els[s].hidden, true, s + " must be hidden, not an empty label");
  }
  const withGoal = { kids: { ainsley: { quests: [{ id: "ain-bed" }], bankGoal: { need: 5, title: "Tour Jar", blurb: "Musts fill the jar." } } } };
  const root2 = fakeRoot(["[data-bank-goal-title]", "[data-bank-goal-blurb]"]);
  K.renderBank(root2, K.getBankView("ainsley", withGoal));
  assert.equal(root2.els["[data-bank-goal-title]"].hidden, false);
  assert.equal(root2.els["[data-bank-goal-title]"].textContent, "Tour Jar");
  assert.equal(root2.els["[data-bank-goal-blurb]"].hidden, false);
});

test("kid-ainsley.html: the Tour Jar has its title and state word, and no goal-line hook that could paint blank", () => {
  const h = read("kid-ainsley.html");
  const jar = h.slice(h.indexOf('id="sec-jar"'), h.indexOf("</section>", h.indexOf('id="sec-jar"')));
  assert.match(jar, /class="bank-title">Tour Jar</);
  assert.match(jar, /data-jar-state="trusted">TRUSTED</);
  assert.doesNotMatch(h, /data-bank-goal-(title|blurb)|data-goal-chip|data-grow-(title|jar-name|meter)|data-bank-reward/);
  assert.doesNotMatch(jar, />\s*Goal\s*</, "no bare 'Goal' placeholder text in the jar");
});
