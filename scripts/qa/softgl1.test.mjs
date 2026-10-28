/* SOFTGL1 · a screen with no GPU never starts the live night scene: the still poster from the first frame, no render loop,
   no retry. Under software WebGL the scene's first frames held the board's main thread for seconds (GATE 3: phone Back from
   Month missed its 8 s budget). BACKCAP1 · Back's leave veil cannot be held past 900 ms by a slow frame (fallback timer at 800 ms).
   Static half always runs; the browser half needs puppeteer-core + chrome (skips cleanly otherwise). No frames are stored. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("static: software WebGL is decided before any GL work, and only ?gl=soft keeps the live scene", () => {
  const s = read("night/scene.html");
  const i = s.indexOf("const SOFTGL="), j = s.indexOf("gl=gl$.getContext('webgl',{preserveDrawingBuffer:true");
  assert.ok(i > 0 && j > i, "SOFTGL is known before the scene's context is made");
  assert.match(s, /if\(!SOFTGL\)try\{gl=gl\$\.getContext\('webgl'/, "no scene context (no shader compile, no plate upload) on software WebGL");
  assert.match(s, /failIfMajorPerformanceCaveat:true/); assert.match(s, /swiftshader\|llvmpipe\|softpipe\|software\|basic render/i);
  assert.match(s, /get\('gl'\)==='soft'\)return false/, "?gl=soft is the only way to keep the live scene on software WebGL");
  assert.match(s, /function fbSoft\(\)\{if\(RM\.matches\)return fbRM\(\);FB\.tries=1;fbPoster\('software-gl'\)/, "poster through the governor, no retry");
  assert.match(s, /\nelse if\(SOFTGL\)fbSoft\(\);\nelse fbStart\(\);/);
  assert.match(read("night/night-host.js"), /pass\.set\("v", "MOON2"\)/, "scene.html cache token bumped");
});

test("static: Back from a board leaves by 900 ms even when the fade frames are slow", () => {
  const w = read("house-ori-world.js");
  assert.match(w, /fadeCover\(iris, 0, 1, 540, goHome\);\n\s+setTimeout\(goHome, 800\);/, 'the fallback fires at 800 ms so a busy main thread still leaves by 900');
  assert.match(w, /function goHome\(\) \{\n\s+if \(gone\) return;\n\s+gone = true;/, "home loads once");
});

const NO_BROWSER = process.env.QA_NO_BROWSER === "1";   /* DAYPKG1 item 3 · QA_NO_BROWSER=1: puppeteer-core is never loaded and no Chrome path is resolved, so nothing below can launch */
let pp = null; if (!NO_BROWSER) for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/", "/tmp/ori-qa/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = NO_BROWSER ? null : (process.env.CHROME_PATH || ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((c) => fs.existsSync(c)) || null);
const SKIP = NO_BROWSER ? "SKIP QA_NO_BROWSER=1 (no Chrome launch)" : (!(pp && CHROME) && "needs puppeteer-core + chrome");
const HOOK = () => { const raf = window.requestAnimationFrame.bind(window); window.__rafN = 0; window.requestAnimationFrame = (cb) => { window.__rafN++; return raf(cb); }; };

test("browser: on software WebGL the scene is the poster at once, with no render loop", { skip: SKIP, timeout: 120000 }, async () => {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(new URL(q.url, "http://x").pathname); if (rel === "/wx") { r.writeHead(404); r.end(); return; }
    const f = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); }); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const base = "http://127.0.0.1:" + srv.address().port;   /* loopback only */
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  try {
    const g = await b.newPage(); await g.setViewport({ width: 440, height: 956 }); await g.evaluateOnNewDocument(HOOK);
    await g.goto(base + "/night/scene.html", { waitUntil: "load" });
    await g.waitForFunction(() => document.documentElement.getAttribute("data-scene-mode") === "poster", { timeout: 30000, polling: 100 });
    await new Promise((r) => setTimeout(r, 1200));
    const st = () => g.evaluate(() => { const c = document.getElementById("poster"); let ink = 0;
      if (c.width) { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 64) if (Math.abs(d[i] - 4) + Math.abs(d[i + 1] - 6) + Math.abs(d[i + 2] - 10) > 12) ink++; }
      return { why: window.__fb && __fb.why, tries: window.__fb && __fb.tries, raf: window.__rafN, po: getComputedStyle(c).opacity, ink }; });
    const s0 = await st(); await new Promise((r) => setTimeout(r, 1500)); const s1 = await st();
    assert.equal(s0.why, "software-gl"); assert.equal(s0.tries, 1, "no live retry");
    assert.equal(s1.raf, s0.raf, "no rAF on a software-WebGL poster"); assert.equal(s1.po, "1", "poster shown");
    assert.ok(s1.ink > 50, "the poster is the still plate, not an empty box (" + s1.ink + ")");
  } finally { await b.close(); srv.close(); }
});

/* SOFTGL2 · the soft poster follows the real hour: the live scene's phaseAt (real KC sun) picks its plate, the live bgCompose draws it
   (the night scene's moon is the night plate's own disc, P.moon, in the live scene and the poster alike: there is no second moon to fake),
   and it is redrawn when the clock's minute turns. */
