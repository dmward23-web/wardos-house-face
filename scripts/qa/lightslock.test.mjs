/* PRIVFEED3 · lights proxy: device key header ONLY (no Origin, loopback, XFF or URL key), and QR pairing codes
   (single use, 5-minute expiry, mint needs the key, /api/pair rate limited).
   node --test scripts/qa/lightslock.test.mjs   (needs the ws module: NODE_PATH=<deps>/node_modules)
   No real light is ever touched: the Kasa python is a fake that only logs what it was asked. */
import { freePortSync } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROXY = path.join(ROOT, "scripts/lights-write-proxy.mjs");
const KEY = "test-lights-key-0123456789abcdef";
const ORIGIN = "https://dmward23-web.github.io";
let wsOk = true; try { createRequire(import.meta.url)("ws"); } catch { wsOk = false; }

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "lightslock-"));
  const cfg = path.join(home, ".config", "wardos");
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, "kasa.user"), "fake" + "@" + "example.invalid\n");
  fs.writeFileSync(path.join(cfg, "kasa.password"), "fake\n");
  fs.writeFileSync(path.join(cfg, "lights-proxy.token"), KEY + "\n", { mode: 0o600 });
  const priv = path.join(home, "priv"); fs.mkdirSync(priv, { mode: 0o700 });
  const log = path.join(home, "kasa-calls.log");
  /* fake kasa python: logs every call / daemon op, never talks to any device */
  const fakeJs = path.join(home, "fake-kasa.cjs");
  fs.writeFileSync(fakeJs, `const fs=require("fs");const log=${JSON.stringify(log)};const a=process.argv.slice(2);
if((a[0]||"").endsWith("kasa-daemon.py")){process.stdout.write(JSON.stringify({event:"ready",ok:true,lights:[]})+"\\n");
 let b="";process.stdin.on("data",d=>{b+=d;let i;while((i=b.indexOf("\\n"))>=0){const l=b.slice(0,i);b=b.slice(i+1);let m={};try{m=JSON.parse(l)}catch{}
 if(m.op&&m.op!=="state")fs.appendFileSync(log,"daemon "+m.op+"\\n");process.stdout.write(JSON.stringify({rid:m.rid,ok:true,lights:[]})+"\\n")}});}
else{fs.appendFileSync(log,"write "+a.slice(1).join(" ")+"\\n");process.stdout.write(JSON.stringify({ok:true,lights:[]})+"\\n");}`);
  const fakePy = path.join(home, "fake-python");
  fs.writeFileSync(fakePy, `#!/bin/sh\nexec "${process.execPath}" "${fakeJs}" "$@"\n`, { mode: 0o755 });
  return { home, priv, log, fakePy };
}
function writes(h) { try { return fs.readFileSync(h.log, "utf8").split("\n").filter((l) => /^(write|daemon) /.test(l)); } catch { return []; } }

