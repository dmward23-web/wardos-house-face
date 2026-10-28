/* DAYPKG1 v2e · QA_NO_BROWSER=1 TZ=America/Chicago, static (node + vm only, no browser).
   Atlas ruling (Oct 28 12:40 AM CT), on top of the 12:15 AM ruling (daypkg1v2d.test.mjs):
   1) Scope by KEY, not by device. The Dad ledger lives in dad-ledger:v1; Dad sheets read and write only that key. Kid pages
      read, write and delete only kid-scoped keys and never read or parse dad-ledger:v1. Legacy house-bank:v1: a Dad sheet moves
      it to dad-ledger:v1 and removes it (both present: the newer wins, the older is kept raw, logged); a kid page does a BLIND
      move (raw copy to dad-ledger:v1 only when absent, never parsed, then remove house-bank:v1).
   2) Paid is hold to confirm (about 2 s), no numbers in the control; sheet-allowance is reachable by URL only.
   Alfred's v2e gate checklist (12:47 AM) items 1 to 6 map to the tests below (see the v2e note). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FX = JSON.parse(rd("scripts/qa/fixtures/hayesjar1c-week.json"));
const D2 = FX.data, W2 = FX.week, K = FX.clock;
const KIDS = ["hayes", "harris", "ainsley"];
const SYNC_INIT = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" };
const D = String.fromCharCode(36);
const LEDGER = "dad-ledger:v1", LEGACY = "house-bank:v1", LOSER = "dad-ledger:v1:superseded", SIDE = "dad-ledger:v1:legacy:";
const KID_PATH = { hayes: "/kid-hayes.html", harris: "/kid-harris", ainsley: "/kid-ainsley.html" };

/* the v2d harness, plus spies: every storage get / set / remove in order, every JSON.parse input inside the page, console.info */
function device(clockName, map, opts = {}) {
  const fixed = Date.parse(K[clockName]); assert.ok(!isNaN(fixed), clockName);
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const ops = [], log = [], parsed = [], info = [], readVals = {};
  const storage = {
    getItem: (k) => { ops.push(["get", String(k)]); const v = has(k) ? map[k] : null; readVals[ops.length - 1] = v; return v; },
    setItem: (k, v) => { ops.push(["set", String(k), String(v)]); if (opts.quota && opts.quota(String(k))) throw new Error("QuotaExceededError"); log.push([String(k), String(v)]); map[k] = String(v); },
    removeItem: (k) => { ops.push(["rm", String(k)]); delete map[k]; },
    key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const pathname = opts.pathname || "/" + (opts.page || "sheet-allowance") + ".html";
  const document = { readyState: "loading", visibilityState: "visible", body: { appendChild(c) { return c; } }, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    createElement: () => ({ setAttribute() {}, getAttribute: () => null }), querySelector: () => null,
    querySelectorAll: () => [], getElementById: () => null, documentElement: { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } } };
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams,
    console: { log() {}, warn() {}, error() {}, info: (...a) => { info.push(a.join(" ")); } },
    setTimeout: opts.timers ? (f, ms) => setTimeout(f, ms) : () => 0, clearTimeout: opts.timers ? (t) => clearTimeout(t) : () => {},
    setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document,
    location: { search: "", hash: "", pathname, href: "https://house.test" + pathname, reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {},
    prompt: () => null, confirm: () => false, alert() {},
    fetch: (url, o) => (o && o.method === "GET" && opts.hub
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ now: fixed, taps: opts.hub.taps }) })
      : new Promise(() => {})),
    HouseHub: { lights: () => "https://hub.test", okForKey: () => true },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.__parsed = parsed;
  vm.runInContext("(function(){var p=JSON.parse;JSON.parse=function(s){__parsed.push(String(s));return p.apply(JSON,arguments);};})();", ctx);
  vm.runInContext(rd("house-tapsync.js"), ctx, { filename: "house-tapsync.js" });
  vm.runInContext(rd("kids-data.js"), ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = D2;
  const wk = ctx.WardKids;
  return { ctx, wk, map, ops, log, parsed, info, readVals,
    boot() { wk.syncBankFromChecks(D2); return this; },
    view(kid) { return wk.getBankView(kid, D2); },
    async pull() { await ctx.HouseTapSync.pull(); for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); } };
}
function playWeek(dev, kid) {
  for (const q of dev.wk.mustQuests(kid, D2)) {
    if ((q.cadence || "daily") === "daily") { for (const iso of W2.taps) dev.wk.setCheck(q.id, true, D2, iso); }
    else dev.wk.setCheck(q.id, true, D2);
  }
  return dev.view(kid);
}
const tapsFromQueue = (map) => {
  const out = {};
  for (const c of JSON.parse(map["house-tapsync:queue"] || "[]")) { (out[c.key] = out[c.key] || {})[c.id] = { v: c.v, t: c.t }; }
  return out;
};
const money = (v) => ({ balance: v.balance, available: v.available, weekEarn: v.weekEarn, toward: v.toward });
const ledgerOps = (dev) => dev.ops.filter((o) => o[1] === LEDGER);
const clone = (m) => JSON.parse(JSON.stringify(m));

