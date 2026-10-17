/* PACKLEAVE1 + AWAYWK1 · node --test scripts/qa/packleave-awaywk.test.mjs
   1. Pack (Atlas Oct 17): the board carries no hardcoded day, time or day badge. The leave line shows only a real
      leave event from the live feed (kids-week boardStrip, leaveBy flag); with none it stays empty, never Fri 3:00.
   2. Away week (Atlas Oct 17): the jar rests and the day list paints no sentence. A missing, unreadable or empty
      week feed is a normal awake board. No custody words either way. Synthetic Smith/QXS stand-ins only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
/* the custody phrase list from nocustody.test.mjs (read, not imported, so its tests do not run twice) */
const PHRASES = new RegExp(...(() => { const m = /export const PHRASES = \/(.*)\/i;/.exec(read("scripts/qa/nocustody.test.mjs")); return [m[1], "i"]; })());
const DAY_WORD = /\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day|s|nes|rs|ur)?\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i;

class El {
  constructor() {
    this.kids = {}; this.attrs = {}; this.innerHTML = ""; this.textContent = ""; this.children = [];
    this.style = { display: "", setProperty() {} };
    const s = new Set();
    this.classList = { toggle: (c, on) => (on ? s.add(c) : s.delete(c)), add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) };
  }
  querySelector(sel) { if (sel === "[data-cw]" || sel === ".sec-hdr") return this.kids[sel] || null; return this.kids[sel] || (this.kids[sel] = new El()); }
  querySelectorAll() { return []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  insertBefore(c) { this.kids["[data-cw]"] = c; return c; }
}

/* ---------- 1. Pack ---------- */
function packBody() {
  const html = read("sheet-pack.html");
  const body = html.slice(html.indexOf("<body"));
  return body.slice(0, body.indexOf("<script"));
}
function loadPack() {
  const ctx = vm.createContext({ Intl, Date });
  ctx.globalThis = ctx;
  vm.runInContext(read("house-pack-leave.js"), ctx);
  return ctx.HousePackLeave;
}
function packDoc() {
  const t = new El(), w = new El();
  t.setAttribute("hidden", ""); w.setAttribute("hidden", "");
  return { t, w, doc: { querySelector: (s) => (s === "[data-pack-leave]" ? t : s === "[data-pack-leave-what]" ? w : null) } };
}
const NOW = Date.parse("2026-10-17T11:00:00-05:00");
const FX_LEAVE = { label: "Next up", time: "9:05", place: "Smith QXS practice", badge: "Mon", startIso: "2026-10-19T14:05:00.000Z", kind: "sport", leaveBy: true };

test("Pack markup: no day, no time, no day badge, no week framing", () => {
  const b = packBody();
  const text = b.replace(/<[^>]+>/g, " ");
  assert.equal(DAY_WORD.test(text), false, "a day word in Pack text");
  assert.equal(/\d{1,2}:\d{2}/.test(text), false, "a clock time in Pack text");
  assert.equal(/class="cheer-badge"/.test(b), false, "no day badge");
  assert.equal(PHRASES.test(b), false, "no custody phrase");
  assert.equal(/whose week/i.test(b), false);
  assert.match(b, /data-pack-leave hidden/);
  assert.match(b, /<span>Now<\/span><\/div>/);
  assert.match(b, /<span>Later<\/span><\/div>/);
  assert.match(read("sheet-pack.html"), /<script src="house-pack-leave\.js\?v=PACKLEAVE1"><\/script>/);
});

test("Pack leave line: no feed, no leave event, or only past/non-leave rows show nothing", () => {
  const P = loadPack();
  const cases = [null, {}, { boardStrip: {} }, { boardStrip: { nextLeave: null, queue: [] } },
    { boardStrip: { queue: [{ ...FX_LEAVE, leaveBy: false }] } },
    { boardStrip: { nextLeave: { ...FX_LEAVE, startIso: "2026-10-16T20:00:00.000Z" } } },
    { boardStrip: { nextLeave: { ...FX_LEAVE, startIso: "" } } }];
  for (const wk of cases) {
    const { t, w, doc } = packDoc();
    assert.equal(P.paint(doc, wk, NOW), null, JSON.stringify(wk));
    assert.equal(t.textContent, ""); assert.equal(w.textContent, "");
    assert.ok(t.hasAttribute("hidden") && w.hasAttribute("hidden"));
    assert.equal(/3:00|fri/i.test(t.textContent + w.textContent), false);
  }
});

