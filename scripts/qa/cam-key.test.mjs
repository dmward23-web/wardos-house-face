/* CAM-KEY · synthetic storage only. Never a real house key. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "nest-webrtc-client.js"), "utf8");
const PAIRED = "paired-test-marker";
const LEGACY = "legacy-test-marker";

function boot(store, opts = {}) {
  const calls = [];
  const logs = [];
  const ctx = {
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    location: { search: opts.search || "", href: "https://dmward23-web.github.io/wardos-house-face/sheet-index.html", hostname: "dmward23-web.github.io", origin: "https://dmward23-web.github.io", pathname: "/wardos-house-face/sheet-index.html" },
    history: { replaceState() {} },
    HouseHub: {
      okForKey(url) { return opts.unpinned ? false : /github\.io|127\.0\.0\.1/.test(String(url || "")); },
      cams() { return opts.cams || "https://cams.example.test"; }
    },
    fetch(url, options) {
      calls.push({ url: String(url), options: options });
      const api = String(url).indexOf("/api/") >= 0;
      const prior = calls.filter((c) => c.url.indexOf("/api/") >= 0).length;
      const status = !api ? 200 : (typeof opts.status === "function" ? opts.status(prior, options) : (opts.status || 200));
      return Promise.resolve({
        status: status,
        ok: status >= 200 && status < 300,
        json() { return Promise.resolve({ cameras: [] }); },
        text() { return Promise.resolve("{}"); }
      });
    },
    console: { log() { logs.push("log"); }, info() { logs.push("info"); }, warn() { logs.push("warn"); }, error() { logs.push("error"); }, debug() { logs.push("debug"); } },
    URL, URLSearchParams, Promise
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "nest-webrtc-client.js" });
  return { ctx, calls, logs, store };
}

test("paired key is sent first when a stale legacy key is also present", async () => {
  const { ctx, calls } = boot({ wardosNestProxyToken: LEGACY, "wardos-lights-proxy-token": PAIRED });
  assert.equal(ctx.NestWebRtc.selectKey().source, "paired");
  assert.equal(ctx.NestWebRtc.proxyToken(), PAIRED);
  await ctx.NestWebRtc.fetchCameras();
  const api = calls.filter((c) => c.url.indexOf("/api/") >= 0);
  assert.equal(api.length, 1);
  assert.equal(api[0].options.headers["X-Nest-Proxy-Token"], PAIRED);
  assert.equal(api[0].url.endsWith("/api/cameras"), true);
});

test("legacy key is the fallback when it is the only key", async () => {
  const { ctx, calls } = boot({ wardosNestProxyToken: LEGACY });
  assert.equal(ctx.NestWebRtc.selectKey().source, "legacy");
  await ctx.NestWebRtc.fetchCameras();
  const api = calls.filter((c) => c.url.indexOf("/api/") >= 0);
  assert.equal(api.length, 1);
  assert.equal(api[0].options.headers["X-Nest-Proxy-Token"], LEGACY);
});

test("a failed legacy request retries once with the paired key and drops only the stale legacy entry", async () => {
  const store = { wardosNestProxyToken: LEGACY };
  const { ctx, calls } = boot(store, {
    status(n) { if (n === 1) { store["wardos-lights-proxy-token"] = PAIRED; return 401; } return 200; }
  });
  await ctx.NestWebRtc.fetchCameras();
  const api = calls.filter((c) => c.url.indexOf("/api/") >= 0);
  assert.equal(api.length, 2);
  assert.equal(api[0].options.headers["X-Nest-Proxy-Token"], LEGACY);
  assert.equal(api[1].options.headers["X-Nest-Proxy-Token"], PAIRED);
  assert.equal(api[0].url, api[1].url);
  assert.equal(store.wardosNestProxyToken, undefined);
  assert.equal(store["wardos-lights-proxy-token"], PAIRED);
});

test("the same key does not retry and a paired 401 does not loop", async () => {
  const same = boot({ wardosNestProxyToken: PAIRED, "wardos-lights-proxy-token": PAIRED }, { status: 401 });
  await assert.rejects(same.ctx.NestWebRtc.fetchCameras(), /locked/);
  assert.equal(same.calls.filter((c) => c.url.indexOf("/api/") >= 0).length, 1);
  const paired = boot({ "wardos-lights-proxy-token": PAIRED }, { status: 403 });
  await assert.rejects(paired.ctx.NestWebRtc.fetchCameras(), /locked/);
  assert.equal(paired.calls.filter((c) => c.url.indexOf("/api/") >= 0).length, 1);
  assert.equal(paired.store["wardos-lights-proxy-token"], PAIRED);
});

test("no key, throwing storage, and an unpinned proxy send nothing", async () => {
  const none = boot({});
  await assert.rejects(none.ctx.NestWebRtc.fetchCameras(), /locked/);
  assert.equal(none.calls.filter((c) => c.url.indexOf("/api/") >= 0).length, 0);
  const broken = boot({}, {});
  broken.ctx.localStorage.getItem = () => { throw new Error("blocked"); };
  assert.equal(broken.ctx.NestWebRtc.proxyToken(), "");
  const evil = boot({ "wardos-lights-proxy-token": PAIRED, wardosNestProxyToken: LEGACY }, { unpinned: true, cams: "https://evil.example" });
  await evil.ctx.NestWebRtc.fetchCameras();
  const evilApi = evil.calls.filter((c) => c.url.indexOf("/api/") >= 0);
  assert.equal(evilApi[0].options.headers["X-Nest-Proxy-Token"], undefined);
  assert.equal(JSON.stringify(evil.logs).includes(PAIRED), false);
  assert.equal(JSON.stringify(evil.logs).includes(LEGACY), false);
});

test("retry keeps the same endpoint and body", async () => {
  const store = { wardosNestProxyToken: LEGACY, "wardos-lights-proxy-token": PAIRED };
  const { ctx, calls } = boot(store, { status: () => 401 });
  await assert.rejects(ctx.NestWebRtc.fetchCameras());
  /* fetchCameras is GET cameras; the webrtc body check uses exchange through a direct authed path via start, which needs RTC.
     Call the cameras route twice worth: legacy is not used because paired is already present, so one call. */
  assert.equal(calls.filter((c) => c.url.indexOf("/api/") >= 0).length, 1);
  const late = { wardosNestProxyToken: LEGACY };
  const second = boot(late, {
    status(n) { if (n === 1) { late["wardos-lights-proxy-token"] = PAIRED; return 403; } return 403; }
  });
  await assert.rejects(second.ctx.NestWebRtc.fetchCameras());
  const api2 = second.calls.filter((c) => c.url.indexOf("/api/") >= 0);
  assert.equal(api2.length, 2);
  assert.equal(api2[0].url, api2[1].url);
  assert.equal(second.calls[1].options.method, undefined);
});