/* a real old-format ledger with carry: a Dad screen played a week (Sat..Fri) and the Fri 15:00 rollover moved it into balance;
   then the same bytes are put back under the legacy key, as a pre-v2e device holds them */
function legacyDevice() {
  const m = Object.assign({}, SYNC_INIT);
  const dad = device("fri1459", m);
  for (const k of KIDS) playWeek(dad, k);
  const after = device("fri1600", m).boot();
  const want = {}; for (const k of KIDS) want[k] = money(after.view(k));
  const raw = m[LEDGER];
  delete m[LEDGER]; m[LEGACY] = raw;
  return { map: m, raw, want };
}
function assertKidClean(dev, tag, raw) {
  assert.deepEqual(ledgerOps(dev).filter((o) => o[0] !== "set"), [], tag + ": no getItem / removeItem on dad-ledger:v1");
  assert.ok(!dev.ops.some((o) => o[1].startsWith(LEDGER) && o[0] === "get"), tag + ": no read of any dad-ledger key");
  /* reads: the only storage value with money fields a kid page may read is the one raw house-bank:v1 copy, and it is never parsed */
  const reads = dev.ops.filter((o) => o[0] === "get").map((o) => [o[1], dev.readVals[dev.ops.indexOf(o)]]);
  for (const [k, v] of reads) if (k !== LEGACY) assert.ok(!/"(balance|lifetime|weekEarn|available)"|\u0024/.test(v || ""), tag + ": a kid page read a number from " + k);
  const legacyVals = reads.filter(([k]) => k === LEGACY).map(([, v]) => v);
  for (const s of dev.parsed) {
    assert.ok(!legacyVals.includes(s), tag + ": a kid page parsed the legacy blob");
    if (raw) assert.notEqual(s, raw, tag + ": a kid page parsed the legacy blob");
    assert.ok(!reads.some(([k, v]) => v === s && k.startsWith(LEDGER)), tag + ": parsed a dad-ledger value");
  }
  for (const k of KIDS) { const v = dev.view(k); assert.equal(v.balance || 0, 0, tag + " " + k + " kid view has no carry number"); }
}

test("DAYPKG1 v2e (Alfred 1, Atlas 1): a Dad sheet moves an opaque house-bank:v1 blob byte-exact into dad-ledger:v1, removes the old key and logs it", () => {
  for (const raw of [legacyDevice().raw, "opaque:\u0000bytes \uFFFF{not json", '{"hayes":{"balance":7,"days":{}}, "x": [1,2']) {
    const m = Object.assign({}, SYNC_INIT, { [LEGACY]: raw });
    const dad = device("fri1600", m);
    assert.equal(m[LEDGER], raw, "byte-exact at dad-ledger:v1");
    assert.ok(!(LEGACY in m), "house-bank:v1 removed");
    const iSet = dad.ops.findIndex((o) => o[0] === "set" && o[1] === LEDGER), iRm = dad.ops.findIndex((o) => o[0] === "rm" && o[1] === LEGACY);
    assert.ok(iSet >= 0 && iRm > iSet, "never delete before the move");
    assert.deepEqual([...dad.wk.ledgerLog()], [LEGACY + " moved to " + LEDGER]);
    assert.ok(dad.info.some((s) => s.startsWith("[dad-ledger] ")), "logged");
  }
});

test("DAYPKG1 v2e (Alfred 1, 2): a kid page blind-moves house-bank:v1 byte-exact, never parses or reads it back, deletes only after the copy landed", () => {
  for (const raw of [legacyDevice().raw, "opaque:\u0000bytes \uFFFF{not json", '{"hayes":{"balance":7,"days":{}}, "x": [1,2']) {
    for (const kid of KIDS) {
      const m = Object.assign({}, SYNC_INIT, { [LEGACY]: raw });
      const k = device("fri1600", m, { pathname: KID_PATH[kid] }).boot();
      assert.equal(m[LEDGER], raw, kid + " byte-exact at dad-ledger:v1");
      assert.ok(!(LEGACY in m), kid + " house-bank:v1 removed");
      const legGets = k.ops.filter((o) => o[0] === "get" && o[1] === LEGACY);
      assert.equal(legGets.length, 1, kid + " one raw read of house-bank:v1 for the copy");
      assert.deepEqual(ledgerOps(k).map((o) => o[0]), ["set"], kid + " exactly one setItem on dad-ledger:v1 (absent), 0 getItem");
      const iSet = k.ops.findIndex((o) => o[0] === "set" && o[1] === LEDGER), iRm = k.ops.findIndex((o) => o[0] === "rm" && o[1] === LEGACY);
      assert.ok(iSet >= 0 && iRm > iSet, kid + " never delete before the move");
      assertKidClean(k, kid, raw);
      assert.equal(k.wk.blindMoveLegacyBank(), "none", "nothing left to move");
    }
  }
});

