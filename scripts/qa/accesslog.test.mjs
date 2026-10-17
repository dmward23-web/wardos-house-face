/* ACCESSLOG · both house proxies write one JSON line per request to ~/.cache/wardos/<proxy>-access.log
   (file 600, dir 700). No key value, query string, fragment or hash of a key ever reaches the file, including keys
   sent in the URL, path or User-Agent; rotation at the size cap keeps 3; a broken log never breaks a request.
   node --test scripts/qa/accesslog.test.mjs   (needs the ws module: NODE_PATH=<deps>/node_modules) */
import { freePortSync } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createAccessLog, cleanPath, cleanIp, cleanUa, isoLocal } from "../access-log.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NEST = path.join(ROOT, "scripts/nest-webrtc-proxy.mjs");
const LIGHTS = path.join(ROOT, "scripts/lights-write-proxy.mjs");
const DEV = "acclog-device-key-0123456789abcdefXYZ";
const RET = "acclog-retired-key-fedcba9876543210QRS";
const LKEY = "acclog-lights-key-0123456789abcdefLMN";
let wsOk = true; try { createRequire(import.meta.url)("ws"); } catch { wsOk = false; }
const TIME_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/;

/* every form of a secret that must never appear in the log */
function forms(k) {
  const h = (alg, enc) => crypto.createHash(alg).update(k).digest(enc);
  return [k, encodeURIComponent(k), Buffer.from(k).toString("base64"), k.slice(0, 16), k.slice(-16),
    h("sha256", "hex"), h("sha256", "hex").slice(0, 12), h("sha256", "base64"), h("sha1", "hex")];
}
function assertClean(text, keys, extra = []) {
  for (const k of keys) for (const f of forms(k)) assert.ok(!text.includes(f), `log leaks a form of a key (${f.length} chars)`);
  for (const bad of ["?", "#", "lightsProxyToken", "nestProxyToken", "proxyToken", "refresh=1", ...extra]) {
    for (const line of text.trim().split("\n")) assert.ok(!JSON.parse(line).p.includes(bad), `path has '${bad}': ${JSON.parse(line).p}`);
  }
}
function mode(p) { return fs.statSync(p).mode & 0o777; }
function readLines(file) { return fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l)); }
async function waitLines(file, n) {
  for (let i = 0; i < 50; i++) { try { if (readLines(file).length >= n) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 50)); }
}
async function up(base) {
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 100)); try { if ((await fetch(base + "/health")).ok) return true; } catch { /* starting */ } }
  return false;
}
function launch(script, args, env) {
  const port = freePortSync();
  const e = { ...process.env, ...env };
  for (const k of ["NEST_PROXY_TOKEN", "NEST_REFRESH_TOKEN", "LIGHTS_PROXY_TOKEN", "WARDOS_ACCESS_LOG_DIR", "WARDOS_ACCESS_LOG_MAX_BYTES"]) if (!(k in env)) delete e[k];
  const child = spawn("node", [script, "--host", "127.0.0.1", "--port", String(port), ...args], { env: e, stdio: ["ignore", "pipe", "pipe"] });
  let out = ""; child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  return { child, base: `http://127.0.0.1:${port}`, out: () => out };
}

/* ---------- loopback Google mock for the cams proxy ---------- */
const google = http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/token") return res.end(JSON.stringify({ access_token: "mock-access", expires_in: 3600 }));
    if (/^\/v1\/enterprises\/[^/]+\/devices$/.test(req.url)) return res.end(JSON.stringify({ devices: [] }));
    res.statusCode = 404; res.end("{}");
  });
});
await new Promise((r) => google.listen(0, "127.0.0.1", r));
const GOOGLE = `http://127.0.0.1:${google.address().port}`;
test.after(() => google.close());

function nestHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "acclog-nest-"));
  const cfg = path.join(home, ".config", "wardos"); fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, "nest-refresh.token"), "fake-refresh\n");
  fs.writeFileSync(path.join(cfg, "nest-sdm.json"), '{"projectId":"p","clientId":"c","clientSecret":"s"}');
  fs.writeFileSync(path.join(cfg, "nest-device.token"), DEV + "\n", { mode: 0o600 });
  fs.writeFileSync(path.join(cfg, "nest-proxy.token"), RET + "\n", { mode: 0o600 });
  /* a looser pre-existing cache dir must end up 700 */
  fs.mkdirSync(path.join(home, ".cache", "wardos"), { recursive: true, mode: 0o755 }); fs.chmodSync(path.join(home, ".cache", "wardos"), 0o755);
  return { home, cfg };
}
function startNest(h, env = {}) {
  return launch(NEST, ["--auth-token-file", path.join(h.cfg, "nest-device.token"), "--auth-token-file", path.join(h.cfg, "nest-proxy.token")],
    { HOME: h.home, NEST_PROXY_TEST_GOOGLE: GOOGLE, ...env });
}

