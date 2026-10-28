/* DAYPKG1 item 4 (P2/P3) · QA_NO_BROWSER=1 TZ=America/Chicago, static (node + vm only, no browser).
   (a) kids-data renderGrow / renderPersonalGoal never write '$' (or an em dash or arrow) into a kid page node, hidden ones included;
       the Dad / sheet pages keep their money text.  (b) house-money-bind: on a kid page data-stars gets no '$N' and data-jar-goal is
       the jar name only; on a sheet page both are unchanged.  (c) HouseSfx exports questPop; a chore tick in house-checkoffs pops it
       on kid pages (tick only, after applyDone); house-kid-engage claims play one sound, not two.  (d) kid-world.css no longer hides a
       shown Paid button on the kid glass; [hidden] still hides it.  (d) needs a render run at 1280 (jar full) once Chrome is allowed. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FX = JSON.parse(rd("scripts/qa/fixtures/hayesjar1c-week.json"));
const D2 = FX.data;
const MB = JSON.parse(rd("scripts/qa/fixtures/daypkg1p4-moneybind.synthetic.json"));   /* synthetic money-bind input + expected outputs */
const KIDS = ["hayes", "harris", "ainsley"];
const BAD = /[$\u2014\u2013\u2191\u2192\u2190\u2193\u21d2]/;

