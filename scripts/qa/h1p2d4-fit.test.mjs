/* H1P2D4 FIT (Alfred FAIL of p2delta3 d7e329da, gate ship-2026-10-24T0913-halloween1-p2delta3) · at 1920x1080 with the live feed
   the hub's four content-sized rows plus gaps came to ~728 px in a 698 px grid-wrap and the Family trips tile lost its foot and
   bottom border. The H1P2D3 overflow check missed it: its faces were short and it only looked inside each tile.
   This test paints REAL-LENGTH tiles: scripts/qa/fixtures/h1p2d4/wall-tiles.live-shape.json is the live tiles' markup with every
   letter masked (lengths, case, digits and times kept; no names, places or urls), served behind the synthetic private fixtures,
   and the cam deck under the hub held at its live 220 px. On index.html (redirects to the hub) and sheet-index.html at
   1920x1080 and 2560x1440: grid-wrap never scrolls, every tile's bottom border is inside grid-wrap and the viewport, no tile
   text leaves its tile or grid-wrap, and each kid tile's last line sits above its foot. A one-line ellipsis box (the tile
   sub, H1-LHVIS, by design) is judged by its own box across and logged; every other line is judged by its glyphs. The live
   Harris sub also caught a second clip: the tile's top row outgrew the tile, so its ellipsis and page dots fell off the edge.
   No live json is read. */
import { assertSealed } from "./temp-home.mjs";
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import http from "node:http"; import os from "node:os"; import path from "node:path";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("TEMPHOME1: sealed before reading anything", () => { assertSealed(); });
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const SHAPE = JSON.parse(R("scripts/qa/fixtures/h1p2d4/wall-tiles.live-shape.json"));

