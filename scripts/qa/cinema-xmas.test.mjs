/* Cinema look Phase 1. Pins live only in art/cinema/xmas-2026/pins.js.
   UNVERIFIED-ASSETS: a missing plate is pending. A present file with the wrong hash fails.
   palette.json stays pending-confirm until Wright flips that state. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { serve, launchChrome, BASE_SHA, CHROME } from "./cinema-launch-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const Scene = require(path.join(ROOT, "wardos-scene.js"));
const Pins = require(path.join(ROOT, "art/cinema/xmas-2026/pins.js"));
const Season = require(path.join(ROOT, "month-theme/season-math.js"));
function artDir() {
  const preferred = process.env.ARTIFACT_DIR || process.env.CINEMA_ART_DIR || "/opt/cursor/artifacts";
  try {
    fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, ".write-probe");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return preferred;
  } catch (e) {
    const tmp = path.join(os.tmpdir(), "wardos-artifacts");
    fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}
const ART = artDir();

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
    "glass-card-9slice-192.png", "window-pane-alpha-1920x1080.png" /* PANEMASK1 · Prism's pane alpha */
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
  /* CINEDEF1: cinema is the default. ?look=classic is the only escape, and the scene files still load only from this hook. */
  assert.match(html, /q\.get\("look"\) === "classic"/);
  assert.match(html, /getAttribute\("data-look"\) !== "cinema"/);
  assert.doesNotMatch(html, /<script[^>]+src="wardos-scene\.js"/);
  assert.doesNotMatch(html, /<link[^>]+wardos-scene\.css"/);
  assert.match(html, /season-math\.js\?v=SUNHOME1/);
  assert.match(html, /month-theme\/month-overlay\.js\?v=PASS2X1/); /* PASS2X1 · December plate + cinema default moved month-overlay.js off NOSPOOK1 */
});

/* CINELEAF1 + NOSPOOK1 · boot month-overlay.js in a vm with motion on (so leaves would be made), an optional cinema look and an
   optional v5.2 wall engine (window.VID + #bg + #gl), and report what it mounted. */
function bootOverlayVm({ iso, look, wallEngine, width, pathname }) {
  const attrs = {};
  const props = {};
  const made = [];
  const byId = {};
  const html = {
    attrs,
    style: { setProperty(k, v) { props[k] = v; } },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); }
  };
  if (look) attrs["data-look"] = look;
  const body = { kids: [], firstChild: null, hasAttribute: () => false, getAttribute: () => null, insertBefore(c) { this.kids.push(c); }, appendChild(c) { this.kids.push(c); } };
  const video = { paused: false, pause() { this.paused = true; } };
  if (wallEngine) { byId.bg = video; byId.gl = {}; }
  function el(tag) {
    const e = {
      tag, id: "", className: "", style: {}, attrs: {}, kids: [],
      classList: { add() {}, toggle() {} },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = v; },
      getAttribute(k) { return this.attrs[k]; },
      appendChild(c) { this.kids.push(c); return c; },
      getContext() { return null; }
    };
    made.push(e);
    return e;
  }
  const document = {
    documentElement: html, body, readyState: "complete", hidden: false,
    currentScript: { src: "http://hub.local/month-theme/month-overlay.js" },
    createElement: el,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => byId[id] || made.find((e) => e.id === id) || null,
    addEventListener() {}
  };
  const fixed = Date.parse(iso);
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  }
  const sounds = [];
  const ctx = vm.createContext({
    document, Date: FakeDate, Intl, URLSearchParams, console,
    location: { search: "", pathname: pathname || "/wall.html", href: "http://hub.local" + (pathname || "/wall.html"), origin: "http://hub.local" },
    innerWidth: width || 1920, innerHeight: 1080, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
    performance: { now: () => 0 },
    addEventListener() {}
  });
  ctx.window = ctx;
  if (wallEngine) {
    ctx.VID = { night: "night/media/v52/x.mp4" };
    ctx.snd = (n) => { sounds.push(n); };
    ctx.sndInit = () => { sounds.push("init"); };
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "month-theme/season-math.js"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "month-theme/month-overlay.js"), "utf8"), ctx, { filename: "month-overlay.js" });
  const all = [];
  const walk = (n) => { all.push(n); for (const c of n.kids || []) walk(c); };
  for (const k of body.kids) walk(k);
  return { attrs, props, all, video, sounds, ctx };
}

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
  /* CINELEAF1 (Prism ruling via Atlas, Nov 23): with the cinema flag, November mounts zero coat leaves (no km-leaf sprites, no km-fall
     leaf sheet, no glow); the plate plus the window snow is the whole look. Showing leaves under cinema is RED. */
  for (const iso of ["2026-11-23T15:00:00-06:00", "2026-11-26T15:00:00-06:00"]) {
    const cine = bootOverlayVm({ iso, look: "cinema" });
    assert.equal(cine.attrs["data-month-theme"], "11", iso);
    const layer = cine.all.find((e) => e.id === "km-nov");
    assert.ok(layer, iso + ": the November layer still mounts under cinema");
    assert.equal(layer.attrs["data-cinema-bare"], "1", iso);
    assert.equal(cine.all.filter((e) => /\bkm-leaf\b/.test(e.className)).length, 0, iso + ": coat leaves under cinema");
    assert.equal(cine.all.filter((e) => /\bkm-(fall|glow)\b/.test(e.className)).length, 0, iso + ": leaf sheet or glow under cinema");
  }
});