test("DAYPKG1 v2e (Alfred 1): a MALFORMED blob survives unchanged: kid page leaves it at dad-ledger:v1, Dad sheet keeps it raw in dad-ledger:v1:superseded once", () => {
  const bad = '{"hayes":{"balance":12,"lifetime":40,"days":{"2026-10-24":{"stars":';
  const m = Object.assign({}, SYNC_INIT, { [LEGACY]: bad });
  for (let i = 0; i < 2; i++) device("fri1459", m, { pathname: "/kid-hayes.html" }).boot();
  assert.equal(m[LEDGER], bad, "kid pages: unchanged");
  const dad = device("fri1459", m).boot();
  assert.equal(m[LOSER], bad, "Dad sheet: kept raw");
  assert.ok(dad.info.some((s) => /unreadable dad-ledger:v1 kept raw as dad-ledger:v1:superseded/.test(s)), "logged");
  assert.doesNotThrow(() => JSON.parse(m[LEDGER]), "the Dad sheet starts a fresh readable ledger");
  device("fri1600", m).boot(); device("sat31", m).boot();
  assert.equal(Object.keys(m).filter((k) => k.startsWith(LOSER)).length, 1, "kept once (no pile up across loads)");
  assert.equal(m[LOSER], bad);
});

test("DAYPKG1 v2e (Atlas 1, Alfred 1): both orders on ONE shared device keep carry and balance; kid, Dad, kid again loads no number", () => {
  for (const order of ["kid-first", "dad-first"]) {
    const { map: m, raw, want } = legacyDevice();
    if (order === "kid-first") {
      const k = device("fri1600", m, { pathname: "/kid-hayes.html" }).boot();
      assertKidClean(k, order + " kid 1", raw);
      assert.equal(m[LEDGER], raw);
    }
    const dad = device("fri1600", m).boot();
    if (order === "dad-first") assert.ok(dad.log.some(([k, v]) => k === LEDGER && v === raw), "Dad moved the bytes");
    for (const k of KIDS) assert.deepEqual(money(dad.view(k)), want[k], order + " " + k + " carry survives the move");
    const before = m[LEDGER];
    for (const kid of KIDS) {
      const k = device("sat31", m, { pathname: KID_PATH[kid] }).boot();
      assert.deepEqual(ledgerOps(k), [], order + " " + kid + " kid page after Dad: 0 get / set / remove on dad-ledger:v1");
      assertKidClean(k, order + " kid 2 " + kid, before);
    }
    assert.equal(m[LEDGER], before, order + " kid pages left the Dad ledger untouched");
    const dad2 = device("fri1600", m).boot();
    for (const k of KIDS) assert.deepEqual(money(dad2.view(k)), want[k], order + " " + k + " carry survives kid, Dad, kid, Dad");
    assert.ok(!(LEGACY in m), order + " no house-bank:v1 left");
    assert.ok(want.hayes.balance > 0 || want.hayes.available > 0, "the fixture really carries money");
  }
});

test("DAYPKG1 v2e (Atlas 1): both keys present. Kid page parks the old blob raw (0 get / 0 set on dad-ledger:v1); Dad sheet keeps the newer, keeps the older raw, logs", () => {
  const { map: m, raw: oldRaw, want } = legacyDevice();
  device("fri1600", m).boot(); /* moved + rewritten with _w: dad-ledger:v1 is the newer one now */
  const newer = m[LEDGER];
  m[LEGACY] = oldRaw; /* an old pre-v2e page wrote the legacy key again */
  const k = device("sat31", m, { pathname: "/kid-harris" }).boot();
  assert.deepEqual(ledgerOps(k), [], "kid: 0 getItem / setItem / removeItem on dad-ledger:v1");
  assert.equal(m[LEDGER], newer);
  const side = Object.keys(m).filter((x) => x.startsWith(SIDE));
  assert.equal(side.length, 1); assert.equal(m[side[0]], oldRaw, "parked byte-exact");
  assert.ok(!(LEGACY in m));
  assertKidClean(k, "kid both", oldRaw);
  const dad = device("sat31", m);
  assert.equal(m[LEDGER], newer, "newer dad-ledger:v1 kept");
  assert.equal(m[LOSER], oldRaw, "older kept raw");
  assert.ok(!Object.keys(m).some((x) => x.startsWith(SIDE)), "side key reconciled and removed");
  assert.match(dad.wk.ledgerLog()[0], /dad-ledger:v1 is newer: kept it, older dad-ledger:v1:legacy:\d+ saved as dad-ledger:v1:superseded/);
  /* the other way round: the legacy blob is the newer one */
  const m2 = Object.assign({}, SYNC_INIT, { [LEDGER]: JSON.stringify({ _w: 1, hayes: { balance: 1, lifetime: 1, days: {} } }), [LEGACY]: JSON.stringify({ _w: Date.parse(K.fri1600), hayes: { balance: 9, lifetime: 9, days: {} } }) });
  const keepOld = m2[LEDGER], win = m2[LEGACY];
  const d2 = device("fri1600", m2);
  assert.equal(m2[LEDGER], win); assert.equal(m2[LOSER], keepOld); assert.ok(!(LEGACY in m2));
  assert.match(d2.wk.ledgerLog()[0], /house-bank:v1 is newer: kept it, older dad-ledger:v1 saved as dad-ledger:v1:superseded/);
  assert.ok(want);
});

