/* DAYPKG1 item 1 (P1, Friday-critical) · QA_NO_BROWSER=1 TZ=America/Chicago, static (node only, no browser).
   Bug (pre-existing, all kids): Paid (resetJarCycle) moved the week's stars into the balance and cleared the week's day buckets,
   but syncBankFromChecks / syncMustGateBank rebuilt the must-gate credit from the house-checkoffs keys right away (the Paid
   click handler itself calls it) and on every boot after, so the week came back full and settled into the balance a second
   time at Fri 15:00. Fix: a per-kid paid-week marker in the bank root (house-bank:v1 -> <kid>.paidWeek = first tap day of the
   week that was paid, no '$'); syncMustGateBank leaves a paid week alone and settlePriorWeeksIntoBalance never settles it.
   Every test runs the REAL kids-data.js and house-tapsync.js in a vm with a faked Chicago clock, on the 1C fixture week
   (2026-10-23, Sat 10-24 .. Fri 10-30), so the HAYESJAR1D lock is live for Hayes throughout. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FX = JSON.parse(rd("scripts/qa/fixtures/hayesjar1c-week.json"));
const D2 = FX.data, W2 = FX.week, K = FX.clock;
const KD = rd("kids-data.js"), TS = rd("house-tapsync.js");
const KIDS = ["hayes", "harris", "ainsley"];
const WANT = { hayes: [53, 52], harris: [53, 52], ainsley: [38, 38] };   /* week stars / jar (the 1C/1D numbers) */
const SYNC_INIT = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" };
const NW = ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];

/* one screen; opts.hub = { taps } answers the GET /api/taps pull, POSTs never resolve */
function device(clockName, map, opts = {}) {
  const fixed = Date.parse(K[clockName]); assert.ok(!isNaN(fixed), clockName);
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const storage = { getItem: (k) => (has(k) ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; },
    key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const page = opts.page || "sheet-allowance"; /* DAYPKG1 v2d · Atlas A: Dad pays on sheet-allowance (kid boards keep no ledger) */
  const document = { readyState: "loading", visibilityState: "visible", addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } } };
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {} }, document,
    location: { search: "", hash: "", pathname: "/" + page + ".html", href: "https://house.test/" + page + ".html", reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {},
    fetch: (url, o) => (o && o.method === "GET" && opts.hub
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ now: fixed, taps: opts.hub.taps }) })
      : new Promise(() => {})),
    HouseHub: { lights: () => "https://hub.test", okForKey: () => true },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(TS, ctx, { filename: "house-tapsync.js" });
  vm.runInContext(KD, ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = D2;
  const wk = ctx.WardKids;
  return {
    ctx, wk, map,
    boot() { wk.syncBankFromChecks(D2); return this; },
    view(kid) { return wk.getBankView(kid, D2); },
    /* DAYPKG1 v2d · Dad's Paid on sheet-allowance: the page load syncs, then resetJarCycle (the same logic dadPaid calls) */
    paid(kid, amount) { wk.syncBankFromChecks(D2); wk.resetJarCycle(kid, amount, D2); wk.syncBankFromChecks(D2); return wk.getBankView(kid, D2); },
    async pull() { await ctx.HouseTapSync.pull(); for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); },
  };
}
function playWeek(dev, kid, taps = W2.taps) {
  for (const q of dev.wk.mustQuests(kid, D2)) {
    if ((q.cadence || "daily") === "daily") { for (const iso of taps) dev.wk.setCheck(q.id, true, D2, iso); }
    else dev.wk.setCheck(q.id, true, D2);
  }
  return dev.wk.getBankView(kid, D2);
}
const noDollar = (map) => { for (const k of Object.keys(map)) assert.ok(!(k + map[k]).includes("$"), "dollar in " + k + " = " + map[k]); };
const tapsFromQueue = (map) => {
  const out = {};
  for (const c of JSON.parse(map["house-tapsync:queue"] || "[]")) { (out[c.key] = out[c.key] || {})[c.id] = { v: c.v, t: c.t }; }
  return out;
};
const AFTER_PAID = ["fri1459", "fri1500", "fri1600", "sat31", "nov1_1200", "nov2_0000cst", "nov2_0700", "nov6_0700"];

