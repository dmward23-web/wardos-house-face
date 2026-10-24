/* CAMLOCK1 · camera + lights proxies lock without a key (node --test scripts/qa/camlock1.test.mjs).
   No real Google, no real lights: Google is a loopback mock; the lights proxy is tested at its auth function. */
import { spawnListening } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROXY = path.join(ROOT, "scripts/nest-webrtc-proxy.mjs");
const KEY = "test-camlock-key-0123456789abcdef";
const ORIGIN = "https://dmward23-web.github.io";

/* ---------- loopback Google mock ---------- */
const googleHits = [];
const google = http.createServer((req, res) => {
  googleHits.push(req.method + " " + req.url);
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/token") return res.end(JSON.stringify({ access_token: "mock-access", expires_in: 3600 }));
    if (/^\/v1\/enterprises\/[^/]+\/devices$/.test(req.url)) {
      return res.end(JSON.stringify({ devices: [{
        name: "enterprises/p/devices/cam1", type: "sdm.devices.types.CAMERA",
        traits: { "sdm.devices.traits.Info": { customName: "Test Cam" }, "sdm.devices.traits.CameraLiveStream": { supportedProtocols: ["WEB_RTC"] } },
        parentRelations: [{ displayName: "Test Room" }],
      }] }));
    }
    if (/:executeCommand$/.test(req.url)) {
      const cmd = (JSON.parse(body || "{}").command || "");
      if (cmd.endsWith("GenerateWebRtcStream")) return res.end(JSON.stringify({ results: { answerSdp: "v=0\n", expiresAt: new Date(Date.now() + 300000).toISOString(), mediaSessionId: "ms1" } }));
      if (cmd.endsWith("ExtendWebRtcStream")) return res.end(JSON.stringify({ results: { expiresAt: new Date(Date.now() + 300000).toISOString(), mediaSessionId: "ms1" } }));
      return res.end("{}");
    }
    res.statusCode = 404; res.end("{}");
  });
});
await new Promise((r) => google.listen(0, "127.0.0.1", r));
const GOOGLE = `http://127.0.0.1:${google.address().port}`;
test.after(() => google.close());

