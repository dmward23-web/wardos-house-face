/* DAYPKG1 v2f · QA_NO_BROWSER=1 TZ=America/Chicago, static (node + vm only, no browser).
   Alfred FAILED v2e (bb5702ab). v2f fixes, each mapped to tests below:
   D1 (P1) getPaidStamp left a '$' stamp when it was expired or a synced stamp existed: the scrub now runs first, and on every
      kids-data.js boot for all 3 kids.
   D2 (P1) mercury-run.html?kid= is opened from a kid board but missed the kid guard: KID_PAGE_RE now covers mercury-run, and
      the kid-reachable pages that load kids-data.js (sheet-chores, sheet-index) are kid scope for storage (no ledger).
   D3 Atlas final ruling (Oct 28 1:47 AM CT), option B with the guards in code: from LEDGER_PURGE_FROM (Nov 6 2026 00:00 CT)
      a kid device purges dad-ledger:v1 (and :legacy: side keys) only with no dad-device marker AND a live, fresh private feed
      saying ledger.serverLive === true and ledger.carryHeld === true. Fails closed.
   D4 (P3) a legacy stamp with no paid-at gets paid-at = now when first seen, so it expires.
   D5 (P3) 440 px phone: the odd 3rd chip spans the row, centred.
   Residual: the second-device mirror never mirrors a week before its install week (bag.mirrorSince). */
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
const KIDS = ["hayes", "harris", "ainsley"];
const SYNC_INIT = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" };
const D = String.fromCharCode(36);
const LEDGER = "dad-ledger:v1", SIDE = "dad-ledger:v1:legacy:", MARK = "dad-device:v1";
const KID_PATH = { hayes: "/kid-hayes.html", harris: "/kid-harris", ainsley: "/kid-ainsley.html" };
const DAY = 864e5;

/* the v2e harness (storage spy: every get / set / rm in order), plus: a clock by fixture name or ISO, location.search, an
   optional PrivateFeed stub (loaded before kids-data.js, as on the real pages), extra page scripts, and a kids-week fetch */
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
    createElement: el, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    documentElement: { setAttribute() {}, getAttribute: () => null, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {} } };
  const pfCalls = [];
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams, Promise,
    console: { log() {}, warn() {}, error() {}, info: (...a) => { info.push(a.join(" ")); } },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
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

/* ---------- D1 ---------- */
test("DAYPKG1 v2f D1: a 20-day-old '$' stamp (Hayes 'Paid $12 · $3 carry') is scrubbed on boot for all 3 kids, on every page; 0 '$' in kid storage", () => {
  for (const pathname of [KID_PATH.hayes, KID_PATH.harris, KID_PATH.ainsley, "/kid-hayes", "/mercury-run.html", "/sheet-chores.html", "/sheet-index.html", "/sheet-allowance.html", "/sheet-dan.html"]) {
    const old = new Date(Date.parse(K.fri1459) - 20 * DAY).toISOString();
    const map = Object.assign({}, SYNC_INIT);
    for (const k of KIDS) { map["house-bank-paid:" + k] = "Paid " + D + "12 \u00b7 " + D + "3 carry"; map["house-bank-paid-at:" + k] = old; }
    map["house-bank-paid:harris"] = "Jar reset " + D + "0";
    const dev = device("fri1459", map, { pathname, search: pathname.startsWith("/mercury") ? "?kid=hayes" : "" });
    noDollar(map, pathname + " after boot (before any read)");
    assert.equal(map["house-bank-paid:hayes"], "Paid \u2713", pathname);
    assert.equal(map["house-bank-paid:harris"], "Jar reset \u2713", pathname);
    assert.equal(map["house-bank-paid-at:hayes"], old, pathname + " a real paid-at is kept (the stamp still expires on time)");
    for (const k of KIDS) assert.equal(dev.wk.getPaidStamp(k), "", pathname + " " + k + " expired stamp hidden");
    noDollar(map, pathname + " after the expired read");
  }
});

