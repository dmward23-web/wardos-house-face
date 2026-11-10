/* WIDE2560 · the wall canvas stays 1920x1080 and scale 1. It is not shrunk to fit a narrower window. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("static: the wall canvas is not scaled to the window", () => {
  const s = read("sheet-index.html");
  assert.match(s, /data-hub-fit", "acer-1920"/);
  assert.match(s, /--hub-fit-scale", "1"/);
  assert.doesNotMatch(s, /panel\.style\.transform = "scale\("/);
  assert.match(read("index.html"), /location\.replace\("sheet-index\.html"/, "index.html is the same page");
});

const NO_BROWSER = process.env.QA_NO_BROWSER === "1";   /* DAYPKG1 item 3 · QA_NO_BROWSER=1: puppeteer-core is never loaded and no Chrome path is resolved, so nothing below can launch */
let pp = null; if (!NO_BROWSER) for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/", "/tmp/ori-qa/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = NO_BROWSER ? null : (process.env.CHROME_PATH || ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((c) => fs.existsSync(c)) || null);
const SKIP = NO_BROWSER ? "SKIP QA_NO_BROWSER=1 (no Chrome launch)" : (!(pp && CHROME) && "needs puppeteer-core + chrome");

test("browser: wall scale stays 1 at 2560, 1920, and 1280", { skip: SKIP, timeout: 180000 }, async () => {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(new URL(q.url, "http://x").pathname); if (rel === "/wx") { r.writeHead(404); r.end(); return; }
    const f = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); }); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const base = "http://127.0.0.1:" + srv.address().port;   /* loopback only */
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    for (const [pg, w, h] of [["index.html", 2560, 1440], ["sheet-index.html", 2560, 1440], ["sheet-index.html", 1920, 1080], ["sheet-index.html", 1280, 800]]) {
      const g = await b.newPage(); await g.setViewport({ width: w, height: h });
      await g.evaluateOnNewDocument((W, H) => { Object.defineProperty(screen, "width", { get: () => W }); Object.defineProperty(screen, "height", { get: () => H }); }, w, h);   /* a desk screen, not the headless 800x600 (which reads as a phone) */
      await g.goto(base + "/" + pg, { waitUntil: "load" });
      await g.waitForFunction(() => /sheet-index\.html/.test(location.pathname) && document.documentElement.getAttribute("data-hub-fit"), { timeout: 30000, polling: 100 });
      await new Promise((r) => setTimeout(r, 1500));
      const o = await g.evaluate(() => { const W = innerWidth, out = [];
        for (const e of document.querySelectorAll("body *")) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue; const r = e.getBoundingClientRect(); if (r.width && r.right > W + 0.5) out.push(e.className + " " + Math.round(r.right)); }
        return { out, ml: parseFloat(getComputedStyle(document.querySelector(".panel")).marginLeft), s: +getComputedStyle(document.documentElement).getPropertyValue("--hub-fit-scale") }; });
      assert.equal(o.s, 1, pg + " at " + w + ": the canvas is not scaled (" + o.s + ")");
      if (w >= 1920) assert.deepEqual(o.out, [], pg + " at " + w + "x" + h + ": text past the right edge " + o.out.slice(0, 5).join(", "));
      assert.equal(o.ml, 0, pg + " at " + w + ": no centering offset (" + o.ml + ")");
      await g.close();
    }
  } finally { await b.close(); srv.close(); }
});