function fakeHome({ tokenFile } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "camlock1-"));
  const cfg = path.join(home, ".config", "wardos");
  fs.mkdirSync(cfg, { recursive: true });
  fs.writeFileSync(path.join(cfg, "nest-refresh.token"), "fake-refresh\n");
  fs.writeFileSync(path.join(cfg, "nest-sdm.json"), '{"projectId":"p","clientId":"c","clientSecret":"s"}');
  if (tokenFile) fs.writeFileSync(path.join(cfg, "nest-device.token"), tokenFile + "\n", { mode: 0o600 });
  return home;
}
function startProxy(home, extraEnv = {}, extraArgs = []) {
  const env = { ...process.env, HOME: home, NEST_PROXY_TEST_GOOGLE: GOOGLE, ...extraEnv };
  delete env.NEST_PROXY_TOKEN; delete env.NEST_REFRESH_TOKEN;
  if (extraEnv.NEST_PROXY_TOKEN) env.NEST_PROXY_TOKEN = extraEnv.NEST_PROXY_TOKEN;
  return spawnListening("node", [PROXY, "--host", "127.0.0.1", "--port", "0", ...extraArgs], { env });   /* LHVID1' · port 0, no race */
}
async function waitUp(h) { if (!(await h.ready)) return false; try { return (await fetch(h.base + "/health")).ok; } catch { return false; } }
const API = [
  ["GET", "/api/cameras"],
  ["POST", "/api/webrtc", { deviceId: "cam1", offerSdp: "v=0" }],
  ["POST", "/api/webrtc/extend", { deviceId: "cam1", mediaSessionId: "ms1" }],
  ["POST", "/api/webrtc/stop", { deviceId: "cam1", mediaSessionId: "ms1" }],
];
async function call(base, [method, p, body], headers = {}, suffix = "") {
  const r = await fetch(base + p + suffix, { method, headers: { "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, j };
}

test("nest proxy refuses to start with no auth token configured", async () => {
  const p = startProxy(fakeHome());
  const code = await Promise.race([p.exited, new Promise((r) => setTimeout(() => r("timeout"), 5000))]);
  if (code === "timeout") p.child.kill();
  assert.equal(code, 3, "expected exit 3, got " + code);
  assert.match(p.log(), /CAMLOCK1/);
  let listening = true; try { await fetch(p.base + "/health"); } catch { listening = false; }
  assert.equal(listening, false, "must not listen without a token");
});

test("nest proxy refuses a short (weak) token too", async () => {
  const p = startProxy(fakeHome(), { NEST_PROXY_TOKEN: "short" });
  const code = await Promise.race([p.exited, new Promise((r) => setTimeout(() => r("timeout"), 5000))]);
  if (code === "timeout") p.child.kill();
  assert.equal(code, 3);
});

test("nest proxy: no key, wrong key, query key, Origin, loopback XFF all → 401 and Google is never called", async () => {
  const p = startProxy(fakeHome({ tokenFile: KEY }));
  try {
    assert.ok(await waitUp(p), "proxy did not start: " + p.log());
    assert.ok(!p.log().includes(KEY), "startup log must not print the token");
    googleHits.length = 0;
    for (const ep of API) {
      for (const [label, headers, suffix] of [
        ["no key", {}, ""],
        ["wrong key", { "X-Nest-Proxy-Token": "wrong-key-0123456789abcdef" }, ""],
        ["wrong bearer", { Authorization: "Bearer wrong-key-0123456789abcdef" }, ""],
        ["query key only", {}, "?proxyToken=" + KEY],
        ["house origin", { Origin: ORIGIN }, ""],
        ["loopback XFF", { "X-Forwarded-For": "127.0.0.1", "X-Real-IP": "127.0.0.1" }, ""],
      ]) {
        const r = await call(p.base, ep, headers, suffix);
        assert.equal(r.status, 401, `${ep[0]} ${ep[1]} ${label}`);
        assert.equal(r.j && r.j.locked, true);
      }
    }
    assert.deepEqual(googleHits, [], "no Google call before auth");
  } finally { p.child.kill(); }
});

test("nest proxy: right key passes auth on all four routes (Google mocked)", async () => {
  const p = startProxy(fakeHome({ tokenFile: KEY }));
  try {
    assert.ok(await waitUp(p), "proxy did not start: " + p.log());
    const h = { "X-Nest-Proxy-Token": KEY };
    const cams = await call(p.base, API[0], h);
    assert.equal(cams.status, 200);
    assert.equal(cams.j.cameras.length, 1);
    const offer = await call(p.base, API[1], h);
    assert.equal(offer.status, 200, JSON.stringify(offer.j));
    assert.equal(offer.j.mediaSessionId, "ms1");
    for (const ep of API.slice(2)) {
      const r = await call(p.base, ep, h);
      assert.notEqual(r.status, 401, ep[1]);
      assert.ok(r.status < 500, ep[1] + " " + r.status + " " + JSON.stringify(r.j));
    }
    assert.ok(googleHits.some((x) => x.startsWith("POST /token")), "mock Google was used");
  } finally { p.child.kill(); }
});

test("nest proxy: NEST_PROXY_TOKEN env is label-only (alone it refuses to start; with a device file it gets 401), and any one of several files works", async () => {
  /* FOLLOWUP2 · the env var is a retired source like nest-proxy.token */
  const p = startProxy(fakeHome(), { NEST_PROXY_TOKEN: KEY });
  const code = await Promise.race([p.exited, new Promise((r) => setTimeout(() => r("timeout"), 5000))]);
  if (code === "timeout") p.child.kill();
  assert.equal(code, 3, "env key alone must not start the proxy");
  const ENVK = "env-retired-key-0123456789abcdef";
  const pe = startProxy(fakeHome({ tokenFile: KEY }), { NEST_PROXY_TOKEN: ENVK });
  try {
    assert.ok(await waitUp(pe));
    assert.equal((await call(pe.base, API[0], { "X-Nest-Proxy-Token": ENVK })).status, 401);
    assert.equal((await call(pe.base, API[0], { "X-Nest-Proxy-Token": KEY })).status, 200);
  } finally { pe.child.kill(); }
  const home = fakeHome();
  const a = path.join(home, "a.token"), b = path.join(home, "b.token");
  fs.writeFileSync(a, "first-key-0123456789abcdef\n"); fs.writeFileSync(b, KEY + "\n");
  const q = startProxy(home, {}, ["--auth-token-file", a, "--auth-token-file", b]);
  try {
    assert.ok(await waitUp(q));
    assert.equal((await call(q.base, API[0], { "X-Nest-Proxy-Token": KEY })).status, 200);
    assert.equal((await call(q.base, API[0], { "X-Nest-Proxy-Token": "first-key-0123456789abcdef" })).status, 200);
  } finally { q.child.kill(); }
});

test("nest proxy: /health says only ok; .git, data, scripts → 404; page code is public", async () => {
  const p = startProxy(fakeHome({ tokenFile: KEY }));
  try {
    assert.ok(await waitUp(p));
    for (const hp of ["/health", "/api/health"]) {
      const r = await fetch(p.base + hp);
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { ok: true });
    }
    for (const bad of ["/.git/config", "/.git/HEAD", "/data/nest-snaps/.gitkeep", "/data/nest-live.json", "/scripts/nest-webrtc-proxy.mjs", "/scripts/kasa-daemon.py", "/%2e%2e/%2e%2e/etc/passwd", "/.env"]) {
      const r = await fetch(p.base + bad, { headers: { "X-Nest-Proxy-Token": KEY } });
      assert.equal(r.status, 404, bad);
    }
    assert.equal((await fetch(p.base + "/nest-webrtc.html")).status, 200);
    assert.equal((await fetch(p.base + "/nest-webrtc-client.js")).status, 200);
  } finally { p.child.kill(); }
});

test("nest checkAuth / loadAuthTokens units: constant-time header compare, no query, no tokens = deny", async () => {
  const m = await import(PROXY);
  assert.equal(m.checkAuth({ headers: {}, url: "/api/cameras" }, []), false);
  assert.equal(m.checkAuth({ headers: { "x-nest-proxy-token": KEY }, url: "/api/cameras" }, []), false);
  assert.equal(m.checkAuth({ headers: { "x-nest-proxy-token": KEY }, url: "/api/cameras" }, [KEY]), true);
  assert.equal(m.checkAuth({ headers: {}, url: "/api/cameras?proxyToken=" + KEY }, [KEY]), false);
  assert.equal(m.checkAuth({ headers: { "x-nest-proxy-token": KEY + "x" }, url: "/" }, [KEY]), false);
  const toks = m.loadAuthTokens({ cliToken: "", authFiles: ["/nonexistent/x"] }, {});
  assert.deepEqual(toks, []);
});

test("client code: token only from local storage, sent as header, never in a URL; locked state has no demo frame", () => {
  const client = fs.readFileSync(path.join(ROOT, "nest-webrtc-client.js"), "utf8");
  const viewer = fs.readFileSync(path.join(ROOT, "nest-webrtc.html"), "utf8");
  const tile = fs.readFileSync(path.join(ROOT, "house-nest.js"), "utf8");
  assert.match(client, /X-Nest-Proxy-Token/);
  assert.match(client, /wardos-lights-proxy-token/);
  assert.match(client, /Camera locked · needs pairing/);
  assert.doesNotMatch(tile, /[&?]proxyToken=/, "tile must not put the key in a viewer link");
  /* CAMREST2: a locked tile rests ("Camera resting") and says "needs pairing" in its label, never LOCKED · PAIR */
  assert.doesNotMatch(tile, /LOCKED · PAIR/);
  assert.match(tile, /needs pairing/);
  assert.match(viewer, /showLocked/);
  for (const src of [client, tile]) assert.match(src, /replaceState/, "pairing key is stripped from the address bar");
});

/* ---------- lights proxy auth (function level; never spawns, never touches a light) ---------- */
test("lights proxy: Origin alone, loopback, query key and no-token config never unlock", async (t) => {
  let m;
  try { m = await import(path.join(ROOT, "scripts/lights-write-proxy.mjs")); }
  catch (e) { if (/Cannot find module 'ws'/.test(String(e))) { t.skip("ws module not installed here (set NODE_PATH to the deps folder)"); return; } throw e; }
  const args = { authToken: KEY };
  const req = (headers, url = "/api/lights/set") => ({ headers, url, socket: { remoteAddress: "127.0.0.1" } });
  assert.equal(m.checkAuth(req({ origin: ORIGIN }), args), false, "forged Origin must not unlock lights/set");
  assert.equal(m.checkAuth(req({ origin: ORIGIN }, "/api/taps"), args), false);
  assert.equal(m.checkAuth(req({ origin: ORIGIN }, "/api/spotify/control"), args), false);
  assert.equal(m.checkAuth(req({ "x-forwarded-for": "127.0.0.1" }), args), false);
  assert.equal(m.checkAuth(req({}, "/api/lights?proxyToken=" + KEY), args), false);
  assert.equal(m.checkAuth(req({}, "/api/lights?lightsProxyToken=" + KEY), args), false);
  assert.equal(m.checkAuth(req({ "x-lights-proxy-token": "wrong-key-0123456789abcdef" }), args), false);
  assert.equal(m.checkAuth(req({}), { authToken: "" }), false, "no token configured = deny");
  assert.equal(m.checkAuth(req({ origin: ORIGIN }), { authToken: "" }), false);
  assert.equal(m.checkAuth(req({ "x-lights-proxy-token": KEY }), args), true);
  assert.equal(m.checkAuth(req({ authorization: "Bearer " + KEY }), args), true);
  /* PRIVFEED3 · there is no keyless mode at all: an extra option or env can never reopen Origin routes */
  assert.equal(m.checkAuth(req({ origin: ORIGIN }), args, { nokeyOrigin: true }), false);
});

test("lights proxy source: refuses to start without a token, no ephemeral key, public health is ok+service only", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/lights-write-proxy.mjs"), "utf8");
  assert.match(src, /FATAL: CAMLOCK1 · no auth token/);
  assert.match(src, /process\.exit\(3\)/);
  assert.doesNotMatch(src, /generated ephemeral/);
  assert.doesNotMatch(src, /localhost API open/);
  assert.doesNotMatch(src, /searchParams\.get\("proxyToken"\)/);
  assert.doesNotMatch(src, /headers\["x-forwarded-for"\]/);
  assert.match(src, /json\(res, 200, \{ ok: true, service: "lights-write-proxy" \}\)/);
  assert.match(src, /timingSafeEqual/);
  assert.doesNotMatch(src, /HOUSE_NOKEY_ORIGIN/, "PRIVFEED3 · rollback switch deleted");
  assert.doesNotMatch(src, /req\.headers\.host/, "never builds a URL from the Host header");
});

test("nest proxy: bad Host / bad request target never crash it; deviceId must be exactly enterprises/<id>/devices/<id>", async () => {
  const net = await import("node:net");
  const p = startProxy(fakeHome({ tokenFile: KEY }));
  try {
    assert.ok(await waitUp(p));
    for (const raw of [`GET /api/cameras HTTP/1.1\r\nHost: [bad\r\nX-Nest-Proxy-Token: ${KEY}\r\n\r\n`, `GET //[x HTTP/1.1\r\nHost: a b\r\n\r\n`]) {
      await new Promise((resolve) => { const s = net.connect(p.port, "127.0.0.1", () => s.end(raw)); s.on("data", () => {}); s.on("close", resolve); s.on("error", resolve); });
    }
    assert.equal((await fetch(p.base + "/health")).status, 200, "still alive after bad requests");
    googleHits.length = 0;
    for (const id of ["enterprises/../../x", "enterprises/p/devices/../../../v2/other", "enterprises/p/devices/cam1/extra", "enterprises/p/structures/s1", "enterprises//devices/cam1"]) {
      const r = await call(p.base, ["POST", "/api/webrtc", { deviceId: id, offerSdp: "v=0" }], { "X-Nest-Proxy-Token": KEY });
      assert.equal(r.status, 404, id);
    }
    assert.ok(!googleHits.some((x) => x.includes("..") || /executeCommand/.test(x)), "no SDM command for a bad device name: " + googleHits.join(","));
    const ok = await call(p.base, ["POST", "/api/webrtc", { deviceId: "enterprises/p/devices/cam1", offerSdp: "v=0" }], { "X-Nest-Proxy-Token": KEY });
    assert.equal(ok.status, 200);
    const m = await import(PROXY);
    assert.ok(m.DEVICE_NAME_RE.test("enterprises/p-1/devices/AVPHw_x-9"));
    assert.ok(!m.DEVICE_NAME_RE.test("enterprises/p/devices/a/b"));
  } finally { p.child.kill(); }
});