test("DAYPKG1 v2f D1: a '$' stamp next to a synced Paid marker is scrubbed too (the synced return no longer skips it)", () => {
  const mapA = Object.assign({}, SYNC_INIT);
  const a = device("fri1459", mapA, { page: "sheet-allowance" });
  for (const k of KIDS) { const v = playWeek(a, k); a.paid(k, String(v.weekEarn)); }
  for (const kid of KIDS) {
    const kmap = Object.assign({}, SYNC_INIT);
    for (const k of Object.keys(mapA)) if (k.startsWith("house-checkoffs:" + kid + ":week:")) kmap[k] = mapA[k];
    const dev = device("fri1600", kmap, { pathname: KID_PATH[kid] });
    kmap["house-bank-paid:" + kid] = "Paid " + D + "12 \u00b7 " + D + "3 carry"; /* lands after boot, e.g. from an old tab */
    assert.equal(dev.wk.getPaidStamp(kid), "Paid \u2713", kid + " synced stamp shown");
    assert.equal(kmap["house-bank-paid:" + kid], "Paid \u2713", kid + " local '$' stamp rewritten on the synced path");
    noDollar(kmap, kid);
  }
});

test("DAYPKG1 v2f D1 + D4: the bare legacy key (a '$' stamp, no paid-at) is rewritten on boot, gets paid-at = now, and expires 14 days later", () => {
  for (const kid of KIDS) {
    const map = Object.assign({}, SYNC_INIT, { ["house-bank-paid:" + kid]: "Paid " + D + "40" });
    const dev = device("fri1459", map, { pathname: KID_PATH[kid] });
    assert.equal(map["house-bank-paid:" + kid], "Paid \u2713", kid);
    assert.equal(map["house-bank-paid-at:" + kid], new Date(dev.fixed).toISOString(), kid + " paid-at = now on rewrite");
    assert.equal(dev.wk.getPaidStamp(kid), "Paid \u2713", kid + " shown now");
    const later = device(new Date(dev.fixed + 13 * DAY).toISOString(), map, { pathname: KID_PATH[kid] });
    assert.equal(later.wk.getPaidStamp(kid), "Paid \u2713", kid + " still shown at 13 days");
    const gone = device(new Date(dev.fixed + 15 * DAY).toISOString(), map, { pathname: KID_PATH[kid] });
    assert.equal(gone.wk.getPaidStamp(kid), "", kid + " expired at 15 days");
    noDollar(map, kid);
    /* a legacy marker-only stamp with no paid-at gets one too (D4: never shown forever) */
    const m2 = Object.assign({}, SYNC_INIT, { ["house-bank-paid:" + kid]: "Jar reset \u2713" });
    const d2 = device("fri1459", m2, { pathname: KID_PATH[kid] });
    assert.equal(m2["house-bank-paid-at:" + kid], new Date(d2.fixed).toISOString(), kid + " marker-only legacy stamp gets paid-at");
  }
});