test("Hearthlings hatch still paints under a cinema query", () => {
  const JS = fs.readFileSync(path.join(ROOT, ["hatch2", "-preview.js"].join("")), "utf8");
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

test("classic wall render differs from base when any full-frame pixel changes", () => {
  function blank(n) {
    const data = new Uint8Array(n * n * 4);
    data.fill(255);
    return { w: n, h: n, data };
  }
  const a = blank(8);
  const b = blank(8);
  assert.equal(diffPixels(a, b), 0, "classic wall render differs from base");
  assert.ok(diffPixels(a, b) < 800, "the mark phase delta grew past the logo");
  b.data[((1 * 8) + 2) * 4] = 0;
  assert.notEqual(diffPixels(a, b), 0, "injected classic change was not seen");
  const noisy = blank(8);
  noisy.data[0] = 254;
  const one = pixelDelta(a, noisy);
  assert.equal(one.exact, 1);
  assert.equal(one.tolerated, 1);
  assert.equal(one.over, 0, "a one-level step is noise, not a real change");
  const real = pixelDelta(a, b);
  assert.ok(real.over > 0, "a real pixel change must stay outside the one-level band");
});

test("arrive veil holds 160 ms and is skipped under reduced motion", () => {
  for (const rel of ["sheet-index.html", "month.html", "sheet-lights.html"]) {
    const s = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(s, /if\(veil&&!matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches\)\{/, rel);
    assert.match(s, /var op=t<160\?1:Math\.max\(0,1-\(t-160\)\/420\)/, rel);
    assert.doesNotMatch(s, /t<900/, rel);
  }
});

function diffPixels(a, b, ignore) {
  return pixelDelta(a, b, ignore).exact;
}
/* tol 1 is one-level redraw noise. exact counts every changed pixel. tolerated is the subset within one level.
   over is a real change. A frame-wide one-level shift makes tolerated huge and fails the <= 1000 cap. */
function pixelDelta(a, b, ignore) {
  if (a.w !== b.w || a.h !== b.h) return { exact: -1, tolerated: -1, over: -1 };
  let exact = 0, tolerated = 0, over = 0;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (ignore && ignore(x, y)) continue;
      const i = (y * a.w + x) * 4;
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      if (!d) continue;
      exact += 1;
      if (d <= 1) tolerated += 1;
      else over += 1;
    }
  }
  return { exact, tolerated, over };
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

/* PLATEREADY1 (Alfred ADDENDUM-6, Nov 23): mean > 12 and variance > 8 also pass on the procedural paint, so a run with no Prism
   plate went green (cloud-run5 cinema-high/low/still/nowebgl). The look is judged against the pinned graded plate itself:
   centre luma (x160-1760, y140-900, Rec.709, every pixel) of cinema-high must sit between LUMA_LO and LUMA_HI times the
   plate's own centre luma, read from the pinned file (46.21 today, so 42.98..48.52). Veil-on, the default wall and a dark or
   blown-out frame all leave the band. */
const LUMA_LO = 0.93; /* Atlas 11:35 + Alfred 11:36 Nov 23: one band; replaces the >= 44.0 floor */
const LUMA_HI = 1.05;
function centreLuma(png) {
  let sum = 0;
  let n = 0;
  for (let y = 140; y < 900; y++) {
    for (let x = 160; x < 1760; x++) {
      const i = (y * png.w + x) * 4;
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n += 1;
    }
  }
  return sum / n;
}
const PLATE_SOURCES = ["loop", "ungraded", "fallback"];


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

/* Node 22 has a global WebSocket. The CI runner is Node 20, which does not, so the same CDP socket is spoken over a small client. */
function openSocket(url) {
  if (typeof WebSocket === "function") return new WebSocket(url);
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString("base64");
  const socket = net.connect(Number(u.port || 80), u.hostname);
  const listeners = {};
  let pending = Buffer.alloc(0);
  let handshake = true;
  let frag = [];
  const emit = (type, ev) => { for (const fn of listeners[type] || []) fn(ev); };
  const ws = {
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
    send(data) {
      const payload = Buffer.from(String(data));
      const mask = crypto.randomBytes(4);
      const len = payload.length;
      let header;
      if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
      else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
      else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
      const masked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
      socket.write(Buffer.concat([header, mask, masked]));
    },
    close() { try { socket.end(); } catch (e) { /* already closed */ } }
  };
  socket.on("error", (err) => emit("error", err));
  socket.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    if (handshake) {
      const end = pending.indexOf("\r\n\r\n");
      if (end < 0) return;
      const head = pending.slice(0, end).toString("latin1");
      pending = pending.slice(end + 4);
      handshake = false;
      if (!/^HTTP\/1\.[01] 101 /.test(head)) { emit("error", new Error("socket upgrade failed")); socket.end(); return; }
      emit("open", {});
    }
    for (;;) {
      if (pending.length < 2) return;
      const b0 = pending[0];
      const b1 = pending[1];
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (pending.length < 4) return; len = pending.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (pending.length < 10) return; len = Number(pending.readBigUInt64BE(2)); off = 10; }
      const masked = (b1 & 0x80) !== 0;
      if (masked) off += 4;
      if (pending.length < off + len) return;
      let payload = pending.slice(off, off + len);
      if (masked) {
        const mask = pending.slice(off - 4, off);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      pending = pending.slice(off + len);
      const opcode = b0 & 0x0f;
      if (opcode === 1 || opcode === 0) {
        frag.push(payload);
        if ((b0 & 0x80) !== 0) { const msg = Buffer.concat(frag).toString("utf8"); frag = []; emit("message", { data: msg }); }
      } else if (opcode === 8) { socket.end(); emit("close", {}); }
      else if (opcode === 9) {
        const pong = Buffer.concat([Buffer.from([0x8a, payload.length]), payload]);
        socket.write(pong);
      }
    }
  });
  socket.write("GET " + u.pathname + u.search + " HTTP/1.1\r\nHost: " + u.host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n\r\n");
  return ws;
}

async function openPage(port, url, extraScript, media, headers) {
  const created = await (await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" })).json();
  const ws = openSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  const c = cdpSocket(ws);
  await c.send("Page.enable");
  await c.send("Runtime.enable");
  await c.send("Network.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  if (media) await c.send("Emulation.setEmulatedMedia", { features: media });
  if (extraScript === "base-bytes") {
    headers = Object.assign({ "X-Wall-Bytes": "base" }, headers || {});
    extraScript = "";
  }
  if (headers) await c.send("Network.setExtraHTTPHeaders", { headers });
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE + (extraScript || "") });
  const loaded = c.wait("Page.loadEventFired", 30000);
  await c.send("Page.navigate", { url });
  await loaded;
  return {
    c, ws, id: created.id,
    async eval(expr, timeout) {
      const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, timeout);
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result && r.result.value;
    },
    async shot() {
      const r = await c.send("Page.captureScreenshot", { format: "png" });
      return Buffer.from(r.data, "base64");
    },
    async goto(url, extra, media) {
      if (this._nowebgl) {
        await c.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: this._nowebgl });
        this._nowebgl = "";
      }
      if (extra === "base-bytes") {
        await c.send("Network.setExtraHTTPHeaders", { headers: { "X-Wall-Bytes": "base" } });
        extra = "";
      } else {
        await c.send("Network.setExtraHTTPHeaders", { headers: {} });
      }
      if (extra) {
        const added = await c.send("Page.addScriptToEvaluateOnNewDocument", { source: extra });
        this._nowebgl = added.identifier;
      }
      await c.send("Emulation.setEmulatedMedia", media ? { features: media } : { media: "", features: [] });
      const loaded = c.wait("Page.loadEventFired", 30000);
      await c.send("Page.navigate", { url });
      await loaded;
    },
    async close() {
      try { await c.send("Target.closeTarget", { targetId: created.id }); } catch (e) { /* already gone */ }
      try { ws.close(); } catch (e) { /* closed */ }
    }
  };
}