test("static: SOFTGL2 both still posters (no GPU, reduced motion) use the live scene's phase and compositor, wait for that plate, redraw on the minute and on a phase change", () => {
  for (const f of ["night/scene.html", "wall.html"]) { const s = read(f);
    assert.match(s, /function fbPlateOk\(\)\{const ph=ENV\.phase;[^\n]*PHK\[n\]\.vid==='night'\|\|imOk\(poster\(PHK\[n\]\.vid\)\)/, f + ": waits for the current phase's plate");
    assert.match(s, /function fbStillDraw\(why\)\{[^\n]*envStep\(2\);step\(0\)[^\n]*if\(!ready\|\|!fbPlateOk\(\)\)return false;fbDraw\(\)/, f + ": phase from envStep (phaseAt over envNow), drawn by fbDraw (bgCompose)");
    assert.match(s, /if\(k!==mk\|\|pk!==FB\.plate\)\{mk=k;go\(\)\}/, f + ": redraw on the minute tick and on a phase change");
    assert.match(s, /function fbRM\(\)\{if\(RM\.matches\)\{fbPoster\('reduced-motion'\);fbStill\('reduced-motion'\)\}/, f + ": reduced motion uses the same still path");
    assert.ok(!/imOk\(poster\('night'\)\)\)\{try\{step\(0\)\}catch\(e\)\{\}fbDraw\(\)/.test(s), f + ": no night-only wait left");
    assert.equal(s.split("// MOON1 · real moon (begin)").length, 2, f + ": one moon source (MOON1, painted in bgCompose for the live scene and the poster alike)"); }
  assert.match(read("night/scene.html"), /function fbSoft\(\)\{if\(RM\.matches\)return fbRM\(\);FB\.tries=1;fbPoster\('software-gl'\);fbStill\('software-gl'\)\}/);
});

const CLOCK = (t0) => { const real = Date.now.bind(Date); window.__realNow = real; window.__clk = t0; window.__clkAt = real(); Date.now = () => window.__clk + (window.__realNow() - window.__clkAt); };
const NINE_AM = Date.parse("2026-10-25T14:00:00Z");   /* 9:00 AM CDT, Kansas City */
const ELEVEN_PM = Date.parse("2026-10-26T04:00:00Z"); /* 11:00 PM CDT the same evening */

for (const rm of [false, true]) test("browser: SOFTGL2 " + (rm ? "reduced motion" : "no GPU") + ": a 9 AM clock gives the day plate, a minute tick redraws, the phase change to 11 PM gives the night plate", { skip: SKIP, timeout: 120000 }, async () => {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(new URL(q.url, "http://x").pathname); if (rel === "/wx") { r.writeHead(404); r.end(); return; }
    const f = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); }); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const base = "http://127.0.0.1:" + srv.address().port;   /* loopback only */
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  try {
    const g = await b.newPage(); await g.setViewport({ width: 440, height: 956 }); await g.evaluateOnNewDocument(CLOCK, NINE_AM);
    if (rm) await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await g.goto(base + "/night/scene.html", { waitUntil: "load" });
    await g.waitForFunction((w) => window.__fb && __fb.why === w && __fb.draws >= 1, { timeout: 30000, polling: 100 }, rm ? "reduced-motion" : "software-gl");
    const st = () => g.evaluate(() => { const c = document.getElementById("poster"); const d = c.getContext("2d").getImageData(0, 0, c.width, Math.floor(c.height * .3)).data; let l = 0, n = 0;
      for (let i = 0; i < d.length; i += 64) { l += .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]; n++; }
      const ph = __env().phase; return { plate: __fb.plate, draws: __fb.draws, live: [ph.A, ph.B, ph.m], sky: l / n, mode: document.documentElement.getAttribute("data-scene-mode") }; });
    const a = await st();
    assert.equal(a.mode, "poster"); assert.equal(a.live[0], "day", "the live scene's phaseAt says day at 9 AM (" + a.live + ")");
    assert.equal(a.plate, "day", "the poster is the day plate at 9 AM, not the night plate");
    await g.evaluate(() => { window.__clk += 61000; });
    await g.waitForFunction((n) => __fb.draws > n, { timeout: 20000, polling: 100 }, a.draws);
    const m = await st(); assert.equal(m.plate, "day", "the minute tick redrew the day plate"); a.draws = m.draws;
    await g.evaluate((t) => { window.__clk = t; window.__clkAt = window.__realNow(); }, ELEVEN_PM);
    await g.waitForFunction((n) => __fb.draws > n && __fb.plate === "night", { timeout: 20000, polling: 100 }, a.draws);
    const c = await st();
    assert.equal(c.live[0] === "night" || c.live[0] === "deepnight", true, "the live scene's phaseAt says night at 11 PM (" + c.live + ")");
    assert.equal(c.plate, "night", "the minute tick redrew the poster onto the night plate");
    assert.ok(c.draws > a.draws, "redrawn on the phase change");
    assert.ok(a.sky > c.sky + 20, "the 9 AM sky is brighter than the 11 PM sky (" + a.sky.toFixed(1) + " vs " + c.sky.toFixed(1) + ")");
  } finally { await b.close(); srv.close(); }
});
