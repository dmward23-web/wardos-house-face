/* DAYPKG1 v2i · static proof for Alfred's v2h FAIL (ship-2026-10-28T0416-daypkg1v2h, f22937b5184e8686), ported onto main 021bb0f2.
   D1 (P1 law): renderBank scrubs the goal title / blurb on kid scope BEFORE any DOM write, so no transient '$' (or digit)
      ever lands in [data-bank-goal-title] / [data-bank-goal-blurb] on a kid board for house-nomoney to strip later.
   D2 (P1): house-nomoney.js and house-ori-world.js leave the ONE page with <meta name="ward-money" content="dad"> alone,
      so Dad's weekly figure stays '$N wk' (was swept to a star); a kid board path never gets the exemption.
   Atlas A: the legacy blind move house-bank:v1 -> dad-ledger:v1 is byte-identical to v2h.
   Guard (b): the Nov 6 purge only runs after the server move says it imported the carry (ledger.carryHeld === true) and
      fails closed on anything else; the blind move (the carry copy) runs before the purge is ever scheduled.
   Main port: private-feed.js stays main's PFCACHE1 v3 bytes. Runs nothing in a browser. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const sha16 = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const D = String.fromCharCode(36);
const FIXED = Date.parse("2026-11-06T09:00:00-06:00");

function ctxFor(pathname, opts = {}) {
  const map = Object.assign({}, opts.map || {}); const ops = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const now = opts.now || FIXED;
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(now); else super(...a); } static now() { return now; } }
  const storage = { getItem: (k) => { ops.push(["get", k]); return has(k) ? map[k] : null; }, setItem: (k, v) => { ops.push(["set", k, String(v)]); map[k] = String(v); },
    removeItem: (k) => { ops.push(["rm", k]); delete map[k]; }, key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const meta = opts.meta ? { getAttribute: (a) => (a === "content" ? opts.meta : null) } : null;
  const el = () => ({ setAttribute() {}, getAttribute: () => null, appendChild(c) { return c; }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  const document = { readyState: "complete", visibilityState: "visible", body: el(), addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    createElement: el, querySelector: (s) => (/ward-money/.test(s) ? meta : null), querySelectorAll: () => [], getElementById: () => null,
    documentElement: { setAttribute() {}, getAttribute: () => null, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {} } };
  const ctx = vm.createContext({ Intl, Date: FakeDate, URL, URLSearchParams, Promise, console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, MutationObserver: class { observe() {} },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document,
    location: { search: opts.search || "", hash: "", pathname, href: "https://house.test" + pathname, reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {},
    navigator: { userAgent: "qa" }, fetch: () => new Promise(() => {}), HouseHub: { lights: () => "https://hub.test", okForKey: () => true } });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  if (opts.pf) ctx.PrivateFeed = { get: (n) => opts.pf(n, now) };
  for (const f of opts.files || ["house-tapsync.js", "kids-data.js"]) vm.runInContext(rd(f), ctx, { filename: f });
  return { ctx, map, ops };
}
/* a fake root that records EVERY textContent write into the goal nodes (the transient the MutationObserver would see) */
function recRoot() {
  const writes = []; const nodes = {};
  const mk = (sel) => { const n = { hidden: true, _t: "", setAttribute() {}, removeAttribute() {}, getAttribute: () => null, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: { setProperty() {} },
    querySelector: () => null, querySelectorAll: () => [], appendChild(c) { return c; }, insertAdjacentHTML() {}, set innerHTML(v) { writes.push([sel, "html", String(v)]); }, get innerHTML() { return ""; } };
    Object.defineProperty(n, "textContent", { get() { return n._t; }, set(v) { writes.push([sel, "text", String(v)]); n._t = String(v); } }); return n; };
  return { writes, nodes, querySelector: (s) => null, querySelectorAll: (s) => { if (!/goal-(title|blurb)/.test(s)) return []; nodes[s] = nodes[s] || [mk(s)]; return nodes[s]; } };
}
const MONEY_BANK = { goalTitle: "Lego set " + D + "45", goalBlurb: "1 \u2605 = " + D + "1 \u00b7 " + D + "45 goal \u2014 save up \u2192 buy", balance: 12, weekEarn: 5, need: 45, currency: { symbol: "\u2605", plural: "stars" } };

test("DAYPKG1 v2i D1: on every kid board renderBank never writes '$', a digit, an em dash or an arrow into the goal title / blurb (no transient)", () => {
  for (const p of ["/kid-hayes.html", "/kid-harris.html", "/kid-harris", "/kid-ainsley.html", "/mercury-run.html", "/sheet-chores.html", "/sheet-index.html"]) {
    const { ctx } = ctxFor(p, { search: p.startsWith("/mercury") ? "?kid=hayes" : "" });
    const root = recRoot();
    try { ctx.WardKids.renderBank(root, Object.assign({}, MONEY_BANK)); } catch (e) { /* other bank nodes are absent in the fake root */ }
    const goalW = root.writes.filter((w) => /goal-(title|blurb)/.test(w[0]));
    assert.ok(goalW.length >= 2, p + " goal title + blurb were written (" + goalW.length + ")");
    for (const w of goalW) assert.ok(!/[$\d\u2014\u2192]/.test(w[2]), p + " transient write " + JSON.stringify(w));
    assert.ok(goalW.some((w) => /Lego set/.test(w[2])), p + " the goal name survives the scrub");
  }
});