test("ACCESSLOG cams: one line per request, right slot/status/ip/ua, no key/query/hash anywhere, file 600 dir 700", async () => {
  const h = nestHome();
  const p = startNest(h);
  try {
    assert.ok(await up(p.base), p.out());
    const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const reqs = [
      ["no key", "/api/cameras", {}, 401, "none"],
      ["device key", "/api/cameras?refresh=1", { "X-Nest-Proxy-Token": DEV, "cf-connecting-ip": "203.0.113.9", "User-Agent": UA_IOS }, 200, "device"],
      ["retired key", "/api/cameras", { "X-Nest-Proxy-Token": RET, "cf-connecting-ip": "2001:db8::7" }, 200, "retired"],
      ["bearer device", "/api/cameras", { Authorization: "Bearer " + DEV }, 200, "device"],
      ["wrong key", "/api/cameras", { "X-Nest-Proxy-Token": "wrong-key-0123456789abcdef" }, 401, "none"],
      ["key in URL", `/api/cameras?nestProxyToken=${DEV}&proxyToken=${encodeURIComponent(RET)}#k=${DEV}`, {}, 401, "none"],
      ["key in path", `/api/${DEV}/x`, {}, 401, "none"],
      ["encoded key in path", `/${encodeURIComponent(RET)}.html`, {}, 404, "none"],
      ["key in UA", "/health", { "User-Agent": "curl/8 " + DEV + " " + "x".repeat(300), "cf-connecting-ip": "not-an-ip<script>" }, 200, "none"],
      ["static with key", "/nest-webrtc.html", { "X-Nest-Proxy-Token": DEV }, 200, "device"],
    ];
    for (const [, url, headers, want] of reqs) {
      const r = await fetch(p.base + url, { headers });
      assert.equal(r.status, want, url.slice(0, 20));
      await r.arrayBuffer();
    }
    const file = path.join(h.home, ".cache", "wardos", "nest-webrtc-proxy-access.log");
    await waitLines(file, reqs.length + 1);
    const lines = readLines(file).filter((l) => !(l.p === "/health" && l.ua.startsWith("node")));
    const raw = fs.readFileSync(file, "utf8");
    assertClean(raw, [DEV, RET]);
    assert.equal(mode(file), 0o600, "file mode");
    assert.equal(mode(path.dirname(file)), 0o700, "dir mode");
    for (const [name, , , want, slot] of reqs) {
      const l = lines.shift();
      assert.deepEqual(Object.keys(l), ["t", "m", "p", "s", "slot", "ip", "ua"], name);
      assert.match(l.t, TIME_RE, name); assert.equal(l.s, want, name); assert.equal(l.slot, slot, name);
      assert.ok(l.ua.length <= 120, name);
    }
    const all = readLines(file);
    const dev = all.find((l) => l.ip === "203.0.113.9");
    assert.equal(dev.p, "/api/cameras"); assert.match(dev.ua, /^Mozilla\/5\.0 \(iPhone/);
    assert.ok(all.some((l) => l.ip === "2001:db8::7" && l.slot === "retired"));
    assert.ok(all.some((l) => l.ip === "invalid"), "a junk cf-connecting-ip is not logged verbatim");
    assert.ok(all.some((l) => l.p === "/api/<redacted>/x"));
    assert.ok(all.some((l) => l.p === "/<redacted>"));
    assert.ok(all.some((l) => l.ua.startsWith("curl/8 <redacted> xxx") && l.ua.length === 120));
    assert.ok(!p.out().includes(DEV) && !p.out().includes(RET), "stdout never prints a key");
  } finally { p.child.kill(); }
});

function lightsHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "acclog-lights-"));
  const cfg = path.join(home, ".config", "wardos"); fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, "kasa.user"), "fake" + "@" + "example.invalid\n");
  fs.writeFileSync(path.join(cfg, "kasa.password"), "fake\n");
  fs.writeFileSync(path.join(cfg, "lights-proxy.token"), LKEY + "\n", { mode: 0o600 });
  const priv = path.join(home, "priv"); fs.mkdirSync(priv, { mode: 0o700 });
  const fakeJs = path.join(home, "fake-kasa.cjs");
  fs.writeFileSync(fakeJs, `const a=process.argv.slice(2);
if((a[0]||"").endsWith("kasa-daemon.py")){process.stdout.write(JSON.stringify({event:"ready",ok:true,lights:[]})+"\\n");
 let b="";process.stdin.on("data",d=>{b+=d;let i;while((i=b.indexOf("\\n"))>=0){const l=b.slice(0,i);b=b.slice(i+1);let m={};try{m=JSON.parse(l)}catch{}
 process.stdout.write(JSON.stringify({rid:m.rid,ok:true,lights:[]})+"\\n")}});}
else{process.stdout.write(JSON.stringify({ok:true,lights:[]})+"\\n");}`);
  const fakePy = path.join(home, "fake-python");
  fs.writeFileSync(fakePy, `#!/bin/sh\nexec "${process.execPath}" "${fakeJs}" "$@"\n`, { mode: 0o755 });
  return { home, cfg, priv, fakePy };
}
function startLights(h, env = {}) {
  return launch(LIGHTS, ["--token-file", path.join(h.cfg, "lights-proxy.token")], { HOME: h.home, WARDOS_PRIVATE_DIR: h.priv, KASA_VENV_PYTHON: h.fakePy, ...env });
}