test("DAYPKG1 P1: full week then Paid before Fri 15:00 is never re-credited (3 kids x Paid at Fri 07:00 / 14:59 x full / part / zero pay): click-time sync, reboots, Fri 15:00 / 16:00, next day, 11-02, next Fri", () => {
  for (const kid of KIDS) for (const at of ["fri0700", "fri1459"]) for (const mode of ["full", "part", "zero"]) {
    const tag = kid + " " + at + " " + mode;
    const map = Object.assign({}, SYNC_INIT);
    const v = playWeek(device(at, map, { page: "sheet-allowance" }), kid);
    assert.equal(v.week, WANT[kid][0], tag); assert.equal(v.toward, WANT[kid][1], tag); assert.equal(v.reached, true, tag);
    const E = v.weekEarn, L = v.lifetime; assert.ok(E > 0, tag); assert.equal(v.balance, 0, tag);
    const P = mode === "full" ? E : mode === "part" ? Math.max(1, Math.floor(E / 2)) : 0;
    const p = device(at, map, { page: "sheet-allowance" }).paid(kid, String(P));
    const carry = E - P;
    assert.equal(p.balance, carry, tag + " Paid moves the week once"); assert.equal(p.week, 0, tag + " jar empties"); assert.equal(p.reached, false, tag);
    assert.equal(p.weekEarn, 0, tag); assert.equal(p.lifetime, L, tag + " lifetime not re-added");
    for (const c of AFTER_PAID) for (let boot = 0; boot < 2; boot++) {
      const b = device(c, map, { page: "sheet-allowance" }).boot().view(kid);
      assert.equal(b.balance, carry, tag + " " + c + " boot " + boot + " no re-credit"); assert.equal(b.lifetime, L, tag + " " + c);
      if (c === "fri1459") { assert.equal(b.week, 0, tag + " same day: jar stays empty"); assert.equal(b.reached, false, tag); }
    }
    noDollar(map);
  }
});

test("DAYPKG1 P1: after Paid the week stays paid even if a must is unticked and reticked (no lifetime double, no jar refill, no settle)", () => {
  for (const kid of KIDS) {
    const map = Object.assign({}, SYNC_INIT);
    const v = playWeek(device("fri0700", map, { page: "sheet-allowance" }), kid);
    device("fri0700", map).paid(kid, String(v.weekEarn));
    const d = device("fri1459", map); d.boot();
    const q = d.wk.mustQuests(kid, D2).find((x) => (x.cadence || "daily") === "daily" && !d.wk.hayesJar1Locked(x.id, "2026-10-30"));
    d.wk.setCheck(q.id, false, D2, "2026-10-30"); assert.equal(d.view(kid).mustComplete, false, kid);
    d.wk.setCheck(q.id, true, D2, "2026-10-30");
    const b = d.view(kid);
    assert.equal(b.mustComplete, true, kid); assert.equal(b.week, 0, kid + " no refill"); assert.equal(b.balance, 0, kid); assert.equal(b.lifetime, v.lifetime, kid + " no lifetime double");
    assert.equal(device("sat31", map).boot().view(kid).balance, 0, kid + " next day");
  }
});

test("DAYPKG1 P1 at/after Fri 15:00: Paid at 15:00 or 16:00 pays the settled week (balance 52 -> carry) and the new week is NOT marked paid: it fills and settles normally", () => {
  for (const kid of KIDS) for (const at of ["fri1500", "fri1600"]) {
    const tag = kid + " " + at;
    const map = Object.assign({}, SYNC_INIT);
    const v = playWeek(device("fri1459", map, { page: "sheet-allowance" }), kid); const E = v.weekEarn;
    const s = device(at, map, { page: "sheet-allowance" }).boot().view(kid);
    assert.equal(s.balance, E, tag + " settled at 15:00"); assert.equal(s.week, 0, tag);
    const p = device(at, map).paid(kid, String(E));
    assert.equal(p.balance, 0, tag + " paid out");
    const bag = JSON.parse(map["dad-ledger:v1"])[kid];
    assert.notEqual(bag.paidWeek, "2026-10-31", tag + " an empty new week is never marked paid");
    for (const c of ["fri1600", "sat31", "nov2_0700"]) assert.equal(device(c, map).boot().view(kid).balance, 0, tag + " " + c);
    const nv = playWeek(device("nov6_0700", map, { page: "sheet-allowance" }), kid, NW);
    assert.equal(nv.week, WANT[kid][0], tag + " new week fills"); assert.equal(nv.reached, true, tag);
    assert.equal(device("nov6_1600", map).boot().view(kid).balance, nv.weekEarn, tag + " new week settles once");
    noDollar(map);
  }
});

test("DAYPKG1 P1: a week paid before 15:00 does not block the next week (it fills, can be paid, settles once); unpaid control still settles at 15:00", () => {
  for (const kid of KIDS) {
    const map = Object.assign({}, SYNC_INIT);
    const v = playWeek(device("fri1459", map, { page: "sheet-allowance" }), kid); const E = v.weekEarn;
    device("fri1459", map).paid(kid, String(E - 1));      /* carry 1 */
    const nv = playWeek(device("nov6_0700", map, { page: "sheet-allowance" }), kid, NW);
    assert.equal(nv.week, WANT[kid][0], kid); assert.equal(nv.balance, 1, kid);
    assert.equal(device("nov6_1600", map).boot().view(kid).balance, 1 + nv.weekEarn, kid + " next week settles on top");
    /* control: same week, never paid -> settles exactly once at 15:00 */
    const m2 = Object.assign({}, SYNC_INIT); playWeek(device("fri1459", m2), kid);
    for (const c of ["fri1500", "sat31", "nov2_0700"]) assert.equal(device(c, m2).boot().view(kid).balance, E, kid + " control " + c);
  }
});