test("DAYPKG1 v2i D1: kidSafeGoalText scrubs money on kid scope only; the Dad sheet keeps the raw text", () => {
  const kid = ctxFor("/kid-hayes.html").ctx.WardKids.kidSafeGoalText;
  for (const s of [D + "45", "1 \u2605 = " + D + "1", "Save " + D + "12.50 toward a bike", "20 dollars", "5 bucks for the jar", D, "Bike \u2192 next week \u2014 yay"]) {
    const o = kid(s); assert.ok(!/[$\d\u2014\u2192]|dollar|buck/i.test(o), JSON.stringify(s) + " -> " + JSON.stringify(o));
  }
  assert.equal(kid("Lego set " + D + "45"), "Lego set");
  const dad = ctxFor("/sheet-allowance.html", { meta: "dad" }).ctx.WardKids.kidSafeGoalText;
  assert.equal(dad("Lego set " + D + "45"), "Lego set " + D + "45");
});

test("DAYPKG1 v2i D1: both goal writes in renderBank read the pre-scrubbed value (source)", () => {
  const s = rd("kids-data.js"); const i = s.indexOf("function renderBank("), body = s.slice(i, s.indexOf("\n  function ", i + 30));
  assert.match(body, /var goalTitleSafe = kidSafeGoalText\(bank\.goalTitle\), goalBlurbSafe = kidSafeGoalText\(bank\.goalBlurb\);/);
  assert.equal((body.match(/textContent = bank\.goal(Title|Blurb)/g) || []).length, 0, "no raw goal write left");
  assert.ok(body.indexOf("goalBlurbSafe") < body.indexOf("[data-bank-goal-blurb]"), "scrub happens before the first write");
});