test("DAYPKG1 v2e (Alfred 2): never delete before the move. A copy that fails (quota) leaves house-bank:v1 in place on kid pages and Dad sheets", () => {
  for (const pathname of ["/kid-hayes.html", "/sheet-allowance.html"]) {
    const m = Object.assign({}, SYNC_INIT, { [LEGACY]: "blob" });
    const dev = device("fri1600", m, { pathname, quota: (k) => k.startsWith(LEDGER) });
    assert.equal(m[LEGACY], "blob", pathname + " kept");
    assert.ok(!dev.ops.some((o) => o[0] === "rm" && o[1] === LEGACY), pathname + " never removed");
  }
});

test("DAYPKG1 v2e (Alfred 6, caveat c): two Dad screens converge. A pays (or resets), B mirrors the synced marker once, no week is re-credited or dropped", async () => {
  for (const mode of ["paid", "jar-reset"]) {
    const mA = Object.assign({}, SYNC_INIT), mB = Object.assign({}, SYNC_INIT);
    const a = device("fri1459", mA);
    for (const k of KIDS) playWeek(a, k);
    for (const k of Object.keys(mA)) if (k.startsWith("house-checkoffs:")) mB[k] = mA[k];
    const b0 = device("fri1459", mB).boot();
    for (const k of KIDS) assert.deepEqual(money(b0.view(k)), money(a.view(k)), mode + " same week on both screens");
    for (const k of KIDS) { if (mode === "paid") a.wk.dadPaid(k, D2); else a.wk.resetJarCycle(k, "0", D2); }
    const hub = { taps: tapsFromQueue(mA) };
    const b = device("fri1459", mB, { hub }); await b.pull(); b.boot();
    const aV = {}; for (const k of KIDS) aV[k] = money(device("fri1459", mA).boot().view(k));
    for (const k of KIDS) assert.deepEqual(money(b.view(k)), aV[k], mode + " " + k + " B mirrors A");
    for (const clock of ["fri1600", "sat31", "nov2_0700", "nov6_0700"]) {
      const av = device(clock, mA, { hub }), bv = device(clock, mB, { hub });
      await av.pull(); await bv.pull(); av.boot(); bv.boot();
      for (const k of KIDS) assert.deepEqual(money(bv.view(k)), money(av.view(k)), mode + " " + clock + " " + k + " the two Dad screens agree");
      if (mode === "paid") for (const k of KIDS) assert.equal(bv.view(k).balance, 0, mode + " " + clock + " " + k + " B never re-credits the paid week");
    }
  }
});

/* ---------- hold to confirm ---------- */
function btn() {
  const on = {}, attrs = {};
  return { on, attrs, addEventListener(t, f) { (on[t] = on[t] || []).push(f); }, setAttribute(k, v) { attrs[k] = String(v); }, removeAttribute(k) { delete attrs[k]; },
    getAttribute(k) { return k in attrs ? attrs[k] : null }, setPointerCapture() {},
    fire(t, ev = {}) { const e = Object.assign({ type: t, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }, ev); (on[t] || []).forEach((f) => f(e)); return e; } };
}
test("DAYPKG1 v2e (Atlas 2, Alfred 3): hold to confirm with fake timers: under 2 s, an early lift, leave or cancel does nothing; 2 s fires exactly once (mouse and touch); repeat key or held key never double-fires; click does nothing; refused on a kid page", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const dad = device("fri1459", Object.assign({}, SYNC_INIT), { timers: true });
  assert.equal(dad.wk.HOLD_MS, 2000);
  for (const pointerType of ["mouse", "touch", "pen"]) {
    const b = btn(); let n = 0;
    const h = dad.wk.bindHold(b, () => { n++; });
    b.fire("pointerdown", { button: 0, pointerType, pointerId: 1 }); t.mock.timers.tick(1999); b.fire("pointerup", { pointerType });
    t.mock.timers.tick(10000); assert.equal(n, 0, pointerType + " early lift");
    assert.ok(!("data-holding" in b.attrs), "fill cleared");
    for (const lift of ["pointerleave", "pointercancel", "lostpointercapture"]) { b.fire("pointerdown", { button: 0, pointerType }); t.mock.timers.tick(1500); b.fire(lift); t.mock.timers.tick(5000); }
    assert.equal(n, 0, pointerType + " leave / cancel");
    b.fire("pointerdown", { button: 0, pointerType }); assert.ok("data-holding" in b.attrs, "fill shown while held");
    t.mock.timers.tick(2000); assert.equal(n, 1, pointerType + " 2 s fires");
    b.fire("pointerdown", { button: 0, pointerType }); t.mock.timers.tick(10000); assert.equal(n, 1, pointerType + " still held: no second fire");
    b.fire("pointerup"); b.fire("pointerdown", { button: 0, pointerType }); t.mock.timers.tick(2500); b.fire("pointerup");
    assert.equal(n, 2, pointerType + " a new hold fires again"); assert.equal(h.fired(), 2);
  }
  const r = btn(); let rn = 0; dad.wk.bindHold(r, () => { rn++; });
  r.fire("pointerdown", { button: 2, pointerType: "mouse" }); t.mock.timers.tick(5000); assert.equal(rn, 0, "right button");
  const c = btn(); let cn = 0; dad.wk.bindHold(c, () => { cn++; });
  const ce = c.fire("click"); t.mock.timers.tick(5000); assert.equal(cn, 0, "a plain click does nothing"); assert.ok(ce.defaultPrevented);
  const k = btn(); let kn = 0; dad.wk.bindHold(k, () => { kn++; });
  k.fire("keydown", { key: " ", repeat: false });
  for (let i = 0; i < 50; i++) { t.mock.timers.tick(100); k.fire("keydown", { key: " ", repeat: true }); }
  assert.equal(kn, 1, "held Space fires once"); k.fire("keyup", { key: " " });
  k.fire("keydown", { key: "Enter" }); t.mock.timers.tick(1999); k.fire("keyup", { key: "Enter" }); t.mock.timers.tick(5000);
  assert.equal(kn, 1, "short Enter does nothing");
  k.fire("keydown", { key: "a" }); t.mock.timers.tick(5000); assert.equal(kn, 1, "other keys do nothing");
  for (const p of ["/kid-hayes.html", "/kid-hayes"]) assert.equal(device("fri1459", Object.assign({}, SYNC_INIT), { pathname: p, timers: true }).wk.bindHold(btn(), () => {}), null, p);
});

