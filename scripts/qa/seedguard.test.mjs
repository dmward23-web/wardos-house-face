/* SEEDGUARD1 · Alfred restart5 P3 #4: a legacy ?lightsProxyToken= / ?nestProxyToken= / ?proxyToken= seed is saved
   only when the screen holds NO device key yet. A paired screen's key is never replaced (a crafted link can't unpair it),
   and the seed is still stripped from the address bar either way. Every seeding script is loaded in a tiny vm browser.
   node --test scripts/qa/seedguard.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PAIRED = "paired-device-key-0123456789abcdef";
const SEED = "crafted-seed-key-ZZZZZZZZZZZZZZZZ";
const SLOTS = ["wardos-lights-proxy-token", "wardosNestProxyToken", "wardos-private-feed-token"];

/* anything-goes DOM stub: every property is a callable stub, so page scripts can load without a real document */
function any() {
  const f = function () { return any(); };
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "then") return undefined;
      if (k === "length") return 0;
      if (k === Symbol.iterator) return function* () {};
      return any();
    },
    set() { return true; },
    apply() { return any(); },
    construct() { return any(); },
  });
}
function browser(href, store) {
  const u = new URL(href);
  const ls = { ...store };
  const replaced = [];
  const storage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; }, key: () => null, length: 0 };
  const doc = any();
  const win = {
    location: { href, origin: u.origin, protocol: u.protocol, host: u.host, hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash, replace() {}, reload() {} },
    localStorage: storage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    history: { state: null, replaceState: (s, t, url) => { replaced.push(url); } },
    fetch: () => new Promise(() => {}), /* never resolves: these tests only look at load-time seeding */
    document: doc, navigator: { userAgent: "qa" }, URL, URLSearchParams, Headers: globalThis.Headers, Request: globalThis.Request,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    AbortController, console: { log() {}, warn() {}, error() {}, info() {} }, Promise, JSON, Math, Date,
  };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  return { ctx, ls, replaced, run: (f) => vm.runInContext(read(f), ctx, { filename: f }) };
}

const CASES = [
  ["house-lights.js", "lightsProxyToken", "wardos-lights-proxy-token"],
  ["house-tapsync.js", "lightsProxyToken", "wardos-lights-proxy-token"],
  ["private-feed.js", "lightsProxyToken", "wardos-lights-proxy-token"],
  ["hub-key-entry.js", "lightsProxyToken", "wardos-lights-proxy-token"],
  ["hub-key-entry.js", "nestProxyToken", "wardosNestProxyToken"],
  ["house-nest.js", "nestProxyToken", "wardosNestProxyToken"],
  ["nest-webrtc-client.js", "nestProxyToken", "wardosNestProxyToken"],
];
/* house-lights / house-nest ingest the seed when they first look for the key; call that hook if the script exposes none */
function load(b, f) {
  b.run(f);
  if (f === "house-nest.js" || f === "house-lights.js") {
    const fn = /function ingestProxyFromQuery\(\) \{[\s\S]*?\n  \}\n/.exec(read(f));
    assert.ok(fn, f + " has ingestProxyFromQuery");
    const pre = /\n  function noDeviceKey\(\)[^\n]*\n/.exec(read(f));
    assert.ok(pre, f + " has noDeviceKey");
    vm.runInContext(`(function(){ var PROXY_TOKEN_LS_KEY = ${JSON.stringify(f === "house-nest.js" ? "wardosNestProxyToken" : "wardos-lights-proxy-token")};
      function qs(n){ var m = location.search.match(new RegExp("[?&]" + n + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : ""; }
      ${pre[0]} ${fn[0]} ingestProxyFromQuery(); })()`, b.ctx);
  }
}

for (const [f, param, slot] of CASES) {
  for (const held of SLOTS) {
    test(`${f}: ?${param}= does NOT replace a paired screen's key (held in ${held}); still stripped`, () => {
      const b = browser(`https://cams.qa.invalid/sheet-index.html?${param}=${SEED}&x=1`, { [held]: PAIRED });
      load(b, f);
      assert.equal(b.ls[held], PAIRED, "paired key untouched");
      for (const s of SLOTS) assert.notEqual(b.ls[s], SEED, "seed not saved into " + s);
      assert.ok(b.replaced.length > 0 && b.replaced.every((u) => !String(u).includes(param)), "seed stripped from the address bar: " + JSON.stringify(b.replaced));
    });
  }
  test(`${f}: ?${param}= on a screen with NO key is saved once (legacy link still works), then stripped`, () => {
    const b = browser(`https://cams.qa.invalid/sheet-index.html?${param}=${SEED}`, {});
    load(b, f);
    assert.equal(b.ls[slot], SEED, "seed saved into " + slot);
    assert.ok(b.replaced.length > 0 && b.replaced.every((u) => !String(u).includes(param)), "seed stripped");
  });
  test(`${f}: a short ?${param}= is never saved, even on an empty screen`, () => {
    const b = browser(`https://cams.qa.invalid/sheet-index.html?${param}=short`, {});
    load(b, f);
    for (const s of SLOTS) assert.equal(b.ls[s], undefined, s);
  });
}

test("hub-key-entry.js: one legacy link carrying both seeds fills an EMPTY screen with both keys", () => {
  const b = browser(`https://cams.qa.invalid/sheet-index.html?lightsProxyToken=${SEED}&nestProxyToken=${SEED}N`, {});
  b.run("hub-key-entry.js");
  assert.equal(b.ls["wardos-lights-proxy-token"], SEED);
  assert.equal(b.ls["wardosNestProxyToken"], SEED + "N");
});

test("every client file that reads a seed param gates the write on noDeviceKey()", () => {
  for (const f of ["house-lights.js", "house-nest.js", "house-tapsync.js", "hub-key-entry.js", "nest-webrtc-client.js", "private-feed.js"]) {
    const s = read(f);
    assert.match(s, /function noDeviceKey\(\)/, f);
    assert.match(s, /SEEDGUARD1/, f);
  }
});