test("Pack leave line: a fixture leave event shows that event's day and time", () => {
  const P = loadPack();
  const { t, w, doc } = packDoc();
  const r = P.paint(doc, { boardStrip: { nextLeave: FX_LEAVE, queue: [FX_LEAVE] } }, NOW);
  assert.ok(r);
  assert.equal(t.textContent, "Next leave · Mon 9:05 AM");
  assert.equal(w.textContent, "Smith QXS practice");
  assert.equal(t.hasAttribute("hidden"), false);
  const { t: t2, doc: d2 } = packDoc();
  P.paint(d2, { boardStrip: { queue: [{ ...FX_LEAVE, startIso: "2026-10-17T21:15:00.000Z", place: "Smith swim" }] } }, NOW);
  assert.equal(t2.textContent, "Next leave · Today 4:15 PM");
  assert.equal(PHRASES.test(t.textContent + w.textContent + t2.textContent), false);
});

/* ---------- 2. Away week ---------- */
function runCalendarWorld(data) {
  const body = new El(); body.setAttribute("data-kid", "hayes");
  const host = new El(); host.id = "kw-cal";
  const document = { body, readyState: "complete", querySelector: (s) => (s === "#kw-cal" ? host : null), createElement: () => new El(), addEventListener() {} };
  const ctx = vm.createContext({ document, Intl, Date, Math, String, localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => 0 }, matchMedia: () => ({ matches: false }), setTimeout: (fn) => fn() });
  ctx.window = ctx;
  vm.runInContext(read("jar-engine.js"), ctx);
  ctx.WardKids = { _data: data, DAY_ISO: "2026-10-17", eventsForIso: () => [{ time: "4:00", what: "Smith swim" }] };
  vm.runInContext(read("calendar-world.js"), ctx);
  const root = host.kids["[data-cw]"];
  assert.ok(root, "calendar world mounted");
  const ul = root.querySelector("[data-cw-day]");
  const rows = ul.children.map((li) => li.children.map((c) => c.textContent).join(" ")).join("|");
  return { asleep: body.classList.contains("kw-asleep"), list: ul.innerHTML + rows, title: root.querySelector("[data-cw-title]").textContent, J: ctx.JarEngine };
}

test("away-week state: missing, unreadable or empty feed is awake; away week rests", () => {
  const ctx = vm.createContext({ performance: { now: () => 0 } });
  ctx.window = ctx;
  vm.runInContext(read("jar-engine.js"), ctx);
  const A = ctx.JarEngine.asleepWeek;
  for (const d of [null, undefined, "", "not json", 7, {}, { homeWeek: null }, { homeWeek: "" }, { homeWeek: {} }, { homeWeek: { with: "" } }]) assert.equal(A(d), false, JSON.stringify(d));
  assert.equal(A({ homeWeek: { with: "Dad" } }), false);
  assert.equal(A({ homeWeek: { with: "away" } }), true);
  assert.equal(A({ homeWeek: { with: "Away" } }), true);
  assert.equal(A({ homeWeek: { with: "Dad", place: "away" } }), false, "keys on with only");
});

test("calendar world: feed missing paints the normal awake day list", () => {
  for (const d of [null, {}, { homeWeek: {} }]) {
    const r = runCalendarWorld(d);
    assert.equal(r.asleep, false);
    assert.match(r.list, /Smith swim/);
    assert.equal(PHRASES.test(r.list + r.title), false);
  }
});

test("calendar world: away week is asleep with no sentence and no custody words", () => {
  const r = runCalendarWorld({ homeWeek: { with: "away" }, kids: {} });
  assert.equal(r.asleep, true);
  assert.equal(r.list, "", "no sentence on an away week");
  assert.equal(PHRASES.test(r.list + r.title), false);
  assert.equal(/Nothing to do here/.test(read("calendar-world.js")), false);
});

/* EMPTYFEED1 · a {} kids-week feed used to throw in renderKidPage and blank all three kid boards */
test("empty kids-week feed: kid and Dad renders do not throw, and the board is awake", () => {
  const doc = { readyState: "complete", querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {},
    body: { getAttribute: () => null, classList: { add() {}, remove() {}, toggle() {} } }, documentElement: { classList: { add() {} } } };
  const ctx = vm.createContext({ document: doc, localStorage: { getItem: () => null, setItem() {} }, Intl, Date, Math, JSON, console,
    setTimeout: () => 0, setInterval: () => 0, CustomEvent: function () {}, location: { search: "", href: "http://x/" }, performance: { now: () => 0 } });
  ctx.window = ctx;
  vm.runInContext(read("kids-data.js"), ctx);
  vm.runInContext(read("jar-engine.js"), ctx);
  for (const d of [{}, { kids: {} }, null]) {
    for (const k of ["hayes", "harris", "ainsley"]) assert.doesNotThrow(() => ctx.WardKids.renderKidPage(k, d), k + " " + JSON.stringify(d));
    if (ctx.WardKids.renderDanPage) assert.doesNotThrow(() => ctx.WardKids.renderDanPage(d));
    assert.equal(ctx.JarEngine.asleepWeek(d), false);
  }
  const r = runCalendarWorld({});
  assert.equal(r.asleep, false);
  assert.match(r.list, /Smith swim/);
});
