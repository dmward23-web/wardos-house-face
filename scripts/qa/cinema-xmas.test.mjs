/* Cinema look Phase 1. Pins live only in art/cinema/xmas-2026/pins.js.
   UNVERIFIED-ASSETS: a missing plate is pending. A present file with the wrong hash fails.
   palette.json stays pending-confirm until Wright flips that state. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawn, spawnSync } from "node:child_process";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const Scene = require(path.join(ROOT, "wardos-scene.js"));
const Pins = require(path.join(ROOT, "art/cinema/xmas-2026/pins.js"));
const Season = require(path.join(ROOT, "month-theme/season-math.js"));
const CHROME = ["/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find((p) => fs.existsSync(p));
const ART = process.env.CINEMA_ART_DIR || "/opt/cursor/artifacts";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function checkPins(dir, pins) {
  const bad = [];
  const pending = [];
  const matched = [];
  for (const pin of pins) {
    const fp = path.join(dir, pin.file);
    if (!fs.existsSync(fp)) {
      pending.push(pin.file);
      continue;
    }
    const got = sha256(fs.readFileSync(fp));
    if (got === pin.sha256) matched.push(pin.file);
    else if (pin.state === "pending-confirm") pending.push(pin.file);
    else bad.push(pin.file + " hash " + got);
  }
  return { bad, pending, matched };
}

test("grade pass is bypassed for the loop and the fallback, and stays on for an ungraded plate", () => {
  assert.equal(Scene.gradeBypassed("loop"), true);
  assert.equal(Scene.gradeBypassed("fallback"), true);
  assert.equal(Scene.gradeBypassed("ungraded"), false);
  assert.equal(Scene.gradeBypassed("procedural"), false);
  assert.deepEqual(Scene.choosePlate({ loop: true, ungraded: true, fallback: true }, "high"), { source: "ungraded", grade: true });
  assert.deepEqual(Scene.choosePlate({ loop: true, fallback: true }, "high"), { source: "loop", grade: false });
  assert.deepEqual(Scene.choosePlate({ fallback: true }, "low"), { source: "fallback", grade: false });
  assert.deepEqual(Scene.choosePlate({ loop: true }, "low"), { source: "loop", grade: false });
  assert.equal(Scene.choosePlate({}, "still").grade, false);
  assert.equal(Scene.choosePlate({}, "high").source, "procedural");
  assert.equal(Scene.choosePlate({}, "high").grade, true);
});

test("watchdog drops high to low to still and never steps back up", () => {
  const w = Scene.createWatchdog("high");
  assert.equal(w.note(30), null);
  assert.equal(w.note(10), null);
  assert.equal(w.note(25), null);
  const first = w.note(21);
  assert.equal(first, "WARDOSFPS drop high to low");
  assert.equal(w.quality(), "low");
  assert.equal(w.note(40), null);
  assert.equal(w.note(40), "WARDOSFPS drop low to still");
  assert.equal(w.quality(), "still");
  assert.equal(w.note(80), null);
  assert.equal(w.quality(), "still");
  assert.equal(Scene.clampQuality("low", "high"), "low");
  assert.equal(Scene.clampQuality("still", "low"), "still");
  assert.equal(Scene.clampQuality("high", "low"), "low");
  assert.equal(Scene.clampQuality("high", "still"), "still");
});

test("frame stats report p50, p95, worst and the over-33 count", () => {
  const s = Scene.summarize([10, 20, 30, 40, 50]);
  assert.equal(s.frames, 5);
  assert.equal(s.worstms, 50);
  assert.equal(s.over33, 2);
  assert.ok(s.p50ms >= 20 && s.p50ms <= 30);
  assert.ok(s.p95ms >= 40);
  assert.deepEqual(Scene.summarize([]), { p50ms: 0, p95ms: 0, worstms: 0, over33: 0, frames: 0 });
});

test("locked kid legend is the house set, not a brighter swap", () => {
  assert.deepEqual(Scene.KID_LEGEND, {
    Ainsley: "#8a6394",
    Hayes: "#3f8b71",
    Harris: "#42679a",
    Shared: "#c4b49a"
  });
});

test("text on the cinema glass clears 4.5:1, and 72 percent glass clears 7:1 over a warm glow", () => {
  const text = Scene.parseHex("#FFF6EE");
  const label = Scene.parseHex("#FFD9B8");
  const glass = [27, 20, 48];
  const glow = [255, 176, 78];
  function over(a, bg) {
    return glass.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
  }
  assert.ok(Scene.contrastRatio(text, over(0.72, glow)) >= 7, "body over the top-left glow");
  assert.ok(Scene.contrastRatio(text, over(0.55, [24, 18, 16])) >= 7, "body over the dark floor");
  assert.ok(Scene.contrastRatio(label, over(0.55, [24, 18, 16])) >= 4.5, "label floor");
  assert.ok(Scene.contrastRatio(text, over(0.55, [255, 255, 255])) < 4.5, "bare 55 percent glass over white is the case the tint exists to fix");
});

test("cube parser accepts a 2-cube and rejects a short file", () => {
  const good = "LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n";
  const pack = Scene.parseCube(good);
  assert.equal(pack.size, 2);
  assert.equal(pack.rgb.length, 24);
  assert.equal(Scene.parseCube("LUT_3D_SIZE 2\n0 0 0\n"), null);
  assert.equal(Scene.parseCube(""), null);
});

test("asset pin list is the r3 set plus the r2 palette pin, in one file", () => {
  const names = Pins.pins.map((p) => p.file);
  assert.deepEqual(names, [
    "xmas-hero-loop-1920x1080-25s.mp4",
    "xmas-hero-plate-1920x1080-ungraded.png",
    "xmas-hero-fallback-1920x1080-graded.png",
    "wardos-xmas.cube",
    "palette.json",
    "glass-card-9slice-192.png"
  ]);
  for (const pin of Pins.pins) {
    assert.match(pin.sha256, /^[0-9a-f]{64}$/);
    assert.equal(Scene.FILES[pin.role].endsWith(pin.file), true, pin.file);
  }
  assert.equal(Pins.pins.find((p) => p.file === "palette.json").state, "verified");
  const pinHex = (role) => Pins.pins.find((p) => p.role === role).sha256;
  assert.equal(pinHex("palette"), "sha256:a05eae0059eef810a7aab91ff28a56b3a106caf83a456c73a703f4c152b33156".slice(7));
  assert.equal(pinHex("loop"), "sha256:1c011db8381484968c58e0b1b3e5f7d520d56d3210eb6fae035c32659d55e59c".slice(7));
  assert.equal(pinHex("ungraded"), "sha256:f3323f756a02c69b7c4f42a602358539ae9e71b66acb7e936ab4e25e099fd1ae".slice(7));
  assert.equal(pinHex("fallback"), "sha256:f795c1ce37b3155e0e53a8b0348da806ac5b1d7f66ac737dcd6214a9113fce94".slice(7));
  assert.equal(pinHex("lut"), "sha256:5bd8ac9135fc12099aa18863e5e6f32b6a02a99ee20d2368b333c30f17e4e518".slice(7));
  assert.equal(pinHex("glass"), "sha256:c630f43eec72e392634d936dc55283de4fb997affc5db8c1e59f6f3c0f9d1a39".slice(7));
  for (const pin of Pins.pins) assert.equal(pin.state, "verified", pin.file);
  assert.equal(Pins.status, "verified");
});

test("absent assets stay pending, every shipped asset matches its pin, and a wrong hash fails", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cinema-pins-"));
  const absent = checkPins(dir, Pins.pins);
  assert.deepEqual(absent.bad, []);
  assert.equal(absent.pending.length, Pins.pins.length);
  const live = checkPins(path.join(ROOT, Pins.dir), Pins.pins);
  assert.deepEqual(live.bad, [], "a shipped plate must match its pin");
  assert.equal(live.matched.length, Pins.pins.length, "every pinned asset ships and matches");
  const loop = Pins.pins.find((p) => p.role === "loop");
  fs.writeFileSync(path.join(dir, loop.file), "not the plate");
  const wrong = checkPins(dir, Pins.pins);
  assert.equal(wrong.bad.length, 1);
  assert.match(wrong.bad[0], /xmas-hero-loop/);
  const palette = Pins.pins.find((p) => p.role === "palette");
  fs.writeFileSync(path.join(dir, palette.file), "{ }\n");
  const held = checkPins(dir, Pins.pins);
  assert.equal(held.bad.length, 2, "a verified palette with the wrong hash is a hard failure");
  assert.ok(held.bad.some((b) => /palette/.test(b)));
});

test("vendored three r169 is the single ES module and matches its recorded hash", () => {
  const fp = path.join(ROOT, "vendor/three/three.module.js");
  const buf = fs.readFileSync(fp);
  assert.equal(sha256(buf), "sha256:0a3368c165eea773490aec7b77c22de70e3eac288503409256fdbf4d12578416".slice(7));
  assert.match(buf.toString("utf8").slice(0, 400), /REVISION = '169'/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "wardos-scene.js"), "utf8"), /from ["']three["']/);
});

test("COVERSYNC1 subscribes the cover canvas to HouseScene", () => {
  const src = fs.readFileSync(path.join(ROOT, "wardos-stage.js"), "utf8");
  assert.match(src, /COVERSYNC1/);
  assert.match(src, /HouseScene\.subscribe/);
  assert.match(src, /extendCover\(node, viewport\(\)\)/);
  assert.match(src, /data-wardos-stage/);
});

test("default wall does not reference cinema files outside the flag hook", () => {
  const html = fs.readFileSync(path.join(ROOT, "wall.html"), "utf8");
  assert.match(html, /q\.get\("look"\) !== "cinema"/);
  assert.match(html, /getAttribute\("data-look"\) !== "cinema"/);
  assert.doesNotMatch(html, /<script[^>]+src="wardos-scene\.js"/);
  assert.doesNotMatch(html, /<link[^>]+wardos-scene\.css"/);
  assert.match(html, /season-math\.js\?v=SUNHOME1/);
  assert.match(html, /month-theme\/month-overlay\.js\?v=SUNHOME2/);
});

test("November and Thanksgiving stay on the season coat, and December still snows, with the cinema flag in the query", () => {
  const nov = Season.decide(new Date("2026-11-23T15:00:00-06:00"));
  const thanks = Season.decide(new Date("2026-11-26T15:00:00-06:00"));
  const dec = Season.decide(new Date("2026-12-25T15:00:00-06:00"));
  assert.equal(nov.id, "november");
  assert.equal(thanks.id, "november");
  assert.ok(thanks.flakes > 0);
  assert.equal(dec.id, "december");
  assert.equal(dec.flakes, 1);
  assert.match(fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8"), /"2026-11": \{ id: "turkey"/);
  assert.match(fs.readFileSync(path.join(ROOT, "kid-world.js"), "utf8"), /assets\/ori\/creature\//);
});

test("Hearthlings hatch still paints under a cinema query", () => {
  const JS = fs.readFileSync(path.join(ROOT, "hatch2-preview.js"), "utf8");
  const kids = [];
  function el(tag) {
    return {
      tag, children: [], attrs: {}, textContent: "", src: "", srcset: "",
      appendChild(c) { this.children.push(c); return c; },
      setAttribute(k, v) { this.attrs[k] = String(v); }
    };
  }
  const stage = el("main");
  const body = el("body");
  const ctx = {
    location: { search: "?look=cinema&kid=hayes" },
    URLSearchParams,
    document: {
      body,
      getElementById: (id) => (id === "h2-stage" ? stage : null),
      createElement: (t) => el(t)
    },
    window: { WGArt: { base: "night/media/art/halloween/", have: { "kidboards/hatch-hayes-v2.webp": 1, "kidboards/hatch-hayes-v2.png": 1 } } },
    addEventListener() {}
  };
  vm.runInNewContext(JS, ctx);
  const walk = (n) => {
    if (n.src) kids.push(n.src);
    if (n.srcset) kids.push(n.srcset);
    for (const c of n.children || []) walk(c);
  };
  walk(stage);
  assert.ok(kids.some((s) => s.includes("hatch-hayes-v2")), JSON.stringify(kids));
  assert.equal(body.attrs["data-hatch2-on"], "hayes");
});

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  let o = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const parts = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o); o += 4;
    const type = buf.toString("ascii", o, o + 4); o += 4;
    const data = buf.subarray(o, o + len); o += len + 4;
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === "IDAT") parts.push(data);
    else if (type === "IEND") break;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error("png color type " + ct);
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 4);
  let p = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (filter === 1) v = (v + left) & 255;
      else if (filter === 2) v = (v + up) & 255;
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 255;
      else if (filter === 4) v = (v + paeth(left, up, ul)) & 255;
      row[i] = v;
    }
    for (let x = 0; x < w; x++) {
      const s = x * bpp;
      const d = (y * w + x) * 4;
      out[d] = row[s];
      out[d + 1] = row[s + 1];
      out[d + 2] = row[s + 2];
      out[d + 3] = bpp === 4 ? row[s + 3] : 255;
    }
    prev = row;
  }
  return { w, h, data: out };
}

function markPhase(x, y) { return x >= 1680 && y <= 220; }

function diffPixels(a, b, ignore) {
  if (a.w !== b.w || a.h !== b.h) return -1;
  let n = 0;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (ignore && ignore(x, y)) continue;
      const i = (y * a.w + x) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n += 1;
    }
  }
  return n;
}

function sample(png, x, y) {
  const xx = Math.max(0, Math.min(png.w - 1, Math.round(x)));
  const yy = Math.max(0, Math.min(png.h - 1, Math.round(y)));
  const i = (yy * png.w + xx) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

function groundStats(png, x, y, w, h) {
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(png.w, x + w);
  const y1 = Math.min(png.h, y + h);
  for (let yy = y0; yy < y1; yy += 8) {
    for (let xx = x0; xx < x1; xx += 8) {
      const i = (yy * png.w + xx) * 4;
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      sum += l;
      sum2 += l * l;
      n += 1;
    }
  }
  const mean = sum / n;
  const variance = sum2 / n - mean * mean;
  return { mean, variance, n };
}

function serve() {
  const baseWall = spawnSync("git", ["show", "cbd117a94662b515e7e1f2298ce81922af806e46:wall.html"], { cwd: ROOT, encoding: "buffer" }).stdout;
  const types = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
    ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
    ".mp4": "video/mp4", ".cube": "text/plain"
  };
  const srv = http.createServer((q, res) => {
    const u = new URL(q.url, "http://127.0.0.1");
    if (u.pathname === "/wall.html" && String(q.headers["x-wall-bytes"] || "") === "base") {
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end(baseWall);
      return;
    }
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    const fp = path.join(ROOT, path.normalize(rel));
    if (!fp.startsWith(ROOT + path.sep) && fp !== ROOT) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const proc = spawn(CHROME, [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
      "--remote-debugging-port=0", "--remote-allow-origins=*",
      "--window-size=1920,1080", "--force-device-scale-factor=1",
      "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
      "--hide-scrollbars", "--mute-audio", "--disable-gpu-sandbox",
      "about:blank"
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("chrome did not open a devtools port")); }, 20000);
    const on = (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) { clearTimeout(timer); resolve({ proc, port: Number(m[1]) }); }
    };
    proc.stdout.on("data", on);
    proc.stderr.on("data", on);
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error("chrome exit " + code)); });
  });
}

function cdpSocket(ws) {
  let n = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result || {});
    }
    for (const w of waiters) if (w.method === msg.method) w.resolve(msg.params || {});
  });
  return {
    send(method, params, timeout) {
      const id = ++n;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("cdp timeout " + method)), timeout || 20000);
        pending.set(id, {
          resolve: (v) => { clearTimeout(t); resolve(v); },
          reject: (e) => { clearTimeout(t); reject(e); }
        });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    },
    wait(method, timeout) {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("wait " + method)), timeout || 20000);
        waiters.push({ method, resolve: (v) => { clearTimeout(t); resolve(v); } });
      });
    }
  };
}

const FREEZE = `(() => {
  const FIXED = Date.parse("2026-11-23T18:00:00Z");
  const R = Date;
  function F(...a) { return a.length ? new R(...a) : new R(FIXED); }
  F.prototype = R.prototype;
  F.now = () => FIXED;
  F.parse = R.parse;
  F.UTC = R.UTC;
  window.Date = F;
  /* Seeded Math.random so particle layers (default-wall leaves, cinema snow) paint the same on every run. */
  let seed = 20261204;
  Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__net = [];
  try {
    const o = new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__net.push(e.name); });
    o.observe({ type: "resource", buffered: true });
  } catch (e) {}
})();`;

const NOWEBGL = `(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
    return orig.apply(this, arguments);
  };
})();`;

async function openPage(port, url, extraScript, media) {
  const created = await (await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  const c = cdpSocket(ws);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.send("Network.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  if (media) await c.send("Emulation.setEmulatedMedia", { features: media });
  if (extraScript === "base-bytes") {
    await c.send("Network.setExtraHTTPHeaders", { headers: { "X-Wall-Bytes": "base" } });
    extraScript = "";
  }
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE + (extraScript || "") });
  const loaded = c.wait("Page.loadEventFired", 30000);
  await c.send("Page.navigate", { url });
  await loaded;
  return {
    c, ws,
    async eval(expr) {
      const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result && r.result.value;
    },
    async shot() {
      const r = await c.send("Page.captureScreenshot", { format: "png" });
      return Buffer.from(r.data, "base64");
    },
    close() { try { ws.close(); } catch (e) { /* closed */ } }
  };
}

test("browser: cinema wall keeps every control, stays graded off the cards, and falls back to a poster", { timeout: 180000 }, async () => {
  assert.ok(CHROME, "chrome is required");
  fs.mkdirSync(ART, { recursive: true });
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  const chrome = await launchChrome();
  const pages = [];
  try {
    async function page(path, extra, media) {
      const p = await openPage(chrome.port, base + path, extra, media);
      pages.push(p);
      return p;
    }
    const snapExpr = `(() => {
      function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
      const rows = [];
      for (const el of document.querySelectorAll("[id], [role]")) {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const text = (el.innerText || el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 180);
        rows.push((el.id || "") + "|" + (el.getAttribute("role") || "") + "|" + hash(text));
      }
      rows.sort();
      const more = ((document.body.innerText || "").match(/\\+\\d+\\s+more/g) || []).sort();
      return { rows, more };
    })()`;

    const reduce = [{ name: "prefers-reduced-motion", value: "reduce" }];
    async function settled(p) {
      await p.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { if (document.documentElement.getAttribute("data-scene-mode") === "poster") return res(true); if (performance.now() - t0 > 8000) return res(false); setTimeout(step, 50); }; step(); })`);
      let prev = null;
      let prevBuf = null;
      for (let i = 0; i < 8; i++) {
        await p.eval(`new Promise((r) => setTimeout(r, 450))`);
        const buf = await p.shot();
        const now = decodePng(buf);
        if (prev && diffPixels(prev, now, markPhase) === 0) {
          await p.eval(`(() => {
            const s = document.getElementById("sweep");
            if (s) s.setAttribute("x", "-200");
            const h = document.getElementById("halo");
            if (h) h.setAttribute("stroke", "rgba(255,205,140,0.22)");
            const k = document.getElementById("sparks");
            if (k) k.setAttribute("opacity", "0.55");
          })()`);
          await p.eval(`new Promise((r) => setTimeout(r, 80))`);
          return p.shot();
        }
        prev = now;
        prevBuf = buf;
      }
      fs.writeFileSync(path.join(ART, "cinema-unstable-a.png"), prevBuf);
      const info = await p.eval(`JSON.stringify({ mode: document.documentElement.getAttribute("data-scene-mode"), why: window.__fb && __fb.why, rm: matchMedia("(prefers-reduced-motion: reduce)").matches, look: document.documentElement.getAttribute("data-look") })`);
      throw new Error("screenshot did not settle " + info);
    }
    const plain = await page("/wall.html", "base-bytes", reduce);
    const baseBuf = await settled(plain);
    const basePng = decodePng(baseBuf);
    fs.writeFileSync(path.join(ART, "cinema-default-base.png"), baseBuf);
    const baseSnap = await plain.eval(snapExpr);

    const def = await page("/wall.html", "", reduce);
    const defPngBuf = await settled(def);
    const defSnap = await def.eval(snapExpr);
    fs.writeFileSync(path.join(ART, "cinema-default.png"), defPngBuf);
    const defPng = decodePng(defPngBuf);
    assert.equal(defPng.w, 1920);
    assert.equal(defPng.h, 1080);
    /* The metal mark's sweep freezes on whatever phase the poster caught. That phase is not the cinema hook. */
    assert.equal(diffPixels(basePng, defPng, markPhase), 0, "default wall render differs from base");
    assert.ok(diffPixels(basePng, defPng) < 800, "the mark phase delta grew past the logo");
    const defNet = await def.eval(`(performance.getEntriesByType("resource").map((e) => e.name).concat(window.__net || [])).join("\\n")`);
    assert.doesNotMatch(defNet, /wardos-scene|vendor\/three|art\/cinema/i);

    const high = await page("/wall.html?look=cinema&fps=1&q=high&now=2026-11-26T18:00:00-06:00");
    await high.eval(`new Promise((res) => {
      const t0 = performance.now();
      const step = () => {
        const s = document.getElementById("wardos-scene");
        if (s && s.getAttribute("data-q") && window.__wardosFps && document.querySelector(".km-layer")) return res(true);
        if (performance.now() - t0 > 8000) return res(false);
        setTimeout(step, 50);
      };
      step();
    })`);
    await high.eval(`new Promise((r) => setTimeout(r, 1200))`);
    const highState = await high.eval(`({
      q: document.getElementById("wardos-scene").getAttribute("data-q"),
      source: document.getElementById("wardos-scene").getAttribute("data-source"),
      grade: document.getElementById("wardos-scene").getAttribute("data-grade"),
      theme: document.documentElement.getAttribute("data-month-theme"),
      layer: !!document.querySelector(".km-layer"),
      fps: window.__wardosFps,
      sceneKids: !!document.getElementById("wardos-scene").querySelector("#ui, .chip, #clock")
    })`);
    assert.equal(highState.q, "high");
    assert.equal(highState.grade, "on");
    assert.equal(highState.theme, "11");
    assert.equal(highState.layer, true);
    assert.equal(highState.sceneKids, false, "cards must not sit inside the graded layer");
    assert.equal(typeof highState.fps.p50ms, "number");
    assert.equal(typeof highState.fps.p95ms, "number");
    assert.equal(typeof highState.fps.worstms, "number");
    assert.equal(typeof highState.fps.over33, "number");
    assert.ok(highState.fps.frames > 0, "fps hook did not record a frame");
    assert.equal(highState.fps.q, "high");
    const fps2 = await high.eval(`new Promise((r) => { const a = window.__wardosFps.frames; setTimeout(() => r(window.__wardosFps.frames !== a || window.__wardosFps.frames > 0), 1100); })`);
    assert.equal(fps2, true);
    /* P2-5: snow only in the window panes (plate x 500..765, y 0..690), none over the tree or lamp, after it has fallen a while. */
    const snow = await high.eval(`window.__wardosScene && window.__wardosScene.snowBox()`);
    assert.ok(snow && snow.n === 1200, "high tier keeps its 1200 flakes");
    assert.equal(snow.out, 0, "snow flake outside the window panes");
    assert.ok(snow.px.x0 >= 480 && snow.px.x1 <= 800 && snow.px.y0 >= 0 && snow.px.y1 <= 700, "snow box drifted off the window: " + JSON.stringify(snow.px));

    const live = await page("/wall.html");
    await live.eval(`new Promise((r) => setTimeout(r, 400))`);
    const liveSnap = await live.eval(snapExpr);
    const highSnap = await high.eval(snapExpr);
    const missing = liveSnap.rows.filter((row) => !highSnap.rows.includes(row));
    assert.deepEqual(missing, [], "cinema dropped visible rows");
    assert.deepEqual(highSnap.more, liveSnap.more);
    assert.ok(highSnap.rows.some((r) => r.startsWith("wardos-scene|")));

    const layout = await high.eval(`(() => {
      const tap = [];
      for (const el of document.querySelectorAll("#clock, .chip, #snd, a, button, [role=link]")) {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || st.pointerEvents === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        tap.push({ id: el.id || el.getAttribute("data-n") || el.tagName, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom });
      }
      const hits = tap.map((t) => {
        const hit = document.elementFromPoint(t.x + t.w / 2, t.y + t.h / 2);
        const owner = hit && hit.closest ? hit.closest("#clock, .chip, #snd, a, button, [role=link]") : null;
        return { id: t.id, ok: !!(owner && (owner === hit || owner.contains(hit))) };
      });
      const gaps = [];
      for (let i = 0; i < tap.length; i++) for (let j = i + 1; j < tap.length; j++) {
        const a = tap[i], b = tap[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0 && oy > 0) gaps.push(a.id + " overlaps " + b.id);
      }
      const trunc = [];
      for (const el of document.querySelectorAll("#time, #date, .chip span, #snd")) {
        if (el.scrollWidth > el.clientWidth + 1) trunc.push(el.id || el.textContent);
      }
      const low = tap.filter((t) => t.bottom > 1032 || (t.y + t.h > 1032));
      const textLow = [];
      for (const el of document.querySelectorAll("#ui *")) {
        const text = (el.childNodes && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
        if (!text) continue;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > 1032) textLow.push((el.id || el.textContent || "").trim().slice(0, 40));
      }
      const clock = document.getElementById("clock").getBoundingClientRect();
      const mark = document.getElementById("wardos-mark").getBoundingClientRect();
      const scene = document.getElementById("wardos-scene");
      const ui = document.getElementById("ui");
      return {
        hits, gaps, trunc, low: low.map((t) => t.id), textLow,
        clock: { right: clock.right, top: clock.top },
        mark: { x: mark.x, y: mark.y, w: mark.width, h: mark.height },
        zScene: getComputedStyle(scene).zIndex,
        zUi: getComputedStyle(ui).zIndex,
        cardInScene: !!scene.querySelector("#clock, .chip")
      };
    })()`);
    assert.deepEqual(layout.hits.filter((h) => !h.ok), []);
    assert.deepEqual(layout.gaps, []);
    assert.deepEqual(layout.trunc, []);
    assert.deepEqual(layout.low, []);
    assert.deepEqual(layout.textLow, []);
    assert.ok(layout.clock.right <= 440, "top-left card right " + layout.clock.right);
    assert.ok(Math.abs(layout.mark.x - 48) <= 1 && Math.abs(layout.mark.y - 48) <= 1, JSON.stringify(layout.mark));
    assert.ok(Math.abs(layout.mark.w - 320) <= 1 && Math.abs(layout.mark.h - 80) <= 1, JSON.stringify(layout.mark));
    assert.equal(layout.cardInScene, false);
    assert.ok(Number(layout.zUi) > Number(layout.zScene));

    const highBuf = await high.shot();
    fs.writeFileSync(path.join(ART, "cinema-high.png"), highBuf);
    const highPng = decodePng(highBuf);
    const ground = groundStats(highPng, 200, 180, 1400, 700);
    assert.ok(ground.mean > 12, "ground mean " + ground.mean);
    assert.ok(ground.variance > 8, "ground variance " + ground.variance);
    const clockBg = sample(highPng, 60, 160);
    const timeRgb = Scene.parseHex("#FFF6EE");
    assert.ok(Scene.contrastRatio(timeRgb, clockBg) >= 4.5, "clock contrast " + Scene.contrastRatio(timeRgb, clockBg) + " bg " + clockBg.join(","));

    const net = await high.eval(`(performance.getEntriesByType("resource").map((e) => e.name).concat(window.__net || [])).join("\\n")`);
    assert.doesNotMatch(net, /camo/i);
    const camoCss = await high.eval(`(() => {
      const hits = [];
      for (const el of document.querySelectorAll("*")) {
        const st = getComputedStyle(el);
        if (/camo/i.test(st.backgroundImage) || /camo/i.test(st.background)) hits.push(el.id || el.className);
      }
      return hits;
    })()`);
    assert.deepEqual(camoCss, []);

    const low = await page("/wall.html?look=cinema&q=low");
    await low.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const s = document.getElementById("wardos-scene"); if (s && s.getAttribute("data-q") === "low") return res(true); if (performance.now() - t0 > 6000) return res(false); setTimeout(step, 40); }; step(); })`);
    const lowState = await low.eval(`({ q: document.getElementById("wardos-scene").getAttribute("data-q"), grade: document.getElementById("wardos-scene").getAttribute("data-grade"), source: document.getElementById("wardos-scene").getAttribute("data-source") })`);
    assert.equal(lowState.q, "low");
    assert.equal(lowState.grade, "off");
    fs.writeFileSync(path.join(ART, "cinema-low.png"), await low.shot());

    const still = await page("/wall.html?look=cinema&q=still");
    await still.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const s = document.getElementById("wardos-scene"); if (s && s.getAttribute("data-q") === "still") return res(true); if (performance.now() - t0 > 6000) return res(false); setTimeout(step, 40); }; step(); })`);
    const stillBuf = await still.shot();
    fs.writeFileSync(path.join(ART, "cinema-still.png"), stillBuf);
    const stillPng = decodePng(stillBuf);
    const gStill = groundStats(stillPng, 200, 200, 1200, 600);
    assert.ok(gStill.mean > 12 && gStill.variance > 8, JSON.stringify(gStill));
    const stillGrade = await still.eval(`document.getElementById("wardos-scene").getAttribute("data-grade")`);
    assert.equal(stillGrade, "off");
    const textA = sample(highPng, layout.clock.right > 80 ? 70 : 60, 210);
    const textB = sample(stillPng, 70, 210);
    const timeIsSolid = textA.every((c, i) => Math.abs(c - timeRgb[i]) <= 2) && textB.every((c, i) => Math.abs(c - timeRgb[i]) <= 2);
    if (timeIsSolid) assert.deepEqual(textA, textB);

    const lost = await page("/wall.html?look=cinema&q=high");
    await lost.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { if (window.__wardosScene) return res(true); if (performance.now() - t0 > 6000) return res(false); setTimeout(step, 40); }; step(); })`);
    await lost.eval(`window.__wardosScene.debugForce("context")`);
    const lostState = await lost.eval(`document.getElementById("wardos-scene").getAttribute("data-fallback")`);
    assert.equal(lostState, "context-lost");
    const lostPng = decodePng(await lost.shot());
    const gLost = groundStats(lostPng, 200, 200, 1000, 500);
    assert.ok(gLost.mean > 12 && gLost.variance > 8, JSON.stringify(gLost));
    assert.equal(await lost.eval(`!!document.getElementById("chip-family")`), true);

    await lost.eval(`window.__wardosScene.debugForce("video")`);
    assert.equal(await lost.eval(`document.getElementById("wardos-scene").getAttribute("data-q")`), "still");
    assert.equal(await lost.eval(`!!document.querySelector("#ui .chip")`), true);

    const noGl = await page("/wall.html?look=cinema&q=high", NOWEBGL);
    await noGl.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const s = document.getElementById("wardos-scene"); if (s && s.getAttribute("data-fallback")) return res(s.getAttribute("data-fallback")); if (performance.now() - t0 > 8000) return res(""); setTimeout(step, 40); }; step(); })`);
    const why = await noGl.eval(`document.getElementById("wardos-scene").getAttribute("data-fallback")`);
    assert.equal(why, "no-webgl");
    const noBuf = await noGl.shot();
    fs.writeFileSync(path.join(ART, "cinema-nowebgl.png"), noBuf);
    const gNo = groundStats(decodePng(noBuf), 200, 200, 1000, 500);
    assert.ok(gNo.mean > 12 && gNo.variance > 8, JSON.stringify(gNo));
    assert.equal(await noGl.eval(`!!document.getElementById("chip-kids")`), true);

    const dec = await page("/wall.html?look=cinema&now=2026-12-25T18:00:00-06:00&q=still");
    const decTheme = await dec.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const v = document.documentElement.getAttribute("data-month-theme"); if (v) return res(v); if (performance.now() - t0 > 5000) return res(""); setTimeout(step, 40); }; step(); })`);
    assert.equal(decTheme, "12");
    assert.equal(await dec.eval(`!!document.querySelector(".km-layer")`), true);
  } finally {
    for (const p of pages) p.close();
    chrome.proc.kill("SIGKILL");
    srv.close();
  }
});