test("ACCESSLOG lights: device / pair / none slots, keys in URL or UA never logged, pair code never logged, file 600", { skip: !wsOk && "ws module not installed" }, async () => {
  const h = lightsHome();
  const p = startLights(h);
  try {
    assert.ok(await up(p.base), p.out());
    const J = { "Content-Type": "application/json" };
    const s = async (url, init = {}) => { const r = await fetch(p.base + url, init); const t = await r.text(); return { status: r.status, t }; };
    assert.equal((await s("/api/lights")).status, 401);
    assert.equal((await s("/api/lights", { headers: { "X-Lights-Proxy-Token": LKEY, "cf-connecting-ip": "198.51.100.4" } })).status, 200);
    assert.equal((await s(`/api/lights?lightsProxyToken=${LKEY}`)).status, 401);
    assert.equal((await s(`/sheet-index.html?lightsProxyToken=${encodeURIComponent(LKEY)}#pair=x`)).status >= 200, true);
    assert.equal((await s("/api/taps", { headers: { "User-Agent": "Go-http-client/1.1 " + LKEY } })).status, 401);
    const mint = await s("/api/pair/mint", { method: "POST", headers: { "X-Lights-Proxy-Token": LKEY } });
    assert.equal(mint.status, 200);
    const code = JSON.parse(mint.t).code;
    const redeem = await s("/api/pair", { method: "POST", headers: J, body: JSON.stringify({ code }) });
    assert.equal(redeem.status, 200);
    assert.equal((await s("/api/pair", { method: "POST", headers: J, body: JSON.stringify({ code }) })).status, 401);
    const file = path.join(h.home, ".cache", "wardos", "lights-write-proxy-access.log");
    await waitLines(file, 9);
    const raw = fs.readFileSync(file, "utf8");
    assertClean(raw, [LKEY, code], ["pair="]);
    assert.equal(mode(file), 0o600); assert.equal(mode(path.dirname(file)), 0o700);
    const L = readLines(file).filter((l) => l.p !== "/health");
    const slots = L.map((l) => `${l.m} ${l.p} ${l.s} ${l.slot}`);
    assert.deepEqual(slots, [
      "GET /api/lights 401 none",
      "GET /api/lights 200 device",
      "GET /api/lights 401 none",
      `GET /sheet-index.html ${L[3].s} none`,
      "GET /api/taps 401 none",
      "POST /api/pair/mint 200 device",
      "POST /api/pair 200 pair",
      "POST /api/pair 401 pair",
    ]);
    assert.equal(L[1].ip, "198.51.100.4");
    assert.equal(L[4].ua, "Go-http-client/1.1 <redacted>");
    for (const l of L) assert.match(l.t, TIME_RE);
  } finally { p.child.kill(); }
});

