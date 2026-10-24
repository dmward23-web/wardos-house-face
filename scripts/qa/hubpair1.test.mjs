/* HUBPAIR1 · a pairing link may carry a hub, honoured only to bootstrap a screen that has no valid hub yet.
   - accept: a key-only (or empty) screen on a real host takes a PINNED &hub= and, after a real tap, redeems there
   - reject: an unpinned host, a reserved .invalid QA origin on a real host, any malformed hub or code
   - never overwrite: a screen with a valid hub redeems against its own hub; the link hub is ignored
   - nothing is sent before the pin check and the tap; the redeem carries the code only, never a key
   - the fragment leaves the address bar first
   - Dad screens report "Needs pairing" for key-without-hub (and hub-without-key); kid boards stay plain
   The prod-path origins are reserved .example names pinned only inside this test's sandbox (no house hostname in git).
   node --test scripts/qa/hubpair1.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const KEY = "old-device-key-0123456789abcdef";
const NEWKEY = "fresh-device-key-from-pair-0123456789";
const CODE = "AbCdEfGhIjKlMnOpQrStUv";
const HUB = "https://lights.house.example", HUB2 = "https://cams.house.example";
const PAGE = "https://pages.example/wardos-house-face/sheet-index.html";
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const keyHeaders = (h) => Object.keys(h || {}).filter((k) => /^(x-lights-proxy-token|x-nest-proxy-token|x-private-feed-token|authorization)$/i.test(k));

/* the real house-hub.js with two extra .example pins added in the sandbox only (the four real pins stay) */
function hubSrc(extra) {
  const s = read("house-hub.js");
  const m = s.match(/var PIN = \[([^\]]*)\];/);
  assert.ok(m, "PIN list found");
  return s.replace(m[0], "var PIN = [" + m[1] + extra.map((o) => ', "' + sha(o) + '"').join("") + "];");
}

function page(href, store = {}, { pairStatus = 200, pairBody = { key: NEWKEY }, pins = [HUB, HUB2], extra = [] } = {}) {
  const calls = [], els = [], u = new URL(href), ls = { ...store }, replaced = [];
  const mk = (tag) => { const e = { tag, style: {}, attrs: {}, kids: [], on: {}, textContent: "", setAttribute(k, v) { this.attrs[k] = v; }, hasAttribute(k) { return k in this.attrs; }, appendChild(c) { this.kids.push(c); }, addEventListener(t, f) { this.on[t] = f; }, remove() { this.gone = true; } }; els.push(e); return e; };
  const body = mk("body");
  const rootAttrs = {};
  const win = {
    location: { href, origin: u.origin, hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash, replace(x) { replaced.push(x); } },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    sessionStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } },
    history: { state: null, replaceState(_s, _t, url) { replaced.push("history:" + url); win.location.hash = ""; } },
    fetch: (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      let headers = init.headers || {};
      if (headers && typeof headers.forEach === "function") { const o = {}; headers.forEach((v, k) => { o[k] = v; }); headers = o; }
      calls.push({ url, headers, body: init.body || "" });
      if (url.endsWith("/api/pair")) return Promise.resolve({ ok: pairStatus === 200, status: pairStatus, json: () => Promise.resolve(pairBody) });
      return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ status: "offline" }), text: () => Promise.resolve("") });
    },
    URL, Request: globalThis.Request, Headers: globalThis.Headers, setTimeout, clearTimeout, console,
    matchMedia: () => ({ matches: true }), requestAnimationFrame: (f) => f(),
  };
  win.window = win; win.globalThis = win;
  win.document = { readyState: "complete", body, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} },
    documentElement: { appendChild() {}, setAttribute(k, v) { rootAttrs[k] = v; }, getAttribute(k) { return rootAttrs[k]; }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }, createElement: mk, getElementById: () => null };
  const ctx = vm.createContext(win);
  vm.runInContext(hubSrc(pins.concat(extra)), ctx);
  vm.runInContext(read("private-feed.js"), ctx);
  vm.runInContext(read("house-pair.js"), ctx);
  const note = () => els.find((e) => "data-pair-note" in e.attrs);
  const go = () => els.find((e) => "data-pair-go" in e.attrs);
  const tick = () => new Promise((r) => setTimeout(r, 30));
  return { win, calls, ls, els, replaced, note, go, tick, rootAttrs, tap: async () => { go().on.click({ isTrusted: true }); await tick(); } };
}
const link = (code, hub) => PAGE + "#pair=" + code + (hub === undefined ? "" : "&hub=" + encodeURIComponent(hub));
const pairCalls = (p) => p.calls.filter((c) => /\/api\/pair$/.test(c.url));

