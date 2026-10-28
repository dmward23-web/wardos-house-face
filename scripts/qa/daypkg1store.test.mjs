/* DAYPKG1 v2 (Alfred P2, Atlas ruling) · QA_NO_BROWSER=1 TZ=America/Chicago, static (node + vm only, no browser).
   Kid law: no '$' anywhere a kid board writes, browser storage and transient writes included. Live kids-data.js wrote
   'Paid $N · $B carry' to house-bank-paid:<kid> on Dad's Paid tap. Atlas: the stored value is a non-money marker only
   ('Paid ✓' / 'Jar reset ✓'), no amounts. A storage-write hook (localStorage + sessionStorage setItem, wrapped UNDER
   house-tapsync's own setItem wrapper, so every raw write is seen, transient ones included) records each value written while
   the real kids-data.js / house-tapsync.js / house-checkoffs.js run in a vm: Paid (full, part, zero) for 3 kids, the legacy
   '$' stamp read, goal reached / cleared, boot syncs, chore ticks. Every recorded key and value must have 0 '$'.
   Also: the only reader of the stamp (renderBank [data-paid-stamp]) copes with the marker; house-checkoffs shows no amount
   chip on a kid page (no '$', no star, no number; Ainsley covered), only a plain tick when done; every setItem call site in kids-data.js, kid-world.js, house-checkoffs.js is
   inventoried so a new write fails here until it is reviewed. Atlas ruling (Oct 27 11:44 PM CT): house-bank-paid-amount:<kid>
   is dropped: never setItem on any path, an old copy is removed at boot, and no stored value carries a paid amount.
   DAYPKG1 v2d (Atlas ruling Oct 28 12:15 AM CT, A and B): Dad's Paid tap is on sheet-allowance (kid boards have no Paid and no
   prompt); every page shows the stored tick itself; the boot drop matches the exact prefix plus the bare key only. */
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
const BAD = /[$\u2014\u2192\u2190\u2191\u2193]/;

