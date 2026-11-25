/* Pass 2 · Dec 4 cinema default, plate pins, December classic plates, leaves, no camo.
   node --test scripts/qa/pass2-dec4.test.mjs
   The browser half is scripts/qa/pass2_browser.py (same file's last test). */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ART = path.join(ROOT, "art/cinema/xmas-2026");
const PINS = {
  "xmas-hero-plate-1920x1080-ungraded.png": "f3323f75",
  "xmas-hero-fallback-1920x1080-graded.png": "f795c1ce",
  "xmas-hero-loop-1920x1080-25s.mp4": "1c011db8",
  "window-pane-alpha-1920x1080.png": "41280f2f",
  "palette.json": "a05eae00",
  "glass-card-9slice-192.png": "c630f43e",
  "wardos-xmas.cube": "5bd8ac91"
};
const DEC = {
  morning: "sha256:e7c63fd77f5b2e6598dac1ae480d78bf0582f7a307cea9ad044092e44f449b0e".slice(7),
  dusk: "sha256:4c408da52f8a2fdad7c6afc0cf5741a645e796d6218b5932407b551db0be5435".slice(7),
  night: "sha256:d40b9a23b4abec32cc7b347e4c03eb90e66dd2a22dc232a7f46dfe0eb18f16cc".slice(7)
};

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

test("CINEDEF1: wall.html enters cinema unless ?look=classic, and ?look=cinema still sets the flag", () => {
  const html = fs.readFileSync(path.join(ROOT, "wall.html"), "utf8");
  assert.match(html, /q\.get\("look"\) === "classic"/);
  assert.match(html, /setAttribute\("data-look", "cinema"\)/);
  assert.match(html, /getAttribute\("data-look"\) !== "cinema"/);
  assert.doesNotMatch(html, /<script[^>]+src="wardos-scene\.js"/);
  assert.doesNotMatch(html, /<link[^>]+href="wardos-scene\.css"/);
  assert.match(html, /month-overlay\.js\?v=PASS2X1/);
});

test("PLATEPIN2: every cinema art file matches pins.js and the Prism prefix list", () => {
  const pins = fs.readFileSync(path.join(ART, "pins.js"), "utf8");
  const files = fs.readdirSync(ART).filter((n) => n !== "pins.js");
  assert.ok(files.length >= 7);
  for (const name of files) {
    const buf = fs.readFileSync(path.join(ART, name));
    const got = sha256(buf);
    const listed = pins.match(new RegExp('file: "' + name.replace(/[.]/g, "\\.") + '",\\s*sha256: "([0-9a-f]{64})"'));
    assert.ok(listed, "pins.js missing " + name);
    assert.equal(got, listed[1], name);
    assert.ok(got.startsWith(PINS[name]), name + " prefix " + got.slice(0, 8));
  }
  const plate = fs.readFileSync(path.join(ART, "xmas-hero-plate-1920x1080-ungraded.png"));
  const flipped = Buffer.from(plate);
  flipped[64] ^= 0x01;
  assert.notEqual(sha256(flipped).slice(0, 8), "f3323f75");
  assert.ok(sha256(plate).startsWith("f3323f75"));
});

test("LUTMATCH1: the shipped cube is the 4-decimal requantize, not the float source", () => {
  const buf = fs.readFileSync(path.join(ART, "wardos-xmas.cube"));
  const got = sha256(buf);
  assert.ok(got.startsWith("5bd8ac91"), got);
  assert.equal(got.startsWith("6c0f"), false);
  const scene = fs.readFileSync(path.join(ROOT, "wardos-scene.js"), "utf8");
  assert.match(scene, /function gradeBypassed/);
  assert.match(scene, /source === "loop" \|\| source === "fallback"/);
});

