/* DAYPKG1 v2d · QA_NO_BROWSER=1 TZ=America/Chicago, static (node + vm only, no browser).
   Alfred FAILED v2c (gate 2026-10-28). Atlas ruling (Oct 28 12:15 AM CT):
   A) Paid moves to a Dad sheet (sheet-allowance: it owns the per-kid bank / allowance view). Dad taps Paid per kid there and it
      runs the same resetJarCycle logic. Kid boards have NO Paid control and NO prompt; they only show the stored 'Paid ✓' /
      'Jar reset ✓' tick. The tick reaches a kid device through the existing tapsync hub path: a boolean marker id
      (<hay|har|ain>-paid / -jar-reset) in house-checkoffs:<kid>:week:<week start>, or straight from localStorage on one device.
   B) No house-bank:v1 balance or lifetime numbers in kid-device storage: a kid page drops house-bank:v1 on load and keeps the
      ledger in memory only; the jar fill on a kid board comes from the chore checks (never a stored balance).
   Also (Alfred P3s / nit / risk): Dad sheet-chores shows '+$n' after a tick (fixture money source); house-saves strips '$' from
   kid-typed names on save and on read; the paid-amount cleanup matches the exact prefix and the bare key only (lookalikes
   survive); every kid guard also matches an extensionless /kid-<name> path. Atlas ruling (Oct 27 11:44 PM CT) still holds:
   house-bank-paid-amount is never written and removed at boot. */
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
const PFX = { hayes: "hay", harris: "har", ainsley: "ain" };
const WANT = { hayes: [53, 52], harris: [53, 52], ainsley: [38, 38] };
const SYNC_INIT = { "wardos-lights-proxy-token": "qa".repeat(10), "house-tapsync:seeded": "1" };
const D = String.fromCharCode(36);
const KID_STORE_OK = /^(house-checkoffs:(hayes|harris|ainsley)(:week)?:\d{4}-\d{2}-\d{2}|house-tapsync:[a-z-]+|house-bank-goal:(hayes|harris|ainsley)|wardos-lights-proxy-token)$/;

