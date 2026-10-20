// node livinghouse/tests/lh-doors.test.mjs
// Layer 4 rooms as doors: one row per board page, kid rooms are not the cartoon worlds, return chip is opt-in.
import { assertSealed } from "../../scripts/qa/temp-home.mjs";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
assertSealed();
const req = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../..", import.meta.url));
const dir = fileURLToPath(new URL("..", import.meta.url));
const src = (f) => readFileSync(dir + f, "utf8");
const doors = req(dir + "doors.js");
const rooms = req(dir + "room.js");
const rows = doors.rows();
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

const BANNED = /kids away|back in \d+ days|kids back|dad week|away week|home week|handoff|who's where|who’s where|custody|their mom|kids with|before friday|fri(?:day)?\s*3/i;
for (const r of rows) {
  assert.equal(BANNED.test(r.label + " " + r.aria), false, r.id + " label");
  assert.equal(/[—–]/.test(r.label + r.aria + r.page), false, r.id + " dash");
  assert.equal(r.href.includes(r.page.split("?")[0]), true, r.id);
}

assert.equal(byId.front.href, "../index.html?from=lh");
assert.equal(byId.dad.href, "../sheet-dan.html?from=lh");
assert.equal(byId.ainsley.href, "room.html?kid=ainsley");
assert.equal(byId.hayes.href, "room.html?kid=hayes");
assert.equal(byId.harris.href, "room.html?kid=harris");
assert.equal(byId.moon.href, "../month.html?from=lh");
assert.equal(byId.kitchen.href, "../sheet-groceries.html?from=lh");
assert.equal(byId.garage.href, "room.html?door=garage");
assert.equal(byId.mail.href, "../month-chat.html?from=lh");
assert.equal(byId.chores.href, "../sheet-chores.html?from=lh");
assert.equal(byId.gate.href, "../mercury-run.html?from=lh");
assert.equal(byId.yard.href, "yard.html");
for (const id of ["ainsley", "hayes", "harris"]) assert.equal(/kid-/.test(byId[id].href), false, id + " stays off the cartoon page");

const sheets = readdirSync(root).filter((f) => /^sheet-.*\.html$/.test(f));
for (const f of sheets) {
  const hit = rows.some((r) => r.page.endsWith(f));
  if (f === "sheet-index.html") assert.equal(hit, false, "the hub is the front door, via index.html");
  else assert.equal(hit, true, "missing door for " + f);
}
const yardHtml = src("yard.html");
for (const r of rows.filter((r) => r.spot === "yard-row")) {
  assert.ok(yardHtml.includes('href="' + r.href + '"'), "yard row " + r.id);
  assert.ok(yardHtml.includes(">" + r.label + "<"), "yard label " + r.label);
}

const html = src("index.html");
for (const id of ["front", "dad", "ainsley", "hayes", "harris", "moon", "kitchen", "garage", "mail", "chores", "gate", "yard"]) {
  assert.ok(html.includes('data-door="' + id + '"'), "house door " + id);
  assert.ok(html.includes(byId[id].href), "house href " + id);
}
assert.equal(/kid-ainsley\.html|kid-hayes\.html|kid-harris\.html/.test(html), false, "house nav does not open the cartoon worlds");

