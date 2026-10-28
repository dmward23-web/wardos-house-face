/* HAYESJAR1C (Atlas 6:54, 6:57, 4:58) · QA_NO_BROWSER=1 TZ=America/Chicago scripts/qa/run-tests.sh
   (1) fix A (unchanged from HAYESJAR1): the board (kid-world readQuests) only folds a chore into a "X + ..." chore of the SAME
       cadence, so Hayes's daily backpack is drawn again next to the weekly "Backpack + sports bag" chore.
   (2) HAYESJAR1C static code lock, no per-device record: Hayes's hay-backpack on Sat 10-24, Sun 10-25, Mon 10-26 and Tue 10-27
       reads done on every device (jar-met) and a tap on it is a true no-op (no write, no class change, nothing queued or sent by
       the real house-tapsync.js), from the chore week that starts Fri 2026-10-23 until Mon 2026-11-02 00:00 CT (HAYESJAR1D,
       Atlas 5:17: past the Fri 10-30 15:00 settle, a local CT date rule across the Sun 11-01 DST change). Wed 10-28 on, the new
       week 10-30, and every other kid, chore, day and week, behave as before. The HAYESJAR1/1B one-time write credit and lock
       record are gone.
   Every test runs the REAL kids-data.js (plus the real house-tapsync.js and house-checkoffs.js for the device tests) in a vm with
   a faked Chicago clock. Week shapes live in fixtures/hayesjar1-board.json (fix A) and fixtures/hayesjar1c-week.json (1C). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FX = JSON.parse(rd("scripts/qa/fixtures/hayesjar1-board.json"));
const DATA = FX.data, W = FX.week, C = FX.clock;
const KIDS = ["hayes", "harris", "ainsley"];
const KW = rd("kid-world.js"), KD = rd("kids-data.js"), KL = rd("art/kid-layout.js");

/* ---------- (1) board counts through the real readQuests source ---------- */
const FIX_A = "o.cadence === q.cadence && ";
function slice(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, a); return src.slice(i, j); }
const RQ = slice(KW, "  function readQuests(", "  function placeQuests(");
const SL = slice(KL, "  function shortLabel(", "\n  }\n") + "\n  }\n";
function rowsFor(kid, doneIds, data = DATA, taps = W.taps) {
  return data.kids[kid].quests.map((q) => {
    const cad = q.cadence || "daily", attrs = { "data-kid-quest": kid, "data-cadence": cad };
    if (q.optional || cad === "addon") attrs["data-optional"] = "1";
    if (cad !== "daily") attrs["data-check"] = q.id;
    const btnOf = (iso) => ({ id: q.id, classList: { contains: (c) => c === "done" && doneIds.has(q.id + "@" + iso) } });
    return {
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      matches: (s) => s === "[data-check]" && "data-check" in attrs,
      querySelector: (s) => {
        if (s === ".what") return { textContent: q.what };
        const m = /^\.day-tap\[data-day-iso="([^"]+)"\]$/.exec(s);
        if (m) return cad === "daily" && taps.includes(m[1]) ? btnOf(m[1]) : null;
        return null;
      },
      id: q.id, classList: { contains: () => false },   /* weekly rows are their own tap target */
    };
  });
}
/* readQuests returns {label, done, btn, cadence}: map to the chore id through btn */
function boardIds(src, kid, iso, data, taps) {
  const doc = { rows: rowsFor(kid, new Set(), data, taps), querySelectorAll() { return this.rows; } };
  const ctx = vm.createContext({ document: doc });
  const fn = vm.runInContext("(function(){ " + SL + src + " return readQuests; })()", ctx);
  return Array.from(fn(iso), (q) => q.btn.id);
}

test("fix A is in kid-world.js exactly as Alfred wrote it (cadence carried on the row, same-cadence fold only)", () => {
  assert.equal((RQ.match(/cadence: cadence \}\);/g) || []).length, 1);
  assert.equal(RQ.split(FIX_A).length - 1, 1);
});

test("board counts, 3 kids x 7 days: unchanged except Hayes's daily backpack, which comes back every day", () => {
  const OLD = RQ.replace(FIX_A, "");
  const table = {};
  for (const kid of KIDS) for (const iso of W.taps) {
    const before = boardIds(OLD, kid, iso), after = boardIds(RQ, kid, iso);
    const added = after.filter((x) => !before.includes(x)), dropped = before.filter((x) => !after.includes(x));
    assert.deepEqual(dropped, [], kid + " " + iso + " lost a chore");
    if (kid === "hayes") assert.deepEqual(added, ["hay-backpack"], iso);
    else assert.deepEqual(added, [], kid + " " + iso);
    table[kid + "@" + iso] = before.length + "->" + after.length;
  }
  const want = { hayes: "5->6", harris: "5->5", ainsley: "4->4" };
  for (const kid of KIDS) for (const iso of W.taps) assert.equal(table[kid + "@" + iso], want[kid], kid + " " + iso);
});