test("DAYPKG1 v2i D1b (browser find): the grow jar name, its aria-label and a save name carry no money on kid boards; Dad sheet unchanged", () => {
  const data = { kids: { hayes: { bankGoal: { title: "Lego set " + D + "45 \u00b7 big one", blurb: "1 \u2605 = " + D + "1", dollarNeed: 45 }, personalGoal: { name: "Bike " + D + "80", need: 80 } } } };
  for (const p of ["/kid-hayes.html", "/kid-harris.html", "/kid-ainsley.html", "/mercury-run.html"]) {
    const W = ctxFor(p, { search: p.startsWith("/mercury") ? "?kid=hayes" : "" }).ctx.WardKids;
    const gv = W.growGoalView("hayes", data, { available: 10 });
    assert.equal(gv.name, "Lego set", p + " " + JSON.stringify(gv));
    const pv = W.personalGoalView("hayes", data, { available: 10 });
    assert.ok(!/[$\d]/.test(String((pv && pv.name) || "")), p + " save name " + JSON.stringify(pv));
  }
  const dad = ctxFor("/sheet-allowance.html", { meta: "dad" }).ctx.WardKids;
  assert.equal(dad.growGoalView("hayes", data, { available: 10 }).name, "Lego set " + D + "45");
  const s = rd("kids-data.js"), g = s.slice(s.indexOf("function growGoalView("), s.indexOf("function growGoalView(") + 900);
  assert.match(g, /var name = kidSafeGoalText\(/);
});

function nomoney(pathname, meta) {
  const added = []; const ctx = vm.createContext({ location: { pathname }, document: { readyState: "complete", body: null, querySelector: (s) => (meta && /ward-money/.test(s) ? { getAttribute: () => meta } : null), addEventListener() {} },
    MutationObserver: class { observe() {} }, setTimeout: () => 0, addEventListener: (t) => added.push(t) });
  ctx.window = ctx; vm.runInContext(rd("house-nomoney.js"), ctx, { filename: "house-nomoney.js" }); return ctx.HouseNoMoney;
}
test("DAYPKG1 v2i D2: house-nomoney leaves ONLY the ward-money=dad page alone ('" + D + "52 wk' stays); kid boards and other sheets still sweep", () => {
  const wk = D + "52 wk";
  const dad = nomoney("/sheet-allowance.html", "dad");
  assert.equal(dad.exempt, "ward-money=dad"); assert.equal(dad.text(wk), wk);
  for (const [p, m] of [["/sheet-allowance.html", null], ["/sheet-allowance.html", "kid"], ["/sheet-chores.html", null], ["/sheet-index.html", null], ["/kid-hayes.html", "dad"], ["/kid-harris", "dad"], ["/mercury-run.html", "dad"]]) {
    const h = nomoney(p, m); assert.ok(!h.exempt, p + " meta=" + m + " must not be exempt"); assert.ok(!h.text(wk).includes(D + "52"), p + " still sweeps: " + h.text(wk));
  }
});
test("DAYPKG1 v2i D2: house-ori-world's money scrub is gated off on the ward-money=dad page only (never a kid path); the meta lives on sheet-allowance only", () => {
  const s = rd("house-ori-world.js");
  assert.match(s, /var DAD_MONEY_PAGE = \(function \(\) \{[\s\S]{0,400}kid-\[a-z\]\+\|mercury-run[\s\S]{0,300}meta\[name="ward-money"\][\s\S]{0,200}=== "dad"/);
  assert.match(s, /function scrub\(node\) \{\n    if \(!node \|\| DAD_MONEY_PAGE\) return;/);
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && /<meta name="ward-money" content="dad"/.test(rd(f)));
  assert.deepEqual(pages, ["sheet-allowance.html"]);
  const sa = rd("sheet-allowance.html");
  assert.match(sa, /house-nomoney\.js\?v=DAYPKG1"/); assert.match(sa, /house-ori-world\.js\?v=DAYPKG1"/);
  for (const f of ["kids-data.js", "house-money-bind.js", "house-nomoney.js"]) assert.ok(!/sheet-allowance/.test(rd(f)), f + " names no Dad page route");
});

test("DAYPKG1 v2i Atlas A: the legacy blind move house-bank:v1 -> dad-ledger:v1 is unchanged from v2h (byte hash)", () => {
  const s = rd("kids-data.js"); const i = s.indexOf("  function blindMoveLegacyBank()"); const fn = s.slice(i, s.indexOf("\n  }\n", i) + 4);
  assert.equal(sha16(fn), "39adc6cab3c41e75");
  const { map } = ctxFor("/kid-hayes.html", { now: Date.parse("2026-10-28T09:00:00-05:00"), map: { "house-bank:v1": "{\"raw\":1}" } });
  assert.equal(map["dad-ledger:v1"], "{\"raw\":1}"); assert.ok(!("house-bank:v1" in map));
});

const LIVE = (ledger, at) => ({ status: "live", at: at - 1000, data: { kids: {}, ledger } });
test("DAYPKG1 v2i guard (b): the purge runs only after the server move imported the carry (carryHeld === true); every other carryHeld fails closed and removes nothing", async () => {
  const asOf = new Date(FIXED - 3600e3).toISOString();
  for (const [tag, ch, want] of [["true", true, "purged"], ["missing", undefined, "held"], ["false", false, "held"], ["string", "true", "held"], ["one", 1, "held"], ["null", null, "held"], ["object", {}, "held"]]) {
    const ledger = { serverLive: true, asOf }; if (ch !== undefined) ledger.carryHeld = ch;
    const dev = ctxFor("/kid-hayes.html", { map: { "dad-ledger:v1": "x", "dad-ledger:v1:legacy:1": "y" }, pf: (n, now) => Promise.resolve(LIVE(ledger, now)) });
    assert.equal(await dev.ctx.WardKids.purgeKidLedger(LIVE(ledger, FIXED)), want, tag);
    if (want === "held") { assert.equal(dev.map["dad-ledger:v1"], "x", tag); assert.equal(dev.ops.filter((o) => o[0] === "rm" && /^dad-ledger/.test(o[1])).length, 0, tag + " no remove"); }
    assert.equal(dev.ctx.WardKids.ledgerPurgeOk(LIVE(ledger, FIXED), FIXED), ch === true, tag);
  }
  assert.equal(ctxFor("/kid-hayes.html").ctx.WardKids.LEDGER_PURGE_FROM, 1793944800000);
});
test("DAYPKG1 v2i guard (b): order in source: carry copy (blind move) before the purge is scheduled; ledgerPurgeOk before any removeItem; carryHeld checked strictly", () => {
  const s = rd("kids-data.js");
  const boot = s.slice(s.indexOf("(function kidBankBoot() {"), s.indexOf("})();", s.indexOf("(function kidBankBoot() {")));
  assert.ok(boot.indexOf("blindMoveLegacyBank();") > 0 && boot.indexOf("blindMoveLegacyBank();") < boot.indexOf("scheduleKidLedgerPurge()"), "blind move before purge");
  const pk = s.slice(s.indexOf("function purgeKidLedger(feed) {"), s.indexOf("function scheduleKidLedgerPurge()"));
  assert.ok(pk.indexOf("ledgerPurgeOk(feed, Date.now())") < pk.indexOf("removeItem"), "guard before remove");
  assert.match(s, /if \(L\.serverLive !== true \|\| L\.carryHeld !== true\) return false;/);
  assert.match(s, /var LEDGER_PURGE_FROM = Date\.parse\("2026-11-06T00:00:00-06:00"\);/);
});

test("DAYPKG1 v2i main port: private-feed.js is main 021bb0f2's PFCACHE1 v3 bytes, untouched", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "private-feed.js"))).digest("hex").slice(0, 16), "7c0bfe6212a83448");
});