function bootOverlay({ iso, look, pathname, wallEngine }) {
  const attrs = {};
  const props = {};
  const made = [];
  const byId = {};
  const html = {
    attrs,
    style: { setProperty(k, v) { props[k] = v; } },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; }
  };
  if (look) attrs["data-look"] = look;
  const body = { kids: [], hasAttribute: () => false, insertBefore(c) { this.kids.push(c); }, appendChild(c) { this.kids.push(c); } };
  const video = { paused: false, pause() { this.paused = true; } };
  if (wallEngine) { byId.bg = video; byId.gl = {}; }
  function el(tag) {
    const e = {
      tag, id: "", className: "", style: {}, attrs: {}, kids: [],
      classList: { add() {} },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = v; },
      getAttribute(k) { return this.attrs[k]; },
      appendChild(c) { this.kids.push(c); return c; },
      getContext() {
        const f = () => f;
        return new Proxy(f, { get: () => f, set: () => true, apply: () => f });
      }
    };
    made.push(e);
    return e;
  }
  const fixed = Date.parse(iso);
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  }
  const ctx = vm.createContext({
    document: {
      documentElement: html, body, readyState: "complete", hidden: false,
      currentScript: { src: "http://hub.local/month-theme/month-overlay.js" },
      createElement: el, querySelector: () => null, querySelectorAll: () => [],
      getElementById: (id) => byId[id] || made.find((e) => e.id === id) || null,
      addEventListener() {}
    },
    Date: FakeDate, Intl, URLSearchParams, console,
    location: { search: "", pathname: pathname || "/wall.html", href: "http://hub.local/", origin: "http://hub.local", reload() {} },
    innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setInterval(fn) { try { for (let i = 0; i < 45; i++) fn(); } catch (e) { /* the coat draw is best-effort in this vm */ } return 1; },
    clearInterval() {}, setTimeout(fn) { try { fn(); } catch (e) { /* same */ } return 1; },
    performance: { now: () => 0 }, addEventListener() {}
  });
  ctx.window = ctx;
  if (wallEngine) { ctx.VID = {}; ctx.snd = () => {}; ctx.sndInit = () => {}; }
  vm.runInContext(fs.readFileSync(path.join(ROOT, "month-theme/season-math.js"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "month-theme/month-overlay.js"), "utf8"), ctx);
  const all = [];
  const walk = (n) => { all.push(n); for (const c of n.kids || []) walk(c); };
  for (const k of body.kids) walk(k);
  return { attrs, props, all };
}

test("DECPLATE1: December classic hub names the pinned plate for 07:30, 16:45 and 21:00", () => {
  const want = {
    "2026-12-04T07:30:00-06:00": "bg-wall-dec-morning.webp",
    "2026-12-04T16:45:00-06:00": "bg-wall-dec-dusk.webp",
    "2026-12-04T21:00:00-06:00": "bg-wall-dec-night.webp"
  };
  for (const [iso, file] of Object.entries(want)) {
    const b = bootOverlay({ iso, pathname: "/sheet-index.html" });
    const bg = String(b.props["--wg-hubbg"] || "");
    assert.match(bg, new RegExp("assets/month-theme/december/" + file.replace(".", "\\.")), iso + " " + bg);
    assert.doesNotMatch(bg, /november|october|halloween|camo/i, iso);
  }
  const nov = bootOverlay({ iso: "2026-11-04T07:30:00-06:00", pathname: "/sheet-index.html" });
  assert.match(String(nov.props["--wg-hubbg"] || ""), /month-theme\/november\/wall-day\.webp/);
  for (const phase of Object.keys(DEC)) {
    const fp = path.join(ROOT, "assets/month-theme/december/bg-wall-dec-" + phase + ".webp");
    assert.equal(sha256(fs.readFileSync(fp)), DEC[phase]);
  }
});