test("DAYPKG1 v2e (Alfred 3): the Paid control carries no number or money word, is wired only through bindHold, and no click handler pays", () => {
  const h = rd("sheet-allowance.html");
  const btns = h.match(/<button[^>]*data-dad-paid[^>]*>[^<]*<\/button>/g) || [];
  assert.equal(btns.length, 3);
  for (const b of btns) {
    assert.match(b, /^<button type="button" class="dad-paid" data-dad-paid="(hayes|harris|ainsley)" aria-label="Hold to mark Paid">Hold for Paid<\/button>$/);
    assert.ok(!/\d|\$|dollar|money|cash|balance|amount|owed|allowance/i.test(b.replace(/data-dad-paid="\w+"/, "")), b);
  }
  const wire = h.slice(h.indexOf('document.querySelectorAll("[data-dad-paid]")'));
  assert.match(wire.slice(0, 200), /WardKids\.bindHold\(btn, function \(\) \{\s*WardKids\.dadPaid\(/);
  assert.equal((h.match(/WardKids\.dadPaid\(/g) || []).length, 1, "the one pay path is the hold");
  assert.ok(!/\.dad-paid[^{]*\{[^}]*content:\s*"[^"]*\d/.test(h), "no number drawn by CSS");
  const L = rd("house-links.js");
  assert.match(L, /var CONTROL = "a\[href\],button,/, "house-links skips buttons");
  assert.match(L, /if \(ev\.defaultPrevented \|\| ev\.button > 0\) return;/, "and a prevented click");
});

test("DAYPKG1 v2e (Alfred 3): static stacking. .dad-paid is position:relative z 6, above .panel > * (z 2); every page layer at z >= 6 is allowlisted with a reason", () => {
  const h = rd("sheet-allowance.html");
  assert.match(h, /\.dad-paid \{[^}]*position: relative; z-index: 6;[^}]*touch-action: none;/);
  assert.match(h, /\.dad-paid::before \{[^}]*pointer-events: none; z-index: -1;/, "the fill sits under the label and never takes the press");
  const ALLOW = new Map([
    ["sheet-allowance.html|.dad-paid", "the control itself"],
    ["house-engage.css|.house-clear-burst", "pointer-events none, transient burst"],
    ["house-engage.css|.house-vfx-layer", "pointer-events none, vfx layer"],
    ["house-engage.css|.vfx-float", "pointer-events none, vfx"],
    ["house-engage.css|.saves-overlay", "modal save dialog, open only on demand (it covers the whole page by design)"],
    ["house-engage.css|.sensi-float", "pointer-events none"],
    ["house-engage.css|body.theme-hayes .grow-stage::before", "pointer-events none, grow meter art inside the bank card"],
    ["house-ori.css|.ori-iris, .ori-arrive, html.ori-arriving::before, html.ori-held::before", "pointer-events none, page transition veil"],
    ["house-ori.css|.ori-ripple", "pointer-events none"],
    ["house-ori.css|html.ori-phone.ori-home .ori-spirit", "ori-home only (not this page)"],
    ["house-ori.css|html.ori-phone.ori-home body .panel.panel.panel header.hdr", "ori-home only (not this page)"],
    ["house-ori.css|html.ori-phone.ori-home .ori-peek", "ori-home only, pointer-events none"],
    ["night/night-host.css|html.night52 body > .night52-snd", "night sound toggle, a fixed corner button"],
  ]);
  const files = [...h.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map((m) => m[1]);
  const styles = [...h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  const seen = [];
  for (const [f, css] of [["sheet-allowance.html", styles], ...files.map((f) => [f, rd(f)])]) {
    for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const z = m[2].match(/z-index:\s*(-?\d+)/);
      if (!z || Number(z[1]) < 6) continue;
      const sel = m[1].trim().replace(/\s+/g, " ");
      const key = [...ALLOW.keys()].find((a) => { const [af, as] = a.split("|"); return af === f && sel.startsWith(as); });
      assert.ok(key, "unreviewed layer at z " + z[1] + ": " + f + " " + sel.slice(0, 90));
      seen.push(key);
    }
  }
  assert.ok(seen.includes("sheet-allowance.html|.dad-paid"));
  const others = styles.replace(/\.dad-paid[^{]*\{[^}]*\}/g, "");
  for (const m of others.matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(Number(m[1]) <= 2, "inline z above the control's container band: " + m[1]);
  /* JS-made layers on this page: corner chips, pairing card, transition veil (reviewed) */
  const JS_OK = { "private-feed.js": "pairing chip / offline flag (fixed, bottom, only when unpaired or offline)", "house-pair.js": "pairing card, opened on demand",
    "house-tapsync.js": "sync badge, pointer-events none (in the footer slot on Dad pages)", "house-ori-world.js": "page transition veil", "month-theme/month-overlay.js": "theme art z <= 2" };
  for (const s of [...h.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1])) {
    if (!fs.existsSync(path.join(ROOT, s))) continue;
    const big = [...rd(s).matchAll(/z-?[iI]ndex\s*[:=]\s*"?(\d+)/g)].filter((m) => Number(m[1]) >= 6);
    if (big.length) assert.ok(JS_OK[s], "unreviewed JS layer in " + s);
  }
});

test("DAYPKG1 v2e (Atlas 2, Alfred 4): sheet-allowance is reachable by URL only. 0 links or routes from the wall, kid boards, nav, hub pages or any manifest (hrefs, onclick, JS-built URLs, fragments)", () => {
  const files = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter((f) => f && /\.(html|js|mjs|css|json|webmanifest)$/.test(f));
  /* allowlist with reasons; everything under scripts/ (QA, tools, never served as a page link) and the 2026-09-28 design plates (archived mocks) */
  const ALLOW = { "house-ori-world.js": /^\s*"sheet-allowance\.html": \{ acc: "#[0-9a-f]+", key: "#[0-9a-f]+", rays: 1 \},$/, /* a per-page theme lookup keyed by the current path, not a link */
    /* DAYPKG1 v2h · PFCACHE1 delta (hotfix, its own bytes e9744d9f): a comment naming its cache-only scope; not a link or route */
    "private-feed.js": /^\s*\/\* PFCACHE1 delta · CACHE-ONLY scope: the kid-reachable no-money sheets \(Jar = sheet-allowance, chores, index, weekend\)$/ };
  const PAT = [/sheet[-_ ]?allow/i, /allowance\.html/i, /["'`/]allowance["'`.#?]/i, /["'`]sheet-["'`]\s*\+/, /\+\s*["'`]allow/i];
  const hits = [];
  for (const f of files) {
    if (f.startsWith("scripts/") || f.startsWith("plates/2026-09-28/")) continue;
    if (f === "sheet-allowance.html") continue;
    rd(f).split("\n").forEach((line, i) => {
      if (!PAT.some((p) => p.test(line))) return;
      if (ALLOW[f] && ALLOW[f].test(line)) return;
      hits.push(f + ":" + (i + 1) + ": " + line.trim().slice(0, 120));
    });
  }
  assert.deepEqual(hits, [], "links or routes to the Dad Paid sheet");
  /* the plate mocks that name the old sheet are not linked by any served page (a CSS comment naming its source plate is fine) */
  const MOCKS = ["family-clock-first-heat-mock.html", "dad-clock-first-heat-mock.html"];
  for (const f of files.filter((x) => !x.startsWith("scripts/") && !x.startsWith("plates/") && !x.startsWith("plates-receipt/"))) for (const mk of MOCKS) assert.ok(!rd(f).includes(mk), f + " links " + mk);
  for (const f of ["wall.html", "night/scene.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "house-links.js", "kids-data.js", "sheet-index.html", "sheet-today.html", "sheet-gallery.html", "sheet-chores.html", "manifest.webmanifest", "ori/plates/painted/manifest.js", "art/world-manifest.js"]) {
    assert.ok(files.includes(f), f + " tracked");
    assert.ok(!/sheet[-_ ]?allow/i.test(rd(f)), f + " names the Dad Paid sheet");
  }
  assert.ok(!/chip-money/.test(rd("wall.html")) && !/chip-money/.test(rd("night/scene.html")), "the wall money chip is gone");
  /* the kids' "show Dad" CTA stays as kid copy (JAR FULL · show Dad: show Dad in person) but links nowhere off the board */
  for (const kid of KIDS) {
    const h = rd("kid-" + kid + ".html");
    for (const a of h.match(/<a\b[^>]*>[^<]*<\/a>/g) || []) if (/Dad|Paid|Jar/i.test(a)) assert.match(a, /href="#[\w-]+"/, kid + " " + a);
    /* DAYPKG1 v2h (Atlas): the CTA is plain text now, no link at all */
    assert.match(h, /<span class="unlock-cta" data-unlock-cta hidden>Jar full · show Dad<\/span>/, kid + " show Dad CTA is plain text");
    assert.doesNotMatch(h, /<a\b[^>]*unlock-cta/, kid + " show Dad CTA is not an anchor");
  }
});

test("DAYPKG1 v2e (Alfred 5, D4), v2g P2: sheet-chores (kid-reachable) fetches no money feed and shows a star count, never '$'; a kid page shows a plain tick; the money feed is never the public same-origin file", async () => {
  const FEED = JSON.parse(rd("scripts/qa/fixtures/daypkg1v2e-private-kids-week.synthetic.json"));
  assert.match(FEED._synthetic, /SYNTHETIC/);
  async function row(page) {
    const h = rd("sheet-chores.html");
    const m = h.match(/<div class="chore open hayes" data-check="hay-bed">[\s\S]*?<span class="star-earn" data-stars="(\d+)" data-money-suffix="([^"]*)"><\/span>/);
    assert.ok(m);
    const attrs = (o) => o;
    const mk = (cls, a = {}, kids = [], text = "") => {
      const el = { cls: new Set(cls.split(" ").filter(Boolean)), attrs: attrs({ ...a }), kids, textContent: text, on: {}, parent: null, style: {}, nodeType: 1 };
      kids.forEach((k) => { k.parent = el; });
      el.classList = { add: (...x) => x.forEach((y) => el.cls.add(y)), remove: (...x) => x.forEach((y) => el.cls.delete(y)), contains: (x) => el.cls.has(x), toggle: (x, on) => { if (on === undefined ? !el.cls.has(x) : on) el.cls.add(x); else el.cls.delete(x); } };
      el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null); el.setAttribute = (k, v) => { el.attrs[k] = String(v); }; el.removeAttribute = (k) => { delete el.attrs[k]; }; el.hasAttribute = (k) => k in el.attrs;
      el.matches = (sel) => sel.split(",").some((s) => { const parts = s.trim().match(/\.[\w-]+|\[[^\]]+\]/g) || []; if (!parts.length) return false;
        return parts.every((p) => { if (p[0] === ".") return el.cls.has(p.slice(1)); const q = p.slice(1, -1).match(/^([\w-]+)(?:=['"]?([^'"]*)['"]?)?$/); return q[2] === undefined ? q[1] in el.attrs : el.attrs[q[1]] === q[2]; }); });
      el.all = () => el.kids.flatMap((k) => [k, ...k.all()]);
      el.querySelector = (s) => el.all().find((e) => e.matches(s)) || null; el.querySelectorAll = (s) => el.all().filter((e) => e.matches(s));
      el.getElementsByTagName = () => el.all(); el.closest = (s) => { let e = el; while (e) { if (e.matches(s)) return e; e = e.parent; } return null; };
      el.addEventListener = (t, f) => { (el.on[t] = el.on[t] || []).push(f); }; el.appendChild = (c) => { el.kids.push(c); c.parent = el; return c; }; el.remove = () => {};
      el.insertBefore = (c) => el.appendChild(c);
      return el;
    };
    const chip = mk("star-earn", { "data-stars": m[1], "data-money-suffix": m[2] });
    const chore = mk("chore open hayes", { "data-check": "hay-bed" }, [mk("ring"), mk("txt", {}, [mk("hint", {}, [], "daily must")]), chip]);
    const body = mk("", {}, [chore]);
    const map = { "wardos-lights-proxy-token": "qa".repeat(10) };
    const calls = [];
    const document = { readyState: "complete", body, documentElement: mk("", {}), head: mk(""), addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
      querySelectorAll: (s) => body.querySelectorAll(s), querySelector: (s) => body.querySelector(s), getElementById: () => null, createElement: () => mk("") };
    const ctx = vm.createContext({ Intl, Date, console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
      localStorage: { getItem: (k) => (k in map ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; }, key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } },
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document, location: { pathname: "/" + page, search: "", hash: "", href: "https://house.test/" + page, origin: "https://house.test" },
      history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: true }), addEventListener() {}, MutationObserver: class { observe() {} disconnect() {} },
      Response, Headers, URL, AbortController, HouseHub: { lights: () => "https://hub.test", okForKey: () => true },
      fetch: (url, o) => { calls.push([String(url), o && o.headers && o.headers["X-Private-Feed-Token"]]);
        if (String(url) === "https://hub.test/api/private/kids-week.json" && o.headers["X-Private-Feed-Token"] === "qa".repeat(10)) return Promise.resolve(new Response(JSON.stringify(FEED), { status: 200 }));
        return Promise.resolve(new Response("nope", { status: 404 })); } });
    ctx.window = ctx; ctx.self = ctx;
    vm.runInContext(rd("private-feed.js"), ctx, { filename: "private-feed.js" });
    vm.runInContext(rd("house-money-bind.js"), ctx, { filename: "house-money-bind.js" });
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    vm.runInContext(rd("house-checkoffs.js"), ctx, { filename: "house-checkoffs.js" });
    const click = () => { chore.__lastToggle = 0; chore.on.click[0]({ preventDefault() {}, stopPropagation() {} }); };
    return { chip, click, n: Number(m[1]), sv: FEED.kids.hayes.bankGoal.starDollar, calls };
  }
  const d = await row("sheet-chores.html");
  /* DAYPKG1 v2g P2: money paints only on the Dad money sheet (meta ward-money=dad); sheet-chores is kid-reachable */
  assert.ok(!d.calls.some(([u]) => /kids-week\.json/.test(u)), "no money feed fetched on a kid-reachable family sheet");
  assert.equal(d.chip.textContent, "");
  d.click(); assert.equal(d.chip.textContent, "\u2605 +" + d.n, "star count, no money");
  d.click(); assert.ok(!d.chip.textContent.includes(D));
  for (const p of ["kid-hayes.html", "kid-hayes"]) {
    const k = await row(p);
    assert.equal(k.chip.textContent, "", p + " no money on a kid page"); k.click(); assert.equal(k.chip.textContent, "\u2713", p);
  }
});

test("DAYPKG1 v2e (Alfred 6): the kid stamp is not tappable and fades about 2 weeks after Paid; a legacy stamp with no paid-at keeps showing", () => {
  const css = rd("kid-world.css");
  const rule = css.match(/body\.kw-on \.kw-paid:not\(\[hidden\]\) \{([^}]*)\}/);
  assert.ok(rule); assert.match(rule[1], /pointer-events:\s*none/);
  const kd = rd("kids-data.js");
  const fn = kd.slice(kd.indexOf("function renderKidPaidChip"), kd.indexOf("function renderKidPaidChip") + 900);
  assert.ok(!/href|tabindex|role|addEventListener|onclick/.test(fn.slice(0, fn.indexOf("return chip"))), "no link, role, focus or handler on the stamp");
  assert.ok(!/kw-paid|data-kw-paid/.test(rd("house-links.js")), "house-links never routes the stamp");
  const at = (clock, days) => new Date(Date.parse(K[clock]) - days * 864e5).toISOString();
  for (const [days, want] of [[0, "Paid \u2713"], [13.9, "Paid \u2713"], [14.1, ""], [30, ""]]) {
    const m = Object.assign({}, SYNC_INIT, { "house-bank-paid:hayes": "Paid \u2713", "house-bank-paid-at:hayes": at("nov6_0700", days) });
    assert.equal(device("nov6_0700", m, { pathname: "/kid-hayes.html" }).wk.getPaidStamp("hayes"), want, days + " days");
  }
  const m = Object.assign({}, SYNC_INIT, { "house-bank-paid:hayes": "Jar reset \u2713" });
  assert.equal(device("nov6_0700", m, { pathname: "/kid-hayes.html" }).wk.getPaidStamp("hayes"), "Jar reset \u2713", "legacy, no paid-at");
});

test("DAYPKG1 v2e (Alfred 6): cache token BUMP. Kid boards load house-nomoney.js and house-links.js at ?v=DAYPKG1; every page loading house-links.js gets DAYPKG1", () => {
  for (const kid of KIDS) {
    const h = rd("kid-" + kid + ".html");
    assert.match(h, /house-nomoney\.js\?v=DAYPKG1"/); assert.match(h, /house-links\.js\?v=DAYPKG1"/);
  }
  for (const f of ["sheet-allowance.html", "sheet-chores.html"]) assert.match(rd(f), /house-links\.js\?v=DAYPKG1"/, f);
});

test("DAYPKG1 v2e (Alfred 6): v2d items still hold (house-saves '$' strip, exact-key cleanup, (\\.html)?$ guards, Ainsley no counts are tested in daypkg1v2d.test.mjs); every kid guard regex accepts the extensionless path", () => {
  const v2d = rd("scripts/qa/daypkg1v2d.test.mjs");
  for (const t of ["house-saves", "exact prefix", "extensionless", "Ainsley"]) assert.ok(v2d.includes(t), "v2d covers " + t);
  for (const f of ["kids-data.js", "house-nomoney.js", "house-money-bind.js", "house-checkoffs.js", "house-saves.js"]) {
    for (const m of rd(f).matchAll(/\\\/kid-[^/\n]{0,40}\$\//g)) assert.match(m[0], /\(\\\.html\)\?\$\/$/, f + " " + m[0]);
  }
});