/* ---------- D2 ---------- */
const MERC_SCRIPTS = { before: ["private-feed.js"], after: ["house-money-bind.js", "house-sfx.js"] };
function dadLedgerMap() {
  const m = Object.assign({}, SYNC_INIT);
  const dad = device("fri1459", m, { page: "sheet-allowance" });
  for (const k of KIDS) playWeek(dad, k);
  device("fri1600", m, { page: "sheet-allowance" }).boot();
  assert.ok(LEDGER in m, "the shared device holds a Dad ledger");
  return m;
}
test("DAYPKG1 v2f D2: KID_PAGE_RE covers mercury-run (with and without .html); kidScope adds sheet-chores and sheet-index; the ledger sheets stay Dad", () => {
  const src = rd("kids-data.js");
  assert.match(src, /var KID_PAGE_RE = \/\\\/\(\?:kid-\[a-z\]\+\|mercury-run\)\(\\\.html\)\?\$\/;/);
  for (const f of ["kids-data.js", "house-nomoney.js", "house-sfx.js", "house-checkoffs.js", "house-money-bind.js"]) {
    assert.ok(!rd(f).includes("/\\/kid-[a-z]+(\\.html)?$/"), f + " has no old kid-only guard left");
  }
  for (const p of ["/kid-hayes", "/kid-harris.html", "/mercury-run.html", "/mercury-run"]) {
    const d = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: p, search: "?kid=hayes" });
    assert.equal(d.wk.kidPage(), true, p); assert.equal(d.wk.kidScope(), true, p);
  }
  for (const p of ["/sheet-chores.html", "/sheet-chores", "/sheet-index.html", "/sheet-index"]) {
    const d = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: p });
    assert.equal(d.wk.kidPage(), false, p + " not a kid board (display)"); assert.equal(d.wk.kidScope(), true, p + " kid scope (storage)");
  }
  for (const p of ["/sheet-allowance.html", "/sheet-allowance", "/sheet-dan.html", "/sheet-dan"]) {
    const d = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: p });
    assert.equal(d.wk.kidScope(), false, p + " Dad ledger sheet");
  }
});

test("DAYPKG1 v2f D2: mercury-run.html?kid= on a shared device with a Dad ledger: 0 get / set / rm of dad-ledger:v1 (spied), 0 '$' written, the board still runs", async () => {
  for (const kid of KIDS) for (const clock of ["fri1459", "sat31", "nov2_0700"]) {
    const map = dadLedgerMap(); const before = map[LEDGER];
    const dev = device(clock, map, Object.assign({ pathname: "/mercury-run.html", search: "?kid=" + kid, feed: true }, MERC_SCRIPTS));
    try { dev.wk.boot(kid); } catch (e) { /* the stub DOM is minimal; storage is what is measured */ }
    await settle();
    playWeek(dev, kid); dev.boot(); dev.view(kid); dev.wk.getPaidStamp(kid);
    assert.deepEqual(ledgerTouch(dev).map((o) => o[0] + " " + o[1]), [], kid + " " + clock + " mercury-run board touched the Dad ledger (Alfred v2e: 22 get / 3 set)");
    try { dev.wk.dadPaid && dev.wk.dadPaid(kid, D2); } catch (e) { /* refuses */ }
    assert.equal(dev.wk.resetJarCycle(kid, "5", D2), "", kid + " no Paid on mercury-run");
    assert.deepEqual(ledgerTouch(dev), [], kid + " " + clock + " mercury-run touched the Dad ledger");
    assert.equal(map[LEDGER], before, kid + " ledger bytes untouched");
    for (const [k, v] of dev.log) assert.ok(!(k + v).includes(D), kid + " '$' written to " + k);
    assert.equal(dev.view(kid).balance || 0, 0, kid + " no stored carry shown");
  }
});