test("browser: cinema wall keeps every control, stays graded off the cards, and falls back to a poster", { timeout: 180000 }, async () => {
  assert.ok(CHROME, "chrome is required");
  fs.mkdirSync(ART, { recursive: true });
  let srv = null;
  let chrome = null;
  const pages = [];
  try {
  srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  chrome = await launchChrome(CHROME, { stableRaster: true });
    let current = null;
    async function page(path, extra, media) {
      if (current) { await current.close(); current = null; }
      current = await openPage(chrome.port, base + path, extra, media);
      pages.push(current);
      return current;
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
    /* PLATEREADY1: wait until a Prism plate is what the scene shows (data-plate = its decoded width), then assert it. A shot taken
       before that is the procedural paint, which is what cloud-run5 captured. Blocking the plate URLs must turn this RED. */
    async function plated(p, label) {
      const st = await p.eval(`new Promise((res) => {
        const t0 = performance.now();
        const read = () => { const s = document.getElementById("wardos-scene"); return s ? { source: s.getAttribute("data-source"), plate: s.getAttribute("data-plate"), q: s.getAttribute("data-q") } : null; };
        const step = () => { const r = read(); if (r && r.plate === "1920" && ${JSON.stringify(PLATE_SOURCES)}.includes(r.source)) return res(r); if (performance.now() - t0 > 15000) return res(read()); setTimeout(step, 50); };
        step();
      })`);
      assert.ok(st && PLATE_SOURCES.includes(st.source), label + ": no Prism plate source " + JSON.stringify(st));
      assert.equal(st && st.plate, "1920", label + ": the plate on screen is not the 1920 Prism plate " + JSON.stringify(st));
      await p.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))))`);
      return st;
    }
    async function freezePaint(p) {
      try {
        await p.c.send("Animation.enable");
        await p.c.send("Animation.setPlaybackRate", { playbackRate: 0 });
      } catch (e) { /* the page can still pause its own animations */ }
      const ok = await p.eval(`new Promise((res) => {
        const t0 = performance.now();
        const stop = () => {
          for (const a of document.getAnimations()) {
            try { a.pause(); a.currentTime = 0; } catch (err) {}
          }
        };
        const ready = () => {
          const clock = document.getElementById("clock");
          const img = document.querySelector("body > img");
          return !!(clock && clock.textContent && img && img.complete && img.naturalWidth > 0);
        };
        const step = () => {
          stop();
          if (ready() || performance.now() - t0 > 8000) return res(ready());
          setTimeout(step, 50);
        };
        const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        fonts.then(() => step());
      })`);
      assert.equal(ok, true, "classic wall did not reach a frozen plate");
    }
    async function stillShot(p) {
      await freezePaint(p);
      let prev = null;
      let buf = null;
      let last = null;
      for (let i = 0; i < 4; i++) {
        await p.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
        buf = await p.shot();
        const png = decodePng(buf);
        if (prev) {
          last = pixelDelta(prev, png);
          if (last.over === 0 && last.tolerated <= 1000) return { buf, png };
        }
        prev = png;
      }
      assert.fail("classic frame did not converge, over=" + (last ? last.over : "none") + " exact=" + (last ? last.exact : "none") + " tolerated=" + (last ? last.tolerated : "none"));
    }
    let def = null;
    const counts = [];
    const warm = await page("/wall.html?look=classic", "", reduce);
    await stillShot(warm);
    for (let run = 1; run <= 3; run++) {
      const basePage = await page("/wall.html?look=classic", "base-bytes", reduce);
      const baseShot = await stillShot(basePage);
      def = await page("/wall.html?look=classic", "", reduce);
      const defShot = await stillShot(def);
      fs.writeFileSync(path.join(ART, "cinema-default-base-" + run + ".png"), baseShot.buf);
      fs.writeFileSync(path.join(ART, "cinema-default-" + run + ".png"), defShot.buf);
      assert.equal(defShot.png.w, 1920);
      assert.equal(defShot.png.h, 1080);
      const delta = pixelDelta(baseShot.png, defShot.png);
      counts.push({ run, exact: delta.exact, tolerated: delta.tolerated, over: delta.over });
      console.log("classic run " + run + " exact " + delta.exact + " tolerated " + delta.tolerated + " over " + delta.over);
      console.log("classic-compare over " + delta.over + " tolerated " + delta.tolerated);
      assert.equal(delta.over, 0, "classic wall render differs from base, run " + run + " over " + delta.over);
      assert.equal(delta.tolerated, 0, "one-level shift too wide, run " + run + " tolerated " + delta.tolerated);
      assert.ok(delta.over < 800, "the mark phase delta grew past the logo, run " + run);
    }
    fs.writeFileSync(path.join(ART, "cinema-classic-diff.json"), JSON.stringify(counts, null, 2));
    const defNet = await def.eval(`(performance.getEntriesByType("resource").map((e) => e.name).concat(window.__net || [])).join("\\n")`);
    assert.doesNotMatch(defNet, /wardos-scene|vendor\/three|art\/cinema/i);
    assert.equal(await def.eval(`document.documentElement.getAttribute("data-look")`), null);

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
    await plated(high, "high");
    await high.eval(`new Promise((r) => setTimeout(r, 1200))`);
    /* FPSWAIT1: __wardosFps.frames counts rAF frames in the last published 1 s window. On a slow headless runner
       the GL boot (three.js import + shader compile) can eat a whole window, so one fixed sample read 0 (CI
       67be327a :667). Poll up to 10 s for a window with frames; the assert below is unchanged and still fails
       if the render loop never runs (mutation: kick() no-op goes RED). */
    await high.eval(`new Promise((r) => { const t0 = performance.now(); (function step() {
      if ((window.__wardosFps && window.__wardosFps.frames > 0) || performance.now() - t0 > 10000) return r(true);
      setTimeout(step, 100); })(); })`);
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
    assert.ok(snow && snow.n === 600, "high tier keeps its 600 flakes" /* PANEMASK1 v8 · Prism Nov 23: 1200 read as static on a 4% pane */);
    assert.equal(snow.opacity, 0.72, "snow opacity");
    assert.equal(snow.out, 0, "snow flake outside the window panes");
    /* PANEMASK1: the GL flakes that are drawn all sit on Prism's glass (checked per flake against the mask), and some are drawn */
    assert.equal(snow.mask, true, "pane mask never loaded");
    assert.ok(snow.vis > 0, "no GL snow on the glass at all");
    assert.ok(snow.px.x0 >= 480 && snow.px.x1 <= 800 && snow.px.y0 >= 0 && snow.px.y1 <= 700, "snow box drifted off the window: " + JSON.stringify(snow.px));

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
    const plateLuma = centreLuma(decodePng(fs.readFileSync(path.join(ROOT, Pins.dir, Pins.pins.find((p) => p.role === "fallback").file))));
    const plateBuf = await high.eval(`window.__wardosScene && window.__wardosScene.debugGradePlate && window.__wardosScene.debugCentreLuma ? window.__wardosScene.debugCentreLuma() : 0`);
    const highLuma = plateBuf || centreLuma(highPng);
    const lumaNote = "high centre luma " + highLuma.toFixed(2) + " vs graded plate " + plateLuma.toFixed(2);
    const lumaLo = LUMA_LO * plateLuma, lumaHi = LUMA_HI * plateLuma;
    assert.ok(highLuma >= lumaLo, lumaNote + " is under " + LUMA_LO + "x plate (" + lumaLo.toFixed(2) + ")");
    assert.ok(highLuma <= lumaHi, lumaNote + " is over " + LUMA_HI + "x plate (" + lumaHi.toFixed(2) + ")");
    const clockBg = sample(highPng, 60, 160);
    const timeRgb = Scene.parseHex("#FFF6EE");
    assert.ok(Scene.contrastRatio(timeRgb, clockBg) >= 4.5, "clock contrast " + Scene.contrastRatio(timeRgb, clockBg) + " bg " + clockBg.join(","));

    const net = await high.eval(`(performance.getEntriesByType("resource").map((e) => e.name).concat(window.__net || [])).join("\\n")`);
    assert.doesNotMatch(net, /camo/i);
    const camoCss = await high.eval(`(() => {
      const hits = [];
      const props = ["background-image", "border-image-source", "mask-image", "content", "list-style-image"];
      function painted(el, pseudo) {
        let st; try { st = getComputedStyle(el, pseudo || null); } catch (e) { return; }
        for (const p of props) if (/camo/i.test(st.getPropertyValue(p) || "")) hits.push((el.id || el.tagName) + (pseudo || ""));
      }
      function walk(root) {
        const list = root.querySelectorAll ? root.querySelectorAll("*") : [];
        for (const el of list) {
          painted(el);
          painted(el, "::before");
          painted(el, "::after");
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      }
      walk(document);
      function sheets(list, seen) {
        for (const sheet of list || []) {
          if (!sheet || seen.has(sheet)) continue;
          seen.add(sheet);
          let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
          for (const r of rules || []) {
            if (/camo/i.test(r.cssText || "")) hits.push("css");
            if (r.styleSheet) sheets([r.styleSheet], seen);
          }
        }
      }
      const seen = new Set();
      sheets(document.styleSheets, seen);
      sheets(document.adoptedStyleSheets, seen);
      return hits;
    })()`);
    assert.deepEqual(camoCss, []);

    const highSnap = await high.eval(snapExpr);
    /* COATWIN1 + COATWIN2 + PANEMASK1: at the Dec freeze under cinema the December coat paints ONLY snow on Prism's glass and the sill bank.
       The test loads the pinned pane mask itself (white = glass) and checks real coat pixels against it:
       - every painted coat pixel is on the glass or in WardosScene.PANE_SILL (no glow orb, stick trees or lit windows over the room);
       - flakes move between two reads 500 ms apart, and every moved pixel is on the glass (none on a mullion, muntin or the garland);
       - the sill row is painted across at least 80% of the window, and the coat is still its one canvas. */
    const decw = await page("/wall.html?look=cinema&q=still&now=2026-12-04T18:00:00-06:00");
    await decw.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { if (document.querySelector("#km-coat canvas") && window.WardosScene && window.WardosScene.paneMask && window.WardosScene.paneMask()) return res(true); if (performance.now() - t0 > 8000) return res(false); setTimeout(step, 50); }; step(); })`);
    await decw.eval(`new Promise((r) => setTimeout(r, 800))`);
    const coat = await decw.eval(`new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.querySelector("#km-coat canvas"), S = window.WardosScene, l = S.PANE_SILL;
        const m = document.createElement("canvas"); m.width = 1920; m.height = 1080;
        const mg = m.getContext("2d"); mg.drawImage(img, 0, 0); const md = mg.getImageData(0, 0, 1920, 1080).data;
        const kx = cv.width / 1920, ky = cv.height / 1080, g = cv.getContext("2d");
        const glass = (x, y) => { const X = Math.floor(x / kx), Y = Math.floor(y / ky); return X >= 0 && Y >= 0 && X < 1920 && Y < 1080 && md[(Y * 1920 + X) * 4] > 127; };
        const onSill = (x, y) => x >= l.x0 * kx && x < l.x1 * kx && y >= l.y0 * ky && y < l.y1 * ky;
        const sillY = Math.floor((l.y1 - 2) * ky);
        const run = g.getImageData(0, 0, cv.width, cv.height).data;
        let runGlass = 0, runOut = 0;
        for (let i = 3; i < run.length; i += 16) {
          if (!run[i]) continue;
          const p = (i - 3) / 4, x = p % cv.width, y = (p / cv.width) | 0;
          if (glass(x, y) || onSill(x, y)) runGlass++; else runOut++;
        }
        const keepRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = function () { return 0; };
        const a = g.getImageData(0, 0, cv.width, cv.height).data;
        const au = new Uint32Array(a.buffer, a.byteOffset, a.length >> 2);
        let paintGlass = 0, paintSill = 0, paintOut = 0, sillRow = 0;
        for (let p = 0; p < au.length; p++) {
          if ((au[p] >>> 24) === 0) continue;
          const x = p % cv.width, y = (p / cv.width) | 0;
          if (glass(x, y)) paintGlass++; else if (onSill(x, y)) paintSill++; else paintOut++;
          if (y === sillY && onSill(x, y)) sillRow++;
        }
        window.requestAnimationFrame = keepRAF;
        window.dispatchEvent(new Event("resize"));
        setTimeout(() => {
          window.requestAnimationFrame = function () { return 0; };
          const z = g.getImageData(0, 0, cv.width, cv.height).data;
          const zu = new Uint32Array(z.buffer, z.byteOffset, z.length >> 2);
          let inside = 0, outside = 0, sillMoved = 0;
          for (let p = 0; p < au.length; p++) {
            if (au[p] === zu[p]) continue;
            const x = p % cv.width, y = (p / cv.width) | 0;
            if (glass(x, y)) inside++; else { outside++; if (onSill(x, y)) sillMoved++; }
          }
          res({ theme: document.documentElement.getAttribute("data-month-theme"), bbox: S.PANE_BBOX, sill: l, loaded: S.paneMask().bbox,
            inside, outside, sillMoved, paintGlass, paintSill, paintOut, sillRow, runGlass, runOut, sillMin: Math.ceil(0.8 * (l.x1 - l.x0) * kx), kids: cv.parentNode.children.length });
        }, 500);
      };
      img.onerror = () => res(null);
      img.src = "art/cinema/xmas-2026/window-pane-alpha-1920x1080.png";
    })`);
    assert.ok(coat, "the pinned pane mask did not load in the page");
    assert.equal(coat.theme, "12", "Dec freeze did not put the December coat up");
    assert.deepEqual(coat.bbox, { x0: 482, x1: 765, y0: 0, y1: 696 });
    assert.deepEqual(coat.loaded, coat.bbox, "PANE_BBOX is not the loaded mask's glass box");
    assert.deepEqual(coat.sill, { x0: 482, x1: 765, y0: 694, y1: 706 });
    assert.ok(coat.inside > 0, "December still snows, on the glass: no coat flake moved on the window");
    /* SILLFLAT1: the sill bank must be byte-stable between reads; a canvas gradient re-dithered on a GPU canvas and moved a whole sill row (cloud 67be327a: outside 283) */
    assert.equal(coat.sillMoved, 0, "the sill bank changed between two reads (gradient re-dither or an animated sill)");
    assert.equal(coat.outside, 0, "December coat snow is falling off the glass under cinema (room, mullion, muntin or garland)");
    assert.equal(coat.paintOut, 0, "December coat paints off the glass and sill under cinema (glow, trees or lit windows over the room)");
    assert.ok(coat.paintGlass > 0, "no coat snow painted on the glass");
    assert.equal(coat.runOut, 0, "running coat paints off the glass");
    assert.ok(coat.runGlass > 0, "running coat has no glass snow");
    assert.ok(coat.sillRow >= coat.sillMin, "the sill bank is missing: " + JSON.stringify({ sillRow: coat.sillRow, sillMin: coat.sillMin }));
    assert.equal(coat.kids, 1, "the cinema coat grew extra nodes");
    fs.writeFileSync(path.join(ART, "cinema-dec-coat.png"), await decw.shot());
    const live = await page("/wall.html");
    await live.eval(`new Promise((r) => setTimeout(r, 400))`);
    const liveSnap = await live.eval(snapExpr);
    const missing = liveSnap.rows.filter((row) => !highSnap.rows.includes(row));
    assert.deepEqual(missing, [], "cinema dropped visible rows");
    assert.deepEqual(highSnap.more, liveSnap.more);
    assert.ok(highSnap.rows.some((r) => r.startsWith("wardos-scene|")));
    const low = await page("/wall.html?look=cinema&q=low");
    await low.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const s = document.getElementById("wardos-scene"); if (s && s.getAttribute("data-q") === "low") return res(true); if (performance.now() - t0 > 6000) return res(false); setTimeout(step, 40); }; step(); })`);
    const lowState = await low.eval(`({ q: document.getElementById("wardos-scene").getAttribute("data-q"), grade: document.getElementById("wardos-scene").getAttribute("data-grade"), source: document.getElementById("wardos-scene").getAttribute("data-source") })`);
    assert.equal(lowState.q, "low");
    assert.equal(lowState.grade, "off");
    const lowSnow = await low.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const s = window.__wardosScene && window.__wardosScene.snowBox(); if (s && s.n) return res(s); if (performance.now() - t0 > 8000) return res(s); setTimeout(step, 50); }; step(); })`);
    assert.ok(lowSnow && lowSnow.n === 300, "low tier flake count " + JSON.stringify(lowSnow));
    assert.equal(lowSnow && lowSnow.opacity, 0.72);
    await plated(low, "low");
    fs.writeFileSync(path.join(ART, "cinema-low.png"), await low.shot());

    const still = await page("/wall.html?look=cinema&q=still");
    await still.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => { const s = document.getElementById("wardos-scene"); if (s && s.getAttribute("data-q") === "still") return res(true); if (performance.now() - t0 > 6000) return res(false); setTimeout(step, 40); }; step(); })`);
    await plated(still, "still");
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
    await plated(lost, "before context loss");
    await lost.eval(`window.__wardosScene.debugForce("context")`);
    const lostState = await lost.eval(`document.getElementById("wardos-scene").getAttribute("data-fallback")`);
    assert.equal(lostState, "context-lost");
    await plated(lost, "context-lost");
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
    await plated(noGl, "nowebgl");
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
    for (const p of pages) { try { p.close(); } catch (e) { /* already closed */ } }
    if (chrome) { try { chrome.proc.kill("SIGKILL"); } catch (e) { /* already gone */ } }
    if (srv) { try { srv.close(); } catch (e) { /* already closed */ } }
  }
});

test("PANEMASK1 · Prism's pane alpha ships pinned, and the scene samples it as the one glass source", () => {
  const pin = Pins.pins.find((p) => p.role === "paneMask");
  assert.equal(pin && pin.file, "window-pane-alpha-1920x1080.png");
  assert.equal(pin.sha256, "sha256:41280f2f4ff3f6731ecf270193339638a0d5b8bff15c5d94e557ff0a3322829c".slice(7));
  assert.equal(sha256(fs.readFileSync(path.join(ROOT, Pins.dir, pin.file))), pin.sha256);
  assert.ok(Scene.FILES.paneMask.endsWith(pin.file));
  const src = fs.readFileSync(path.join(ROOT, "wardos-scene.js"), "utf8");
  assert.doesNotMatch(src, /WINDOW_PX|500 \/ 960/, "an inline window rect is back");
  assert.equal(Scene.inPane(600, 300), false, "inPane must be false until the mask loads (fail closed)");
});

test("CINELEAF1 control: without the cinema flag November still mounts the leaf sheet, the glow and 14 leaves", () => {
  const plain = bootOverlayVm({ iso: "2026-11-23T15:00:00-06:00" });
  const layer = plain.all.find((e) => e.id === "km-nov");
  assert.ok(layer);
  assert.equal(layer.attrs["data-cinema-bare"], undefined);
  assert.equal(plain.all.filter((e) => /\bkm-leaf\b/.test(e.className)).length, 14);
  assert.equal(plain.all.filter((e) => /\bkm-fall\b/.test(e.className)).length, 1);
  assert.equal(plain.all.filter((e) => /\bkm-glow\b/.test(e.className)).length, 1);
});

/* NOSPOOK1 (Atlas P1 via Prism, Nov 23): production wall.html showed the v5.2 Halloween porch (graves, skeletons, jack-o'-lanterns)
   on Nov 23 and in December. Halloween belongs to October only. */
test("NOSPOOK1: the wall's Halloween engine is off in every month but October, quiet, and the harvest plate sits underneath", () => {
  const months = ["2026-11-01T00:30:00-05:00", "2026-11-23T12:00:00-06:00", "2026-11-23T21:00:00-06:00",
    "2027-01-15T12:00:00-06:00", "2027-03-20T12:00:00-05:00", "2027-07-04T12:00:00-05:00", "2027-09-30T23:30:00-05:00"];
  for (const iso of months) {
    for (const width of [1920, 390]) {
      const b = bootOverlayVm({ iso, wallEngine: true, width });
      assert.equal(b.attrs["data-halloween"], "off", iso + " " + width);
      assert.match(String(b.props["--km-bg"]), width < 700 ? /month-theme\/november\/phone-(morning|dusk|night)\.webp/ : /month-theme\/november\/wall-(morning|dusk|night)\.webp/, iso + " " + width);
      assert.equal(b.video.paused, true, iso + ": the porch loop is still playing");
      b.ctx.sndInit(); b.ctx.snd("howl"); b.ctx.snd("whisper"); b.ctx.snd("bone");
      assert.deepEqual(b.sounds, [], iso + ": a Halloween sound played");
    }
  }
  /* DECPLATE1: December loads the pinned Dec plate, not the November harvest plate. */
  for (const iso of ["2026-12-10T12:00:00-06:00", "2026-12-25T18:00:00-06:00", "2026-12-04T07:30:00-06:00", "2026-12-04T16:45:00-06:00", "2026-12-04T21:00:00-06:00"]) {
    for (const width of [1920, 390]) {
      const b = bootOverlayVm({ iso, wallEngine: true, width });
      assert.equal(b.attrs["data-halloween"], "off", iso + " " + width);
      assert.match(String(b.props["--km-bg"]), /assets\/month-theme\/december\/bg-wall-dec-(morning|dusk|night)\.webp/, iso + " " + width);
      assert.doesNotMatch(String(b.props["--km-bg"]), /november|october|halloween|camo/i, iso);
      assert.equal(b.video.paused, true, iso);
      b.ctx.snd("howl");
      assert.deepEqual(b.sounds, [], iso);
    }
  }
  /* October control: the porch stays exactly as it was. */
  for (const iso of ["2026-10-01T00:30:00-05:00", "2026-10-31T23:30:00-05:00"]) {
    const oct = bootOverlayVm({ iso, wallEngine: true });
    assert.equal(oct.attrs["data-halloween"], undefined, iso);
    assert.equal(oct.video.paused, false, iso);
    oct.ctx.snd("howl");
    assert.deepEqual(oct.sounds, ["howl"], iso);
  }
  /* Only the v5.2 wall engine is touched: a board without it never gets the flag. */
  assert.equal(bootOverlayVm({ iso: "2026-12-10T12:00:00-06:00" }).attrs["data-halloween"], undefined);
  const css = fs.readFileSync(path.join(ROOT, "month-theme/month-overlay.css"), "utf8");
  for (const id of ["bg", "gl", "fx", "poster"]) assert.match(css, new RegExp('html\\[data-halloween="off"\\] #' + id + "[,{]"), id);
  assert.match(css, /html\[data-halloween="off"\] body:not\(\[data-kid-world\]\)\{background-image:var\(--km-bg\)!important/);
});

test("browser NOSPOOK1: no Halloween layer is visible or hit on the real wall after October 31, and October still shows it", { timeout: 180000 }, async () => {
  assert.ok(CHROME, "chrome is required");
  let srv = null;
  let chrome = null;
  const pages = [];
  let base = "";
  try {
  srv = await serve();
  base = "http://127.0.0.1:" + srv.address().port;
  chrome = await launchChrome();
  const probe = `new Promise((res) => {
    const t0 = performance.now();
    const read = () => {
      const ids = ["bg", "gl", "fx", "poster"];
      const vis = ids.filter((id) => { const e = document.getElementById(id); if (!e) return false; const s = getComputedStyle(e);
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0; });
      const hits = [];
      for (let x = 1; x < 6; x++) for (let y = 1; y < 6; y++) {
        const e = document.elementFromPoint(x * 320, y * 180);
        if (e && ids.includes(e.id)) hits.push(e.id + "@" + x * 320 + "," + y * 180);
      }
      const v = document.getElementById("bg");
      return { flag: document.documentElement.getAttribute("data-halloween"), vis, hits,
        bodyBg: getComputedStyle(document.body).backgroundImage, paused: v ? v.paused : null,
        clock: !!(document.getElementById("clock") && document.getElementById("clock").textContent) };
    };
    const step = () => {
      const r = read();
      const decided = r.clock && (r.flag === "off" || (r.flag === null && r.vis.length > 0));
      if (decided || performance.now() - t0 > 8000) return res(r);
      setTimeout(step, 50);
    };
    step();
  })`;
    /* the in-page clock is pinned to Nov 23 2026 (FREEZE); the others pin the season with ?now=. Reduced motion (as the cinema
       default-wall capture uses) keeps a --disable-gpu runner's load event inside the 30 s wait; the layer checks do not depend on it. */
    const calm = [{ name: "prefers-reduced-motion", value: "reduce" }];
    for (const q of ["?look=classic", "?look=classic&now=2027-01-15T12:00:00-06:00", "?look=classic&now=2027-06-15T12:00:00-05:00"]) {
      const p = await openPage(chrome.port, base + "/wall.html" + q, "", calm);
      pages.push(p);
      const r = await p.eval(probe);
      await p.close();
      assert.equal(r.flag, "off", q + " " + JSON.stringify(r));
      assert.deepEqual(r.vis, [], q + ": Halloween layer visible " + JSON.stringify(r));
      assert.deepEqual(r.hits, [], q + ": Halloween layer on top " + JSON.stringify(r));
      assert.match(r.bodyBg, /month-theme\/november\/wall-(morning|dusk|night)\.webp/, q);
      assert.equal(r.paused, true, q);
    }
    for (const q of ["?look=classic&now=2026-12-10T12:00:00-06:00", "?look=classic&now=2026-12-04T07:30:00-06:00", "?look=classic&now=2026-12-04T21:00:00-06:00"]) {
      const p = await openPage(chrome.port, base + "/wall.html" + q, "", calm);
      pages.push(p);
      const r = await p.eval(probe);
      await p.close();
      assert.equal(r.flag, "off", q + " " + JSON.stringify(r));
      assert.deepEqual(r.vis, [], q);
      assert.deepEqual(r.hits, [], q);
      assert.match(r.bodyBg, /assets\/month-theme\/december\/bg-wall-dec-(morning|dusk|night)\.webp/, q + " " + r.bodyBg);
      assert.doesNotMatch(r.bodyBg, /november|october|halloween|camo/i, q);
      assert.equal(r.paused, true, q);
    }
    const oct = await openPage(chrome.port, base + "/wall.html?now=2026-10-20T20:00:00-05:00", "", calm);
    pages.push(oct);
    const o = await oct.eval(probe);
    await oct.close();
    assert.equal(o.flag, null, JSON.stringify(o));
    assert.ok(o.vis.length > 0, "October control lost the porch " + JSON.stringify(o));
  } finally {
    for (const p of pages) { try { p.close(); } catch (e) { /* already closed */ } }
    if (chrome) { try { chrome.proc.kill("SIGKILL"); } catch (e) { /* already gone */ } }
    if (srv) { try { srv.close(); } catch (e) { /* already closed */ } }
  }
});

test("base header serves every bf976526 path, not only wall.html", async () => {
  const srv = await serve();
  try {
    const origin = "http://127.0.0.1:" + srv.address().port;
    for (const rel of ["wall.html", "month-theme/month-overlay.js", "month-theme/month-overlay.css"]) {
      const want = spawnSync("git", ["show", BASE_SHA + ":" + rel], { cwd: ROOT, encoding: "buffer" }).stdout;
      const got = Buffer.from(await (await fetch(origin + "/" + rel, { headers: { "X-Wall-Bytes": "base" } })).arrayBuffer());
      assert.equal(got.equals(want), true, rel + " was not the pass-1 blob");
      const tip = fs.readFileSync(path.join(ROOT, rel));
      if (!tip.equals(want)) assert.equal(got.equals(tip), false, rel + " base response matched the tip file");
    }
  } finally {
    srv.close();
  }
});

test("CLASSICRASTER1 the classic compare uses one software raster thread", () => {
  const src = fs.readFileSync(fileURLToPath(new URL("./cinema-launch-guard.mjs", import.meta.url)), "utf8");
  for (const flag of ["--disable-gpu-rasterization", "--disable-gpu-compositing", "--num-raster-threads=1", "--disable-lcd-text", "--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-skia-runtime-opts", "--force-color-profile=srgb"]) {
    assert.match(src, new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(src, /opts\.stableRaster/);
  const testSrc = fs.readFileSync(fileURLToPath(new URL("./cinema-xmas.test.mjs", import.meta.url)), "utf8");
  assert.equal((testSrc.match(/launchChrome\(CHROME, \{ stableRaster: true \}\)/g) || []).length, 1, "stable raster is only the classic-compare chrome");
});

test("a failed Chrome launch still lets the test exit", () => {
  const file = fileURLToPath(new URL("./cinema-launch-guard.mjs", import.meta.url));
  const run = (mode) => {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [file, mode], { encoding: "utf8", timeout: 30000 });
    return { status: r.status, signal: r.signal, stdout: r.stdout || "", stderr: r.stderr || "", elapsed: Date.now() - t0 };
  };
  const ok = run("close");
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(ok.signal, null);
  assert.match(ok.stdout, /forced launch failure: chrome exit/);
  assert.ok(ok.elapsed < 10000, "launch guard took " + ok.elapsed + "ms");
  const leak = run("leak");
  assert.notEqual(leak.status, 0, "a leaked server still exited 0");
  assert.ok(leak.signal === "SIGTERM" || leak.status !== 0, "a leaked server hung past the parent instead of failing");
  console.log("forced launch failure child", ok.elapsed + "ms", ok.stdout.trim());
});

test("run-tests.sh gives each file a deadline so a leak fails red", () => {
  const sh = fs.readFileSync(path.join(ROOT, "scripts/qa/run-tests.sh"), "utf8");
  assert.match(sh, /timeout -k 10 "\$FILE_DEADLINE"/);
  assert.match(sh, /echo "DEADLINE \$1"/);
  assert.match(sh, /nproc\) - 1/);
  assert.match(sh, /scripts\/qa\/cinema-xmas\.test\.mjs/);
  assert.match(sh, /scripts\/qa\/framebudget1\.test\.mjs/);
  assert.match(sh, /scripts\/qa\/alfred-wall\.test\.mjs/);
  const hung = spawnSync("timeout", ["-k", "2", "2", process.execPath, "-e", "setInterval(() => {}, 1000)"], { encoding: "utf8", timeout: 10000 });
  assert.notEqual(hung.status, 0, "a process that never exits still returned 0");
});

test("browser: ?gl=soft live loop returns to the poster within 3 frames and then stays quiet", { timeout: 120000, skip: process.env.QA_NO_BROWSER === "1" ? "SKIP QA_NO_BROWSER=1" : false }, async () => {
  assert.ok(CHROME, "chrome is required");
  let srv = null;
  let chrome = null;
  const pages = [];
  try {
    srv = await serve();
    chrome = await launchChrome();
    const origin = "http://127.0.0.1:" + srv.address().port;
    const hook = `(() => {
      const raf = window.requestAnimationFrame.bind(window);
      const origTimeout = window.setTimeout.bind(window);
      window.__rafN = 0; window.__gap = 0; window.__retryFrames = 0; window.__burstGap = 0; window.__burstLast = 0; window.__inBurst = false; window.__fbRetryShort = 0;
      let last = 0;
      window.setTimeout = (fn, ms, ...rest) => {
        const shorten = ms === 60000 && typeof fn === "function" && /fbRetry/.test(Function.prototype.toString.call(fn));
        if (shorten) window.__fbRetryShort++;
        return origTimeout(fn, shorten ? 250 : ms, ...rest);
      };
      window.requestAnimationFrame = (cb) => {
        window.__rafN++;
        return raf((t) => {
          const fb = window.__fb;
          const live = !!(fb && fb.tries >= 1 && document.documentElement.getAttribute("data-scene-mode") === "live");
          if (live) {
            if (window.__inBurst && window.__burstLast) { const g = t - window.__burstLast; window.__burstGap = Math.max(window.__burstGap, g); (window.__burstGaps || (window.__burstGaps = [])).push(Math.round(g)); }
            window.__inBurst = true;
            window.__burstLast = t;
          }
          if (last) window.__gap = Math.max(window.__gap, t - last);
          last = t;
          const n = fb && fb.ft ? fb.ft.length : 0;
          cb(t);
          const now = window.__fb;
          if (now && now.tries >= 1 && now.ft && now.ft.length > n) window.__retryFrames++;
        });
      };
    })();`;
    const p = await openPage(chrome.port, origin + "/wall.html?look=classic&gl=soft&now=2026-10-20T20:00:00-05:00", hook);
    pages.push(p);
    const first = await p.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => {
      const mode = document.documentElement.getAttribute("data-scene-mode");
      if (mode === "poster" && window.__fb) return res({ mode, why: __fb.why, tries: __fb.tries, n: window.__rafN });
      if (performance.now() - t0 > 20000) return res(null);
      setTimeout(step, 50);
    }; step(); })`, 25000);
    assert.ok(first && first.mode === "poster", "the live loop never reached the poster " + JSON.stringify(first));
    assert.notEqual(first.why, "software-gl", "gl=soft must keep the live loop");
    const quiet = await p.eval(`new Promise((res) => { const step = () => {
      const fb = window.__fb;
      const mode = document.documentElement.getAttribute("data-scene-mode");
      if (fb && fb.tries >= 1 && mode === "poster") return res({ n: window.__rafN, gap: window.__gap, why: fb.why, tries: fb.tries });
      setTimeout(step, 100);
    }; step(); })`, 90000);
    const frames = await p.eval(`window.__retryFrames`);
    const burstGap = await p.eval(`window.__burstGap`);
    const burstGaps = await p.eval(`window.__burstGaps || []`);
    console.log("retry why", quiet.why, "frames", frames, "burst", JSON.stringify(burstGaps));
    assert.ok(quiet.why === "3x150ms" || quiet.why === "median>50ms", "retry poster why " + quiet.why);
    assert.ok(frames <= 3 && frames >= 1, "the retry used " + frames + " frames (" + quiet.why + ")");
    await p.eval(`new Promise((r) => { window.__gap = 0; setTimeout(r, 800); })`);
    const after = await p.eval(`({ n: window.__rafN, gap: window.__gap, mode: document.documentElement.getAttribute("data-scene-mode") })`);
    assert.equal(after.n, quiet.n, "rAF kept running after the poster returned");
    assert.equal(after.mode, "poster");
    assert.ok(after.gap <= 500, "gap after the poster returned " + after.gap);
    const baseHook = `(() => { const raf = window.requestAnimationFrame.bind(window); window.__baseGaps = []; let last = 0;
      window.requestAnimationFrame = (cb) => raf((t) => { if (last) window.__baseGaps.push(t - last); last = t; cb(t); }); })();`;
    const basePage = await openPage(chrome.port, origin + "/wall.html?look=classic&now=2026-10-20T20:00:00-05:00", baseHook, null, { "X-Wall-Bytes": "base" });
    pages.push(basePage);
    const baseGaps = await basePage.eval(`new Promise((res) => { const t0 = performance.now(); const step = () => {
      const g = window.__baseGaps || [];
      if ((g.length >= 2 && Math.max.apply(null, g) > 500) || performance.now() - t0 > 12000) return res(g);
      setTimeout(step, 100);
    }; step(); })`, 20000);
    const baseGap = baseGaps.length ? Math.max(...baseGaps) : 0;
    /* __burstGap is only the live retry frames, not the idle minute. Those draws
       stay within 2500 ms. After the poster returns, no gap may exceed 500 ms.
       The pass-1 wall never posters, so that 500 ms cap fails there. */
    assert.ok((await p.eval(`window.__fbRetryShort`)) >= 1, "the fbRetry hook never shortened the 60 s timer");
    assert.ok(burstGap > 0 && burstGap <= 2500, "retry burst gap " + burstGap);
    assert.ok(after.gap <= 500, "gap after the poster returned " + after.gap);
    assert.ok(baseGap > 500, "base wall inter-frame gap " + baseGap + " did not fail the 500 ms cap");
    fs.mkdirSync(ART, { recursive: true });
    fs.writeFileSync(path.join(ART, "gl-soft-retry.json"), JSON.stringify({ first, quiet, frames, burstGap, after, baseGap, baseGaps }, null, 2));
  } finally {
    for (const p of pages) { try { p.close(); } catch (e) { /* already closed */ } }
    if (chrome) { try { chrome.proc.kill("SIGKILL"); } catch (e) { /* already gone */ } }
    if (srv) { try { srv.close(); } catch (e) { /* already closed */ } }
  }
});