function el(sel) {
  const cls = new Set(); const attrs = {};
  return { sel, textContent: "", style: {}, innerHTML: "", hidden: false,
    classList: { add: (...a) => a.forEach((c) => cls.add(c)), remove: (...a) => a.forEach((c) => cls.delete(c)), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) },
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => { delete attrs[k]; }, closest: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
}
function fakeRoot() {
  const byS = new Map();
  return { byS, querySelectorAll(sel) { if (!byS.has(sel)) byS.set(sel, [el(sel), el(sel)]); return byS.get(sel); }, querySelector(sel) { return this.querySelectorAll(sel)[0]; } };
}
function kidsData(page, saves) {
  const document = { readyState: "loading", addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } } };
  const map = {};
  const storage = { getItem: (k) => (k in map ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; }, key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const ctx = vm.createContext({ Intl, Date, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, localStorage: storage, sessionStorage: { getItem: () => null, setItem() {} },
    document, location: { search: "", hash: "", pathname: "/" + page + ".html", href: "https://house.test/" + page + ".html", reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {}, fetch: () => new Promise(() => {}),
    HouseSaves: { list: () => saves } });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(rd("kids-data.js"), ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = D2;
  return { ctx, wk: ctx.WardKids, map };
}
const texts = (root) => [...root.byS.values()].flat().map((e) => [e.sel, e.textContent + "|" + e.innerHTML + "|" + (e.getAttribute("aria-label") || "")]);
const BANKS = { open: { balance: 3, weekEarn: 4, available: 7, toward: 20, need: 52, lifetime: 30, mustComplete: true }, met: { balance: 30, weekEarn: 10, available: 40, toward: 52, need: 52, lifetime: 90, mustComplete: true } };

test("DAYPKG1 P4a: kids-data renderGrow + renderPersonalGoal write no '$', em dash or arrow on any kid page (3 kids x goal open / met / no goal), hidden nodes included", () => {
  for (const kid of KIDS) for (const [bn, bank] of Object.entries(BANKS)) for (const saves of [[{ name: "Lego set", need: 20 }], []]) {
    const { wk, map } = kidsData("kid-" + kid, saves);
    const root = fakeRoot();
    wk.renderPersonalGoal(root, kid, D2, bank);
    wk.renderGrow(root, kid, D2, bank);
    const t = texts(root);
    assert.ok(t.length > 10, "renderers touched nodes");
    for (const [sel, s] of t) assert.ok(!BAD.test(s), kid + " " + bn + " " + sel + " = " + s);
    for (const k of Object.keys(map)) assert.ok(!(k + map[k]).includes("$"), "storage " + k);
    if (saves.length) {
      const chip = root.byS.get("[data-goal-chip]")[0].textContent;
      assert.ok(chip.includes("Lego set"), kid + " chip names the save: " + chip);
      if (bn === "met") assert.equal(chip, "Goal met · Lego set · show Dad");
      else assert.equal(chip, "Lego set");
      const sl = root.byS.get("[data-grow-save-line]")[0].textContent;   /* the grow jar's save line (jar name on a kid page, no amounts) */
      assert.ok(sl.length > 0 && !/\d/.test(sl), kid + " save line is a name only: " + sl);
    }
    assert.equal(root.byS.get("[data-grow-week-rising]")[0].textContent, "");
  }
});

test("DAYPKG1 P4a control: the Dad sheet page keeps its money text (guards are kid-page only)", () => {
  const { wk } = kidsData("sheet-allowance", [{ name: "Lego set", need: 20 }]);
  const root = fakeRoot();
  wk.renderPersonalGoal(root, "harris", D2, BANKS.open);
  wk.renderGrow(root, "harris", D2, BANKS.open);
  assert.match(root.byS.get("[data-grow-week-rising]")[0].textContent, /^week \+\$4 rising/);
  assert.match(root.byS.get("[data-goal-chip]")[0].textContent, /^Lego set · \$\d+\/\$20$/);
  assert.match(root.byS.get("[data-grow-save-line]")[0].textContent, / · \$\d+\/\$\d+$/);
  const r2 = fakeRoot();
  wk.renderPersonalGoal(r2, "harris", D2, BANKS.met);
  assert.match(r2.byS.get("[data-goal-chip]")[0].textContent, /goal met · Lego set \(\$20\)$/);
});

function moneyBind(page) {
  const nodes = [];
  const mk = (attrs, text) => { const e = el("x"); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.textContent = text || ""; nodes.push(e); return e; };
  const stars = mk({ "data-stars": "7", "data-money-suffix": " wk" });
  const jar = mk({ "data-jar-goal": "gem-jar" }, "Gem Jar");
  const sit = mk({ "data-money": "babysit" });
  const match = (sel) => {
    if (sel === "[data-money-suffix][data-stars]") return [stars];
    if (sel === "[data-jar-goal]") return [jar];
    if (sel === "[data-money='babysit']") return [sit];
    return [];
  };
  const data = MB.data;
  let done, fetched = false;
  const p = new Promise((r) => { done = r; });
  /* DAYPKG1 v2g P2: money paints only on the page that declares itself the Dad money sheet in its own markup */
  const dadMeta = rd(page + ".html").includes('<meta name="ward-money" content="dad"');
  const ctx = vm.createContext({
    document: { readyState: "complete", documentElement: { classList: { toggle() {} } }, querySelectorAll: match, addEventListener() {},
      querySelector: (s) => (dadMeta && /ward-money/.test(s) ? { getAttribute: (k) => (k === "content" ? "dad" : null) } : null) },
    fetch: () => { fetched = true; return Promise.resolve({ ok: true, json: () => Promise.resolve(data) }).finally(() => setTimeout(done, 5)); },
    location: { pathname: "/" + page + ".html" }, setTimeout,
  });
  ctx.window = ctx;
  vm.runInContext(rd("house-money-bind.js"), ctx, { filename: "house-money-bind.js" });
  if (!fetched) setTimeout(done, 5); /* v2g: a kid page fetches no money feed at all */
  return p.then(() => ({ stars: stars.textContent, jar: jar.textContent, sit: sit.textContent, ready: ctx.HouseMoney.ready(), fetched }));
}

test("DAYPKG1 P4b: house-money-bind on kid pages: data-stars empty, data-jar-goal name only, no '$' anywhere; sheet page unchanged", async () => {
  for (const kid of KIDS) {
    const r = await moneyBind("kid-" + kid);
    assert.equal(r.fetched, false, kid + " no money feed fetched (v2g P2)");
    assert.equal(r.stars, MB.kid.stars, kid + " stars");
    assert.equal(r.jar, MB.kid.jar, kid + " jar");
    assert.equal(r.sit, MB.kid.sit, kid + " babysit");
    for (const s of Object.values(r)) assert.ok(!String(s).includes("$"), kid);
  }
  const d = await moneyBind("sheet-allowance");
  assert.equal(d.stars, MB.sheet.stars);
  assert.equal(d.jar, MB.sheet.jar);
  assert.equal(d.sit, MB.sheet.sit);
});

test("DAYPKG1 P4c: HouseSfx exports questPop; the chore tick pops it (kid page, tick only, after applyDone); engage claims make one sound", () => {
  const sfx = rd("house-sfx.js");
  const exp = sfx.slice(sfx.indexOf("global.HouseSfx = {"));
  assert.match(exp.slice(0, exp.indexOf("};")), /\bquestPop:\s*questPop\b/);
  assert.match(sfx, /function questPop\(el\)/);
  const co = rd("house-checkoffs.js");
  const tg = co.slice(co.indexOf("function toggle(ev)"), co.indexOf('el.addEventListener("click", toggle)'));
  const iApply = tg.indexOf("applyDone(el, nowDone, true)"), iPop = tg.indexOf("HouseSfx.questPop(el)");
  assert.ok(iApply > 0 && iPop > iApply, "pop after applyDone");
  const guard = tg.slice(tg.lastIndexOf("if (", iPop), iPop);
  assert.match(guard, /nowDone/); assert.match(guard, /usesShared\(el\)/); assert.match(guard, /typeof window\.HouseSfx\.questPop === "function"/);
  assert.match(guard, /\\\/\(\?:kid-\[a-z\]\+\|mercury-run\)\(\\\.html\)\?\$/); /* DAYPKG1 v2d · the guard also matches the extensionless path. DAYPKG1 v2f D2 · and mercury-run */
  assert.match(tg, /try \{ window\.HouseSfx\.questPop\(el\); \} catch/);
  const eg = rd("house-kid-engage.js");
  const claim = eg.slice(eg.indexOf('closest("[data-hq-claim]")'), eg.indexOf("paintDailyQuest();", eg.indexOf('closest("[data-hq-claim]")')));
  assert.ok(!/sfxQuest\(btn\);\s*\n\s*try \{ if \(next/.test(claim), "no unconditional sfxQuest before questPop");
  assert.match(claim, /if \(next && global\.HouseSfx && typeof HouseSfx\.questPop === "function"\) \{ try \{ HouseSfx\.questPop\(btn\); \} catch \(e\) \{ sfxQuest\(btn\); \} \}\s*\n\s*else sfxQuest\(btn\);/);
  const qp = sfx.slice(sfx.indexOf("function questPop(el)"), sfx.indexOf("function questPop(el)") + 400);
  assert.match(qp, /sfxQuest\(\);/, "questPop plays the quest sound itself");
});

test("DAYPKG1 P4d (v2d, Atlas Oct 28 12:15 AM CT A): no Paid button on the kid glass; kid-world.css has no got-it show rule and shows the stored tick above the canvas, read only", () => {
  const css = rd("kid-world.css");
  assert.ok(!/got-it/.test(css), "no got-it rule left in kid-world.css");
  const rule = /body\.kw-on \.kw-paid:not\(\[hidden\]\)\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, "stamp show rule");
  assert.match(rule[1], /position:\s*fixed/);
  assert.match(rule[1], /z-index:\s*6\b/);
  assert.match(rule[1], /pointer-events:\s*none/);
  assert.match(css, /\.kw-paid \{ display: none; \}/);
  for (const kid of KIDS) {
    const h = rd("kid-" + kid + ".html");
    assert.ok(!/<button[^>]*data-got-it/.test(h), kid + ": no Paid button");
    assert.ok(!/window\.prompt\(|window\.confirm\(/.test(h), kid + ": no prompt or confirm");
  }
});