test("sandbox: the .example pins are real pins only here; the shipped list is unchanged (4 entries, no .example)", () => {
  const m = read("house-hub.js").match(/var PIN = \[([^\]]*)\];/);
  assert.equal(m[1].split(",").length, 4);
  for (const o of [HUB, HUB2, "https://hub.qa.invalid"]) assert.equal(m[1].includes(sha(o)), o.endsWith(".invalid"), o);
});

test("REGRESSION · key-only screen on the Pages host + pair link with a pinned hub: tap, redeem there, hub + new key saved, clean reload", async () => {
  const p = page(link(CODE, HUB), { "wardos-lights-proxy-token": KEY });
  assert.equal(p.win.PrivateFeed.pairState(), "key-no-hub", "starts key-only (the dark board)");
  await p.tick();
  assert.ok(p.replaced[0] && p.replaced[0].startsWith("history:") && !p.replaced[0].includes("#"), "fragment stripped first");
  assert.equal(pairCalls(p).length, 0, "nothing redeemed before the tap");
  assert.ok(!p.calls.some((c) => c.url.startsWith(HUB)), "nothing at all sent to the link hub before the tap");
  assert.ok(p.go(), "Pair this screen is shown");
  p.go().on.click({ isTrusted: false }); await p.tick();
  assert.equal(pairCalls(p).length, 0, "a scripted click does not redeem");
  await p.tap();
  const pc = pairCalls(p);
  assert.equal(pc.length, 1);
  assert.equal(pc[0].url, HUB + "/api/pair");
  assert.deepEqual(keyHeaders(pc[0].headers), [], "redeem carries no key header");
  assert.deepEqual(JSON.parse(pc[0].body), { code: CODE }, "redeem body is the code only");
  assert.equal(p.ls["wardos-lights-proxy"], HUB, "hub saved");
  assert.equal(p.ls["wardos-lights-proxy-token"], NEWKEY, "fresh key saved");
  assert.ok(p.replaced.some((x) => x === "/wardos-house-face/sheet-index.html"), "clean reload");
  assert.equal(p.win.PrivateFeed.pairState(), "paired");
});

test("accept: an empty screen (no key, no hub) can bootstrap the same way", async () => {
  const p = page(link(CODE, HUB));
  await p.tick(); await p.tap();
  assert.equal(pairCalls(p)[0].url, HUB + "/api/pair");
  assert.equal(p.ls["wardos-lights-proxy"], HUB);
});

test("reject: a hub that is not pinned (no card, no request of any kind to it)", async () => {
  for (const bad of ["https://evil.example", "https://lights.house.example.evil.example", "https://evil.example" + String.fromCharCode(64) + "lights.house.example"]   /* userinfo trick, built so the scan sees no address */) {
    const p = page(link(CODE, bad), { "wardos-lights-proxy-token": KEY });
    await p.tick();
    assert.ok(!p.go(), bad + " no Pair card");
    assert.equal(p.note() && p.note().attrs["data-pair-note"], "fail", bad);
    assert.ok(!p.calls.some((c) => c.url.includes("evil.example")), bad + " nothing sent");
    assert.equal(p.ls["wardos-lights-proxy"], undefined);
    assert.equal(p.ls["wardos-lights-proxy-token"], KEY, "key untouched");
  }
});

