/* DAYPKG1 v2g · QA_NO_BROWSER=1, static (node + vm only, no browser). Alfred FAILED v2f (6c7a8d96, gate 4902ab389b3a22b0).
   v2g fixes, each mapped to tests below (Atlas P1-2 ruling + Atlas (a), 3:30 AM CT steering):
   P1-2  Dad sheets (sheet-allowance, sheet-dan) are URL-only: no link from any page reachable from a kid board, followed
         recursively (hrefs, data-href, JS-built URLs, house-links.js targets, loaded scripts). dad-device:v1 is set only by a
         completed 2 s Paid hold on sheet-allowance, never by opening a page.
   (a)   Dad's weekly figure sits next to each kid's Paid hold on sheet-allowance, painted by renderBank so a rebuild keeps it.
   P2    wall.html / night/scene.html odd 440 px chip: width:calc(50% - 8px).
   P2    house-money-bind.js paints '$' only on the Dad money sheet (allowlist: <meta name="ward-money" content="dad">, sheet-allowance
         only, never a kid path); every kid-reachable page gets none and fetches no money feed.
   P3    TZ pinned in the v2f D3 date test (Intl, America/Chicago).
   Out of v2g: private-feed.js (hotfix PFCACHE1), grocery '$' on kid-linked family pages (P2, after Friday). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FX = JSON.parse(rd("scripts/qa/fixtures/hayesjar1c-week.json"));
const D2 = FX.data, W2 = FX.week, K = FX.clock;
const KIDS = ["hayes", "harris", "ainsley"];
const SYNC_INIT = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" };
const D = String.fromCharCode(36);
const LEDGER = "dad-ledger:v1", SIDE = "dad-ledger:v1:legacy:", MARK = "dad-device:v1";
const KID_PATH = { hayes: "/kid-hayes.html", harris: "/kid-harris", ainsley: "/kid-ainsley.html" };
const DAY = 864e5;

/* the v2e harness (storage spy: every get / set / rm in order), plus: a clock by fixture name or ISO, location.search, an
   optional PrivateFeed stub (loaded before kids-data.js, as on the real pages), extra page scripts, and a kids-week fetch */