test("LAW8C1 still folds a same-cadence combined chore (only the cross-cadence fold is gone)", () => {
  const save = DATA.kids.harris.quests;
  DATA.kids.harris.quests = [{ id: "x-a", what: "Dishes · daily", cadence: "daily" }, { id: "x-b", what: "Dishes + counters · daily", cadence: "daily" },
    { id: "x-c", what: "Room · weekly", cadence: "weekly" }, { id: "x-d", what: "Room + closet · weekly", cadence: "weekly" }];
  try { assert.deepEqual(boardIds(RQ, "harris", W.taps[0]), ["x-b", "x-d"]); } finally { DATA.kids.harris.quests = save; }
});


/* ---------- (2) HAYESJAR1C on the real code: kids-data.js + house-tapsync.js + house-checkoffs.js in one vm ---------- */
const FX2 = JSON.parse(rd("scripts/qa/fixtures/hayesjar1c-week.json"));
const D2 = FX2.data, W2 = FX2.week, K = FX2.clock;
const TS = rd("house-tapsync.js"), HC = rd("house-checkoffs.js");
const keyOf = (kid, iso) => "house-checkoffs:" + kid + ":" + iso;
const LOCKED = W2.locked, OPEN = W2.taps.filter((d) => !LOCKED.includes(d));
const IN_WEEK = ["sat0700", "sun2200", "mon0700", "tue0700", "tue2330", "wed0001", "wed0700", "thu0700", "fri0700", "fri1459"];
/* HAYESJAR1D: after the week change the lock still holds (STILL) until Mon 11-02 00:00 CT; AFTER = lock gone */
const STILL = ["fri1500", "fri1600", "sat31", "nov1_0130cdt", "nov1_0130cst", "nov1_1200", "nov1_2359cst"];
const AFTER = ["nov2_0000cst", "nov2_0700", "nov6_0700", "nov6_1600"];
const LOCK_ON = IN_WEEK.concat(STILL);
const NEXT = ["2026-10-31", "2026-11-01"];   /* the new week's Sat and Sun, never locked */
const SYNC_INIT = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" };   /* a paired screen; seed already sent */