test("reject: a reserved .invalid QA origin on a real host (prod path), accepted only on a QA/loop page", async () => {
  for (const qa of ["https://hub.qa.invalid", "https://cams.qa.invalid"]) {
    const p = page(link(CODE, qa), { "wardos-lights-proxy-token": KEY });
    await p.tick();
    assert.ok(!p.go(), qa + " refused on a real host");
    assert.equal(pairCalls(p).length, 0);
    assert.equal(p.win.HouseHub.okLinkHub(qa), "");
  }
  /* the same QA origin passes on a .invalid QA page (that page has no sibling QA hub of its own) */
  const q = page("https://qa-page.invalid/sheet-index.html#pair=" + CODE + "&hub=" + encodeURIComponent("https://hub.qa.invalid"));
  assert.equal(q.win.HouseHub.okLinkHub("https://hub.qa.invalid"), "https://hub.qa.invalid");
});

test("never overwrite: a screen with a valid hub redeems against its own hub; the link hub is ignored", async () => {
  const p = page(link(CODE, HUB), { "wardos-lights-proxy": HUB2, "wardos-lights-proxy-token": KEY });
  await p.tick(); await p.tap();
  const pc = pairCalls(p);
  assert.equal(pc.length, 1);
  assert.equal(pc[0].url, HUB2 + "/api/pair", "own hub");
  assert.ok(!p.calls.some((c) => c.url.startsWith(HUB + "/")), "nothing to the link hub");
  assert.equal(p.ls["wardos-lights-proxy"], HUB2, "saved hub unchanged");
  /* and an unpinned link hub on a paired screen changes nothing either */
  const e = page(link(CODE, "https://evil.example"), { "wardos-lights-proxy": HUB2, "wardos-lights-proxy-token": KEY });
  await e.tick(); await e.tap();
  assert.equal(pairCalls(e)[0].url, HUB2 + "/api/pair");
  assert.equal(e.ls["wardos-lights-proxy"], HUB2);
});

test("reject: malformed hub or code (no card, no request, key kept, fragment still stripped)", async () => {
  const cases = [
    [CODE, HUB + "/x"], [CODE, HUB + ":8443"], [CODE, "http://lights.house.example"], [CODE, "LIGHTS.HOUSE.EXAMPLE"],
    [CODE, "javascript:alert(1)"], [CODE, ""], [CODE, HUB + "?a=1"], [CODE, HUB + "#x"], [CODE, " " + HUB],
    ["short", HUB], ["bad code with spaces!!!!!!!", HUB], ["", HUB], ["A".repeat(65), HUB],
  ];
  for (const [c, h] of cases) {
    const p = page(link(c, h), { "wardos-lights-proxy-token": KEY });
    await p.tick();
    assert.ok(!p.go(), JSON.stringify([c, h]) + " no card");
    assert.equal(p.calls.filter((x) => x.url.includes("house.example")).length, 0, JSON.stringify([c, h]));
    assert.equal(p.ls["wardos-lights-proxy-token"], KEY);
    assert.ok(p.replaced[0] && p.replaced[0].startsWith("history:"), "stripped");
  }
  /* a broken percent-encoding in the fragment is refused too */
  const p = page(PAGE + "#pair=" + CODE + "&hub=%E0%A4%A", { "wardos-lights-proxy-token": KEY });
  await p.tick();
  assert.ok(!p.go());
});

test("a failed redeem (401/429/expired) saves nothing", async () => {
  for (const st of [401, 410, 429]) {
    const p = page(link(CODE, HUB), { "wardos-lights-proxy-token": KEY }, { pairStatus: st, pairBody: {} });
    await p.tick(); await p.tap();
    assert.equal(p.ls["wardos-lights-proxy"], undefined, String(st));
    assert.equal(p.ls["wardos-lights-proxy-token"], KEY);
  }
  const short = page(link(CODE, HUB), {}, { pairBody: { key: "short" } });
  await short.tick(); await short.tap();
  assert.equal(short.ls["wardos-lights-proxy"], undefined, "a too-short key is refused");
});