/* raw storage with a write hook: every setItem lands in log (store, key, value) before the map */
function hooked(name, map, log) {
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  return { getItem: (k) => (has(k) ? map[k] : null), setItem: (k, v) => { log.push([name, String(k), String(v)]); map[k] = String(v); },
    removeItem: (k) => { delete map[k]; }, key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
}
function clean(log, tag) {
  assert.ok(log.length > 0, tag + ": the hook saw writes");
  for (const [s, k, v] of log) assert.ok(!BAD.test(k) && !BAD.test(v), tag + ": " + s + " " + k + " = " + v);
  for (const [s, k] of log) assert.ok(!/^house-bank-paid-amount/.test(k), tag + ": " + s + " setItem of the dropped key " + k);
}
/* Atlas: no stored value anywhere carries the paid amount. Paid-named keys hold only the marker and an ISO time; the bank ledger
   has no paid field but paidWeek (an ISO date); no value written after the Paid tap is the bare amount (with or without '$'). */
function noPaidAmount(map, log, paid, tag) {
  for (const k of Object.keys(map)) {
    assert.ok(!/^house-bank-paid-amount/.test(k), tag + " dropped key stored: " + k);
    if (/^house-bank-paid:/.test(k)) assert.ok(/^(Paid|Jar reset) \u2713$/.test(map[k]), tag + " stamp " + map[k]);
    if (/^house-bank-paid-at:/.test(k)) assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(map[k]), tag + " paid-at " + map[k]);
  }
  const bank = JSON.parse(map["dad-ledger:v1"] || "{}");
  for (const kid of Object.keys(bank)) for (const f of Object.keys(bank[kid] || {})) {
    /* DAYPKG1 v2e (caveat c): syncPaid is the second-Dad-device done list, week keys to 1, never an amount */
    if (f === "syncPaid") { for (const [wk, v] of Object.entries(bank[kid][f] || {})) { assert.match(wk, /^\d{4}-\d{2}-\d{2}$/, tag + " syncPaid key"); assert.equal(v, 1, tag + " syncPaid value"); } continue; }
    if (/paid/i.test(f)) { assert.equal(f, "paidWeek", tag + " bank field " + f); assert.match(String(bank[kid][f]), /^\d{4}-\d{2}-\d{2}$/, tag + " paidWeek"); }
  }
  if (paid > 0) for (const [s, k, v] of log) if (!/^house-bank-goal:/.test(k)) assert.ok(!new RegExp("^\\$?" + paid + "(\\.0+)?$").test(v.trim()), tag + " " + s + " " + k + " holds the paid amount " + v);
}
function kidsPage(clockName, map, log, page) {
  const fixed = Date.parse(K[clockName]);
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  const document = { readyState: "loading", visibilityState: "visible", addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } } };
  const ctx = vm.createContext({ Intl, Date: FakeDate, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: hooked("local", map, log), sessionStorage: hooked("session", {}, log), document,
    location: { search: "", hash: "", pathname: "/" + page + ".html", href: "https://house.test/" + page + ".html", reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {}, fetch: () => new Promise(() => {}),
    HouseHub: { lights: () => "https://hub.test", okForKey: () => true } });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(rd("house-tapsync.js"), ctx, { filename: "house-tapsync.js" });
  vm.runInContext(rd("kids-data.js"), ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = D2;
  return ctx.WardKids;
}
function playWeek(wk, kid) {
  for (const q of wk.mustQuests(kid, D2)) {
    if ((q.cadence || "daily") === "daily") { for (const iso of W2.taps) wk.setCheck(q.id, true, D2, iso); }
    else wk.setCheck(q.id, true, D2);
  }
  return wk.getBankView(kid, D2);
}

test("DAYPKG1 v2: Dad's Paid tap (full / part / zero, before and after Fri 15:00, 3 kids) writes 0 '$' to storage; the stamp is the marker only, no amount", () => {
  const avail = {};
  for (const kid of KIDS) for (const at of ["fri0700", "fri1459", "fri1600"]) for (const mode of ["zero", "full", "part"]) {
    const tag = kid + " " + at + " " + mode, map = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" }, log = [];
    const wk = kidsPage(at, map, log, "sheet-allowance");   /* DAYPKG1 v2d · Atlas A: Dad pays on sheet-allowance */
    wk.syncBankFromChecks(D2);
    const v = playWeek(wk, kid);
    const E = Math.max(v.weekEarn, v.balance), P = mode === "full" ? E : mode === "part" ? Math.max(1, Math.floor(E / 2)) : 0;
    const n0 = log.length;
    wk.resetJarCycle(kid, String(P), D2); wk.syncBankFromChecks(D2); wk.getBankView(kid, D2);
    const paidWrites = log.slice(n0).filter(([, k]) => k === "house-bank-paid:" + kid);
    assert.equal(paidWrites.length, 1, tag + " one stamp write");
    const balAfter = Number(JSON.parse(map["dad-ledger:v1"])[kid].balance) || 0;
    if (mode === "zero") avail[kid + at] = balAfter;   /* Paid 0 leaves everything as carry */
    const amt = Math.round((avail[kid + at] - balAfter) * 100) / 100;   /* what Dad's tap actually took out of the jar */
    assert.ok(amt >= 0, tag + " paid " + amt);
    assert.ok(!log.slice(n0).some(([, k]) => /^house-bank-paid-amount/.test(k)), tag + " no setItem of house-bank-paid-amount");
    assert.equal(paidWrites[0][2], amt > 0 ? "Paid \u2713" : "Jar reset \u2713", tag);
    if (mode === "full" && at === "fri1459") assert.equal(paidWrites[0][2], "Paid \u2713", tag + " a real Paid is covered");
    if (mode === "zero") assert.equal(paidWrites[0][2], "Jar reset \u2713", tag);
    assert.ok(!/\d/.test(paidWrites[0][2]), tag + " no amount in the stamp");
    assert.equal(wk.getPaidStamp(kid), paidWrites[0][2], tag + " reads back as written");
    kidsPage("nov2_0700", map, log, "kid-" + kid).syncBankFromChecks(D2);   /* a later boot */
    clean(log, tag);
    noPaidAmount(map, log.slice(n0), amt, tag);
    if (mode === "full" && at === "fri1459") assert.ok(amt > 0, tag + " a real paid amount is exercised");
  }
});

test("DAYPKG1 v2: a legacy live stamp ('Paid $10 · $0 carry', 'Jar reset · $3 carry') is rewritten to the marker on read, and that write is '$'-free", () => {
  const map = { "house-bank-paid:harris": "Paid $10 \u00b7 $0 carry", "house-bank-paid:ainsley": "Jar reset \u00b7 $3 carry", "house-bank-paid:hayes": "Paid \u2713" }, log = [];
  const wk = kidsPage("fri1459", map, log, "kid-harris");
  assert.equal(wk.getPaidStamp("harris"), "Paid \u2713");
  assert.equal(wk.getPaidStamp("ainsley"), "Jar reset \u2713");
  assert.equal(wk.getPaidStamp("hayes"), "Paid \u2713");
  assert.deepEqual(log.filter(([, k]) => /^house-bank-paid:/.test(k)).map(([, k]) => k).sort(), ["house-bank-paid:ainsley", "house-bank-paid:harris"], "only the legacy stamps are rewritten");
  clean(log, "legacy");
  for (const k of Object.keys(map)) assert.ok(!BAD.test(map[k]), k);
});

test("DAYPKG1 v2d: the stamp's reader (renderBank [data-paid-stamp]) shows the stored marker itself on every page (Atlas Oct 28 12:15 AM CT A)", () => {
  const src = rd("kids-data.js");
  const line = src.slice(src.indexOf('querySelectorAll("[data-paid-stamp]")'), src.indexOf('querySelectorAll("[data-got-it]")'));
  const expr = line.match(/el\.textContent = (.+?); \}/)[1];
  const run = (page, paid) => vm.runInNewContext(expr, { location: { pathname: "/" + page + ".html" }, paid });
  for (const page of [...KIDS.map((k) => "kid-" + k), "sheet-allowance"]) {
    assert.equal(run(page, "Paid \u2713"), "Paid \u2713", page);
    assert.equal(run(page, "Jar reset \u2713"), "Jar reset \u2713", page);
  }
  const readers = [];
  for (const f of fs.readdirSync(ROOT).filter((f) => /\.(js|html)$/.test(f))) if (/house-bank-paid|getPaidStamp/.test(rd(f))) readers.push(f);
  assert.deepEqual(readers, ["kids-data.js"], "nothing else reads or parses the stamp");
  assert.ok(!/house-bank-paid:[^"]*"\)\s*\|\|\s*""\)\.(match|split)|parseFloat\(getPaidStamp|Number\(getPaidStamp/.test(src), "the stamp is never parsed for numbers");
});

test("DAYPKG1 v2: chore ticks, goal reached / cleared and boot syncs on every kid page write 0 '$' (hooked localStorage + sessionStorage)", () => {
  for (const kid of KIDS) {
    const map = {}, log = [];
    const wk = kidsPage("fri1459", map, log, "kid-" + kid);
    playWeek(wk, kid);
    for (const q of wk.mustQuests(kid, D2).slice(0, 2)) { wk.setCheck(q.id, false, D2, "2026-10-29"); wk.setCheck(q.id, true, D2, "2026-10-29"); }
    wk.syncBankFromChecks(D2);
    for (const c of ["fri1500", "sat31", "nov2_0700"]) kidsPage(c, map, log, "kid-" + kid).syncBankFromChecks(D2);
    clean(log, kid);
  }
});

/* minimal DOM for house-checkoffs */
class El {
  constructor(cls, attrs = {}, kids = [], text = "") { this.cls = new Set(cls.split(" ").filter(Boolean)); this.attrs = { ...attrs }; this.kids = kids; this.textContent = text; this.on = {}; this.parent = null; this.offsetWidth = 0;
    kids.forEach((k) => { k.parent = this; });
    const c = this.cls; this.classList = { add: (...a) => a.forEach((x) => c.add(x)), remove: (...a) => a.forEach((x) => c.delete(x)), contains: (x) => c.has(x), toggle: (x, on) => { if (on === undefined ? !c.has(x) : on) c.add(x); else c.delete(x); } }; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; }
  matches(sel) { return sel.split(",").some((s) => { s = s.trim(); if (s === "[data-check]") return "data-check" in this.attrs; return s.split(".").filter(Boolean).every((c) => this.cls.has(c)); }); }
  all() { return this.kids.flatMap((k) => [k, ...k.all()]); }
  querySelector(sel) { return this.all().find((e) => e.matches(sel)) || null; } querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  closest(sel) { let e = this; while (e) { if (e.matches(sel)) return e; e = e.parent; } return null; }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); } remove() {}
}
function checkoffsPage(page, earnText) {
  const map = {}, log = [];
  const chip = new El("star-earn", { "data-stars": "5" }, [], earnText);
  const chore = new El("chore open", { "data-check": "qa-local-chore" }, [new El("hint", {}, [], "tap when done"), chip]);
  const body = new El("", {}, [chore]);
  const document = { readyState: "complete", body, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, querySelectorAll: (s) => body.querySelectorAll(s), querySelector: (s) => body.querySelector(s), getElementById: () => null, documentElement: new El("") };
  const ctx = vm.createContext({ Intl, Date, console, setTimeout: () => 0, clearTimeout() {}, localStorage: hooked("local", map, log), sessionStorage: hooked("session", {}, log), document,
    location: { pathname: "/" + page + ".html", search: "", hash: "" }, matchMedia: () => ({ matches: true }), addEventListener() {} });
  ctx.window = ctx;
  vm.runInContext(rd("house-checkoffs.js"), ctx, { filename: "house-checkoffs.js" });
  const click = () => chore.on.click[0]({ preventDefault() {}, stopPropagation() {} });
  return { map, log, chip, chore, click, ctx };
}