/* a tiny body for the kid board stamp chip */
function body() {
  const kids = [];
  const mk = (tag) => { const a = {}; return { tagName: tag, className: "", hidden: false, textContent: "", attrs: a, setAttribute(k, v) { a[k] = String(v); }, getAttribute(k) { return k in a ? a[k] : null; } }; };
  return { kids, mk, appendChild(c) { kids.push(c); return c; } };
}
const READS = new WeakMap();
function device(clockName, map, opts = {}) {
  const fixed = Date.parse(K[clockName]); assert.ok(!isNaN(fixed), clockName);
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const log = [];
  /* DAYPKG1 v2f D3 · every value read on this storage map is recorded (READS), so noMoneyKidStore can prove 0 kid reads of the ledger */
  if (!READS.has(map)) READS.set(map, []);
  const storage = { getItem: (k) => { READS.get(map).push(String(k)); return has(k) ? map[k] : null; }, setItem: (k, v) => { log.push([String(k), String(v)]); map[k] = String(v); }, removeItem: (k) => { delete map[k]; },
    key: (i) => Object.keys(map)[i] ?? null, get length() { return Object.keys(map).length; } };
  const pathname = opts.pathname || "/" + (opts.page || "sheet-allowance") + ".html";
  const b = body();
  const document = { readyState: "loading", visibilityState: "visible", body: b, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    createElement: (t) => b.mk(t), querySelector: (s) => (s === "[data-kw-paid]" ? b.kids.find((c) => "data-kw-paid" in c.attrs) || null : null),
    querySelectorAll: () => [], getElementById: () => null, documentElement: { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } } };
  const prompts = [];
  const ctx = vm.createContext({
    Intl, Date: FakeDate, URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document,
    location: { search: "", hash: "", pathname, href: "https://house.test" + pathname, reload() {} },
    history: { state: null, replaceState() {} }, matchMedia: () => ({ matches: false }), addEventListener() {},
    prompt: (...a) => { prompts.push(["prompt", ...a]); return null; }, confirm: (...a) => { prompts.push(["confirm", ...a]); return false; }, alert: (...a) => { prompts.push(["alert", ...a]); },
    fetch: (url, o) => (o && o.method === "GET" && opts.hub
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ now: fixed, taps: opts.hub.taps }) })
      : new Promise(() => {})),
    HouseHub: { lights: () => "https://hub.test", okForKey: () => true },
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(rd("house-tapsync.js"), ctx, { filename: "house-tapsync.js" });
  vm.runInContext(rd("kids-data.js"), ctx, { filename: "kids-data.js" });
  ctx.WardKids._data = D2;
  const wk = ctx.WardKids;
  return { ctx, wk, map, log, prompts, body: b,
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
const stampExpr = () => { const s = rd("kids-data.js"); return s.slice(s.indexOf('querySelectorAll("[data-paid-stamp]")'), s.indexOf('querySelectorAll("[data-got-it]")')).match(/el\.textContent = (.+?); \}/)[1]; };
function kidBoardShows(dev, kid, want, tag) {
  assert.equal(dev.wk.getPaidStamp(kid), want, tag + " stored tick");
  const chip = dev.wk.renderKidPaidChip(kid);
  assert.ok(chip, tag + " board chip");
  assert.equal(chip.textContent, want, tag + " chip text"); assert.equal(chip.hidden, false, tag + " chip shown");
  assert.equal(chip.className, "kw-paid", tag); assert.ok("data-kw-paid" in chip.attrs, tag);
  assert.equal(vm.runInNewContext(stampExpr(), { location: { pathname: "/kid-" + kid + ".html" }, paid: want }), want, tag + " [data-paid-stamp] line");
}
function noMoneyKidStore(map, tag) {
  assert.ok(!("house-bank:v1" in map), tag + " no house-bank:v1 on a kid device");
  for (const k of Object.keys(map)) {
    /* DAYPKG1 v2f D3 · no skip: the ONLY money-bearing key allowed on a kid device is dad-ledger:v1 (or a :legacy: side copy)
       as an OPAQUE blob. Kid code never reads it (the storage spy proves 0 value reads of it on this map) and nothing else on
       the device holds a balance. Atlas 1:47 AM: from Nov 6 it is purged by the fail-closed gate (daypkg1v2f.test.mjs) */
    if (/^dad-ledger:v1(?::legacy:\d+x*)?$/.test(k)) {
      assert.equal(typeof map[k], "string", tag + " " + k + " is an opaque stored string");
      const reads = (READS.get(map) || []).filter((r) => r === k);
      assert.equal(reads.length, 0, tag + " kid code read " + k + " " + reads.length + " time(s)");
      continue;
    }
    assert.ok(!(k + map[k]).includes(D), tag + " '$' in " + k + " = " + map[k]);
    assert.ok(!/balance|lifetime|weekEarn|available/i.test(k + map[k]), tag + " money field in " + k + " = " + map[k]);
    assert.ok(KID_STORE_OK.test(k), tag + " unexpected kid storage key " + k);
  }
}