test("P2: a real December clock picks the December plate when ?now is absent", () => {
  const wall = fs.readFileSync(path.join(ROOT, "wall.html"), "utf8");
  const body = wall.match(/<script>if\(document\.documentElement\.getAttribute\("data-look"\)!=="cinema"\)\{([\s\S]*?)\}var wallUi/)[1];
  function chosen(search, iso) {
    const Fixed = class extends Date {
      constructor(...a) { super(...(a.length ? a : [Date.parse(iso)])); }
      static now() { return Date.parse(iso); }
    };
    const style = {};
    let plate = "";
    const document = {
      documentElement: { getAttribute: () => null, style },
      createElement() { return { style: {} }; },
      body: { insertBefore(node) { plate = node.src; }, firstChild: null },
      getElementById() { return null; }
    };
    vm.runInNewContext(body, { URLSearchParams, Intl, Date: Fixed, location: { search }, document });
    return plate;
  }
  assert.match(chosen("", "2026-12-04T18:00:00Z"), /bg-wall-dec-dusk\.webp$/);
  assert.match(chosen("", "2026-11-04T18:00:00Z"), /november\/wall-dusk\.webp$/);
  assert.match(chosen("?now=2026-11-04T12:00:00-06:00", "2026-12-04T18:00:00Z"), /november\/wall-dusk\.webp$/);
});

test("CINELEAF1: December creates no November leaf in either look", () => {
  for (const look of [undefined, "cinema"]) {
    const b = bootOverlay({ iso: "2026-12-04T16:45:00-06:00", look, pathname: "/wall.html" });
    const leaves = b.all.filter((e) => /\bkm-leaf\b/.test(e.className || "") || /leaf-nov-/.test(JSON.stringify(e.attrs || {})));
    assert.equal(leaves.length, 0, "look=" + look);
  }
  const cine = bootOverlay({ iso: "2026-11-23T15:00:00-06:00", look: "cinema", pathname: "/wall.html" });
  assert.equal(cine.all.filter((e) => /\bkm-leaf\b/.test(e.className || "")).length, 0);
  assert.equal(cine.all.find((e) => e.id === "km-nov").attrs["data-cinema-bare"], "1");
  const plain = bootOverlay({ iso: "2026-11-23T15:00:00-06:00", pathname: "/wall.html" });
  assert.equal(plain.all.filter((e) => /\bkm-leaf\b/.test(e.className || "")).length, 14);
});

function camoHits(text) {
  const hits = [];
  const re = /camo/ig;
  let m;
  while ((m = re.exec(text))) hits.push(m.index);
  return hits;
}

test("NOCAMO1: December package files do not name camo, and an injected token is caught", () => {
  const roots = ["wall.html", "month-theme", "art/cinema/xmas-2026", "wardos-scene.css", "wardos-scene.js", "assets/month-theme/december"];
  const hits = [];
  function walk(rel) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs)) walk(path.join(rel, name));
      return;
    }
    if (/\.(png|webp|mp4|jpg)$/i.test(rel)) return;
    const text = fs.readFileSync(abs, "utf8");
    if (camoHits(text).length) hits.push(rel);
  }
  for (const r of roots) walk(r);
  assert.deepEqual(hits, []);
  assert.equal(camoHits(".hero{background-image:url(camo-plate.webp)}").length, 1);
});

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
test("PASS2 browser: plates, contrast, LUT match, tiers, soak, stills", { timeout: 420000, skip: process.env.QA_NO_BROWSER === "1" ? "SKIP QA_NO_BROWSER=1" : false }, () => {
  const art = artDir();
  const r = spawnSync("python3", ["scripts/qa/pass2_browser.py"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 400000,
    env: { ...process.env, TZ: "America/Chicago", ARTIFACT_DIR: art }
  });
  if (r.status !== 0) {
    assert.fail((r.stdout || "") + "\n" + (r.stderr || ""));
  }
  const report = JSON.parse(fs.readFileSync(path.join(art, "pass2-report.json"), "utf8"));
  assert.ok(report.deltaE <= 3, "deltaE " + report.deltaE);
  assert.ok(report.luma >= 42.98 && report.luma <= 48.52, "luma " + report.luma);
  assert.equal(report.heapGrowthMB <= 20, true, "heap " + report.heapGrowthMB);
  assert.equal(report.rafStallMs <= 500, true, "stall " + report.rafStallMs);
  assert.equal(report.camoRequests.length, 0);
  assert.equal(report.stills.length, 9);
  for (const row of report.contrast) assert.ok(row.ratio >= 4.5, JSON.stringify(row));
});