/* every page a kid board (or mercury-run) links to, one hop: hrefs, location assignments, JS-built URLs. Audited for v2f */
const KID_SOURCES = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "kid-world.js", "mercury-run.html", "mercury-run.js", "house-kid-engage.js", "house-hdr-home.js", "hayes-loot.js"];
const KID_REACH = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "mercury-run.html", "index.html", "sheet-index.html", "sheet-chores.html", "sheet-today.html", "sheet-pack.html", "month.html", "sheet-lights.html", "sheet-status.html"];
const LEDGER_SHEETS = ["sheet-allowance.html", "sheet-dan.html"];
const scriptsOf = (html) => [...rd(html).matchAll(/<script[^>]*src="([^"?#]+)/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
test("DAYPKG1 v2f D2 audit: every page linked from a kid board / kid-world.js / mercury-run is in the kid-reach list; none is a ledger sheet", () => {
  for (const f of KID_SOURCES) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    for (const m of rd(f).matchAll(/["'\/=]([a-z0-9-]+\.html)/g)) {
      assert.ok(!LEDGER_SHEETS.includes(m[1]), f + " links a Dad ledger sheet " + m[1]);
      assert.ok(KID_REACH.includes(m[1]), f + " links " + m[1] + ": audit it and add it to the kid-reach list");
    }
  }
  /* house-links.js rules on kid-* pages and the shared footer */
  const hl = rd("house-links.js");
  for (const name of ["CHORES", "TODAY", "MONTH", "LIGHTS", "STATUS", "HOME"]) {
    const m = hl.match(new RegExp("\\b" + name + " = \"([a-z0-9-]+\\.html)\""));
    if (m) assert.ok(KID_REACH.includes(m[1]), "house-links " + name + " = " + m[1]);
  }
});

test("DAYPKG1 v2f D2: each kid-reachable page is kid scope: pages with kids-data.js do 0 dad-ledger ops on a shared device (spied); pages without it carry no ledger code", async () => {
  for (const page of KID_REACH) {
    if (!fs.existsSync(path.join(ROOT, page))) continue;
    const scripts = scriptsOf(page);
    if (scripts.some((s) => /(^|\/)kids-data\.js$/.test(s))) {
      for (const p of ["/" + page, "/" + page.replace(/\.html$/, "")]) {
        const map = dadLedgerMap(); const before = map[LEDGER];
        const dev = device("sat31", map, { pathname: p, search: page.startsWith("mercury") ? "?kid=hayes" : "", feed: true, before: ["private-feed.js"], after: ["house-money-bind.js"] });
        assert.equal(dev.wk.kidScope(), true, p + " is kid scope");
        try { dev.wk.boot(p.includes("kid-") ? p.replace(/.*kid-|\.html/g, "") : "hayes"); } catch (e) { /* minimal DOM */ }
        await settle();
        for (const k of KIDS) { playWeek(dev, k); dev.view(k); dev.wk.getPaidStamp(k); }
        dev.boot();
        assert.deepEqual(ledgerTouch(dev), [], p + " touched the Dad ledger");
        assert.equal(map[LEDGER], before, p);
        for (const [k, v] of dev.log) assert.ok(!(k + v).includes(D), p + " '$' written to " + k);
      }
    } else {
      for (const s of scripts) {
        const f = s.replace(/^\.\//, "");
        if (!fs.existsSync(path.join(ROOT, f))) continue;
        const src = rd(f);
        assert.ok(!src.includes("dad-ledger") && !src.includes("house-bank:v1") && !src.includes("house-bank-paid"), page + " loads " + f + " which names the ledger");
      }
    }
  }
});

/* ---------- D3 ---------- */
const PURGE_AT = Date.parse("2026-11-06T00:00:00-06:00");
test("DAYPKG1 v2f D3: LEDGER_PURGE_FROM is Fri Nov 6 2026 00:00 CT = 2026-11-06T00:00:00-06:00 (CST) = 1793944800000", () => {
  assert.equal(PURGE_AT, 1793944800000);
  assert.equal(new Date(1762408800000).toISOString(), "2025-11-06T06:00:00.000Z", "the epoch quoted in the 1:50 AM steering (1762408800000) is Nov 6 2025, one year early: the code uses the 2026 value");
  assert.equal(PURGE_AT, Date.UTC(2026, 10, 6, 6, 0, 0), "06:00 UTC");
  /* DAYPKG1 v2g (Alfred v2f P3) · TZ pinned in the assertion itself: America/Chicago through Intl, whatever process.env.TZ is */
  const ct = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" }).formatToParts(new Date(PURGE_AT)).map((p) => [p.type, p.value]));
  assert.deepEqual([ct.year, ct.month, ct.day, ct.hour, ct.minute], ["2026", "11", "06", "00", "00"], "midnight America/Chicago");
  assert.equal(ct.timeZoneName, "GMT-06:00", "CST (-06:00), after the Nov 1 change");
  const dev = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: "/kid-hayes" });
  assert.equal(dev.wk.LEDGER_PURGE_FROM, 1793944800000, "the code constant");
  assert.match(rd("kids-data.js"), /var LEDGER_PURGE_FROM = Date\.parse\("2026-11-06T00:00:00-06:00"\);/);
});

const OPAQUE = "opaque:\u0000" + D + "52{not json";
function kidLedgerMap(extra = {}) { return Object.assign({}, SYNC_INIT, { [LEDGER]: OPAQUE, [SIDE + "1761600000000"]: OPAQUE + "2", "house-checkoffs:hayes:day:2026-11-06": "{}" }, extra); }
const goodFeed = (name, now) => Promise.resolve({ status: "live", at: now - 1000, data: { kids: {}, ledger: { serverLive: true, carryHeld: true, asOf: new Date(now - 3600e3).toISOString() } } });
async function runPurge(clock, map, pf, pathname = "/kid-hayes.html") {
  const dev = device(clock, map, { pathname, pf });
  const r = await Promise.resolve(dev.wk.purgeRun());
  await settle();
  return { dev, r };
}
function assertKept(map, dev, tag) {
  assert.equal(map[LEDGER], OPAQUE, tag + " ledger kept"); assert.ok(Object.keys(map).some((k) => k.startsWith(SIDE)), tag + " side key kept");
  assert.deepEqual(ledgerTouch(dev).filter((o) => o[0] !== "rm"), [], tag + " 0 reads"); assert.deepEqual(ledgerTouch(dev), [], tag + " nothing removed");
}
test("DAYPKG1 v2f D3 gate: before Nov 6 00:00 CT there is no purge and no feed call, even with the signal true", async () => {
  for (const clock of ["fri1459", "nov2_0700", "2026-11-05T23:59:59-06:00", "2026-11-06T05:59:59Z"]) {
    const map = kidLedgerMap();
    const { dev, r } = await runPurge(clock, map, goodFeed);
    assert.equal(r, "before", clock); assert.deepEqual(dev.pfCalls, [], clock + " no feed call"); assertKept(map, dev, clock);
  }
});
test("DAYPKG1 v2f D3 gate: after the date with a dad-device marker there is no purge (key checked by name, never read)", async () => {
  for (const clock of ["2026-11-06T00:00:00-06:00", "nov6_0700", "nov6_1600"]) {
    const map = kidLedgerMap({ [MARK]: "2026-10-30T20:00:00.000Z" });
    const { dev, r } = await runPurge(clock, map, goodFeed);
    assert.equal(r, "dad-device", clock); assert.deepEqual(dev.pfCalls, [], clock); assertKept(map, dev, clock);
    assert.ok(!dev.ops.some((o) => o[0] === "get" && o[1] === MARK), clock + " the marker value is never read");
    assert.equal(dev.wk.ledgerPurgeOk({ status: "live", at: dev.fixed, data: { ledger: { serverLive: true, carryHeld: true, asOf: new Date(dev.fixed).toISOString() } } }, dev.fixed), false, clock + " pure gate refuses too");
  }
});
test("DAYPKG1 v2f D3 gate: after the date, no marker, the signal missing / false / not exactly true / errored / stale = no purge (fails closed)", async () => {
  const live = (data, extra = {}) => (name, now) => Promise.resolve(Object.assign({ status: "live", at: now - 1000, data }, extra));
  const asOf = (now) => new Date(now - 3600e3).toISOString();
  const CASES = {
    "no PrivateFeed": null,
    "feed rejects": () => Promise.reject(new Error("HTTP 503")),
    "feed throws": () => { throw new Error("boom"); },
    "offline, no data": (n, now) => Promise.resolve({ status: "offline", at: 0, data: null }),
    "no ledger field": live({ kids: {} }),
    "ledger null": live({ ledger: null }),
    "serverLive false": (n, now) => live({ ledger: { serverLive: false, carryHeld: true, asOf: asOf(now) } })(n, now),
    "carryHeld false": (n, now) => live({ ledger: { serverLive: true, carryHeld: false, asOf: asOf(now) } })(n, now),
    "serverLive 'true' string": (n, now) => live({ ledger: { serverLive: "true", carryHeld: true, asOf: asOf(now) } })(n, now),
    "carryHeld 1": (n, now) => live({ ledger: { serverLive: true, carryHeld: 1, asOf: asOf(now) } })(n, now),
    "carryHeld missing": (n, now) => live({ ledger: { serverLive: true, asOf: asOf(now) } })(n, now),
    "no asOf": live({ ledger: { serverLive: true, carryHeld: true } }),
    "asOf 2 days old": (n, now) => live({ ledger: { serverLive: true, carryHeld: true, asOf: new Date(now - 2 * DAY).toISOString() } })(n, now),
    "asOf in the future": (n, now) => live({ ledger: { serverLive: true, carryHeld: true, asOf: new Date(now + 3600e3).toISOString() } })(n, now),
    "cached (status stale)": (n, now) => live({ ledger: { serverLive: true, carryHeld: true, asOf: asOf(now) } }, { status: "stale" })(n, now),
    "fetched 20 min ago": (n, now) => live({ ledger: { serverLive: true, carryHeld: true, asOf: asOf(now) } }, { at: now - 20 * 60e3 })(n, now),
    "no fetch time": (n, now) => live({ ledger: { serverLive: true, carryHeld: true, asOf: asOf(now) } }, { at: undefined })(n, now),
  };
  for (const [name, pf] of Object.entries(CASES)) for (const clock of ["nov6_0700", "nov6_1600"]) {
    const map = kidLedgerMap();
    const { dev, r } = await runPurge(clock, map, pf);
    assert.notEqual(r, "purged", name + " " + clock); assertKept(map, dev, name + " " + clock);
  }
});
test("DAYPKG1 v2f D3 gate: after the date, no marker, a live fresh signal true: dad-ledger:v1 and :legacy: keys purged with 0 reads of the value; kid keys kept", async () => {
  for (const pathname of ["/kid-hayes.html", "/kid-harris", "/kid-ainsley.html", "/mercury-run.html", "/sheet-chores.html", "/sheet-index"]) for (const clock of ["2026-11-06T00:00:00-06:00", "nov6_0700"]) {
    const map = kidLedgerMap();
    const { dev, r } = await runPurge(clock, map, goodFeed, pathname);
    assert.equal(r, "purged", pathname + " " + clock);
    assert.ok(!(LEDGER in map) && !Object.keys(map).some((k) => k.startsWith(SIDE)), pathname + " ledger keys gone");
    assert.ok("house-checkoffs:hayes:day:2026-11-06" in map, pathname + " kid keys kept");
    assert.deepEqual(ledgerTouch(dev).filter((o) => o[0] !== "rm"), [], pathname + " 0 get / set of the ledger keys");
    assert.deepEqual(dev.pfCalls, ["kids-week"], pathname + " one private kids-week call");
    assert.ok(dev.info.some((s) => s.startsWith("[dad-ledger] kid device purge")), pathname + " logged");
  }
  /* a Dad ledger sheet never purges, whatever the feed says */
  const map = kidLedgerMap();
  const dad = device("nov6_0700", map, { page: "sheet-allowance", pf: goodFeed });
  assert.equal(dad.wk.purgeRun(), null, "no purge on the Dad sheet");
  assert.equal(await dad.wk.purgeKidLedger(await goodFeed("kids-week", dad.fixed)), "not-kid");
  assert.equal(map[LEDGER], OPAQUE);
});
test("DAYPKG1 v2f D3 (a), v2g rule: opening any page never sets the dad-device marker (Atlas P1-2: only a completed Paid hold does, see daypkg1v2g); kid-scope pages never read it by value", () => {
  for (const p of ["/sheet-allowance.html", "/sheet-allowance", "/sheet-dan.html", "/sheet-dan", "/kid-hayes.html", "/kid-harris", "/mercury-run.html", "/sheet-chores.html", "/sheet-index"]) {
    const map = Object.assign({}, SYNC_INIT);
    const d = device("fri1459", map, { pathname: p });
    d.boot(); for (const k of KIDS) d.view(k);
    assert.ok(!(MARK in map), p + " no marker on open"); assert.ok(!d.ops.some((o) => o[1] === MARK && o[0] === "set"), p);
    if (!/sheet-(allowance|dan)/.test(p)) assert.ok(!d.ops.some((o) => o[0] === "get" && o[1] === MARK), p + " marker never read by value");
  }
});

/* ---------- D5 ---------- */
test("DAYPKG1 v2f D5: at 440 px (phone, 2 columns) the odd last chip spans the row and is centred (wall.html, night/scene.html)", () => {
  for (const f of ["wall.html", "night/scene.html"]) {
    const s = rd(f);
    assert.match(s, /\.phone #chips\{[^}]*grid-template-columns:repeat\(2,176px\)/, f + " 2-column phone grid");
    assert.ok(s.includes(".phone #chips .chip:last-child:nth-child(odd){grid-column:1/-1;justify-self:center;width:calc(50% - 8px)}"), f + " odd last chip rule (v2g: + width)");
    const chips = s.slice(s.indexOf('<div id="chips">'), s.indexOf("</div>\n</div>", s.indexOf('<div id="chips">')));
    /* DAYPKG1 v2h (Atlas: Dad chip removed): 2 chips fill the phone row, so no lone chip; the odd rule above stays for an odd count */
    assert.equal((chips.match(/<div class="chip"/g) || []).length, 2, f + " 2 chips (v2h), phone row full");
  }
});

/* ---------- residual ---------- */
test("DAYPKG1 v2f residual: a synced Paid for a week before this ledger's install week is never mirrored (own carry kept); after install it mirrors as in v2e", () => {
  const mapA = Object.assign({}, SYNC_INIT);
  const a = device("fri1459", mapA, { page: "sheet-allowance" });
  const vA = playWeek(a, "hayes"); a.paid("hayes", String(vA.weekEarn));
  const markers = Object.keys(mapA).filter((k) => k.startsWith("house-checkoffs:hayes:week:"));
  assert.ok(markers.length >= 1, "A wrote the synced marker");
  function deviceB(installed) {
    const mapB = Object.assign({}, SYNC_INIT);
    const b = device("fri1459", mapB, { page: "sheet-dan" }); playWeek(b, "hayes"); device("fri1600", mapB, { page: "sheet-dan" }).boot();
    const L = JSON.parse(mapB[LEDGER]);
    if (!installed) { for (const k of Object.keys(L)) if (L[k] && typeof L[k] === "object") delete L[k].mirrorSince; mapB[LEDGER] = JSON.stringify(L); }
    for (const k of markers) mapB[k] = mapA[k];
    return mapB;
  }
  const ctl = Object.assign({}, SYNC_INIT); const c = device("fri1459", ctl, { page: "sheet-dan" }); playWeek(c, "hayes");
  const carry = device("nov2_0700", ctl, { page: "sheet-dan" }).boot().view("hayes").balance;
  assert.ok(carry > 0, "control carry");
  const pre = deviceB(false);
  const bd = device("nov2_0700", pre, { page: "sheet-dan" }).boot(); const vb = bd.view("hayes");
  assert.equal(vb.balance, carry, "pre-install ledger: last week's synced Paid does not zero this device's own carry");
  assert.equal(JSON.parse(pre[LEDGER]).hayes.mirrorSince, bd.wk.weekStartIso(), "install week recorded (" + bd.wk.weekStartIso() + ")"); assert.ok(bd.wk.weekStartIso() > "2026-10-24", "install week recorded");
  const post = deviceB(true);
  assert.equal(device("nov2_0700", post, { page: "sheet-dan" }).boot().view("hayes").balance, 0, "installed before the Paid: mirrored (v2e behaviour)");
});