test("DAYPKG1 v2d (Atlas A): the 3 kid pages have no Paid control and no prompt / confirm; kid-world.css has no got-it rule; resetJarCycle and dadPaid refuse on a kid page (with and without .html)", () => {
  for (const kid of KIDS) {
    const h = rd("kid-" + kid + ".html");
    assert.ok(!/<button[^>]*data-got-it/.test(h), kid + " no Paid button");
    assert.ok(!/<button[^>]*>\s*Paid\s*</.test(h), kid + " no button labelled Paid");
    assert.ok(!/data-dad-paid/.test(h), kid + " no Dad Paid control");
    assert.ok(!/\b(window\.)?(prompt|confirm)\s*\(/.test(h), kid + " no prompt or confirm");
    assert.ok(!/Dad paid how many|resetJarCycle|dadPaid/.test(h), kid + " no payday code on the board");
  }
  assert.ok(!/got-it/.test(rd("kid-world.css")), "kid-world.css: no got-it rule");
  for (const kid of KIDS) for (const pathname of ["/kid-" + kid + ".html", "/kid-" + kid]) {
    const map = Object.assign({}, SYNC_INIT), dev = device("fri1459", map, { pathname });
    playWeek(dev, kid);
    const n = dev.log.length;
    assert.equal(dev.wk.resetJarCycle(kid, "52", D2), "", pathname + " resetJarCycle refused");
    assert.equal(dev.wk.dadPaid(kid, D2), "", pathname + " dadPaid refused");
    assert.deepEqual(dev.log.slice(n), [], pathname + " no write"); assert.deepEqual(dev.prompts, [], pathname + " no prompt");
    assert.equal(dev.view(kid).week, WANT[kid][0], pathname + " the week is untouched");
  }
});

test("DAYPKG1 v2d (Atlas A): sheet-allowance carries one Dad Paid button per kid, wired to WardKids.dadPaid then a repaint; no prompt", () => {
  const h = rd("sheet-allowance.html");
  for (const kid of KIDS) {
    /* DAYPKG1 v2e · Atlas 12:40 AM (2): the button is hold-to-confirm (about 2 s), no number in the control */
    const btn = h.match(new RegExp('<button type="button" class="dad-paid" data-dad-paid="' + kid + '" aria-label="Hold to mark Paid">Hold for Paid</button><span class="dad-paid-wk" data-dad-wk hidden></span><span class="dad-paid-stamp" data-paid-stamp hidden></span>', "g")); /* DAYPKG1 v2g · Atlas (a): + Dad's weekly figure slot */
    assert.equal(btn && btn.length, 1, kid + " one Paid button with its stamp");
  }
  assert.match(h, /\[data-dad-paid\]/); assert.match(h, /WardKids\.dadPaid\(/); assert.match(h, /paint\(\);/);
  assert.ok(!/\b(window\.)?(prompt|confirm)\s*\(/.test(h), "the Dad sheet pays without a prompt");
  assert.match(h, /<script src="kids-data\.js\?v=DAYPKG1"><\/script>/);
});

test("DAYPKG1 v2d (Atlas A): Dad's Paid flow on sheet-allowance pays what is owed (before Fri 15:00 and after), stamps 'Paid ✓', writes the synced marker, never re-credits; nothing owed gives 'Jar reset ✓'", () => {
  for (const kid of KIDS) for (const at of ["fri0700", "fri1459", "fri1600"]) {
    const tag = kid + " " + at, map = Object.assign({}, SYNC_INIT);
    playWeek(device(at === "fri1600" ? "fri1459" : at, map).boot(), kid);   /* the week is ticked before Fri 15:00 */
    const dad = device(at, map).boot();   /* sheet-allowance load: syncs (and settles at or after Fri 15:00) */
    const v = dad.view(kid);
    assert.ok(v.available > 0, tag + " owed " + v.available);
    assert.equal(dad.wk.dadPaid(kid, D2), "Paid \u2713", tag);
    const after = dad.view(kid);
    assert.equal(after.balance, 0, tag + " jar emptied"); assert.equal(after.week, 0, tag + " week cleared"); assert.equal(after.lifetime, v.lifetime, tag + " lifetime kept");
    assert.equal(map["house-bank-paid:" + kid], "Paid \u2713", tag);
    const keys = Object.keys(map).filter((k) => new RegExp("^house-checkoffs:" + kid + ":week:").test(k) && JSON.parse(map[k])[PFX[kid] + "-paid"] === true);
    assert.equal(keys.length, 1, tag + " one synced Paid marker " + keys.join(","));
    for (const c of ["fri1459", "fri1500", "sat31", "nov2_0700"]) if (Date.parse(K[c]) >= Date.parse(K[at])) {
      const b = device(c, map).boot().view(kid);
      assert.ok(b.balance <= 0.0001 || c !== "fri1459", tag + " " + c + " no re-credit");
      if (c !== "sat31" && c !== "nov2_0700") assert.equal(b.balance, 0, tag + " " + c);
    }
    assert.ok(!Object.keys(map).some((k) => /paid-amount/.test(k)), tag + " no paid-amount key");
    for (const k of Object.keys(map)) assert.ok(!(k + map[k]).includes(D), tag + " '$' in " + k);
    assert.equal(device(at === "fri1600" ? "fri1600" : "fri1459", map).wk.dadPaid(kid, D2), "Jar reset \u2713", tag + " a second tap with nothing owed");
  }
});

test("DAYPKG1 v2d (Atlas A): the stamp shows on all 3 kid boards: same device (localStorage) and another device (tapsync hub pull of the marker key)", async () => {
  const proxy = rd("scripts/lights-write-proxy.mjs");
  const KEY_RE = new RegExp(proxy.match(/const TAP_KEY_RE = \/(.+)\/;/)[1]), ID_RE = new RegExp(proxy.match(/const TAP_ID_RE = \/(.+)\/;/)[1]);
  for (const kid of KIDS) for (const [mode, want] of [["paid", "Paid \u2713"], ["reset", "Jar reset \u2713"]]) {
    const tag = kid + " " + mode;
    /* same device: Dad pays on sheet-allowance, then the kid board loads */
    const map = Object.assign({}, SYNC_INIT);
    const dad = device("fri1459", map).boot(); playWeek(dad, kid);
    if (mode === "paid") dad.wk.dadPaid(kid, D2); else dad.wk.resetJarCycle(kid, "0", D2);
    kidBoardShows(device("fri1459", map, { page: "kid-" + kid }), kid, want, tag + " same device");
    kidBoardShows(device("sat31", map, { page: "kid-" + kid }), kid, want, tag + " same device next day");
    /* another device: the kid tablet pulls the Dad screen's queued marker from the hub */
    const q = JSON.parse(map["house-tapsync:queue"] || "[]").filter((c) => /-(paid|jar-reset)$/.test(c.id));
    assert.ok(q.length >= 1, tag + " the marker is queued for the hub");
    for (const c of q) { assert.ok(KEY_RE.test(c.key), tag + " hub key " + c.key); assert.ok(ID_RE.test(c.id), tag + " hub id " + c.id); assert.equal(typeof c.v, "boolean", tag); }
    const kmap = Object.assign({}, SYNC_INIT), hub = { taps: tapsFromQueue(map) };
    const kidDev = device("fri1459", kmap, { page: "kid-" + kid, hub });
    assert.equal(kidDev.wk.getPaidStamp(kid), "", tag + " nothing before the pull");
    await kidDev.pull();
    kidBoardShows(kidDev, kid, want, tag + " other device");
    kidBoardShows(device("nov2_0700", kmap, { page: "kid-" + kid }), kid, want, tag + " other device after the weekend");
    noMoneyKidStore(kmap, tag + " other device");
    for (const kb of kidDev.body.kids) assert.ok(!/[$\d]/.test(kb.textContent), tag + " chip text has no '$' or digit");
  }
  /* no stamp: the chip stays away */
  const none = device("fri1459", Object.assign({}, SYNC_INIT), { page: "kid-hayes" });
  assert.equal(none.wk.renderKidPaidChip("hayes"), null, "no tick, no chip");
});

test("DAYPKG1 v2d (Atlas B): a kid page drops an old house-bank:v1 on load, never stores balance / lifetime, and still fills the jar from the chore checks; 0 '$' in storage and in the shown tick (3 kids, with and without .html)", () => {
  for (const kid of KIDS) for (const pathname of ["/kid-" + kid + ".html", "/kid-" + kid]) {
    const tag = kid + " " + pathname;
    const old = { hayes: { balance: 52, lifetime: 104, days: { "2026-10-24": { stars: 7, earned: {} } } }, harris: { balance: 3, lifetime: 9, days: {} }, ainsley: { balance: 10.5, lifetime: 38, days: {} } };
    const map = Object.assign({}, SYNC_INIT, { "house-bank:v1": JSON.stringify(old), ["house-bank-paid-amount:" + kid]: "52" });
    const dev = device("fri1459", map, { pathname });
    assert.ok(!("house-bank:v1" in map), tag + " migrated on load");
    /* DAYPKG1 v2e · Atlas 12:40 AM: the move is a blind raw copy to dad-ledger:v1 (absent here), then the old key goes */
    assert.equal(map["dad-ledger:v1"], JSON.stringify(old), tag + " moved byte for byte to the Dad key");
    assert.deepEqual(dev.log.filter(([k]) => /^dad-ledger/.test(k)).map(([k]) => k), ["dad-ledger:v1"], tag + " one raw copy, nothing else");
    const v = playWeek(dev, kid); dev.boot();
    assert.equal(v.week, WANT[kid][0], tag + " week from the checks");
    assert.ok(!dev.log.some(([k]) => k === "house-bank:v1"), tag + " never written");
    for (const c of ["fri1500", "sat31", "nov2_0700"]) device(c, map, { pathname }).boot();
    noMoneyKidStore(map, tag);
    assert.equal(dev.view(kid).balance, 0, tag + " the kid view shows no stored balance");
  }
});

test("DAYPKG1 v2d: kid-visible payday text has no money word, no '$' and no digit (Ainsley gets no counts)", () => {
  const MONEY = /[$\d]|dollar|cash|money|balance|carry|owe|allowance|earn/i;
  for (const s of ["Paid \u2713", "Jar reset \u2713"]) assert.ok(!MONEY.test(s), s);
  for (const kid of KIDS) {
    const h = rd("kid-" + kid + ".html");
    for (const m of h.matchAll(/\b(?:prompt|confirm|alert)\s*\(\s*("[^"]*"|'[^']*')/g)) assert.fail(kid + " dialog text " + m[1]);
  }
  const kd = rd("kids-data.js");
  const stampStrings = [...kd.matchAll(/"((?:Paid|Jar reset)[^"]*)"/g)].map((m) => m[1]);
  assert.ok(stampStrings.length >= 2);
  for (const s of stampStrings) { assert.ok(!/\\u0024/.test(s), "stamp literal " + s); assert.ok(!/[$\d]/.test(s.replace(/\\u[0-9a-fA-F]{4}/g, "")), "stamp literal " + s); }
});

test("DAYPKG1 v2d (Alfred P3): house-saves strips '$' from kid-typed save names on save, on edit and on read (old stored names rewritten)", () => {
  const map = { "house-saves:v1": JSON.stringify({ hayes: [{ id: "save-a", name: "Lego " + D + "50", need: 10, created: 1 }, { id: "save-b", name: D + D, need: 2, created: 2 }] }) };
  const has = (k) => Object.prototype.hasOwnProperty.call(map, k);
  const ctx = vm.createContext({ console, Date, Math, JSON, localStorage: { getItem: (k) => (has(k) ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; } },
    document: { readyState: "loading", addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, location: { pathname: "/kid-hayes.html", search: "" }, addEventListener() {} });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(rd("house-saves.js"), ctx, { filename: "house-saves.js" });
  const S = ctx.HouseSaves;
  const got = S.list("hayes").map((x) => x.name);
  assert.deepEqual(got, ["Lego 50", "Save"], "read strips and rewrites");
  assert.ok(!map["house-saves:v1"].includes(D), "the stored copy is rewritten");
  const it = S.add("hayes", "Bike " + D + "120", 5);
  assert.equal(it.name, "Bike 120");
  assert.equal(S.add("harris", D + " ", 1), null, "a name of only '$' is not saved");
  S.update("hayes", it.id, D + "Skates" + D, 4);
  assert.ok(S.list("hayes").some((x) => x.name === "Skates"), "edit strips");
  assert.ok(!map["house-saves:v1"].includes(D), "0 '$' stored");
});

test("DAYPKG1 v2d (Alfred nit): the paid-amount cleanup removes only 'house-bank-paid-amount:' keys and the bare key; lookalikes survive", () => {
  for (const page of ["kid-hayes", "sheet-allowance"]) {
    const map = Object.assign({}, SYNC_INIT, { "house-bank-paid-amount:hayes": "5", "house-bank-paid-amount:ainsley": "0", "house-bank-paid-amount": "7",
      "zz-house-bank-paid-amount": "keep1", "house-bank-paid-amountX": "keep2", "house-bank-paid-amount-old": "keep3", "house-bank-paid:hayes": "Paid \u2713" });
    device("fri1459", map, { page });
    for (const k of ["house-bank-paid-amount:hayes", "house-bank-paid-amount:ainsley", "house-bank-paid-amount"]) assert.ok(!(k in map), page + " removed " + k);
    assert.equal(map["zz-house-bank-paid-amount"], "keep1", page); assert.equal(map["house-bank-paid-amountX"], "keep2", page);
    assert.equal(map["house-bank-paid-amount-old"], "keep3", page); assert.equal(map["house-bank-paid:hayes"], "Paid \u2713", page);
  }
});

test("DAYPKG1 v2d (Alfred risk): every kid-page guard also matches an extensionless /kid-<name> path (GitHub Pages serves it), and the Dad pages stay Dad pages", () => {
  const FILES = ["kids-data.js", "house-nomoney.js", "house-checkoffs.js", "house-sfx.js", "house-money-bind.js"];
  let n = 0;
  for (const f of FILES) {
    const src = rd(f);
    /* DAYPKG1 v2f D2 · the shared kid guard is /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/ (mercury-run.html?kid= is a kid page) */
    for (const m of src.matchAll(/\/\\\/(?:\(\?:kid-\[a-z\]\+\|mercury-run\)|kid-(?:\[a-z\]\+|ainsley))([^/]*)\//g)) { n++; assert.equal(m[1], "(\\.html)?$", f + " guard " + m[0]); }
  }
  assert.ok(n >= 20, "guards found " + n);
  const KRE = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/;
  for (const p of ["/kid-hayes", "/kid-hayes.html", "/kid-ainsley", "/house/kid-harris", "/mercury-run.html", "/mercury-run"]) assert.ok(KRE.test(p), p);
  for (const p of ["/sheet-allowance.html", "/sheet-chores", "/kid-hayes.html/x", "/index.html"]) assert.ok(!KRE.test(p), p);
  const g = { location: { pathname: "/kid-hayes" } }; g.window = g; g.globalThis = g; g.addEventListener = () => {};
  g.document = { readyState: "loading", addEventListener() {} };
  vm.runInNewContext(rd("house-nomoney.js"), g);
  const nm = g.HouseNoMoney;
  assert.ok(nm, "house-nomoney loads");
  const dev = device("fri1459", Object.assign({}, SYNC_INIT), { pathname: "/kid-hayes" });
  assert.equal(dev.wk.kidPage(), true, "kids-data sees /kid-hayes as a kid page");
  assert.equal(device("fri1459", Object.assign({}, SYNC_INIT), { pathname: "/sheet-allowance" }).wk.kidPage(), false);
});

/* minimal DOM with .class / [attr] / [attr='v'] selectors, for house-money-bind + house-checkoffs on one chore row */
class El {
  constructor(cls, attrs = {}, kids = [], text = "") { this.cls = new Set(cls.split(" ").filter(Boolean)); this.attrs = { ...attrs }; this.kids = kids; this.textContent = text; this.on = {}; this.parent = null; this.offsetWidth = 0;
    kids.forEach((k) => { k.parent = this; });
    const c = this.cls; this.classList = { add: (...a) => a.forEach((x) => c.add(x)), remove: (...a) => a.forEach((x) => c.delete(x)), contains: (x) => c.has(x), toggle: (x, on) => { if (on === undefined ? !c.has(x) : on) c.add(x); else c.delete(x); } }; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
  matches(sel) { return sel.split(",").some((s) => { s = s.trim(); const parts = s.match(/\.[\w-]+|\[[^\]]+\]/g) || []; if (!parts.length) return false;
    return parts.every((p) => { if (p[0] === ".") return this.cls.has(p.slice(1)); const m = p.slice(1, -1).match(/^([\w-]+)(?:=['"]?([^'"]*)['"]?)?$/); return m[2] === undefined ? m[1] in this.attrs : this.attrs[m[1]] === m[2]; }); }); }
  all() { return this.kids.flatMap((k) => [k, ...k.all()]); }
  querySelector(sel) { return this.all().find((e) => e.matches(sel)) || null; } querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  closest(sel) { let e = this; while (e) { if (e.matches(sel)) return e; e = e.parent; } return null; }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); } remove() {}
}
async function choreRow(page) {
  const h = rd("sheet-chores.html");
  const row = h.match(/<div class="chore open hayes" data-check="hay-bed">[\s\S]*?<span class="star-earn" data-stars="(\d+)" data-money-suffix="([^"]*)"><\/span>/);
  assert.ok(row, "sheet-chores hay-bed row with its money chip");
  const chip = new El("star-earn", { "data-stars": row[1], "data-money-suffix": row[2] });
  const chore = new El("chore open hayes", { "data-check": "hay-bed" }, [new El("ring"), new El("txt", {}, [new El("hint", {}, [], "daily must")]), chip]);
  const bodyEl = new El("", {}, [chore]);
  const map = {};
  const document = { readyState: "complete", body: bodyEl, documentElement: new El("", {}), addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelectorAll: (s) => bodyEl.querySelectorAll(s), querySelector: (s) => bodyEl.querySelector(s), getElementById: () => null, createElement: () => new El("") };
  const ctx = vm.createContext({ Intl, Date, console, setTimeout: () => 0, clearTimeout() {}, localStorage: { getItem: (k) => (k in map ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; } },
    sessionStorage: { getItem: () => null, setItem() {} }, document, location: { pathname: "/" + page, search: "", hash: "" }, matchMedia: () => ({ matches: true }), addEventListener() {},
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(D2) }) });
  ctx.window = ctx;
  vm.runInContext(rd("house-money-bind.js"), ctx, { filename: "house-money-bind.js" });
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  vm.runInContext(rd("house-checkoffs.js"), ctx, { filename: "house-checkoffs.js" });
  const click = () => { chore.__lastToggle = 0; chore.on.click[0]({ preventDefault() {}, stopPropagation() {} }); };
  return { chip, click, n: Number(row[1]), sv: D2.kids.hayes.bankGoal.starDollar };
}

test("DAYPKG1 v2d (Alfred D4), superseded by DAYPKG1 v2g P2: sheet-chores is kid-reachable, so its chip shows no '$' (star count on the family sheet, plain tick on the kid page); Dad's money figure moved to the Dad Paid sheet (daypkg1v2g.test.mjs)", async () => {
  for (const p of ["sheet-chores.html", "kid-hayes.html", "kid-hayes"]) {
    const k = await choreRow(p);
    assert.equal(k.chip.textContent, "", p + " money-bind leaves the chip empty");
    k.click();
    assert.equal(k.chip.textContent, p.startsWith("kid-") ? "\u2713" : "\u2605 +" + k.n, p + " tick (kid) or star count (family sheet), never money");
    assert.ok(!k.chip.textContent.includes(D), p);
  }
});