function start(h, extraEnv = {}, tokenFile = path.join(h.home, ".config/wardos/lights-proxy.token")) {
  const port = freePortSync();
  const env = { ...process.env, HOME: h.home, WARDOS_PRIVATE_DIR: h.priv, KASA_VENV_PYTHON: h.fakePy, ...extraEnv };
  delete env.LIGHTS_PROXY_TOKEN; if (extraEnv.LIGHTS_PROXY_TOKEN) env.LIGHTS_PROXY_TOKEN = extraEnv.LIGHTS_PROXY_TOKEN;
  const child = spawn("node", [PROXY, "--host", "127.0.0.1", "--port", String(port), "--token-file", tokenFile], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  const exited = new Promise((r) => child.on("exit", (c) => r(c)));
  return { child, base: `http://127.0.0.1:${port}`, exited, log: () => out };
}
async function up(p) {
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 100)); try { if ((await fetch(p.base + "/health")).ok) return true; } catch { /* starting */ } }
  return false;
}
const ROUTES = [["GET", "/api/lights"], ["GET", "/api/taps"], ["GET", "/api/spotify"], ["POST", "/api/lights/set", { id: "kitchen", on: true }]];
async function call(base, [method, p, body], headers = {}, suffix = "") {
  const r = await fetch(base + p + suffix, { method, headers: { "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, j };
}

test("lights proxy: refuses to start with no token", { skip: !wsOk && "ws module not installed" }, async () => {
  const h = fakeHome();
  const p = start(h, {}, "/nonexistent/lights.token");
  const code = await Promise.race([p.exited, new Promise((r) => setTimeout(() => r("timeout"), 6000))]);
  if (code === "timeout") p.child.kill();
  assert.equal(code, 3, p.log());
});

test("lights proxy: no key, wrong key, forged Origin, Origin + loopback XFF, key in URL → 401; no light touched", { skip: !wsOk && "ws module not installed" }, async () => {
  const h = fakeHome();
  const p = start(h, { HOUSE_NOKEY_ORIGIN: "1" }); /* the old rollback switch must do nothing now */
  try {
    assert.ok(await up(p), p.log());
    assert.doesNotMatch(p.log(), /HOUSE_NOKEY_ORIGIN/);
    assert.ok(!p.log().includes(KEY), "log never prints the key");
    const cases = [
      ["no key", {}, ""],
      ["wrong key", { "X-Lights-Proxy-Token": "wrong-key-0123456789abcdef" }, ""],
      ["wrong bearer", { Authorization: "Bearer wrong-key-0123456789abcdef" }, ""],
      ["forged house Origin", { Origin: ORIGIN }, ""],
      ["forged Origin + loopback XFF", { Origin: ORIGIN, Referer: ORIGIN + "/", "X-Forwarded-For": "127.0.0.1", "X-Real-IP": "127.0.0.1" }, ""],
      ["key in ?proxyToken", {}, "?proxyToken=" + KEY],
      ["key in ?lightsProxyToken", { Origin: ORIGIN }, "?lightsProxyToken=" + KEY],
    ];
    for (const ep of ROUTES) for (const [label, hd, sfx] of cases) {
      const r = await call(p.base, ep, hd, sfx);
      assert.equal(r.status, 401, `${ep[0]} ${ep[1]} · ${label}`);
    }
    await new Promise((r) => setTimeout(r, 300));
    assert.deepEqual(writes(h), [], "fake Kasa got zero writes");
    const hl = await (await fetch(p.base + "/health", { headers: { Origin: ORIGIN } })).json();
    assert.deepEqual(hl, { ok: true, service: "lights-write-proxy" });
  } finally { p.child.kill(); }
});

test("lights proxy: the right key passes on all four routes (fake Kasa)", { skip: !wsOk && "ws module not installed" }, async () => {
  const h = fakeHome();
  const p = start(h);
  try {
    assert.ok(await up(p), p.log());
    for (const ep of ROUTES) {
      const r = await call(p.base, ep, { "X-Lights-Proxy-Token": KEY });
      assert.notEqual(r.status, 401, ep[1]);
      assert.ok(r.status < 500 || ep[1] === "/api/spotify", ep[1] + " " + r.status);
    }
    const b = await call(p.base, ROUTES[0], { Authorization: "Bearer " + KEY });
    assert.equal(b.status, 200);
    const bad = await fetch(p.base + "/api/lights", { headers: { Host: "bad host[" , "X-Lights-Proxy-Token": KEY } }).catch(() => null);
    if (bad) assert.ok(bad.status === 200 || bad.status === 400);
  } finally { p.child.kill(); }
});

test("pairing: mint needs the key; code works once; wrong and reused codes fail; legacy key names keep working", { skip: !wsOk && "ws module not installed" }, async () => {
  const h = fakeHome();
  const p = start(h);
  try {
    assert.ok(await up(p), p.log());
    for (const hd of [{}, { Origin: ORIGIN }, { "X-Lights-Proxy-Token": "wrong-key-0123456789abcdef" }]) {
      assert.equal((await call(p.base, ["POST", "/api/pair/mint", {}], hd)).status, 401);
    }
    const m = await call(p.base, ["POST", "/api/pair/mint", {}], { "X-Lights-Proxy-Token": KEY });
    assert.equal(m.status, 200);
    assert.match(m.j.code, /^[A-Za-z0-9_-]{22}$/, "128-bit code");
    assert.equal(m.j.ttlSec, 300);
    assert.ok(!("key" in m.j));
    assert.equal((await call(p.base, ["POST", "/api/pair", { code: "wrongcode0123456789abc" }])).status, 401, "well-formed but wrong");
    assert.equal((await call(p.base, ["POST", "/api/pair", { code: "nope" }])).status, 400, "malformed gets 400");
    const ok = await call(p.base, ["POST", "/api/pair", { code: m.j.code }]);
    assert.equal(ok.status, 200);
    assert.equal(ok.j.key, KEY, "the device key comes back, so it lands in the same storage key every screen uses");
    assert.equal((await call(p.base, ["POST", "/api/pair", { code: m.j.code }])).status, 401, "single use");
    assert.ok(!p.log().includes(m.j.code), "codes never logged");
    assert.ok(!p.log().includes(KEY), "key never logged");
    /* the redeemed key unlocks the routes */
    assert.equal((await call(p.base, ROUTES[0], { "X-Lights-Proxy-Token": ok.j.key })).status, 200);
  } finally { p.child.kill(); }
});

test("pairing: /api/pair is rate limited on well-formed codes only (junk gets 400 and cannot block pairing)", { skip: !wsOk && "ws module not installed" }, async () => {
  const h = fakeHome();
  const p = start(h);
  try {
    assert.ok(await up(p), p.log());
    /* HUBPIN1 · 25 junk tries: all 400, none counted toward the pairing bucket */
    const junk = [];
    for (let i = 0; i < 25; i++) junk.push((await call(p.base, ["POST", "/api/pair", { code: "junk-" + i }])).status);
    assert.ok(junk.every((s) => s === 400), junk.join(","));
    const m0 = await call(p.base, ["POST", "/api/pair/mint", {}], { "X-Lights-Proxy-Token": KEY });
    assert.equal((await call(p.base, ["POST", "/api/pair", { code: m0.j.code }])).status, 200, "junk did not block a real pairing");
    /* the junk bucket itself is bounded per client */
    const more = [];
    for (let i = 0; i < 8; i++) more.push((await call(p.base, ["POST", "/api/pair", { code: "x" + i }])).status);
    assert.ok(more.includes(429), "junk bucket bounded: " + more.join(","));
    /* well-formed wrong codes: 4 more allowed this minute (1 used above), then 429 */
    const st = [];
    for (let i = 0; i < 7; i++) st.push((await call(p.base, ["POST", "/api/pair", { code: ("wrongcode" + i + "0123456789abcdef").slice(0, 22) }])).status);
    assert.deepEqual(st.slice(0, 4), [401, 401, 401, 401], st.join(","));
    assert.ok(st.slice(4).every((s) => s === 429), st.join(","));
    /* a valid code is refused while limited too (no brute force around the limit) */
    const m = await call(p.base, ["POST", "/api/pair/mint", {}], { "X-Lights-Proxy-Token": KEY });
    assert.equal((await call(p.base, ["POST", "/api/pair", { code: m.j.code }])).status, 429);
  } finally { p.child.kill(); }
});

test("pairing units: expiry after 5 minutes, single use, format check", { skip: !wsOk && "ws module not installed" }, async () => {
  const m = await import(PROXY);
  const t0 = Date.now();
  const a = m.pairMint(t0);
  assert.equal(m.pairRedeem(a.code, t0 + 5 * 60 * 1000 + 1), "invalid", "expired");
  assert.equal(m.pairRedeem(a.code, t0 + 1000), "invalid", "an expired try burns the code");
  const b = m.pairMint(t0);
  assert.equal(m.pairRedeem(b.code, t0 + 4 * 60 * 1000), "ok");
  assert.equal(m.pairRedeem(b.code, t0 + 4 * 60 * 1000), "invalid", "reuse");
  assert.equal(m.pairRedeem("../../etc", t0), "invalid");
  assert.equal(m.pairRedeem(undefined, t0), "invalid");
  assert.equal(m.PAIR_TTL_MS, 300000);
  assert.equal(m.checkAuth({ headers: { origin: ORIGIN }, url: "/api/lights/set" }, { authToken: KEY }), false);
});

test("client: every screen reads the same storage keys (HUBTOK / lightsProxyToken), pairing strips the fragment, no paste box", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const pair = read("house-pair.js"), lights = read("house-lights.js"), feed = read("private-feed.js"), tap = read("house-tapsync.js"),
    spot = read("house-spotify.js"), nest = read("nest-webrtc-client.js"), hubkey = read("hub-key-entry.js"), dad = read("sheet-dan.html");
  for (const src of [pair, lights, feed, tap, spot, nest, hubkey]) assert.match(src, /wardos-lights-proxy-token/);
  assert.match(nest, /wardosNestProxyToken/); assert.match(hubkey, /wardosNestProxyToken/);
  assert.match(pair, /#pair=/); assert.match(pair, /replaceState/); assert.match(pair, /\/api\/pair\/mint/);
  assert.match(pair, /if \(frag\) \{\s*stripFragment\(\);/, "fragment stripped first thing");
  assert.match(pair, /ev\.isTrusted !== true\) return;/, "TAPPAIR1: redeem only on a real tap");
  assert.ok(pair.indexOf("redeem(code, hub, function") > pair.indexOf('btn.addEventListener("click", function (ev)'), "the only redeem call sits in the tap handler");
  assert.doesNotMatch(hubkey, /<textarea|createElement\("textarea"/, "no paste box");
  assert.doesNotMatch(hubkey, /el\("textarea"/);
  assert.match(dad, /data-pair-tile hidden/); assert.match(dad, /vendor\/qrcode-generator/);
  assert.doesNotMatch(dad, /https?:\/\/cdn|unpkg|jsdelivr/);
  for (const f of ["sheet-index.html", "kid-ainsley.html", "kid-harris.html", "kid-hayes.html"]) assert.doesNotMatch(read(f), /data-pair-tile/, f + " is shared glass: no pairing tile");
  for (const src of [lights, tap, feed]) assert.match(src, /\{16,\}/, "16+ char seeds like the server");
});