test("DAYPKG1 P1 multi-device: kid taps on screen B reach the paying screen A through the house-checkoffs keys (real tapsync pull); A never re-credits after Paid, before or after Fri 15:00 and the next day", async () => {
  for (const kid of KIDS) {
    const mapB = Object.assign({}, SYNC_INIT), mapA = Object.assign({}, SYNC_INIT);
    playWeek(device("fri0700", mapB, { page: "kid-" + kid }), kid);
    const hub = { taps: tapsFromQueue(mapB) };
    assert.ok(Object.keys(hub.taps).length > 0, kid + " B queued its taps");
    const A = device("fri0700", mapA, { page: "sheet-allowance", hub }) /* DAYPKG1 v2f D2 · sheet-chores is kid scope now; screen A is the Dad ledger sheet */; await A.pull(); A.boot();
    const v = A.view(kid);
    assert.equal(v.week, WANT[kid][0], kid + " A sees B's week"); assert.equal(v.reached, true, kid);
    const p = device("fri1459", mapA, { page: "sheet-allowance" }).paid(kid, String(v.weekEarn));
    assert.equal(p.balance, 0, kid); assert.equal(p.week, 0, kid);
    /* B: a late untick + retick on Fri reaches A again (newer stamps), and a plain re-pull of the same keys */
    const B2 = device("fri1459", mapB, { page: "kid-" + kid });
    const q = B2.wk.mustQuests(kid, D2).find((x) => (x.cadence || "daily") === "daily" && !B2.wk.hayesJar1Locked(x.id, "2026-10-30"));
    B2.wk.setCheck(q.id, false, D2, "2026-10-30"); B2.wk.setCheck(q.id, true, D2, "2026-10-30");
    const hub2 = { taps: tapsFromQueue(mapB) };
    for (const c of ["fri1459", "fri1500", "sat31", "nov2_0700"]) {
      const a = device(c, mapA, { page: "sheet-allowance", hub: hub2 }); await a.pull(); a.boot();
      const b = a.view(kid);
      assert.equal(b.balance, 0, kid + " " + c + " A no re-credit after B's keys"); assert.equal(b.lifetime, v.lifetime, kid + " " + c);
    }
    noDollar(mapA);
  }
});

test("DAYPKG1 P1 HAYESJAR1D unchanged: Hayes full week 53 / jar 52/52 with the lock, unpaid week settles once (52 then 104 next Fri); paid marker never written without a Paid", () => {
  const map = Object.assign({}, SYNC_INIT);
  const v = playWeek(device("fri1459", map), "hayes");
  assert.equal(v.week, 53); assert.equal(v.toward, 52); assert.equal(v.need, 52); assert.equal(v.reached, true);
  for (const iso of W2.locked) assert.equal(device("fri1459", map).wk.getCheck("hay-backpack", D2, iso), true, iso);
  const b = device("sat31", map).boot().view("hayes"); assert.equal(b.balance, v.weekEarn); assert.equal(b.week, 0);
  const nv = playWeek(device("nov6_0700", map), "hayes", NW); assert.equal(nv.week, 53);
  assert.equal(device("nov6_1600", map).boot().view("hayes").balance, 2 * v.weekEarn);
  assert.ok(!/paidWeek/.test(map["dad-ledger:v1"]), "no paid marker without a Paid");
});

test("DAYPKG1 P1 code: the marker and the Paid stamp carry no '$'; resetJarCycle writes no '$' key or value; a legacy '$' stamp is rewritten on read", () => {
  const map = Object.assign({}, SYNC_INIT, { "house-bank-paid:harris": "Paid $10 · $0 carry", "house-bank-paid:ainsley": "Jar reset · $3 carry" });
  const d = device("fri1459", map);
  assert.equal(d.wk.getPaidStamp("harris"), "Paid \u2713");
  assert.equal(d.wk.getPaidStamp("ainsley"), "Jar reset \u2713");
  noDollar(map);
  for (const kid of KIDS) { playWeek(device("fri1459", map), kid); device("fri1459", map).paid(kid, "1"); }
  noDollar(map);
  const code = KD.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const rj = code.slice(code.indexOf("function resetJarCycle("), code.indexOf("function personalGoalView("));
  assert.ok(!rj.includes("$"), "resetJarCycle code has no '$'");
  /* the P1 lines only: the item-4 "DAYPKG1 kid guard" lines keep the Dad-page money text in their non-kid branch on purpose
     (behaviour-tested in daypkg1p4.test.mjs: kid branch has no '$', dash or arrow) */
  for (const l of KD.split("\n").filter((x) => /DAYPKG1/.test(x) && !/DAYPKG1 kid guard/.test(x))) { assert.ok(!l.includes("$"), l); assert.ok(!/[\u2014\u2192\u2190\u2191\u2193]/.test(l), l); }
});