test("DAYPKG1 v2: house-checkoffs chore tick on a kid page writes 0 '$' to storage and shows no amount chip at all (no money sign, no star, no number; a plain tick when done, hidden when open); the Dad sheet keeps its money chip", () => {
  const NOCHIP = /[$\u2605\u2606\d]/;
  const seen = [];
  for (const kid of KIDS) {
    for (const start of ["$5", "\u2605 5", "$12", "\u2605 1", ""]) {
      const p = checkoffsPage("kid-" + kid, start);
      const tag = kid + " chip '" + start + "'";
      p.click();
      assert.equal(p.chip.textContent, "\u2713", tag + " tick: plain tick only");
      assert.equal(p.chip.getAttribute("hidden"), null, tag + " tick: shown");
      assert.ok(!NOCHIP.test(p.chip.textContent), tag + " tick: no '$', star or digit");
      assert.equal(JSON.parse(p.map[Object.keys(p.map).find((k) => /^house-checkoffs:/.test(k))])["qa-local-chore"], true, tag + " stored");
      p.chore.__lastToggle = 0; p.click();
      assert.equal(p.chip.textContent, "", tag + " untick: nothing");
      assert.equal(p.chip.getAttribute("hidden"), "", tag + " untick: hidden");
      for (const el of p.chore.all()) assert.ok(!NOCHIP.test(el.textContent || ""), tag + " no '$', star or digit anywhere in the row: " + el.textContent);
      clean(p.log, "checkoffs " + tag);
      seen.push(kid);
    }
  }
  assert.ok(seen.includes("ainsley") && seen.filter((k) => k === "ainsley").length === 5, "Ainsley's page explicitly covered (no stars, star rates or counts)");
  const a = checkoffsPage("kid-ainsley", "\u2605 5"); a.click();
  assert.equal(a.chip.textContent, "\u2713", "Ainsley: a star chip becomes a plain tick, never '\u2605 +5'");
  const d = checkoffsPage("sheet-chores", "$5"); d.click();
  assert.equal(d.chip.textContent, "+$5", "Dad page money chip unchanged");
  d.chore.__lastToggle = 0; d.click();
  assert.equal(d.chip.textContent, "$5", "Dad page money chip untick unchanged");
});

