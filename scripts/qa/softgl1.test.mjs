/* SOFTGL1 · a screen with no GPU never starts the live night scene: the still poster from the first frame, no render loop,
   no retry. Under software WebGL the scene's first frames held the board's main thread for seconds (GATE 3: phone Back from
   Month missed its 8 s budget). BACKCAP1 · Back's leave veil cannot be held past 900 ms by a slow frame.
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
  assert.match(read("night/night-host.js"), /pass\.set\("v", "SOFTGL1"\)/, "scene.html cache token bumped");
});

test("static: Back from a board leaves by 900 ms even when the fade frames are slow", () => {
  const w = read("house-ori-world.js");
  assert.match(w, /fadeCover\(iris, 0, 1, 540, goHome\);\n\s+setTimeout\(goHome, 900\);/);
  assert.match(w, /function goHome\(\) \{\n\s+if \(gone\) return;\n\s+gone = true;/, "home loads once");
});

let pp = null; for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/", "/tmp/ori-qa/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = process.env.CHROME_PATH || ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((c) => fs.existsSync(c)) || null;
const SKIP = !(pp && CHROME) && "needs puppeteer-core + chrome";
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
