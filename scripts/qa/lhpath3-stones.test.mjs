/* LHPATH3 (Prism stone row, HALLOWEEN1) · on the 440 x 956 phone every near-stone state (1, 2 or 3) is one row on the path,
   below the steps and house art. Bottom edge stays calc(100% - clamp(96px, 12%, 150px)) = 841.3, height 176. Widths and lefts:
   1 = 255.2 at 50%; 2 = 193.6 at 25% / 75%; 3 = 128 at 17.6% / 49.3% / 83.6% (already compensated for the rotate drift).
   Each card's box must sit inside Prism's no-prop box (stone box + 12, the art keeps props out of it), +-1 px; no card text
   under 14 px; no text clipped; the pumpkin count row (Prism's streak row) is never overlapped. FAKE calendar rows in a
   temp HOME only; no private art, list or feed is read (the art route answers 404, so the bare page layout is measured). */
import { assertSealed, TEMP_HOME } from "./temp-home.mjs";
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import http from "node:http"; import path from "node:path";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
import { handlePrivate } from "../private-feed.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("TEMPHOME1: sealed before reading anything", () => { assertSealed(); });
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const CSS = R("livinghouse/lh.css"), LH = R("livinghouse/index.html");
/* Prism's no-prop boxes, x0,y0,x1,y1 in 440 css px */
const BOX = { 1: [[74, 650, 362, 859]], 2: [[0, 651, 221, 858], [219, 649, 440, 855]], 3: [[0, 651, 156, 856], [139, 651, 298, 855], [286, 651, 440, 856]] };
const STREAK = [10, 860, 145, 905], TOL = 1;
test("LHPATH3 static: Prism's one-row stone block replaces H1-LHVIS; LHPATH3 cache tokens", () => {
  assert.doesNotMatch(CSS, /H1-LHVIS \(Alfred P2\) · with one or two near stones/); assert.doesNotMatch(CSS, /clamp\(140px, 20vh, 210px\)/);
  assert.match(CSS, /html\.lh-phone #lh-near \.lh-stone \{\s*top: calc\(100% - clamp\(96px, 12%, 150px\)\) !important; height: 176px !important;/);
  for (const [sel, left, w] of [[":only-child", "50%", "clamp\\(196px, 58vw, 280px\\)"], [":first-child:nth-last-child\\(2\\)", "25%", "193\\.6px"], [":nth-child\\(2\\):last-child", "75%", "193\\.6px"],
    [":first-child:nth-last-child\\(3\\)", "17\\.6%", "128px"], [":nth-child\\(2\\):nth-last-child\\(2\\)", "49\\.3%", "128px"], [":nth-child\\(3\\):last-child", "83\\.6%", "128px"]])
    assert.match(CSS, new RegExp(`#lh-near \\.lh-stone${sel} \\{ left: ${left} !important; width: ${w} !important;`), sel);
  assert.ok(LH.includes('href="lh.css?v=LHPATH3"'), "lh.css token");
  assert.match(LH, /<i class="lh-tallbg"[^>]* data-asset-v="LHPATH3"[^>]*data-asset="backgrounds\/bg-phone-night-v2-nomoon\.webp\|[^"]*phone-extension-bg-night-v2-440x956\.webp/);
});
let pp = null; for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = process.env.CHROME_PATH || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : null);
const SKIP = !(pp && CHROME) && "needs puppeteer-core + chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const TOKEN = "test-token-lhpath3-0123456789";
/* FAKE rows: tomorrow 10 AM and 3 PM ("Tomorrow" wraps on the 128 px stones), then 9 AM the day after */
const at = (dd, h) => { const d = new Date(); d.setDate(d.getDate() + dd); d.setHours(h, 0, 0, 0); return d; };
const ROWS = [["Pumpkin patch", at(1, 10)], ["Soccer practice", at(1, 15)], ["Library day", at(2, 9)]];
function privDir() {
  const d = fs.mkdtempSync(path.join(TEMP_HOME, "lhpath3-priv-")), FX = path.join(ROOT, "scripts/qa/fixtures/private");
  for (const f of fs.readdirSync(FX)) { const m = f.match(/^(.*)\.synthetic\.json$/); if (m) fs.copyFileSync(path.join(FX, f), path.join(d, m[1] + ".json")); }
  return d;
}
function writeCal(d, n) {
  const c0 = JSON.parse(fs.readFileSync(path.join(d, "cal-live.json"), "utf8"));
  const ev = ROWS.slice(0, n).map(([t, s], i) => ({ id: "fake-" + i, summary: t, start: s.toISOString(), end: new Date(+s + 36e5).toISOString(), location: "", busy: false, allDay: false }));
  fs.writeFileSync(path.join(d, "cal-live.json"), JSON.stringify({ ...c0, status: "live", fetchedAt: new Date().toISOString(), nextLeave: null, upcomingLeaves: ev }));
}
async function serve(PRIV) {
  const o = { base: "" };
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, "http://x"), rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (u.pathname.startsWith("/api/private")) { if (!handlePrivate(q, r, { tokens: [TOKEN], origins: new Set([o.base]), dir: PRIV })) { r.writeHead(404); r.end(); } return; }
    if (rel === "night/media/caps.json") { r.writeHead(200, { "content-type": "application/json" }); return r.end(JSON.stringify({ video: false, artH: [] })); }
    if (rel.startsWith("night/media/")) { r.writeHead(404); return r.end(); }
    const f = path.join(ROOT, path.normalize(rel || "index.html").replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); r.end(b); });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); o.base = "http://127.0.0.1:" + srv.address().port; return { srv, base: o.base };
}
const inside = (b, z) => b.x0 >= z[0] - TOL && b.y0 >= z[1] - TOL && b.x1 <= z[2] + TOL && b.y1 <= z[3] + TOL;
const hit = (a, z) => a.x0 < z[2] - TOL && a.x1 > z[0] + TOL && a.y0 < z[3] - TOL && a.y1 > z[1] + TOL;
test("LHPATH3 browser 440@3x: 1, 2 and 3 stones sit in Prism's no-prop boxes, one row, text 14 px+, nothing clipped, count row clear", { skip: SKIP, timeout: 300000 }, async () => {
  const PRIV = privDir(), { srv, base } = await serve(PRIV);
  try {
    for (const n of [1, 2, 3]) {
      writeCal(PRIV, n);
      const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });   /* a new browser per state */
      try {
        const g = await b.newPage(); await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
        await g.setViewport({ width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        await g.evaluateOnNewDocument((t) => { try { localStorage.setItem("wardos-private-feed-token", t); } catch (e) {} }, TOKEN);
        await g.goto(base + "/livinghouse/index.html?spook=0&pfBase=" + encodeURIComponent(base), { waitUntil: "domcontentloaded", timeout: 90000 });
        await g.waitForFunction((k) => document.fonts.status === "loaded" && document.querySelectorAll("#lh-near .lh-stone").length === k, { timeout: 60000 }, n);
        await new Promise((ok) => setTimeout(ok, 1500));
        const r = await g.evaluate(() => {
          const R = (q) => { const x = q.getBoundingClientRect(); return { x0: x.left, y0: x.top, x1: x.right, y1: x.bottom }; };
          const st = [...document.querySelectorAll("#lh-near .lh-stone")].map((s) => {
            const txt = [...s.querySelectorAll(".d, .w")].map((t) => { const cs = getComputedStyle(t), rg = document.createRange(); rg.selectNodeContents(t);
              const lines = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size;
              return { cls: t.className, text: t.textContent, px: parseFloat(cs.fontSize), lines, clipV: t.scrollHeight > t.clientHeight + 1, clipH: t.scrollWidth > t.clientWidth + 1,
                glyphs: [...rg.getClientRects()].map((q) => ({ x0: q.left, y0: q.top, x1: q.right, y1: q.bottom })) }; });
            const cs = getComputedStyle(s);
            return { box: R(s), w: s.offsetWidth, h: s.offsetHeight, left: cs.left, cardClip: s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1, txt };
          });
          const c = document.querySelector("#lh-count"), cv = c && !c.hidden && getComputedStyle(c).display !== "none" && c.getBoundingClientRect().height > 0;
          return { st, count: cv ? R(c) : null, vh: innerHeight, feed: document.documentElement.getAttribute("data-feed-status") };
        });
        console.log(`# LHPATH3 ${n} stone(s): ` + JSON.stringify(r.st.map((s) => ({ box: Object.values(s.box).map((v) => +v.toFixed(1)), w: s.w, h: s.h, d: s.txt[0] && [s.txt[0].px, s.txt[0].lines], w2: s.txt[1] && [s.txt[1].px, s.txt[1].lines] }))) + " count " + JSON.stringify(r.count && Object.values(r.count).map((v) => +v.toFixed(1))));
        assert.equal(r.st.length, n);
        const ys = r.st.map((s) => s.box.y1);
        r.st.forEach((s, i) => {
          const z = BOX[n][i], tag = `${n} stones #${i + 1}`;
          assert.ok(inside(s.box, z), `${tag}: box ${JSON.stringify(s.box)} outside Prism's no-prop box ${z}`);
          assert.equal(s.h, 176, `${tag}: height 176`); assert.ok(Math.abs(s.w - (n === 1 ? 255.2 : n === 2 ? 193.6 : 128)) <= 1, `${tag}: width ${s.w}`);
          assert.ok(!s.cardClip, `${tag}: card content clipped`);
          for (const t of s.txt) {
            assert.ok(t.px >= 14, `${tag} .${t.cls} "${t.text}": ${t.px}px under 14`);
            assert.ok(!t.clipV && !t.clipH, `${tag} .${t.cls} "${t.text}": clipped`);
            for (const q of t.glyphs) assert.ok(inside(q, [s.box.x0, s.box.y0, s.box.x1, s.box.y1]), `${tag} .${t.cls}: a line box leaves the card`);
          }
          assert.ok(!hit(s.box, STREAK), `${tag}: over Prism's streak row ${STREAK}`);
          if (r.count) assert.ok(!hit(s.box, [r.count.x0, r.count.y0, r.count.x1, r.count.y1]), `${tag}: over the pumpkin count row`);
        });
        assert.ok(Math.max(...ys) - Math.min(...ys) <= 6, `one row: bottoms ${ys}`);
        if (n === 3) for (const s of r.st) if (/^Tomorrow/i.test(s.txt[0].text)) console.log(`# LHPATH3 3-stone "${s.txt[0].text}" wraps to ${s.txt[0].lines} line(s), not clipped`);
      } finally { await b.close(); }
    }
  } finally { srv.close(); fs.rmSync(PRIV, { recursive: true, force: true }); }
});