test("DAYPKG1 v2 (Atlas 11:44 PM): an old house-bank-paid-amount key is removed on boot of every kid page and the Dad pages, with removeItem, never re-written", () => {
  for (const page of ["kid-hayes", "kid-harris", "kid-ainsley", "sheet-allowance", "sheet-dan"]) {
    const map = { "house-bank-paid-amount:hayes": "52", "house-bank-paid-amount:harris": "0", "house-bank-paid-amount:ainsley": "10.5", "house-bank-paid-amount": "7",
      "house-bank-paid:hayes": "Paid \u2713", "house-bank-paid-at:hayes": "2026-10-23T19:00:00.000Z", "house-tapsync:seeded": "1" }, log = [], removed = [];
    const wk = kidsPage("nov2_0700", map, log, page);
    assert.deepEqual(Object.keys(map).filter((k) => /paid-amount/.test(k)), [], page + ": every paid-amount key removed at boot");
    assert.equal(map["house-bank-paid:hayes"], "Paid \u2713", page + ": the marker stamp stays");
    assert.equal(map["house-bank-paid-at:hayes"], "2026-10-23T19:00:00.000Z", page + ": paid-at stays");
    wk.syncBankFromChecks(D2);
    if (/^kid-/.test(page)) { const kid = page.slice(4); playWeek(wk, kid); wk.resetJarCycle(kid, "5", D2); wk.getPaidStamp(kid); }
    assert.ok(!log.some(([, k]) => /paid-amount/.test(k)), page + ": no setItem of the dropped key");
    assert.deepEqual(Object.keys(map).filter((k) => /paid-amount/.test(k)), [], page + ": still gone after Paid");
    if (log.length) clean(log, page);
  }
});

