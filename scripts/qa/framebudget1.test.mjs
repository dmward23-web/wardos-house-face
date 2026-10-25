/* FRAMEBUDGET1 · the night scene's frame-budget governor (night/scene.html and wall.html). A slow scene pauses, crossfades to the
   LHVID1 still poster and stops its render loop (no rAF after the fallback); prefers-reduced-motion goes straight to the poster;
   the back layer is uploaded only when it changes. Static half always runs; the browser half needs puppeteer-core + chrome
   (skips cleanly otherwise). No frames are stored. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SC = ["night/scene.html", "wall.html"].map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]);
const block = (s) => { const a = s.indexOf("// FRAMEBUDGET1 · frame-budget governor"), b = s.indexOf("function fbStart()"); return a > 0 && b > a ? s.slice(a, s.indexOf("\n", b)) : null; };

test("static: one governor, same in both scenes, thresholds and poster wiring", () => {
  const g = SC.map(([f, s]) => { const x = block(s); assert.ok(x, f + " has the governor"); return x; });
  assert.equal(g[0], g[1], "scene.html and wall.html carry the identical governor");
  for (const [f, s] of SC) {
    const x = block(s);
    assert.match(x, /now-FB\.ft\[0\]\[0\]>1500/, f + " rolling ~1.5 s window"); assert.match(x, /if\(m>50\)return fbPoster/, f + " median over 50 ms");
    assert.match(x, /FB\.run=d>150\?FB\.run\+1:0;if\(FB\.run>=3\)/, f + " 3 consecutive over 150 ms");
    assert.match(x, /setTimeout\(fbRetry,60000\)/, f + " one retry after 60 s idle"); assert.match(x, /FB\.tries>=1/, f + " retry once only");
    assert.match(x, /document\.visibilityState!=='visible'/, f + " retry only when visible");
    assert.match(x, /cancelAnimationFrame\(RAF\)/, f + " stops the loop"); assert.match(x, /data-scene-mode/, f);
    assert.match(s, /<canvas id="poster" aria-hidden="true"><\/canvas>/, f + " poster layer");
    assert.match(s, /#poster\{opacity:0;pointer-events:none;transition:opacity \.4s ease\}/, f + " soft 400 ms crossfade");
    assert.match(s, /if\(fbWatch\(now,d\)\)return;RAF=requestAnimationFrame\(loop\)/, f + " loop asks the governor before every rAF");
    assert.match(s, /\nelse fbStart\(\);/, f + " start goes through the governor");
    assert.equal((s.match(/requestAnimationFrame\(loop\)/g) || []).length, 3, f + " rAF(loop) only in loop, fbLive and fbStart");
    assert.match(s, /if\(SBup\)\{gl\.activeTexture\(gl\.TEXTURE1\);gl\.texImage2D\([^)]*sB\)\}/, f + " back layer uploaded only on change");
    assert.doesNotMatch(s, /gl\.activeTexture\(gl\.TEXTURE1\);gl\.texImage2D\(gl\.TEXTURE_2D,0,gl\.RGBA,gl\.RGBA,gl\.UNSIGNED_BYTE,sB\);gl/, f + " no unconditional back-layer upload");
  }
});

let pp = null; for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/", "/tmp/ori-qa/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = process.env.CHROME_PATH || ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((c) => fs.existsSync(c)) || null;
const SKIP = !(pp && CHROME) && "needs puppeteer-core + chrome";
/* counts every rAF request; with __slow set each frame callback busy-waits 200 ms (a forced slow frame) */
const HOOK = () => { const raf = window.requestAnimationFrame.bind(window); window.__rafN = 0; window.__slow = false;
  window.requestAnimationFrame = (cb) => { window.__rafN++; return raf((t) => { if (window.__slow) { const e = performance.now() + 200; while (performance.now() < e); } cb(t); }); }; };