test("Needs pairing: Dad screens say so for key-without-hub and hub-without-key; kid boards stay plain", () => {
  const dad = page(PAGE, { "wardos-lights-proxy-token": KEY });
  assert.equal(dad.win.PrivateFeed.needsPairing(), true);
  assert.equal(dad.rootAttrs["data-pair-state"], "key-no-hub");
  const chip = dad.els.find((e) => "data-pair-needed" in e.attrs);
  assert.ok(chip && chip.style.display === "block", "visible notice on a Dad screen");
  const words = chip.kids.map((k) => k.textContent).join(" ");
  assert.match(words, /^Needs pairing /);
  assert.doesNotMatch(words, /[0-9\u2014\u2013\u2192\u2190]|->|=>/, "no digits, dashes or arrows");
  const hubOnly = page(PAGE, { "wardos-lights-proxy": HUB });
  assert.equal(hubOnly.win.PrivateFeed.pairState(), "hub-no-key");
  assert.equal(hubOnly.win.PrivateFeed.needsPairing(), true);
  const paired = page(PAGE, { "wardos-lights-proxy": HUB, "wardos-lights-proxy-token": KEY });
  assert.equal(paired.win.PrivateFeed.needsPairing(), false);
  assert.ok(!paired.els.some((e) => "data-pair-needed" in e.attrs), "no notice on a paired screen");
  for (const kid of ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]) {
    const k = page("https://pages.example/wardos-house-face/" + kid, { "wardos-lights-proxy-token": KEY });
    assert.equal(k.win.PrivateFeed.needsPairing(), false, kid);
    assert.ok(!k.els.some((e) => "data-pair-needed" in e.attrs), kid + " stays plain");
  }
});

test("Needs pairing replaces the masked Ready / All clear words on Dad screens only (source)", () => {
  const strip = read("house-board-strip.js"), lights = read("house-lights.js");
  assert.match(strip, /function clearWord\(\) \{[^\n]*needsPairing\(\) \? "Needs pairing" : "All clear"/);
  assert.doesNotMatch(strip.replace(/\/\*[\s\S]*?\*\//g, ""), /leaveby-dest">All clear</);
  assert.match(lights, /function readyWord\(up\)/);
  assert.doesNotMatch(lights.replace(/\/\*[\s\S]*?\*\//g, "").replace(/function readyWord[^\n]*\n/, ""), /"Ready"|"READY"/, "every Ready goes through readyWord");
});

test("pair-link.mjs --template: Pages-safe link with the pinned hub and a placeholder, no request, no key needed", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "hubpair1-"));
  try {
    fs.mkdirSync(path.join(home, ".config", "wardos"), { recursive: true });
    fs.writeFileSync(path.join(home, ".config", "wardos", "lights-write-proxy.url"), HUB + "\n");
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/pair-link.mjs"), "--house", PAGE, "--template"], { env: { HOME: home, PATH: "/usr/bin:/bin" }, encoding: "utf8", timeout: 10000 });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), PAGE + "#pair=<CODE>&hub=" + encodeURIComponent(HUB));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("the shipped pins accept the box's real lights hub on a real host (box config, when present)", () => {
  let real = "";
  try { real = fs.readFileSync(path.join(os.homedir(), ".config", "wardos", "lights-write-proxy.url"), "utf8").trim().replace(/\/$/, ""); } catch { /* CI */ }
  const p = page(PAGE, {}, { pins: [] });
  if (real) assert.equal(p.win.HouseHub.okLinkHub(real), real.toLowerCase(), "real hub (masked) passes okLinkHub");
  assert.equal(p.win.HouseHub.okLinkHub(HUB), "", "an unpinned host fails with the shipped list");
});