test("DAYPKG1 v2 inventory: every setItem in kids-data.js, kid-world.js, house-checkoffs.js is a reviewed write with no '$' literal", () => {
  const want = {
    "kids-data.js": ["localStorage.setItem(key, JSON.stringify(state))", "localStorage.setItem(CHECK_KEY, JSON.stringify(state))", "localStorage.setItem(BANK_KEY, JSON.stringify(root))",
      'localStorage.setItem("house-bank-goal:" + bank.kidId, "1")', 'localStorage.setItem(k, v)', "localStorage.setItem(atK, new Date().toISOString())", /* DAYPKG1 v2f D1/D4 · the scrub rewrites the stamp to a marker, legacy paid-at = now */
      "localStorage.setItem(DAD_DEVICE_KEY, new Date().toISOString())", /* DAYPKG1 v2f D3 (a) · the dad-device marker: a time, no money */
      'localStorage.setItem("house-bank-paid:" + kidId, stamp)',
      'localStorage.setItem("house-bank-paid-at:" + kidId, new Date().toISOString())', 'localStorage.setItem("house-bank-goal:" + kidId, "1")',
      /* DAYPKG1 v2e · Atlas 12:40 AM: the ledger key move. Each one copies an existing stored string byte for byte (no new value is
         built, so no new '$' can appear); daypkg1v2e.test.mjs proves the bytes */
      "localStorage.setItem(dest, raw)", "localStorage.setItem(k, raw)", "localStorage.setItem(BANK_KEY, raw)", "localStorage.setItem(BANK_KEY, raw)"],
    "kid-world.js": ['sessionStorage.setItem("ori-from", JSON.stringify({ x: +fx, y: +fy, t: Date.now() }))'],
    "house-checkoffs.js": ["localStorage.setItem(key, JSON.stringify(state))"]
  };
  for (const [f, list] of Object.entries(want)) {
    const got = [...rd(f).matchAll(/\b(?:local|session)Storage\.setItem\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g)].map((m) => m[0]);
    assert.deepEqual(got.slice().sort(), list.slice().sort(), f + " setItem sites changed: review for '$' and update this list");
    for (const g of got) for (const lit of g.match(/"[^"]*"/g) || []) assert.ok(!lit.includes("$"), f + " " + g);
    for (const g of got) assert.ok(!/paid-amount/.test(g), f + " writes the dropped key: " + g);
  }
  const kd = rd("kids-data.js");
  const uses = [...kd.matchAll(/house-bank-paid-amount/g)].length;
  assert.equal(uses, 3, "kids-data.js names house-bank-paid-amount only in the boot drop (comment + exact prefix + bare key)");
  assert.match(kd, /k\.indexOf\("house-bank-paid-amount:"\) === 0 \|\| k === "house-bank-paid-amount"/, "DAYPKG1 v2d · exact prefix and the bare key only");
  assert.match(kd, /localStorage\.removeItem\(drop\[j\]\)/, "the boot drop uses removeItem");
  for (const f of fs.readdirSync(ROOT).filter((f) => /\.(js|html)$/.test(f))) if (f !== "kids-data.js") assert.ok(!rd(f).includes("house-bank-paid-amount"), f + " must not touch house-bank-paid-amount");
});