async function withScene(fn) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => { let rel = decodeURIComponent(new URL(q.url, "http://x").pathname); if (rel === "/wx") { r.writeHead(404); r.end(); return; }
    const f = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); }); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const base = "http://127.0.0.1:" + srv.address().port;   /* loopback only */
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  try { await fn(b, base); } finally { await b.close(); srv.close(); }
}
const state = (g) => g.evaluate(() => ({ mode: document.documentElement.getAttribute("data-scene-mode"), why: window.__fb && __fb.why, raf: window.__rafN,
  po: getComputedStyle(document.getElementById("poster")).opacity, gl: getComputedStyle(document.getElementById("gl")).visibility,
  ink: (() => { const c = document.getElementById("poster"); if (!c.width) return 0; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 64) if (Math.abs(d[i] - 4) + Math.abs(d[i + 1] - 6) + Math.abs(d[i + 2] - 10) > 12) n++; return n; })() }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("browser: a forced slow frame falls back to the poster and no rAF runs after the fallback", { skip: SKIP, timeout: 120000 }, async () => {
  await withScene(async (b, base) => { for (const f of ["night/scene.html", "wall.html"]) {
    const g = await b.newPage(); await g.setViewport({ width: 440, height: 956 }); await g.evaluateOnNewDocument(HOOK);
    /* SOFTGL1 · this runner is software WebGL, where scene.html now shows the poster at once; ?gl=soft keeps its live scene so the governor is still the thing under test */
    await g.goto(base + "/" + f + (f === "night/scene.html" ? "?gl=soft" : ""), { waitUntil: "load" });
    await g.waitForFunction(() => window.__fb && document.documentElement.getAttribute("data-scene-mode"), { timeout: 30000, polling: 100 });
    await g.evaluate(() => { window.__slow = true; });
    await g.waitForFunction(() => document.documentElement.getAttribute("data-scene-mode") === "poster", { timeout: 30000, polling: 100 });
    await g.evaluate(() => { window.__slow = false; });
    const s0 = await state(g); await sleep(1500); const s1 = await state(g);
    assert.ok(/3x150ms|median>50ms/.test(s0.why), f + " fell back on the frame budget: " + s0.why);
    assert.equal(s1.raf, s0.raf, f + " no rAF after the fallback");
    assert.equal(s1.mode, "poster", f); assert.equal(s1.po, "1", f + " poster shown"); assert.equal(s1.gl, "hidden", f + " WebGL scene paused and hidden after the crossfade");
    assert.ok(s1.ink > 50, f + " the poster is the still plate, not an empty box (" + s1.ink + ")");
    await g.close();
  } });
});

test("browser: prefers-reduced-motion goes straight to the poster with no render loop", { skip: SKIP, timeout: 120000 }, async () => {
  await withScene(async (b, base) => { for (const f of ["night/scene.html", "wall.html"]) {
    const g = await b.newPage(); await g.setViewport({ width: 440, height: 956 }); await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await g.evaluateOnNewDocument(HOOK); await g.goto(base + "/" + f, { waitUntil: "load" });
    await g.waitForFunction(() => document.documentElement.getAttribute("data-scene-mode") === "poster", { timeout: 30000, polling: 100 });
    await sleep(800); const s0 = await state(g); await sleep(1500); const s1 = await state(g);
    assert.equal(s0.why, "reduced-motion", f); assert.equal(s1.raf, s0.raf, f + " no rAF in reduced motion");
    assert.equal(s1.po, "1", f + " poster shown"); assert.ok(s1.ink > 50, f + " poster painted (" + s1.ink + ")");
    await g.close();
  } });
});

/* VEILPAUSE1 · the calm leave veil must really paint before the page goes: no fixed 320ms timer racing a slow frame. */
test("calm leave veil: navigates on the frame after the veil was drawn (>= 320ms, opacity >= .9), 1.5s cap, ambient motion held and resumed", () => {
  const src = fs.readFileSync(path.join(ROOT, "house-ori-calm.js"), "utf8");
  assert.ok(!/setTimeout\(function \(\) \{ location\.href = u\.href; \}, root\.classList\.contains\("ori-reduced"\) \? 0 : 320\)/.test(src), "the fixed 320ms leave timer is gone");
  assert.match(src, /if \(shown\) return go\(\); if \(Date\.now\(\) - t0 >= 320 && \(parseFloat\(getComputedStyle\(el\)\.opacity\) \|\| 0\) >= 0\.9\) shown = true; requestAnimationFrame\(tick\)/);
  assert.match(src, /setTimeout\(go, 1500\)/);
  /* H1 P2 delta · reduced motion is the class OR the OS setting (the class alone was never set); VEILDROP1 drops a stuck veil */
  assert.match(src, /ori-reduced"\) \|\| \(RMQ && RMQ\.matches\)\) \{ setTimeout\(function \(\) \{ leave\(u\.href\); \}, 0\); return; \}/);
  assert.match(src, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(src, /function leave\(href\) \{ location\.href = href; setTimeout\(clear, DROP_MS\); \}/);
  assert.match(src, /DROP_MS = 4000/);
  assert.match(src, /an\.playState === "running"\) \{ an\.pause\(\); held\.push\(an\); \}/);
  assert.match(src, /held\.splice\(0\)\.forEach\(function \(an\) \{ try \{ an\.play\(\); \} catch \(e\) \{\} \}\)/);
  assert.match(src, /addEventListener\("pageshow", clear\)/);
});