test("H1P2D4 static: the live-shape fixture is masked; the wall rows stay content-sized; compact chrome under 1100 px tall", () => {
  assert.ok(SHAPE.tiles.length >= 9); assert.equal(SHAPE.camDeckH, 220);
  for (const t of SHAPE.tiles) { assert.doesNotMatch(t.html, /\b(src|href|data-[\w-]+)=|url\(/, t.cls); assert.doesNotMatch(t.html, /—|→|\$|%/, t.cls); }
  const land = R("wg-wall-land.css");
  assert.match(land, /tile-grid--cams \{ grid-template-rows: repeat\(4, minmax\(min-content, 1fr\)\) !important/, "rows never squeeze a tile below its content");
  const blk = land.match(/@media \(min-width: 1200px\) and \(min-aspect-ratio: 4\/3\) and \(max-height: 1100px\) \{[\s\S]*?\n\}/);
  assert.ok(blk, "H1P2D4 compact block"); for (const r of [/row-gap: 4px/, /padding-top: 6px/, /\.tile-top \{ margin-bottom: 4px/, /\.tile-foot \{ padding-top: 3px/, /\.kf-face \{ gap: 2px/, /line-height: 1\.1/]) assert.match(blk[0], r);
  assert.doesNotMatch(blk[0].slice(blk[0].indexOf("{")), /font-size|overflow|max-height/, "the compact block only trims spacing");
  assert.match(land, /tile-grid--cams > \.tile > \.tile-top \{ max-width: 100% !important; \}/, "a tile's top row never outgrows the tile");
  assert.ok(R("sheet-index.html").includes('href="wg-wall-land.css?v=H1P2D4"'));
});

let pp = null; for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = process.env.CHROME_PATH || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : null);
const SKIP = !(pp && CHROME) && "needs puppeteer-core + chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".jpg": "image/jpeg" };

test("H1P2D4 browser FIT: real-length tiles fit the wall (bottom borders in view, no overflow) at 1920x1080 and 2560x1440", { skip: SKIP, timeout: 300000 }, async () => {
  const PRIV = fs.mkdtempSync(path.join(os.homedir(), "h1p2d4-priv-")), FX = path.join(ROOT, "scripts/qa/fixtures/private");
  for (const f of fs.readdirSync(FX)) { const m = f.match(/^(.*)\.synthetic\.json$/); if (m) fs.copyFileSync(path.join(FX, f), path.join(PRIV, m[1] + ".json")); }
  fs.writeFileSync(path.join(PRIV, "private-names.tsv"), "partner\tSynthpartner\n", { mode: 0o600 });
  const { handlePrivate } = await import(path.join(ROOT, "scripts/private-feed.mjs")), TOKEN = "test-token-0123456789abcdef";
  let base = "";
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x"), rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (u.pathname.startsWith("/api/private")) { if (!handlePrivate(req, res, { tokens: [TOKEN], origins: new Set([base]), dir: PRIV })) { res.writeHead(404); res.end(); } return; }
    if (rel.startsWith("night/media/")) { res.writeHead(404); return res.end(); }
    const f = path.join(ROOT, path.normalize(rel || "index.html").replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(b); });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); base = "http://127.0.0.1:" + srv.address().port;
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] }), fails = [];
  try {
    for (const pg of ["index.html", "sheet-index.html"]) for (const [w, h] of [[1920, 1080], [2560, 1440]]) {
      const g = await b.newPage(); await g.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await g.evaluateOnNewDocument((t) => { try { localStorage.setItem("wardos-private-feed-token", t); } catch (e) {} }, TOKEN);
      await g.goto(`${base}/${pg}?spook=0&pfBase=${encodeURIComponent(base)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await g.waitForFunction(() => document.querySelectorAll(".tile .kf-stage").length >= 4, { timeout: 60000 }); await new Promise((ok) => setTimeout(ok, 4000));
      const r = await g.evaluate((S) => {
        const deck = document.querySelector(".panel > .hub-cam-deck"); if (deck) { deck.hidden = false; deck.style.setProperty("display", getComputedStyle(deck).display === "none" ? "block" : getComputedStyle(deck).display, "important"); for (const p of ["height", "min-height", "max-height"]) deck.style.setProperty(p, S.camDeckH + "px", "important"); }
        const grid = document.querySelector(".grid-wrap .tile-grid"), painted = [];
        for (const t of S.tiles) { const el = grid && grid.querySelector(":scope > .tile." + t.cls.trim().split(/\s+/)[1]); if (!el) continue; el.hidden = false; el.style.removeProperty("display"); el.innerHTML = t.html; painted.push(t.cls); }
        return { painted, deck: !!deck };
      }, SHAPE);
      await new Promise((ok) => setTimeout(ok, 800));
      const m = await g.evaluate(() => {
        const vis = (e) => { const s = getComputedStyle(e); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0; };
        const nm = (e) => String(e.className || "").trim().split(/\s+/).slice(0, 2).join(".");
        const gw = document.querySelector(".grid-wrap"), gb = gw.getBoundingClientRect(), bad = [], tiles = [], ellipsis = new Set();
        if (gw.scrollHeight > gw.clientHeight + 1) bad.push("grid-wrap overflows by " + (gw.scrollHeight - gw.clientHeight));
        for (const t of document.querySelectorAll(".grid-wrap .tile-grid > .tile")) { if (!vis(t)) continue; const tb = t.getBoundingClientRect(); if (tb.width < 1) continue;
          tiles.push(nm(t) + " " + Math.round(tb.top) + "-" + Math.round(tb.bottom));
          if (tb.bottom > gb.bottom + 0.5) bad.push(nm(t) + " bottom border " + Math.round(tb.bottom) + " below grid-wrap " + Math.round(gb.bottom));
          if (tb.bottom > innerHeight + 0.5) bad.push(nm(t) + " bottom border " + Math.round(tb.bottom) + " below the viewport");
          if (tb.top < gb.top - 0.5) bad.push(nm(t) + " top above grid-wrap");
          const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); let last = null;
          for (let n; (n = tw.nextNode());) { if (!n.textContent.trim() || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n);
            for (const x of rg.getClientRects()) { if (x.width < 1) continue;
              /* a one-line ellipsis box (the tile sub, H1-LHVIS) ends its own text: judge its box across, its text down */
              const e = n.parentElement, es = getComputedStyle(e), ell = es.textOverflow === "ellipsis" && /hidden|clip/.test(es.overflowX) && es.whiteSpace === "nowrap", eb = e.getBoundingClientRect();
              const xr = ell ? eb.right : x.right, xl = ell ? eb.left : x.left; if (ell && x.right > eb.right + 1) ellipsis.add(nm(t) + " " + nm(e));
              if (Math.max(x.bottom - tb.bottom, tb.top - x.top, xr - tb.right, tb.left - xl) > 1) bad.push("text outside " + nm(t) + ": " + n.textContent.trim().slice(0, 12));
              if (x.bottom > gb.bottom + 1 || x.bottom > innerHeight) bad.push("text cut by grid-wrap in " + nm(t) + ": " + n.textContent.trim().slice(0, 12));
              if (n.parentElement.closest(".kf-face")) last = x; } }
          if (t.classList.contains("kid-flip")) { const foot = t.querySelector(".tile-foot");
            if (!last) bad.push(nm(t) + " has no face text");
            else if (foot && vis(foot) && last.bottom > foot.getBoundingClientRect().top + 1) bad.push(nm(t) + " last line under its foot"); } }
        const de = document.documentElement; if (de.scrollWidth > de.clientWidth + 1) bad.push("hscroll");
        return { bad, tiles, ellipsis: [...ellipsis], gw: [Math.round(gb.top), Math.round(gb.bottom)], cut: gw.scrollHeight - gw.clientHeight, page: location.pathname };
      });
      console.log(`# H1P2D4 FIT ${pg}@${w}x${h} (${m.page}) painted=${r.painted.length} deck=${r.deck} grid-wrap=${m.gw.join("-")} cut=${m.cut} bad=${m.bad.length} ellipsis=[${m.ellipsis.join(", ")}]`);
      for (const x of m.bad) console.log("#   " + x);
      assert.ok(r.painted.length >= 9, `${pg}@${w}: painted ${r.painted.length} live-shape tiles`); assert.ok(r.deck, "cam deck present");
      if (m.bad.length) fails.push(`${pg}@${w}x${h}: ${m.bad.join("; ")}`);
      await g.close();
    }
    assert.deepEqual(fails, []);
  } finally { await b.close(); srv.close(); fs.rmSync(PRIV, { recursive: true, force: true }); }
});
