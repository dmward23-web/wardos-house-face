/* r53 autoreload. The build token in version.json and sheet-index.html must match.
   A new token reloads only after 60s idle, once per token, and a failed fetch backs off.
   A private feed that answers 530 redraws that tile after the backoff, and a 401 does not loop. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const steady = Object.create(Math);
steady.random = () => 0.5;

const ROOT = process.env.WARDOS_ROOT
  ? path.resolve(process.env.WARDOS_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("r53 the build token in version.json matches the wall meta tag", () => {
  const ver = JSON.parse(read("version.json"));
  const html = read("sheet-index.html");
  const meta = html.match(/<meta name="wardos-build" content="([^"]+)"\s*\/?>/);
  assert.ok(meta, "sheet-index.html has a wardos-build meta");
  assert.equal(meta[1], ver.token);
  assert.ok(!/[@]/.test(ver.token) && !/\d{3}[-.]\d{3}/.test(ver.token), "token is not an address or a phone");
});

function freshPage(start, opts = {}) {
  const clock = { t: start };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); }
    static now() { return clock.t; }
  }
  const q = [];
  let nid = 0;
  const reloads = [];
  const ss = {};
  const ls = { "wardos-private-feed-token": "wall-key-wall-key-01" };
  const fetches = [];
  const listeners = {};
  const src = read("house-fresh.js");
  const ctx = vm.createContext({
    Intl, Date: FakeDate, console, Math,
    setTimeout: (fn, ms) => { nid += 1; q.push({ id: nid, at: clock.t + (ms || 0), fn, every: 0 }); return nid; },
    setInterval: (fn, ms) => { nid += 1; q.push({ id: nid, at: clock.t + ms, fn, every: ms }); return nid; },
    clearTimeout: (id) => { const i = q.findIndex((t) => t.id === id); if (i >= 0) q.splice(i, 1); },
    sessionStorage: { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); } },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    location: {
      pathname: "/sheet-index.html", search: "", hash: "",
      replace: (u) => reloads.push({ u, t: clock.t })
    },
    document: {
      readyState: "complete", hidden: false,
      addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
      querySelector(sel) {
        if (sel === 'meta[name="wardos-build"]') return { getAttribute: () => opts.meta || "r53ar1" };
        return null;
      },
      querySelectorAll: () => [],
      getElementById: () => null
    },
    fetch: (url, init) => {
      fetches.push({ url: String(url), cache: init && init.cache, t: clock.t });
      const hit = String(url).indexOf("version.json") >= 0;
      if (!hit) return new Promise(() => {});
      if (opts.failVer) return Promise.reject(new Error("down"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: opts.live || "r53ar1" }) });
    }
  });
  ctx.window = ctx;
  ctx.window.addEventListener = (ev, fn) => { (listeners[ev] ||= []).push(fn); };
  vm.runInContext(src, ctx, { filename: "house-fresh.js" });
  async function advance(ms) {
    const end = clock.t + ms;
    for (;;) {
      let best = null;
      for (const t of q) if (t.at <= end && (!best || t.at < best.at)) best = t;
      if (!best) break;
      clock.t = best.at;
      if (best.every) best.at += best.every;
      else q.splice(q.indexOf(best), 1);
      best.fn();
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    }
    clock.t = end;
  }
  function touch() { (listeners.pointerdown || []).forEach((fn) => fn()); }
  return { advance, touch, reloads, fetches, ss, ls, listeners };
}

test("r53 a new build reloads only after the wall has been idle for 60s, and only once", async () => {
  const idle = freshPage(1_000_000, { live: "r53ar2" });
  await idle.advance(2000);
  assert.equal(idle.reloads.length, 0, "a fresh page is not idle yet");
  assert.ok(idle.fetches.some((f) => f.url.startsWith("version.json?t=") && f.cache === "no-store"));
  await idle.advance(70_000);
  assert.equal(idle.reloads.length, 1, "idle wall reloads onto the new token");
  assert.match(idle.reloads[0].u, /^\/sheet-index\.html\?fresh=\d+$/);
  const keys = Object.keys(idle.ls);
  assert.deepEqual(keys, ["wardos-private-feed-token"]);
  await idle.advance(6 * 60 * 1000);
  assert.equal(idle.reloads.length, 1, "the same token does not reload again");

  const busy = freshPage(1_000_000, { live: "r53ar2" });
  await busy.advance(2000);
  busy.touch();
  await busy.advance(70_000);
  assert.equal(busy.reloads.length, 0, "a press inside the last 60s holds the reload");
});

test("r53 a version.json error backs off 5, 10, 20, then 30 minutes", async () => {
  const page = freshPage(1_000_000, { failVer: true });
  await page.advance(2000);
  const vers = () => page.fetches.filter((f) => f.url.startsWith("version.json"));
  assert.equal(vers().length, 1);
  const gaps = [];
  for (const min of [5, 10, 20, 30, 30]) {
    const before = vers().length;
    const at = vers().at(-1).t;
    await page.advance(min * 60 * 1000 + 30 * 1000);
    assert.equal(vers().length, before + 1, "fetch after " + min + " min");
    gaps.push(vers().at(-1).t - at);
    assert.ok(gaps.at(-1) >= min * 60 * 1000 && gaps.at(-1) < min * 60 * 1000 + 31 * 1000, gaps.at(-1));
  }
});

function feedPage(plan) {
  const clock = { t: 5_000_000 };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); }
    static now() { return clock.t; }
  }
  const q = [];
  let nid = 0;
  const counts = {};
  const reloads = [];
  const store = { "wardos-private-feed-token": "wall-key-wall-key-01" };
  const value = { textContent: "" };
  const tile = { querySelector: () => value };
  const listeners = {};
  const ctx = {
    Intl, Date: FakeDate, console, Math: steady, URL, CustomEvent, AbortController,
    setTimeout: (fn, ms) => { nid += 1; q.push({ id: nid, at: clock.t + (ms || 0), fn }); return nid; },
    clearTimeout: (id) => { const i = q.findIndex((t) => t.id === id); if (i >= 0) q.splice(i, 1); },
    setInterval: () => 0, clearInterval: () => {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      key: (i) => Object.keys(store)[i] || null,
      get length() { return Object.keys(store).length; }
    },
    location: {
      href: "http://127.0.0.1/sheet-index.html", origin: "http://127.0.0.1",
      pathname: "/sheet-index.html", search: "", hash: "",
      replace: (u) => reloads.push(u)
    },
    document: {
      readyState: "complete",
      documentElement: { classList: { toggle() {} }, setAttribute() {}, appendChild() {} },
      head: { appendChild() {} },
      body: { appendChild() {}, style: {}, hasAttribute: () => false, classList: { contains: () => false } },
      addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
      createElement: () => ({ setAttribute() {}, style: {}, appendChild() {}, classList: { toggle() {} } }),
      querySelector: (sel) => (sel.indexOf("cal-live") >= 0 || sel.indexOf("lights-live") >= 0 || sel.indexOf("sensi-live") >= 0 ? tile : null),
      querySelectorAll: () => []
    },
    HouseHub: { lights: () => "http://127.0.0.1:9", okForKey: () => true },
    HouseFaceLaw: { cleanFeed: (_n, d) => d },
    fetch: (url) => {
      const u = String(url);
      const name = (u.match(/\/api\/private\/([a-z-]+)\.json/) || [])[1] || "other";
      counts[name] = (counts[name] || 0) + 1;
      const step = plan[name] || plan.other || [];
      const status = step[Math.min(counts[name] - 1, step.length - 1)];
      if (status === 200) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ label: "Tile up", status: "live" }) });
      return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });
    }
  };
  ctx.window = ctx;
  ctx.window.addEventListener = (ev, fn) => { (listeners[ev] ||= []).push(fn); };
  ctx.window.dispatchEvent = (ev) => { (listeners[ev.type] || []).forEach((fn) => fn(ev)); return true; };
  vm.runInContext(read("private-feed.js"), vm.createContext(ctx), { filename: "private-feed.js" });
  async function advance(ms) {
    const end = clock.t + ms;
    for (;;) {
      let best = null;
      for (const t of q) if (t.at <= end && (!best || t.at < best.at)) best = t;
      if (!best) break;
      clock.t = best.at;
      q.splice(q.indexOf(best), 1);
      best.fn();
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    }
    clock.t = end;
  }
  return { advance, counts, reloads, value, store, ctx };
}

test("r53 a 530 on calendar, lights, and thermostat redraws that tile, and a 401 does not retry", async () => {
  const page = feedPage({ "cal-live": [530, 530, 200], "lights-live": [530, 200], "sensi-live": [530, 200], other: [404] });
  await page.ctx.PrivateFeed.get("cal-live");
  await page.advance(0);
  assert.equal(page.value.textContent, "", "the tile stays quiet after the first 530");
  assert.equal(page.reloads.length, 0);
  await page.advance(15_000);
  assert.equal(page.counts["cal-live"], 2, "second try at 15s");
  assert.equal(page.value.textContent, "");
  await page.advance(30_000);
  assert.equal(page.counts["cal-live"], 3, "third try at 30s");
  assert.equal(page.value.textContent, "Tile up");
  assert.equal(page.reloads.length, 0, "a recovered tile does not reload the page");

  await page.ctx.PrivateFeed.get("lights-live");
  await page.advance(15_000);
  assert.equal(page.value.textContent, "Tile up");
  await page.ctx.PrivateFeed.get("sensi-live");
  await page.advance(15_000);
  assert.equal(page.value.textContent, "Tile up");

  const denied = feedPage({ "cal-live": [401], other: [404] });
  const before = denied.store["wardos-private-feed-token"];
  await denied.ctx.PrivateFeed.get("cal-live");
  await denied.advance(10 * 60 * 1000);
  assert.equal(denied.counts["cal-live"], 1, "401 is not retried");
  assert.equal(denied.store["wardos-private-feed-token"], before);
  assert.equal(denied.reloads.length, 0);
});

function weatherPage(statuses) {
  const clock = { t: 8_000_000 };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); }
    static now() { return clock.t; }
  }
  const q = [];
  const waits = [];
  let nid = 0;
  let n = 0;
  const wxCalls = [];
  const reloads = [];
  const el = {
    id: "house-wx", hidden: false, innerHTML: "",
    classList: { add() {}, remove() {}, toggle() {} },
    style: { setProperty() {}, removeProperty() {} },
    setAttribute() {}, getAttribute: () => "",
    querySelector: () => null
  };
  const ctx = {
    Intl, Date: FakeDate, console, Math: steady, URL, AbortController, Promise,
    setTimeout: (fn, ms) => { nid += 1; waits.push(ms); q.push({ id: nid, at: clock.t + (ms || 0), fn }); return nid; },
    clearTimeout: (id) => { const i = q.findIndex((t) => t.id === id); if (i >= 0) q.splice(i, 1); },
    setInterval: () => 0, clearInterval: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    location: { origin: "http://127.0.0.1", href: "http://127.0.0.1/sheet-index.html", reload: () => reloads.push("reload") },
    document: { querySelector: (s) => (s === "#house-wx" ? el : null), getElementById: () => null, addEventListener() {} },
    fetch: (url) => {
      const u = String(url);
      if (u.indexOf("/wx") < 0) return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
      n += 1;
      wxCalls.push(clock.t);
      const status = statuses[Math.min(n - 1, statuses.length - 1)];
      if (status === 200) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({
            raw: { current: { temperature_2m: 22.2, weather_code: 1, wind_speed_10m: 8, is_day: 1, precipitation: 0, rain: 0, showers: 0, snowfall: 0, interval: 900 } },
            ts: clock.t, stale: false
          })
        });
      }
      return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });
    },
    HouseScene: { now: () => new FakeDate(), sunDown: () => false }
  };
  ctx.window = ctx;
  const realm = vm.createContext(ctx);
  vm.runInContext(read("livewx-core.js"), realm, { filename: "livewx-core.js" });
  vm.runInContext(read("house-weather.js"), realm, { filename: "house-weather.js" });
  async function advance(ms) {
    const end = clock.t + ms;
    for (;;) {
      let best = null;
      for (const t of q) if (t.at <= end && (!best || t.at < best.at)) best = t;
      if (!best) break;
      clock.t = best.at;
      q.splice(q.indexOf(best), 1);
      best.fn();
      for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
    }
    clock.t = end;
  }
  return { advance, el, reloads, ctx, calls: () => n, wxCalls, waits };
}

test("r53 weather retries a 530 and redraws the outdoor tile without a reload", async () => {
  const page = weatherPage([530, 530, 200]);
  page.ctx.HouseWeather.mount("#house-wx");
  await page.advance(0);
  assert.match(page.el.innerHTML, /offline/);
  assert.equal(page.reloads.length, 0);
  await page.advance(20_000);
  assert.equal(page.calls(), 2);
  assert.ok(page.wxCalls[1] - page.wxCalls[0] >= 15_000);
  assert.match(page.el.innerHTML, /offline/);
  await page.advance(40_000);
  assert.equal(page.calls(), 3);
  assert.ok(page.wxCalls[2] - page.wxCalls[1] >= 30_000);
  assert.match(page.el.innerHTML, /72/, page.el.innerHTML);
  assert.equal(page.reloads.length, 0);
  const denied = weatherPage([401]);
  denied.ctx.HouseWeather.mount("#house-wx");
  await denied.advance(10 * 60 * 1000);
  assert.equal(denied.calls(), 1);
});