/* a page's own markup decides whether it is the Dad money sheet (<meta name="ward-money" content="dad">) */
const META_DAD = '<meta name="ward-money" content="dad"';
function pageHasMeta(pathname) { let f = pathname.replace(/^\//, ""); if (!/\.html$/.test(f)) f += ".html"; return fs.existsSync(path.join(ROOT, f)) && rd(f).includes(META_DAD); }
const metaQS = (on) => (s) => (on && /ward-money/.test(s) ? { getAttribute: (k) => (k === "content" ? "dad" : null) } : null);
function device(clock, map, opts = {}) {
  const fixed = Date.parse(K[clock] || clock); assert.ok(!isNaN(fixed), clock);
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const ops = [], log = [], info = [];
  const storage = {
    getItem: (k) => { ops.push(["get", String(k)]); return has(k) ? map[k] : null; },
    setItem: (k, v) => { ops.push(["set", String(k), String(v)]); log.push([String(k), String(v)]); map[k] = String(v); },
    removeItem: (k) => { ops.push(["rm", String(k)]); delete map[k]; },
    key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const pathname = opts.pathname || "/" + (opts.page || "sheet-allowance") + ".html";
  const search = opts.search || "";
  const el = () => ({ setAttribute() {}, getAttribute: () => null, appendChild(c) { return c; }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  const document = { readyState: "loading", visibilityState: "visible", body: el(), addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    createElement: el, querySelector: metaQS(opts.meta ?? pageHasMeta(pathname)), querySelectorAll: () => [], getElementById: () => null,
    documentElement: { setAttribute() {}, getAttribute: () => null, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {} } };
  const pfCalls = [];
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams, Promise,
    console: { log() {}, warn() {}, error() {}, info: (...a) => { info.push(a.join(" ")); } },
    setTimeout: opts.timers ? (f, ms) => setTimeout(f, ms) : () => 0, clearTimeout: opts.timers ? (t) => clearTimeout(t) : () => {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document,
    location: { search, hash: "", pathname, href: "https://house.test" + pathname + search, reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {},
    navigator: { userAgent: "qa" }, prompt: () => null, confirm: () => false, alert() {},
    fetch: (url) => (/kids-week\.json/.test(String(url)) && opts.feed ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(D2))) }) : new Promise(() => {})),
    HouseHub: { lights: () => "https://hub.test", okForKey: () => true },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  if (opts.pf) ctx.PrivateFeed = { get: (name) => { pfCalls.push(name); return opts.pf(name, fixed); } };
  const errs = [];
  for (const f of opts.before || []) { try { vm.runInContext(rd(f), ctx, { filename: f }); } catch (e) { errs.push(f + ": " + e.message); } }
  vm.runInContext(rd("house-tapsync.js"), ctx, { filename: "house-tapsync.js" });
  vm.runInContext(rd("kids-data.js"), ctx, { filename: "kids-data.js" });
  for (const f of opts.after || []) { try { vm.runInContext(rd(f), ctx, { filename: f }); } catch (e) { errs.push(f + ": " + e.message); } }
  ctx.WardKids._data = D2;
  const wk = ctx.WardKids;
  return { ctx, wk, map, ops, log, info, pfCalls, errs, fixed,
    boot() { wk.syncBankFromChecks(D2); return this; },
    view(kid) { return wk.getBankView(kid, D2); },
    paid(kid, amount) { wk.syncBankFromChecks(D2); wk.resetJarCycle(kid, amount, D2); wk.syncBankFromChecks(D2); return wk.getBankView(kid, D2); } };
}
function playWeek(dev, kid) {
  for (const q of dev.wk.mustQuests(kid, D2)) {
    if ((q.cadence || "daily") === "daily") { for (const iso of W2.taps) dev.wk.setCheck(q.id, true, D2, iso); }
    else dev.wk.setCheck(q.id, true, D2);
  }
  return dev.view(kid);
}
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
const noDollar = (map, tag) => { for (const [k, v] of Object.entries(map)) assert.ok(!(k + v).includes(D), tag + " '$' in " + k + " = " + v); };
const ledgerTouch = (dev) => dev.ops.filter((o) => o[1] === LEDGER || o[1].startsWith(SIDE));

/* ---------- P1-2 · recursive kid reachability ---------- */
const DAD_SHEETS = ["sheet-allowance.html", "sheet-dan.html"];
const KID_SEEDS = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "mercury-run.html"];
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\"'])\/\/[^\n]*/g, "$1")
  .replace(/\[\s*"[^"]+\.html"\s*,/g, "[") /* house-links.js rule source page (where a rule runs, not a target) */
  .replace(/"[a-z0-9-]+\.html"\s*:/g, ":"); /* object keys (house-ori-world.js themes per page) */
const stripHtml = (s) => s.replace(/<!--[\s\S]*?-->/g, " ");
function norm(from, ref) {
  ref = ref.replace(/[?#].*$/, ""); if (!ref || /^[a-z]+:/i.test(ref) || ref.startsWith("//")) return null;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));
  return p.startsWith("..") ? null : p;
}
function linksOf(page) {
  const out = new Set(), html = stripHtml(rd(page));
  const add = (r) => { const p = norm(page, r); if (p && p.endsWith(".html") && fs.existsSync(path.join(ROOT, p))) out.add(p); };
  for (const m of html.matchAll(/\b(?:href|data-href|src|action|data-go)\s*=\s*"([^"]+)"/g)) add(m[1]);
  const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const m of html.matchAll(/<script[^>]*\bsrc="([^"?#]+)/g)) { const f = norm(page, m[1]); if (f && fs.existsSync(path.join(ROOT, f))) js.push(rd(f)); }
  for (const src of js) for (const m of stripJs(src).matchAll(/["'`]((?:\.\.?\/)?[a-z0-9\/-]*[a-z0-9-]+\.html)(?:[?#][^"'`]*)?["'`]/g)) add(m[1]);
  return out;
}
function crawl(seeds) {
  const seen = new Map(seeds.map((s) => [s, null])), q = [...seeds];
  while (q.length) { const f = q.shift(); for (const l of linksOf(f)) if (!seen.has(l)) { seen.set(l, f); q.push(l); } }
  return seen;
}
const pathTo = (seen, p) => { const out = []; for (let n = p; n; n = seen.get(n)) out.unshift(n); return out.join(" > "); };
const REACH = crawl(KID_SEEDS);

test("DAYPKG1 v2g P1-2: no Dad sheet (sheet-allowance, sheet-dan) is reachable from any kid board, followed recursively through every page", () => {
  for (const s of DAD_SHEETS) assert.ok(fs.existsSync(path.join(ROOT, s)), s + " exists (URL-only, not deleted)");
  for (const s of DAD_SHEETS) assert.ok(!REACH.has(s), s + " reachable: " + pathTo(REACH, s));
  /* the crawl really follows: the hops Alfred took are still walked, and the Dad pages themselves are found from a page that links them */
  for (const p of ["sheet-chores.html", "sheet-index.html", "sheet-today.html", "wall.html", "month.html"]) assert.ok(REACH.has(p), "crawl reaches " + p);
  assert.ok(REACH.size >= 20, "crawl size " + REACH.size);
  assert.ok(linksOf("livinghouse/index.html").has("sheet-dan.html"), "control: a ../ link is extracted (livinghouse is not kid-reachable)");
  assert.ok(!REACH.has("livinghouse/index.html"));
});
test("DAYPKG1 v2g P1-2: the four known hops are cut (Today where-card, Index Dad tile, wall/night Dad chip, house-links.js targets)", () => {
  assert.doesNotMatch(stripHtml(rd("sheet-today.html")), /href="sheet-dan\.html"/);
  assert.doesNotMatch(stripHtml(rd("sheet-index.html")), /href="sheet-dan\.html"/);
  /* DAYPKG1 v2h (Atlas: nothing dead on kid glass): the Dad tile and the Dad chip are removed, not just unlinked */
  assert.doesNotMatch(rd("sheet-index.html"), /class="tile dan\b|data-kid-seed="dad"/, "Dad tile removed (v2h)");
  for (const f of ["wall.html", "night/scene.html"]) {
    assert.doesNotMatch(rd(f), /data-href="(?:\.\.\/)?sheet-(?:dan|allowance)\.html"/, f);
    assert.doesNotMatch(rd(f), /id="chip-body"|data-n="Dad"/, f + " Dad chip removed (v2h)");
  }
  const hl = stripJs(rd("house-links.js"));
  assert.doesNotMatch(hl, /sheet-(?:dan|allowance)\.html/, "house-links.js targets no Dad sheet");
});

/* ---------- P1-2 · dad-device marker only from a completed Paid hold ---------- */
const OPAQUE = "opaque:\u0000" + D + "52{not json";
const goodFeed = (name, now) => Promise.resolve({ status: "live", at: now - 1000, data: { kids: {}, ledger: { serverLive: true, carryHeld: true, asOf: new Date(now - 3600e3).toISOString() } } });
function btn() {
  const on = {}, attrs = {};
  return { on, attrs, addEventListener(t, f) { (on[t] = on[t] || []).push(f); }, setAttribute(k, v) { attrs[k] = String(v); }, removeAttribute(k) { delete attrs[k]; },
    getAttribute(k) { return k in attrs ? attrs[k] : null; }, setPointerCapture() {},
    fire(t, ev = {}) { const e = Object.assign({ type: t, preventDefault() {} }, ev); (on[t] || []).forEach((f) => f(e)); return e; } };
}
test("DAYPKG1 v2g P1-2: dad-device:v1 is set only by a completed 2 s Paid hold on sheet-allowance; opening, an early lift, a direct dadPaid call or a hold on another page never set it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const p of ["/sheet-allowance.html", "/sheet-allowance"]) {
    const map = Object.assign({}, SYNC_INIT);
    const dad = device("fri1459", map, { pathname: p, timers: true });
    dad.boot(); playWeek(dad, "hayes");
    assert.ok(!(MARK in map), p + " open: no marker");
    dad.wk.dadPaid("harris", D2); assert.ok(!(MARK in map), p + " dadPaid outside a hold: no marker");
    const b = btn(); dad.wk.bindHold(b, () => dad.wk.dadPaid("hayes", D2));
    b.fire("pointerdown", { button: 0, pointerId: 1 }); t.mock.timers.tick(1999); b.fire("pointerup"); t.mock.timers.tick(5000);
    assert.ok(!(MARK in map), p + " early lift: no marker");
    b.fire("pointerdown", { button: 0, pointerId: 1 }); t.mock.timers.tick(2000);
    assert.equal(map[MARK], new Date(dad.fixed).toISOString(), p + " completed hold sets the marker (a time)");
    assert.ok(!map[MARK].includes(D), "no money in the marker");
    b.fire("pointerup"); const first = map[MARK];
    b.fire("pointerdown", { button: 0, pointerId: 1 }); t.mock.timers.tick(2000);
    assert.equal(map[MARK], first, "first mark kept");
    /* shared device: the kid board on the same device never purges after Nov 6 */
    map[LEDGER] = OPAQUE;
    const kid = device("nov6_0700", map, { pathname: "/kid-hayes.html", pf: goodFeed });
    assert.equal(kid.wk.purgeRun(), "dad-device"); assert.equal(map[LEDGER], OPAQUE);
  }
  for (const p of ["/sheet-dan.html", "/sheet-index.html", "/sheet-chores.html"]) {
    const map = Object.assign({}, SYNC_INIT);
    const d = device("fri1459", map, { pathname: p, timers: true });
    const b = btn(); const h = d.wk.bindHold(b, () => d.wk.dadPaid("hayes", D2));
    if (h) { b.fire("pointerdown", { button: 0 }); t.mock.timers.tick(2500); }
    assert.ok(!(MARK in map), p + " no marker");
  }
  for (const p of ["/kid-hayes.html", "/kid-harris", "/mercury-run.html"]) {
    const d = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: p, timers: true });
    assert.equal(d.wk.bindHold(btn(), () => {}), null, p + " hold refused");
  }
  assert.doesNotMatch(rd("kids-data.js").slice(rd("kids-data.js").indexOf("(function kidBankBoot()"), rd("kids-data.js").indexOf("(function kidBankBoot()") + 400), /markDadDevice\(\)/, "boot never marks");
});

/* ---------- Atlas (a) · weekly figure next to each Paid hold ---------- */
function wkRoot() { const el = { textContent: "", hidden: true, writes: [] };
  Object.defineProperty(el, "text", { get() { return el.textContent; } });
  return { el, root: { querySelectorAll: (sel) => (sel === "[data-dad-wk]" ? [el] : []), querySelector: () => null } }; }
test("DAYPKG1 v2g Atlas (a): sheet-allowance shows each kid's weekly figure next to the Paid hold; every renderBank pass (rebuild, after Paid) keeps it; never on a kid or kid-reachable page", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = rd("sheet-allowance.html");
  for (const k of KIDS) {
    const sec = s.slice(s.indexOf('data-bank-kid="' + k + '"'), s.indexOf("</section>", s.indexOf('data-bank-kid="' + k + '"')));
    assert.match(sec, /data-dad-paid="[a-z]+"[^>]*>Hold for Paid<\/button><span class="dad-paid-wk" data-dad-wk hidden><\/span>/, k + " figure sits next to the hold, inside the renderBank root");
  }
  const map = Object.assign({}, SYNC_INIT);
  const dad = device("fri1459", map, { pathname: "/sheet-allowance.html", timers: true });
  dad.boot();
  for (const k of KIDS) {
    const v = playWeek(dad, k); const { el, root } = wkRoot();
    dad.wk.renderBank(root, v);
    assert.equal(el.textContent, D + v.weeklyAllowance + " wk", k); assert.equal(el.hidden, false);
    dad.wk.renderBank(root, dad.view(k)); assert.equal(el.textContent, D + v.weeklyAllowance + " wk", k + " survives a rebuild");
    const b = btn(); dad.wk.bindHold(b, () => dad.wk.dadPaid(k, D2)); b.fire("pointerdown", { button: 0 }); t.mock.timers.tick(2000); b.fire("pointerup");
    dad.wk.renderBank(root, dad.view(k)); assert.equal(el.textContent, D + v.weeklyAllowance + " wk", k + " still there after Paid");
  }
  for (const p of ["/sheet-dan.html", "/sheet-chores.html", "/sheet-index.html", "/kid-hayes.html", "/kid-harris", "/mercury-run.html"]) {
    const d = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: p }); const { el, root } = wkRoot(); el.textContent = "x";
    d.wk.renderBank(root, playWeek(d, "hayes")); assert.equal(el.textContent, "", p); assert.equal(el.hidden, true, p);
  }
  assert.ok(!REACH.has("sheet-allowance.html"), "sheet-allowance not kid-reachable");
});

/* ---------- P2 · house-money-bind.js ---------- */
async function moneyPage(pathname, meta = pageHasMeta(pathname)) {
  const writes = []; let fetched = 0;
  const mk = (attrs, text = "") => { const a = Object.assign({}, attrs); let t = text;
    return { getAttribute: (k) => (k in a ? a[k] : null), setAttribute: (k, v) => { a[k] = String(v); }, hasAttribute: (k) => k in a,
      get textContent() { return t; }, set textContent(v) { t = String(v); writes.push(t); } }; };
  const els = { "[data-money-suffix][data-stars]": [mk({ "data-stars": "7", "data-money-suffix": " wk" }), mk({ "data-stars": "2", "data-money-suffix": "" })],
    "[data-money='babysit']": [mk({})], "[data-jar-goal]": [mk({ "data-jar-goal": "tour-jar" }, "Tour Jar")] };
  const data = JSON.parse(JSON.stringify(D2));
  for (const k in data.kids) { data.kids[k].bankGoal = Object.assign({ id: k + "-jar" }, data.kids[k].bankGoal); }
  els["[data-jar-goal]"].push(mk({ "data-jar-goal": "hayes-jar" }, "Victory Jar"));
  const ctx = vm.createContext({ Promise, console: { log() {}, warn() {}, error() {}, info() {} },
    location: { pathname }, document: { readyState: "complete", documentElement: { classList: { toggle() {} } }, querySelectorAll: (sel) => els[sel] || [], querySelector: metaQS(meta), addEventListener() {} },
    fetch: () => (fetched++, Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })) });
  ctx.window = ctx;
  vm.runInContext(rd("house-money-bind.js"), ctx, { filename: "house-money-bind.js" });
  await settle();
  return { writes, fetched, ready: ctx.HouseMoney.ready() };
}
test("DAYPKG1 v2g P2: house-money-bind.js writes no '$' (not even transiently) and fetches no money feed on every kid-reachable page, recursive set; '$' only on the Dad money sheet (meta ward-money=dad, never a kid page)", async () => {
  const loaders = [...REACH.keys()].filter((p) => /house-money-bind\.js/.test(rd(p)));
  assert.ok(loaders.includes("sheet-chores.html") && loaders.includes("kid-hayes.html"), "sheet-chores and kid boards load it");
  for (const p of [...REACH.keys()]) {
    assert.ok(!rd(p).includes(META_DAD), p + " is kid-reachable and must not declare itself the Dad money sheet");
    for (const pn of ["/" + p, "/" + p.replace(/\.html$/, "")]) {
      const r = await moneyPage(pn); assert.equal(r.fetched, 0, pn + " fetched the money feed");
      for (const w of r.writes) assert.ok(!w.includes(D), pn + " wrote " + w);
    }
  }
  const html = spawnSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter((f) => f && !f.startsWith("scripts/") && !f.startsWith("plates"));
  assert.deepEqual(html.filter((f) => rd(f).includes(META_DAD)), ["sheet-allowance.html"], "exactly one page declares the Dad money sheet");
  for (const p of ["/sheet-allowance.html", "/sheet-allowance"]) {
    const r = await moneyPage(p); assert.equal(r.ready, true, p); assert.ok(r.writes.some((w) => w.includes(D)), p + " Dad sheet keeps its money labels");
  }
  /* a kid path never paints money, even if a page were mis-tagged */
  for (const p of ["/kid-hayes.html", "/kid-harris", "/mercury-run.html"]) { const r = await moneyPage(p, true); for (const w of r.writes) assert.ok(!w.includes(D), p + " forged meta wrote " + w); }
});

/* ---------- P2 · 440 px odd chip width ---------- */
test("DAYPKG1 v2g P2: the odd 440 px chip gets width:calc(50% - 8px) on wall.html and night/scene.html, still spanning the row, centred", () => {
  for (const f of ["wall.html", "night/scene.html"]) {
    const s = rd(f);
    assert.ok(s.includes(".phone #chips .chip:last-child:nth-child(odd){grid-column:1/-1;justify-self:center;width:calc(50% - 8px)}"), f);
    const chips = s.slice(s.indexOf('<div id="chips">'), s.indexOf("</div>\n</div>", s.indexOf('<div id="chips">')));
    /* DAYPKG1 v2h (Atlas): the Dad chip is removed, 2 chips fill the phone row; the odd rule stays for any future odd count */
    assert.equal((chips.match(/<div class="chip"/g) || []).length, 2, f + " 2 chips (v2h)");
  }
});