/* ---------- unit: rotation, failure isolation, repo refusal ---------- */
function fakeReqRes(url, status = 200, headers = {}) {
  const res = new EventEmitter(); res.statusCode = status; res.writableFinished = true; res.headersSent = true;
  return { req: { method: "GET", url, headers }, res };
}
test("ACCESSLOG rotation: at the cap the log rolls to .1 .2 .3, keeps 3, newest in the live file, every file 600", () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "acclog-rot-")), "logs");
  const KEY = "rotation-key-0123456789abcdef";
  const log = createAccessLog({ name: "unit", secrets: () => [KEY], env: { WARDOS_ACCESS_LOG_DIR: dir, WARDOS_ACCESS_LOG_MAX_BYTES: "600" } });
  for (let i = 0; i < 60; i++) {
    const { req, res } = fakeReqRes(`/api/n${i}?k=${KEY}`, 200, { "user-agent": "ua " + KEY });
    log.setSlot(req, "device"); log.attach(req, res); res.emit("finish"); res.emit("close");
  }
  const files = fs.readdirSync(dir).sort();
  assert.deepEqual(files, ["unit-access.log", "unit-access.log.1", "unit-access.log.2", "unit-access.log.3"]);
  assert.equal(mode(dir), 0o700);
  let total = 0;
  for (const f of files) {
    const fp = path.join(dir, f);
    assert.equal(mode(fp), 0o600, f);
    assert.ok(fs.statSync(fp).size <= 600, `${f} under the cap`);
    const txt = fs.readFileSync(fp, "utf8");
    assert.ok(!txt.includes(KEY) && !txt.includes("?"), f);
    total += txt.trim().split("\n").length;
  }
  const live = readLines(path.join(dir, "unit-access.log"));
  assert.equal(live.at(-1).p, "/api/n59", "newest line in the live file");
  const oldest = readLines(path.join(dir, "unit-access.log.3"));
  assert.ok(Number(oldest[0].p.slice(6)) > 0, "the oldest lines were dropped");
  assert.ok(total < 60, "only 3 rotated files kept");
  const one = readLines(path.join(dir, "unit-access.log.1"));
  assert.ok(Number(one.at(-1).p.slice(6)) + 1 === Number(live[0].p.slice(6)), ".1 continues straight into the live file");
});

test("ACCESSLOG: a broken log never breaks a request; a log dir inside the repo is refused", async () => {
  /* unit: unwritable target (the dir path is a FILE) */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acclog-bad-"));
  const notDir = path.join(tmp, "file"); fs.writeFileSync(notDir, "x");
  const log = createAccessLog({ name: "u", env: { WARDOS_ACCESS_LOG_DIR: path.join(notDir, "sub") } });
  const { req, res } = fakeReqRes("/x");
  assert.doesNotThrow(() => { log.attach(req, res); res.emit("finish"); });
  /* repo refusal */
  const inRepo = createAccessLog({ name: "u", env: { WARDOS_ACCESS_LOG_DIR: path.join(ROOT, "data") } });
  assert.equal(inRepo.enabled, false);
  const rr = fakeReqRes("/y"); inRepo.attach(rr.req, rr.res); rr.res.emit("finish");
  assert.ok(!fs.existsSync(path.join(ROOT, "data", "u-access.log")));
  /* live proxy with a broken log dir still answers every request */
  const h = nestHome();
  const p = startNest(h, { WARDOS_ACCESS_LOG_DIR: path.join(notDir, "sub") });
  try {
    assert.ok(await up(p.base), p.out());
    assert.equal((await fetch(p.base + "/api/cameras", { headers: { "X-Nest-Proxy-Token": DEV } })).status, 200);
    assert.equal((await fetch(p.base + "/api/cameras")).status, 401);
    assert.match(p.out(), /access logging degraded; requests unaffected/);
    assert.equal((p.out().match(/\[access-log\]/g) || []).length, 1, "warns once, not per request");
  } finally { p.child.kill(); }
});

test("ACCESSLOG helpers: path strips query/fragment, ip shape-checked, ua capped, time carries an offset", () => {
  assert.equal(cleanPath("/a/b?c=d#e", []), "/a/b");
  assert.equal(cleanPath("/a#x?y", []), "/a");
  assert.equal(cleanPath("http://evil.example/z?q", []), "/z");
  assert.equal(cleanIp("203.0.113.1, 10.0.0.1"), "203.0.113.1");
  assert.equal(cleanIp(undefined), "-");
  assert.equal(cleanIp("<x>"), "invalid");
  assert.equal(cleanUa("a\nb", []), "a b");
  assert.equal(cleanUa("z".repeat(500), []).length, 120);
  assert.match(isoLocal(), TIME_RE);
});