test("browser: reduced motion paints no arrive iris on month, home, or lights", { timeout: 120000, skip: process.env.QA_NO_BROWSER === "1" ? "SKIP QA_NO_BROWSER=1" : false }, async () => {
  assert.ok(CHROME, "chrome is required");
  let srv = null;
  let chrome = null;
  const pages = [];
  try {
    srv = await serve();
    chrome = await launchChrome();
    const origin = "http://127.0.0.1:" + srv.address().port;
    const watch = `(() => { window.__irisSeen = 0; const note = () => { if (document.querySelector && document.querySelector(".ori-iris")) window.__irisSeen++; };
      const mo = new MutationObserver(note); const arm = () => { try { mo.observe(document.documentElement || document, { childList: true, subtree: true }); } catch (e) {} note(); };
      arm(); document.addEventListener("DOMContentLoaded", arm); })();`;
    const reduce = [{ name: "prefers-reduced-motion", value: "reduce" }];
    const p = await openPage(chrome.port, origin + "/sheet-index.html", watch, reduce);
    pages.push(p);
    async function arrived(clickJs, pathRe) {
      const loaded = p.c.wait("Page.loadEventFired", 20000);
      p.eval(clickJs).catch(() => {});
      await loaded;
      const seen = await p.eval(`({ seen: window.__irisSeen || 0, n: document.querySelectorAll(".ori-iris").length, path: location.pathname })`);
      assert.match(seen.path, pathRe, JSON.stringify(seen));
      return seen;
    }
    const month = await arrived(`document.querySelector("a.tile.month").click()`, /month\.html/);
    assert.equal(month.n, 0, "month arrive iris " + JSON.stringify(month));
    assert.equal(month.seen, 0, "month arrive iris was created " + JSON.stringify(month));
    const home = await arrived(`history.back()`, /sheet-index\.html/);
    assert.equal(home.n, 0, "back-home arrive iris " + JSON.stringify(home));
    assert.equal(home.seen, 0, "back-home arrive iris was created " + JSON.stringify(home));
    const lights = await arrived(`document.querySelector("a.hub-lights-more").click()`, /sheet-lights\.html/);
    assert.equal(lights.n, 0, "lights arrive iris " + JSON.stringify(lights));
    assert.equal(lights.seen, 0, "lights arrive iris was created " + JSON.stringify(lights));
  } finally {
    for (const pg of pages) { try { pg.close(); } catch (e) { /* already closed */ } }
    if (chrome) { try { chrome.proc.kill("SIGKILL"); } catch (e) { /* already gone */ } }
    if (srv) { try { srv.close(); } catch (e) { /* already closed */ } }
  }
});