class FakeEl {
  constructor(attrs, classes) {
    this.attrs = Object.assign({}, attrs); this.cls = new Set(classes || []); this.L = []; this.muts = [];
    const me = this;
    this.classList = {
      contains: (c) => me.cls.has(c),
      add: (...cs) => cs.forEach((c) => { if (!me.cls.has(c)) me.muts.push("+" + c); me.cls.add(c); }),
      remove: (...cs) => cs.forEach((c) => { if (me.cls.has(c)) me.muts.push("-" + c); me.cls.delete(c); }),
      toggle: (c, f) => { const on = f === undefined ? !me.cls.has(c) : !!f; if (on !== me.cls.has(c)) me.muts.push((on ? "+" : "-") + c); if (on) me.cls.add(c); else me.cls.delete(c); return on; },
    };
    this.style = {};
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { if (this.attrs[k] !== String(v)) this.muts.push("@" + k + "=" + v); this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { this.L.push({ t, fn }); }
  closest(sel) {
    for (const s of sel.split(",").map((x) => x.trim())) {
      const a = /^\[([a-z-]+)\]$/.exec(s); if (a && a[1] in this.attrs) return this;
      const c = /^\.([a-z-]+)$/.exec(s); if (c && this.cls.has(c[1])) return this;
    }
    return null;
  }
  querySelector() { return null; } querySelectorAll() { return []; } appendChild() {} remove() {}
  get offsetWidth() { return 0; }
}

/* one screen: storage map, real tapsync (wraps setItem, queues, sends), real kids-data, optionally the real house-checkoffs */
function device(clockName, init, opts = {}) {
  const fixed = Date.parse(K[clockName]); assert.ok(!isNaN(fixed), clockName);
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  const map = init || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const storage = { getItem: (k) => (has(k) ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; },
    key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const docL = [], fetches = [], events = [], els = opts.els || [];
  const page = opts.page || "sheet-chores";
  const document = {
    readyState: "loading", visibilityState: "visible",
    addEventListener(t, fn, cap) { docL.push({ t, fn, cap: cap === true }); }, removeEventListener() {},
    dispatchEvent(e) { events.push(e); return true; },
    querySelector: () => null, querySelectorAll: (s) => (s === "[data-check]" ? els.filter((e) => "data-check" in e.attrs) : []),
    getElementById: () => null, createElement: () => new FakeEl({}), documentElement: new FakeEl({}), body: new FakeEl({}),
  };
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {} }, document,
    location: { search: "", hash: "", pathname: "/" + page + ".html", href: "https://house.test/" + page + ".html", reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {},
    fetch: (url, o) => { fetches.push({ url, method: o && o.method, body: o && o.body }); return new Promise(() => {}); },
    HouseHub: { lights: () => "https://hub.test", okForKey: () => true },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(TS, ctx, { filename: "house-tapsync.js" });          /* pages load tapsync BEFORE kids-data */
  vm.runInContext(KD, ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = opts.data || D2;
  if (opts.checkoffs) vm.runInContext(HC, ctx, { filename: "house-checkoffs.js" });
  const dev = { ctx, wk: ctx.WardKids, map, fetches, events, docL, els };
  dev.snap = () => JSON.stringify(Object.keys(map).sort().map((k) => [k, map[k]]));
  dev.queue = () => JSON.parse(map["house-tapsync:queue"] || "[]");
  dev.sent = async () => { ctx.HouseTapSync.push(); for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    return fetches.filter((f) => f.body).flatMap((f) => JSON.parse(f.body).changes || []); };
  dev.boot = () => { ctx.WardKids.syncBankFromChecks(ctx.WardKids._data); if (opts.checkoffs) ctx.HouseCheckoffs.rewire(); };
  return dev;
}
function dispatch(dev, el, type, key) {
  const ev = { type, key, target: el, stopped: false, prevented: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; } };
  for (const l of dev.docL.filter((x) => x.cap && x.t === type)) { l.fn.call(dev.ctx.document, ev); if (ev.stopped) return ev; }
  for (const l of el.L.filter((x) => x.t === type)) { l.fn.call(el, ev); if (ev.stopped) return ev; }
  for (const l of dev.docL.filter((x) => !x.cap && x.t === type)) l.fn.call(dev.ctx.document, ev);
  return ev;
}
const dayTaps = (id, days) => days.map((iso) => new FakeEl({ "data-check": id, "data-day-iso": iso, "data-cadence": "daily" }, ["day-tap"]));
const bpBtns = () => dayTaps("hay-backpack", W2.taps);
const btn = (els, iso) => els.find((e) => e.attrs["data-day-iso"] === iso);
const unchecks = (list, id) => list.filter((c) => c.id === id && c.v === false);

/* tap every must of a kid for the whole week through setCheck (what every surface calls); returns the bank view */
function playWeek(dev, kid, skip = () => false, taps = W2.taps) {
  for (const q of dev.wk.mustQuests(kid, D2)) {
    if ((q.cadence || "daily") === "daily") { for (const iso of taps) if (!skip(q.id, iso)) dev.wk.setCheck(q.id, true, D2, iso); }
    else if (!skip(q.id, null)) dev.wk.setCheck(q.id, true, D2);
  }
  return dev.wk.getBankView(kid, D2);
}
const noDollar = (dev) => { for (const k of Object.keys(dev.map)) assert.ok(!(k + dev.map[k]).includes("$"), "dollar in " + k); };

test("1C/1D: the fixture clock lands where the lock is keyed (week 2026-10-23, Sat..Fri taps, Fri 15:00 new week, DST day 11-01, lock ends 11-02 00:00 CT)", () => {
  for (const c of IN_WEEK) { const wk = device(c, {}).wk; assert.equal(wk.weekStartIso(wk.DAY_ISO), W2.id, c); assert.deepEqual(Array.from(wk.weekDayIsos(wk.DAY_ISO)), W2.taps, c); }
  for (const c of STILL.concat(AFTER)) { const wk = device(c, {}).wk; assert.notEqual(wk.weekStartIso(wk.DAY_ISO), W2.id, c); }
  for (const c of STILL) { const wk = device(c, {}).wk; assert.equal(wk.weekStartIso(wk.DAY_ISO), "2026-10-30", c + " is in the new week"); }
  assert.equal(device("nov1_2359cst", {}).wk.DAY_ISO, "2026-11-01", "23:59 CST is still Sun 11-01");
  assert.equal(device("nov2_0000cst", {}).wk.DAY_ISO, "2026-11-02", "00:00 CST is Mon 11-02");
  assert.equal(device("tue0700", {}).wk.HAYESJAR1_UNTIL, "2026-11-02", "the rule is a local CT date, not a ms offset");
  assert.equal(device("nov1_0130cdt", {}).wk.DAY_ISO, "2026-11-01"); assert.equal(device("nov1_0130cst", {}).wk.DAY_ISO, "2026-11-01");
  assert.equal(device("tue2330", {}).wk.DAY_ISO, "2026-10-27"); assert.equal(device("wed0001", {}).wk.DAY_ISO, "2026-10-28");
  assert.deepEqual(Array.from(device("tue0700", {}).wk.HAYESJAR1_DAYS), LOCKED, "Sat 10-24 .. Tue 10-27 (Atlas 4:58)");
});

test("1C/1D exact scope: locked only for hay-backpack on Sat..Tue from that week until 11-02 00:00 CT; never Wed..Fri, the new week, other chores, other kids", () => {
  for (const c of LOCK_ON) {
    const wk = device(c, {}).wk;
    for (const iso of LOCKED) assert.equal(wk.hayesJar1Locked("hay-backpack", iso), true, c + " " + iso);
    for (const iso of OPEN.concat(["2026-10-21", "2026-10-23", "2026-11-02"], NEXT)) assert.equal(wk.hayesJar1Locked("hay-backpack", iso), false, c + " " + iso);
    for (const kid of KIDS) for (const q of wk.mustQuests(kid, D2)) if (q.id !== "hay-backpack")
      for (const iso of W2.taps) assert.equal(wk.hayesJar1Locked(q.id, iso), false, c + " " + q.id + " " + iso);
    assert.equal(wk.hayesJar1Locked("hay-backpack"), LOCKED.includes(wk.DAY_ISO), c + " no-iso path = today");
  }
  for (const c of AFTER.concat(["priorWed"])) {
    const wk = device(c, {}).wk;
    for (const iso of W2.taps.concat(NEXT)) assert.equal(wk.hayesJar1Locked("hay-backpack", iso), false, c + " " + iso);
    assert.equal(wk.hayesJar1Locked("hay-backpack"), false, c);
  }
});

test("1C/1D sheet-chores-only device: a tap on each locked day is a true no-op (no write, no class change, nothing queued or sent) in the week and after it until 11-01 23:59; Wed..Fri and the new week's 10-31, 11-01 still toggle and undo", async () => {
  for (const c of LOCK_ON) {
    for (const seed of ["empty", "stored-true", "stored-false"]) {
      const init = Object.assign({}, SYNC_INIT);
      if (seed !== "empty") for (const iso of LOCKED) init[keyOf("hayes", iso)] = JSON.stringify({ "hay-backpack": seed === "stored-true" });
      const els = bpBtns(), dev = device(c, init, { checkoffs: true, els });
      dev.boot();
      for (const iso of LOCKED) assert.ok(btn(els, iso).cls.has("done"), c + " " + seed + " " + iso + " shows done");
      const before = dev.snap(), evN = dev.events.length;
      for (const iso of LOCKED) {
        const el = btn(els, iso); el.muts.length = 0;
        for (const [t, k] of [["click"], ["keydown", "Enter"], ["keydown", " "], ["click"]]) {
          const ev = dispatch(dev, el, t, k);
          assert.ok(ev.prevented && ev.stopped, c + " " + iso + " " + t + " stopped in capture");
        }
        assert.deepEqual(el.muts, [], c + " " + seed + " " + iso + " no flicker");
        assert.ok(el.cls.has("done"));
        /* the surfaces that call setCheck directly (claim tiles, board undo path) are no-ops too */
        dev.wk.setCheck("hay-backpack", false, D2, iso); dev.wk.setCheck("hay-backpack", true, D2, iso);
      }
      assert.equal(dev.snap(), before, c + " " + seed + " storage byte-identical");
      assert.equal(dev.events.length, evN, "no house:earn / goal-hit event");
      assert.ok(!("house-tapsync:queue" in dev.map), c + " " + seed + " nothing queued");
      assert.deepEqual(unchecks(await dev.sent(), "hay-backpack"), [], c + " " + seed + " no uncheck sent");
      noDollar(dev);
    }
  }
  /* control: the same stub sees a real tap and a real undo on an open day */
  for (const c of ["wed0700", "thu0700", "fri1459", "sat31", "nov1_0130cst", "nov1_2359cst"]) {
    const els = dayTaps("hay-backpack", W2.taps.concat(NEXT)), dev = device(c, Object.assign({}, SYNC_INIT), { checkoffs: true, els });
    dev.boot();
    const el = btn(els, dev.wk.DAY_ISO);
    dispatch(dev, el, "click"); assert.ok(el.cls.has("done")); assert.equal(dev.wk.getCheck("hay-backpack", D2, dev.wk.DAY_ISO), true);
    el.__lastToggle = 0;
    dispatch(dev, el, "click"); assert.ok(!el.cls.has("done")); assert.equal(dev.wk.getCheck("hay-backpack", D2, dev.wk.DAY_ISO), false, c + " undo works");
    assert.deepEqual(dev.queue().map((q) => [q.key, q.id, q.v]), [[keyOf("hayes", dev.wk.DAY_ISO), "hay-backpack", true], [keyOf("hayes", dev.wk.DAY_ISO), "hay-backpack", false]]);
    assert.equal(unchecks(await dev.sent(), "hay-backpack").length, 1, c + " the stub does see an uncheck");
  }
});

test("1C guard covers every tap surface: data-check, claim tiles and the hub claim (no day = today); Tab and other chores pass", () => {
  const claimEls = () => [new FakeEl({ "data-claim": "hay-backpack" }), new FakeEl({ "data-hq-claim": "hay-backpack" })];
  for (const c of ["sat0700", "mon0700", "tue0700", "tue2330"]) {
    const dev = device(c, {});
    for (const el of claimEls()) {
      let ran = 0; el.addEventListener("click", () => { ran++; });
      const ev = dispatch(dev, el, "click"); assert.ok(ev.stopped && ev.prevented, c + " " + JSON.stringify(el.attrs)); assert.equal(ran, 0);
    }
    const tab = dispatch(dev, btn(bpBtns(), LOCKED[0]), "keydown", "Tab"); assert.equal(tab.stopped, false);
  }
  for (const c of ["wed0001", "wed0700", "fri1459", "fri1500", "fri1600", "sat31", "nov1_2359cst", "nov2_0000cst", "nov2_0700"]) {
    const dev = device(c, {});
    for (const el of claimEls()) { let ran = 0; el.addEventListener("click", () => { ran++; }); dispatch(dev, el, "click"); assert.equal(ran, 1, c + " today is not locked"); }
  }
  /* an old locked day tile still on screen after the week change: stopped until 11-01 23:59, free from 11-02 00:00 CT */
  for (const c of ["fri1600", "sat31", "nov1_0130cdt", "nov1_0130cst", "nov1_2359cst"]) for (const iso of LOCKED) {
    const ev = dispatch(device(c, {}), btn(bpBtns(), iso), "click"); assert.ok(ev.stopped && ev.prevented, c + " " + iso);
  }
  for (const c of AFTER) for (const iso of LOCKED) {
    const el = btn(bpBtns(), iso); let ran = 0; el.addEventListener("click", () => { ran++; });
    const ev = dispatch(device(c, {}), el, "click"); assert.equal(ev.prevented, false, c + " " + iso); assert.equal(ran, 1);
  }
  const dev = device("mon0700", {});
  for (const el of [...dayTaps("hay-bed", LOCKED), ...dayTaps("har-backpack", LOCKED), ...dayTaps("ain-bed", LOCKED), ...dayTaps("hay-backpack", OPEN)]) {
    let ran = 0; el.addEventListener("click", () => { ran++; }); const ev = dispatch(dev, el, "click");
    assert.equal(ev.prevented, false, JSON.stringify(el.attrs)); assert.equal(ran, 1);
  }
});

test("1D expiry: Mon 11-02 00:00 CST, 07:00, Fri 11-06 (and a prior week): nothing locked, nothing read as done, taps toggle", async () => {
  for (const c of AFTER.concat(["priorWed"])) {
    const dev = device(c, Object.assign({}, SYNC_INIT));
    for (const iso of LOCKED.concat([dev.wk.DAY_ISO])) {
      assert.equal(dev.wk.hayesJar1Locked("hay-backpack", iso), false, c + " " + iso);
      assert.equal(dev.wk.getCheck("hay-backpack", D2, iso), false, c + " " + iso + " empty storage reads not done");
    }
    for (const iso of dev.wk.weekDayIsos(dev.wk.DAY_ISO)) assert.equal(dev.wk.getCheck("hay-backpack", D2, iso), false, c + " " + iso);
    dev.wk.setCheck("hay-backpack", true, D2); assert.equal(dev.wk.getCheck("hay-backpack", D2), true, c);
    dev.wk.setCheck("hay-backpack", false, D2); assert.equal(dev.wk.getCheck("hay-backpack", D2), false, c + " undo");
    assert.equal(unchecks(await dev.sent(), "hay-backpack").length, 1, c);
  }
  /* edges: the week change does NOT end the lock; the 11-01 23:59 CST -> 11-02 00:00 CST minute does */
  for (const c of ["fri1459", "fri1500", "fri1600", "nov1_2359cst"]) assert.equal(device(c, {}).wk.getCheck("hay-backpack", D2, LOCKED[0]), true, c);
  assert.equal(device("nov2_0000cst", {}).wk.getCheck("hay-backpack", D2, LOCKED[0]), false, "11-02 00:00 CST");
});

test("1D still locked and met after the week change: Fri 10-30 15:00 and 16:00, Sat 10-31, Sun 11-01 01:30 CDT, 01:30 CST, 12:00 and 23:59 CST; the new week's backpack is unaffected", async () => {
  for (const c of STILL) {
    for (const seed of ["empty", "stored-false"]) {
      const init = Object.assign({}, SYNC_INIT);
      if (seed !== "empty") for (const iso of LOCKED) init[keyOf("hayes", iso)] = JSON.stringify({ "hay-backpack": false });
      const dev = device(c, init); dev.boot();
      for (const iso of LOCKED) {
        assert.equal(dev.wk.hayesJar1Locked("hay-backpack", iso), true, c + " " + iso);
        assert.equal(dev.wk.getCheck("hay-backpack", D2, iso), true, c + " " + seed + " " + iso + " still met");
      }
      const before = dev.snap();
      for (const iso of LOCKED) { dev.wk.setCheck("hay-backpack", false, D2, iso); dev.wk.setCheck("hay-backpack", true, D2, iso); }
      assert.equal(dev.snap(), before, c + " " + seed + " still a true no-op");
      assert.deepEqual(unchecks(await dev.sent(), "hay-backpack"), [], c + " no uncheck sent");
      /* the new week is untouched by the lock: nothing pre-done, the backpack counts 0 of 7 on an empty screen */
      const days = Array.from(dev.wk.weekDayIsos(dev.wk.DAY_ISO));
      assert.deepEqual(days.slice(0, 2), NEXT, c);
      for (const iso of days) assert.equal(dev.wk.getCheck("hay-backpack", D2, iso), false, c + " " + iso + " new week not pre-done");
      assert.equal(dev.wk.dailyDoneCount("hay-backpack", D2), 0, c + " new week count");
    }
    /* today's backpack in the new week taps and undoes normally (10-31 / 11-01 are never locked) */
    if (NEXT.includes(device(c, {}).wk.DAY_ISO)) {
      const dev = device(c, Object.assign({}, SYNC_INIT));
      dev.wk.setCheck("hay-backpack", true, D2); assert.equal(dev.wk.getCheck("hay-backpack", D2), true, c);
      assert.equal(dev.wk.dailyDoneCount("hay-backpack", D2), 1, c);
      dev.wk.setCheck("hay-backpack", false, D2); assert.equal(dev.wk.getCheck("hay-backpack", D2), false, c + " undo");
      assert.deepEqual(dev.queue().map((q) => [q.key, q.v]), [[keyOf("hayes", dev.wk.DAY_ISO), true], [keyOf("hayes", dev.wk.DAY_ISO), false]], c);
      assert.equal(unchecks(await dev.sent(), "hay-backpack").length, 1, c);
    }
  }
});

test("1C empty-storage device first opened Tue (and Sat, Mon, Wed): locked days read met, nothing written, jar unblocked; full board week = 53, jar 52/52", () => {
  for (const c of ["sat0700", "mon0700", "tue0700", "wed0700"]) {
    const map = Object.assign({}, SYNC_INIT);
    const first = device(c, map, { page: "kid-hayes" });
    first.boot();
    for (const iso of LOCKED) assert.equal(first.wk.getCheck("hay-backpack", D2, iso), true, c + " " + iso);
    for (const iso of OPEN) assert.equal(first.wk.getCheck("hay-backpack", D2, iso), false, c + " " + iso);
    assert.equal(first.wk.dailyDoneCount("hay-backpack", D2), 4, c);
    assert.deepEqual(Object.keys(map).filter((k) => k.startsWith("house-checkoffs:")), [], c + " boot wrote no tap key");
    assert.ok(!("house-tapsync:queue" in map), c);
    /* the rest of the week on this same screen, ending Fri morning */
    const v = playWeek(device("fri0700", map, { page: "kid-hayes" }), "hayes");
    assert.equal(v.mustComplete, true, c); assert.equal(v.week, 53, c); assert.equal(v.toward, 52); assert.equal(v.need, 52); assert.equal(v.reached, true);
    for (const iso of LOCKED) assert.ok(!JSON.parse(map[keyOf("hayes", iso)] || "{}")["hay-backpack"], c + " " + iso + " met by the read, not by a write");
    const q = JSON.parse(map["house-tapsync:queue"] || "[]");
    assert.deepEqual(q.filter((x) => x.id === "hay-backpack" && LOCKED.some((d) => x.key === keyOf("hayes", d))), [], "no locked-day change queued");
  }
  /* control: the same storage seen after the lock ends counts the backpack as 3 of 7 (the jar rule really needs the read) */
  const map = Object.assign({}, SYNC_INIT); playWeek(device("fri0700", map), "hayes");
  const fx = device("fri0700", map); assert.equal(fx.wk.dailyDoneCount("hay-backpack", D2), 7);
  const stored = W2.taps.filter((d) => JSON.parse(map[keyOf("hayes", d)] || "{}")["hay-backpack"] === true);
  assert.deepEqual(stored, OPEN);
});

test("1C no double count: stored taps on the locked days (true, false, hub-arrived) and leftover 1/1B flag and lock keys still give exactly 53 / 52, untouched", () => {
  const leftovers = { "house-migrate:hayesjar1:hayes:2026-10-23": "1", "house-hayesjar1-lock:hayes:2026-10-23": JSON.stringify({ "hay-backpack": LOCKED.slice(0, 3) }) };
  for (const seed of [true, false, "leftover"]) {
    const map = Object.assign({}, SYNC_INIT, seed === "leftover" ? leftovers : {});
    for (const iso of LOCKED) map[keyOf("hayes", iso)] = JSON.stringify({ "hay-backpack": seed !== false, "hay-bed": true });
    const keep = LOCKED.map((d) => map[keyOf("hayes", d)]);
    const dev = device("thu0700", map); dev.boot();
    const v = playWeek(dev, "hayes");
    assert.equal(v.week, 53, String(seed)); assert.equal(v.toward, 52); assert.equal(v.reached, true);
    const again = device("fri0700", map); again.boot(); const v2 = again.wk.getBankView("hayes", D2);
    assert.equal(v2.week, 53, "reboot does not re-add"); assert.equal(v2.lifetime, v.lifetime, "lifetime credited once");
    assert.deepEqual(LOCKED.map((d) => JSON.parse(map[keyOf("hayes", d)])["hay-backpack"]), keep.map((s) => JSON.parse(s)["hay-backpack"]), "locked-day bytes kept");
    if (seed === "leftover") for (const k of Object.keys(leftovers)) assert.equal(map[k], leftovers[k], k + " left alone, never read");
    noDollar(again);
  }
});

test("1D one settle: the full week settles once into the balance at Fri 15:00 (52); the lock still on after it never re-counts, re-settles or leaks into week 10-30; 11-02 changes nothing", () => {
  const map = Object.assign({}, SYNC_INIT);
  /* DAYPKG1 v2f D2 · sheet-chores is kid-reachable (kid scope, no ledger): the settle is read on the Dad ledger sheet */
  const DADLEDGER = { page: "sheet-allowance" };
  const v = playWeek(device("fri1459", map, DADLEDGER), "hayes"); assert.equal(v.week, 53); assert.equal(v.toward, 52);
  const life = v.lifetime;
  for (const c of STILL.concat(["nov2_0000cst", "nov2_0700"])) {
    for (let boot = 0; boot < 2; boot++) {
      const dev = device(c, map, DADLEDGER); dev.boot();
      const b = dev.wk.getBankView("hayes", D2);
      assert.equal(b.balance, 52, c + " settled once (boot " + boot + ")"); assert.equal(b.week, 0, c + " new week starts empty");
      assert.equal(b.toward, 0, c); assert.equal(b.lifetime, life, c + " no top-up");
      const on = STILL.includes(c);
      for (const iso of LOCKED) assert.equal(dev.wk.getCheck("hay-backpack", D2, iso), on, c + " old locked day " + (on ? "still met" : "reads storage again"));
      assert.equal(dev.wk.dailyDoneCount("hay-backpack", D2), 0, c + " no leak into the new week count");
    }
  }
  /* the new week 10-30 plays out on the same screen: its own 53 / 52, the old week is not paid again */
  const NW = Array.from(device("sat31", {}).wk.weekDayIsos("2026-10-31"));
  assert.equal(NW[0], "2026-10-31"); assert.equal(NW[6], "2026-11-06");
  const nv = playWeek(device("nov6_0700", map, DADLEDGER), "hayes", () => false, NW);
  assert.equal(nv.week, 53, "new week counts its own taps only"); assert.equal(nv.toward, 52); assert.equal(nv.balance, 52, "old week paid once");
  const after = device("nov6_1600", map, DADLEDGER); after.boot();
  assert.equal(after.wk.getBankView("hayes", D2).balance, 104, "week 10-30 settles once on top; week 10-23 not re-settled");
  /* missing the new week's Sat 10-31 backpack still gates that week (the old lock does not cover it) */
  const gv = playWeek(device("nov6_0700", {}), "hayes", (id, d) => id === "hay-backpack" && d === NW[0], NW);
  assert.equal(gv.mustComplete, false, "10-31 backpack is a real chore"); assert.equal(gv.week, 0);
  assert.deepEqual(Object.keys(map).filter((k) => /hayesjar1/i.test(k)), [], "no lock record or flag ever written");
  noDollar(device("nov2_0700", map, DADLEDGER));
});

test("1C Harris and Ainsley are unaffected: same counts, their own backpack and every chore still gate, Hayes's other chores still gate", () => {
  for (const [kid, week, need] of [["harris", 53, 52], ["ainsley", 38, 38]]) {
    const map = Object.assign({}, SYNC_INIT);
    const v = playWeek(device("fri0700", map, { page: "kid-" + kid }), kid);
    assert.equal(v.week, week, kid); assert.equal(v.toward, need, kid); assert.equal(v.reached, true, kid);
    const q = device("fri0700", {}).wk.mustQuests(kid, D2).find((x) => (x.cadence || "daily") === "daily");
    for (const iso of LOCKED) {
      const m2 = {}; const v2 = playWeek(device("fri0700", m2), kid, (id, d) => id === q.id && d === iso);
      assert.equal(v2.mustComplete, false, kid + " missing " + q.id + " " + iso); assert.equal(v2.week, 0);
    }
    assert.ok(!Object.keys(map).some((k) => k.startsWith("house-checkoffs:hayes:")), kid + " page wrote no Hayes key");
  }
  for (const [id, iso] of [["hay-bed", LOCKED[3]], ["hay-backpack", OPEN[0]], ["hay-backpack", OPEN[2]], ["hay-shower", LOCKED[0]]]) {
    const v = playWeek(device("fri0700", {}), "hayes", (q, d) => q === id && d === iso);
    assert.equal(v.mustComplete, false, id + " " + iso + " still gates"); assert.equal(v.week, 0);
  }
  /* a Hayes page booting on an empty screen writes no key for anyone */
  const map = {}; const h = device("tue0700", map, { page: "kid-hayes" }); h.boot();
  assert.deepEqual(Object.keys(map).filter((k) => k.startsWith("house-checkoffs:")), []);
});

test("1C board, 3 kids x 7 days on the 1C week: Hayes 10, Harris 10, Ainsley 8 (backpack and the weekly Backpack + chore both drawn)", () => {
  const want = { hayes: 10, harris: 10, ainsley: 8 };
  for (const kid of KIDS) for (const iso of W2.taps) {
    const ids = boardIds(RQ, kid, iso, D2, W2.taps);
    assert.equal(ids.length, want[kid], kid + " " + iso);
    if (kid === "hayes") { assert.ok(ids.includes("hay-backpack") && ids.includes("hay-cubby"), iso); }
  }
});

test("1C 0 '$': no dollar sign in any key or value after every 1C path above, nor in any 1C code line", () => {
  const map = Object.assign({}, SYNC_INIT);
  const els = bpBtns(); const dev = device("tue0700", map, { checkoffs: true, els }); dev.boot();
  for (const iso of LOCKED) dispatch(dev, btn(els, iso), "click");
  for (const kid of KIDS) playWeek(device("fri0700", map), kid);
  device("fri1500", map).boot(); device("nov1_2359cst", map).boot(); device("nov2_0000cst", map).boot(); device("nov2_0700", map).boot();
  noDollar(device("nov2_0700", map));
  const block = slice(KD, "  /* HAYESJAR1C (Atlas", "  function boot(");
  const lines = KD.split("\n").concat(HC.split("\n")).filter((l) => /HAYESJAR1C|HAYESJAR1D|hayesJar1Locked/.test(l));
  for (const l of [block, ...lines]) { assert.ok(!l.includes("$"), l.slice(0, 80)); assert.ok(!/[\u2014\u2192\u2190\u2191\u2193]/.test(l), "no em dash or arrow"); }
  const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"); /* comments may name the removed keys; code may not */
  for (const src of [KD, HC]) assert.ok(!/hayesJar1Credit|house-hayesjar1-lock|house-migrate:hayesjar1/.test(code(src)), "the 1/1B write credit and lock record are gone");
});

test("1D cache tokens: kids-data.js and house-checkoffs.js at ?v=HAYESJAR1D on every page that loads them; kid-world.js stays ?v=HAYESJAR1", () => {
  const want = { "kids-data": "DAYPKG1", "house-checkoffs": "DAYPKG1", "kid-world": "HAYESJAR1" }; /* DAYPKG1 re-bumped kids-data.js + house-checkoffs.js (token only) */
  const n = { "kids-data": 0, "house-checkoffs": 0, "kid-world": 0 };
  for (const p of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
    for (const m of rd(p).matchAll(/(kids-data|house-checkoffs|kid-world)\.js\?v=([A-Za-z0-9_-]+)/g)) { n[m[1]]++; assert.equal(m[2], want[m[1]], p + " " + m[1]); }
  }
  assert.ok(n["kids-data"] >= 8 && n["house-checkoffs"] >= 7 && n["kid-world"] >= 3, JSON.stringify(n));
});
