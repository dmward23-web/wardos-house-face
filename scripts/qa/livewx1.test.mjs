/* LIVEWX1 · each faked weather state renders and publishes the locked LiveWx contract; a spook never changes the weather
   or the plate (same LiveWx, same scene WX, plate luma within 3). Static half always runs; the browser half needs
   puppeteer-core + CHROME_PATH (skips cleanly otherwise). No frames are stored. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SC = ["night/scene.html", "wall.html"].map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]);
test("static: contract, last-known never default, poll 12 min, no client location, lightning storm-gated, crows hunker, wet is a sheen", () => {
  for (const [f, s] of SC) {
    assert.match(s, /W\.LiveWx=o/, f); assert.match(s, /'livewx:update'/, f);
    assert.doesNotMatch(s, /offline-default/, f); assert.doesNotMatch(s, /Date\.now\(\)-s\.t<6\*36e5/, f);
    assert.match(s, /setInterval\(wxFetch,12\*6e4\)/, f);
    /* LIVEWX2 · the client carries no location at all (the hub /wx route holds the coarse cell server-side) */
    assert.doesNotMatch(s, /HOME=\{lat:/, f); assert.doesNotMatch(s, /\b(?:lat|lon|latitude|longitude)\s*[:=]\s*-?\d{1,3}\.\d/, f);
    assert.match(s, /thun:thunder\?1:0/, f); assert.match(s, /if\(ENV\.thun>\.5&&!RM\.matches\)/, f);
    assert.doesNotMatch(s, /c\.drawImage\(wv,0,0,W,H\)/, f, "rain footage never full-frame");
    assert.match(s, /function fire\(n\)\{if\(\(ENV\.rain>\.15\|\|ENV\.snow>\.15\)/, f);
  }
  const sp = fs.readFileSync(path.join(ROOT, "wg-spook.js"), "utf8");
  assert.doesNotMatch(sp, /LiveWx|wx52|WX\.|weather=/, "spook never touches weather");
  assert.match(sp, /"spook:scare"/);
});
const NO_BROWSER = process.env.QA_NO_BROWSER === "1";   /* DAYPKG1 item 3 · QA_NO_BROWSER=1: puppeteer-core is never loaded and no Chrome path is resolved, so nothing below can launch */
let pp = null; if (!NO_BROWSER) for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }   /* box dep dirs; skips cleanly when none */
const CHROME = NO_BROWSER ? null : (process.env.CHROME_PATH || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : null));
const STATES = { clear: "clear", cloudy: "cloudy", fog: "fog", drizzle: "drizzle", downpour: "downpour", storm: "storm", snow: "snow", windy: "clear", stale: null };
test("browser: every faked state publishes LiveWx; spook leaves weather and plate unchanged", { skip: NO_BROWSER ? "SKIP QA_NO_BROWSER=1 (no Chrome launch)" : (!(pp && CHROME) && "needs puppeteer-core + chrome"), timeout: 900000 }, async () => {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => { let rel = decodeURIComponent(new URL(q.url, "http://x").pathname); if (rel.endsWith("/")) rel += "index.html"; const f = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); }); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const base = "http://127.0.0.1:" + srv.address().port;
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const [name, st] of Object.entries(STATES)) {
      const g = await b.newPage(); await g.setViewport({ width: 960, height: 540 });
      if (name === "stale") { await g.goto(base + "/night/scene.html?weather=none"); await g.evaluate(() => localStorage.setItem("wx52", JSON.stringify({ t: Date.now() - 9 * 36e5, j: { current: { cloud_cover: 40, weather_code: 2, temperature_2m: 12, dew_point_2m: 4, visibility: 20000, wind_speed_10m: 14, wind_gusts_10m: 22, wind_direction_10m: 310, interval: 900 } } }))); }
      const q = name === "stale" ? "weather=stale" : "weather=" + (name === "windy" ? "windy" : name);
      await g.goto(base + "/night/scene.html?" + q, { waitUntil: "load" }); await new Promise((r) => setTimeout(r, 2500));
      const w0 = await g.evaluate(() => window.LiveWx && JSON.stringify(window.LiveWx));
      assert.ok(w0, name + ": LiveWx published");
      const o = JSON.parse(w0);
      for (const k of ["state", "intensity", "windMph", "gustMph", "windDirDeg", "cloudPct", "fog", "wet", "tempF", "ts", "stale", "ageMin", "code"]) assert.ok(k in o, name + " has " + k);
      if (st) assert.equal(o.state, st, name); else { assert.equal(o.stale, true); assert.equal(o.windDirDeg, 310); }
      if (name === "windy") assert.ok(o.windMph > 25, "windy reads real wind");
      if (name === "storm") assert.ok(o.code >= 95, "storm carries its WMO code (lightning keys on it)"); if (name === "clear") assert.ok(o.code == null || o.code < 95, "clear never reads as a storm code");
      const lum = () => g.evaluate(() => { const c = document.querySelector("canvas"); if (!c) return null; const t = document.createElement("canvas"); t.width = 64; t.height = 36; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 64, 36); const d = x.getImageData(0, 0, 64, 36).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114; return s / (d.length / 4); });
      const lumQ = async () => { const v = []; for (let i = 0; i < 40 && v.length < 5; i++) { const f = await g.evaluate(() => { try { return window.__env().env.flash || 0; } catch (_) { return 0; } });
        if (f < 0.01) { const x = await lum(); if (x != null) v.push(x); } await new Promise((r) => setTimeout(r, 150)); }   /* real storm lightning is weather, not spook: sample between flashes, median of 5 */
        if (!v.length) return null; v.sort((a, b) => a - b); return v[v.length >> 1]; };
      let l0 = await lumQ();   /* weather eases in after load (storm darkens ~15 -> ~9.5 luma over ~30s with no spook): baseline only once settled */
      for (let i = 0; i < 30 && l0 != null; i++) { await new Promise((r) => setTimeout(r, 1500)); const l = await lumQ(); if (l == null || Math.abs(l - l0) < 0.25) { l0 = l; break; } l0 = l; }
      await g.evaluate(() => { for (const n of ["crows", "bats", "witch", "jolt", "ghost"]) try { window.__fire && window.__fire(n); } catch (_) {} });
      await new Promise((r) => setTimeout(r, 2000));
      const w1 = await g.evaluate(() => window.LiveWx && JSON.stringify(window.LiveWx)), l1 = await lumQ();
      assert.equal(w1, w0, name + ": spook leaves LiveWx unchanged");
      if (l0 != null && l1 != null) assert.ok(Math.abs(l1 - l0) < 3, name + ": plate luma stable " + l0.toFixed(1) + " -> " + l1.toFixed(1));
      await g.close();
    }
  } finally { await b.close(); srv.close(); }
});