const ret = src("return.js");
assert.match(ret, /Back to the house/);
assert.match(ret, /textContent = "House"/);
assert.equal(/CLOCK OVERRIDE|lh-probe|Date\.now|new Date\(/.test(ret), false);
const hub = readFileSync(root + "house-hub.js", "utf8");
assert.match(hub, /from=lh/);
assert.ok(hub.includes("if (!/(?:^|[?&])from=lh(?:&|$)/.test(search)) return;"), "chip only when the URL has from=lh");
assert.equal(/sessionStorage|wardos-from-lh/.test(hub), false, "the chip is not remembered in sessionStorage");
assert.equal(/sessionStorage|wardos-from-lh/.test(ret), false, "return.js does not touch sessionStorage");

/* Same tab, two pages, one session store. The second page has no from=lh, so it must not load the chip,
   even if an older build had written wardos-from-lh. Door hops on the first page keep the param. */
{
  const store = { "wardos-from-lh": "1" };
  const ss = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  function boot(href, links) {
    const u = new URL(href);
    const anchors = links.map((h) => ({ id: "", attrs: { href: h } }));
    const els = [];
    const listeners = {};
    const document = {
      readyState: "loading",
      head: { appendChild() {} },
      documentElement: {},
      createElement() { const el = { src: "" }; els.push(el); return el; },
      querySelectorAll() {
        return anchors.map((a) => ({
          id: a.id,
          getAttribute: (k) => a.attrs[k] || "",
          setAttribute: (k, v) => { a.attrs[k] = v; },
        }));
      },
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    };
    const win = {
      location: { href, origin: u.origin, hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash },
      sessionStorage: ss, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      document, URL, URLSearchParams, history: { replaceState() {} },
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
      Request: globalThis.Request, Headers: globalThis.Headers, setTimeout, clearTimeout, console,
    };
    win.window = win; win.globalThis = win;
    vm.runInContext(hub, vm.createContext(win));
    (listeners.DOMContentLoaded || []).forEach((fn) => fn());
    return { els, anchors };
  }
  const first = boot("http://127.0.0.1/sheet-dan.html?from=lh", ["sheet-today.html", "livinghouse/index.html", "https://example.test/x.html"]);
  assert.equal(first.els.length, 1, "from=lh loads the return chip");
  assert.match(first.els[0].src, /return\.js/);
  assert.match(first.anchors[0].attrs.href, /(?:^|[?&])from=lh(?:&|$)/, "the next hop keeps from=lh");
  assert.equal(first.anchors[1].attrs.href, "livinghouse/index.html", "the House link stays a plain return");
  assert.equal(first.anchors[2].attrs.href, "https://example.test/x.html");
  const second = boot("http://127.0.0.1/sheet-status.html", ["sheet-today.html"]);
  assert.equal(second.els.length, 0, "a main page after an lh page in the same tab has no chip");
  assert.equal(second.anchors[0].attrs.href, "sheet-today.html");
  assert.equal(store["wardos-from-lh"], "1", "this test's leftover key is ignored");
}

assert.equal(rooms.snapPath(null), "");
assert.equal(rooms.snapPath({ snapshotUrl: "https://example.test/snap.jpg" }), "");
assert.equal(rooms.snapPath({ snapshotUrl: "data/nest-snaps/still.webp" }), "../data/nest-snaps/still.webp");
assert.equal(rooms.snapPath({ cameras: [{ snapshotUrl: "../data/nest-snaps/x.webp" }] }), "");

const now = Date.parse("2026-10-21T12:00:00-05:00");
const face = (s) => s;
assert.deepEqual(rooms.visibleItems("hayes", null, now, false, face), { feed: "missing", items: [] });
assert.deepEqual(rooms.visibleItems("hayes", [{ id: "item-1", summary: "Item 1", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00" }], now, false, face).items, []);
const sport = rooms.visibleItems("hayes", [{ id: "item-1", summary: "Hayes soccer", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00" }], now, false, face);
assert.equal(sport.feed, "live");
assert.equal(sport.items.length, 1);
assert.equal(sport.items[0].text, "Hayes soccer");
assert.deepEqual(rooms.visibleItems("hayes", [{ id: "item-1", summary: "Hayes soccer", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00" }], now, true, face).items, []);
assert.deepEqual(rooms.visibleItems("harris", [{ id: "item-1", summary: "Harris football", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00" }], now, false, face).items.length, 1);
assert.deepEqual(rooms.visibleItems("harris", [{ id: "item-1", summary: "Harris soccer", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00" }], now, false, face).items, []);
assert.deepEqual(rooms.visibleItems("hayes", [{ id: "item-1", summary: "Hayes soccer", start: "2026-10-21T15:00:00-05:00", end: "2026-10-21T16:00:00-05:00" }], now, false, () => "").items, []);

for (const f of ["doors.js", "return.js", "room.js", "room.html", "yard.html", "index.html"]) {
  assert.equal(/[—–]|→|➜/.test(src(f)), false, "dash in " + f);
}
assert.equal(/Date\.now\(\)|new Date\(\)/.test(src("room.js")), false, "room.js reads time only through the clock");
assert.match(src("room.html"), /mercury-run\.html\?from=lh/);
assert.match(src("room.html"), /nest-webrtc\.html\?from=lh/);
assert.match(src("room.html"), /data-art="missing"/);

console.log("lh-doors: ok");
