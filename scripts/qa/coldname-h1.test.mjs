/* COLDLOAD1 (Alfred P1 + P2s, HALLOWEEN1 gate) · livinghouse kid name plaques never go blank on a cold first load.
   Root cause: wg-sway.js skin() was not idempotent. The first pass cloned the word as a text node and wrapped the original in a
   <span>; when the plaque art finished loading AFTER sway init (a cold cache), the refresh cloned that <span>, which the
   baked-art rule hides with !important, so the phone plank (live words) showed no name until a reload (warm art beats init).
   Also: LH faces swap instead of block, sway re-skins once on document.fonts.ready, the phone type floor is 14 px, and the
   phone background art carries its own cache token (LHPATH2, now LHPATH3 with lh.css). Each browser case is a NEW browser (fresh profile, no reload)
   with synthetic plaque art; cold = art and fonts answer late, warm = at once. No private art, list or feed is read. */
import { assertSealed } from "./temp-home.mjs";
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import http from "node:http"; import path from "node:path";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
import { artKey } from "../nest-webrtc-proxy.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("TEMPHOME1: sealed before reading anything", () => { assertSealed(); });
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const SW = R("wg-sway.js"), LH = R("livinghouse/index.html"), CSS = R("livinghouse/lh.css"), GL = R("wg-glass.css"), WA = R("wg-assets.js");
test("COLDLOAD1 static: idempotent skin, font swap + fonts.ready re-skin, 14 px phone floor, cache tokens", () => {
  assert.match(SW, /setAttribute\("data-sw-tx", ""\)/); assert.match(SW, /hasAttribute\("data-sw-tx"\) \? document\.createTextNode/);
  assert.match(SW, /document\.fonts\.ready\.then\(function \(\) \{ Array\.prototype\.forEach\.call\(els, refresh\)/);
  assert.doesNotMatch(CSS, /font-display:\s*block/); assert.equal((CSS.match(/font-display: swap/g) || []).length, 3);
  assert.match(GL, /@media \(max-width: 600px\) \{ \.md, \.kf-kicker, \.tile-mchip, \.tile-fact, \.tag \{ font-size: max\(14px, 1em\) !important; \} \}/);
  assert.doesNotMatch(GL, /11\.5px/);
  for (const t of ['src="../wg-sway.js?v=COLDLOAD1"', 'src="../wg-assets.js?v=COLDLOAD1"', 'href="lh.css?v=LHPATH3"', 'href="../wg-glass.css?v=COLDLOAD1"']) assert.ok(LH.includes(t), t);
  assert.match(LH, /<i class="lh-tallbg"[^>]* data-asset-v="LHPATH3"[^>]*data-asset="backgrounds\/bg-phone-night-v2-nomoon\.webp\|[^"]*phone-extension-bg-night-v2-440x956\.webp/);
  assert.match(WA, /q = el\.getAttribute\("data-asset-v"\), src = base \+ name \+ \(q \? "\?v=" \+ encodeURIComponent\(q\) : ""\)/);
  for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"))) assert.doesNotMatch(R(f), /wg-glass\.css\?v=WGGLASS1/, f);
});
let pp = null; for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = process.env.CHROME_PATH || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : null);
const SKIP = !(pp && CHROME) && "needs puppeteer-core + chrome";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");   /* 1x1, synthetic */
const KIDS = ["ainsley", "hayes", "harris"], NAMES = KIDS.flatMap((k) => [`signs/plaque-${k}-v2-hang.png`, `signs/plaque-${k}-v2-hang-phone@3x.png`]);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf" };
async function serve(st) {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "");
    if (rel === "night/media/caps.json") { r.writeHead(200, { "content-type": "application/json" }); return r.end(JSON.stringify({ video: false, artH: NAMES.map(artKey) })); }
    if (rel.startsWith("night/media/art/halloween/")) { if (!NAMES.includes(rel.slice(26))) { r.writeHead(404); return r.end(); }
      return setTimeout(() => { r.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }); r.end(PNG); }, st.delay); }
    const f = path.join(ROOT, path.normalize(rel || "index.html").replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { const go = () => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); r.end(b); };
      if (rel.startsWith("fonts/")) setTimeout(go, st.delay); else go(); });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); return { srv, base: "http://127.0.0.1:" + srv.address().port };
}
const vp = (w) => (w < 800 ? { width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { width: 1920, height: 1080, deviceScaleFactor: 1 });
const shot = async (g, clip) => Buffer.from(await g.screenshot({ clip }));   /* puppeteer may hand back a Uint8Array */
/* in-page pixel diff of two shots (count of pixels whose RGB moves by more than 24): [a vs a2 = frame noise, a vs z = the words] */
const diff = async (us) => { const px = await Promise.all(us.map((u) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); ok(x.getImageData(0, 0, i.width, i.height).data); }; i.src = u; })));
  const n = (p, q) => { let k = 0; for (let j = 0; j < p.length; j += 4) if (Math.abs(p[j] - q[j]) + Math.abs(p[j + 1] - q[j + 1]) + Math.abs(p[j + 2] - q[j + 2]) > 24) k++; return k; };
  return [n(px[0], px[1]), n(px[0], px[2])]; };
/* make only that sign's skin words transparent (inline !important beats the READ1 plank rule), and back */
const HIDE = (kid, on) => { const gu = document.querySelector(`.lh-kw .name[data-kid="${kid}"] > .wg-sw .wg-gu`), all = [gu, ...gu.querySelectorAll("*")];
  if (on) { window.__cl1 = all.map((n) => n.getAttribute("style")); all.forEach((n) => { n.style.setProperty("color", "transparent", "important"); n.style.setProperty("-webkit-text-fill-color", "transparent", "important"); n.style.setProperty("text-shadow", "none", "important"); }); }
  else all.forEach((n, k) => { const v = window.__cl1[k]; if (v == null) n.removeAttribute("style"); else n.setAttribute("style", v); }); };
test("COLDLOAD1 browser: a fresh-profile first load (no reload) paints the kid names at 440@3x and 1920, cold and warm", { skip: SKIP, timeout: 300000 }, async () => {
  const st = { delay: 0 }, { srv, base } = await serve(st);
  try {
    for (const w of [440, 1920]) for (const order of ["cold", "warm"]) {
      st.delay = order === "cold" ? 2500 : 0;   /* cold: art + fonts land well after sway init (DOMContentLoaded + 600 ms) */
      const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });   /* a new browser = a fresh profile */
      try {
        const g = await b.newPage(); await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]); await g.setViewport(vp(w));
        await g.goto(base + "/livinghouse/index.html?pfOffline=1&spook=0", { waitUntil: "domcontentloaded", timeout: 90000 });
        await g.waitForFunction(() => document.fonts.status === "loaded" && [...document.querySelectorAll(".lh-kw .name")].every((el) => el.hasAttribute("data-asset-baked") && el.querySelector(":scope > .wg-sw .wg-gu")), { timeout: 60000 });
        await new Promise((ok) => setTimeout(ok, 1500));   /* past the 120 ms MutationObserver refresh and the fonts.ready re-skin */
        const r = await g.evaluate(() => [...document.querySelectorAll(".lh-kw .name")].map((el) => {
          const gu = el.querySelector(":scope > .wg-sw .wg-gu"), h = [...gu.childNodes].find((n) => (n.textContent || "").trim());
          const cs = getComputedStyle(h && h.nodeType === 1 ? h : gu), bx = gu.getBoundingClientRect();
          return { kid: el.dataset.kid, text: h ? h.textContent.trim() : "", vis: cs.visibility, fill: cs.webkitTextFillColor, art: getComputedStyle(el).getPropertyValue("--wg-art"),
            box: { x: bx.x, y: bx.y, width: bx.width, height: bx.height }, phone: document.documentElement.classList.contains("lh-phone"), lhfont: document.fonts.check('700 24px "LH Display"') };
        }));
        assert.equal(r.length, 3, `${w} ${order}: three plaques`);
        for (const x of r) {
          assert.equal(x.text.toLowerCase(), x.kid, `${w} ${order} ${x.kid}: word in the skin`); assert.ok(x.lhfont, "LH Display loaded"); assert.match(x.art, /plaque-/, "plaque art painted");
          if (w < 800) {
            assert.ok(x.phone, "phone layout"); assert.equal(x.vis, "visible", `${w} ${order} ${x.kid}: live word shows on the phone plank`); assert.doesNotMatch(x.fill, /rgba\(0, 0, 0, 0\)/);
            /* rendered glyphs, not just textContent: the plank's pixels change when only its words are made transparent */
            const clip = { x: Math.max(0, x.box.x), y: Math.max(0, x.box.y), width: Math.max(1, x.box.width), height: Math.max(1, x.box.height) };
            const still = await g.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }" });
            const a = await shot(g, clip), a2 = await shot(g, clip), flip = (on) => g.evaluate(HIDE, x.kid, on);
            await flip(true); const z = await shot(g, clip); await flip(false); await still.evaluate((n) => n.remove());
            const [noise, words] = await g.evaluate(diff, [a, a2, z].map((u) => "data:image/png;base64," + u.toString("base64")));
            assert.ok(words > 40 && words > 4 * noise, `${w} ${order} ${x.kid}: the name's glyphs are painted on the plank (${words} px change with the words hidden, ${noise} px frame noise)`);
          } else assert.ok(x.vis === "hidden" || /rgba\(0, 0, 0, 0\)/.test(x.fill), `${w} ${order} ${x.kid}: the wall plaque art carries the name, the live word stays unpainted`);
        }
      } finally { await b.close(); }
    }
  } finally { srv.close(); }
});
test("COLDLOAD1 browser: every index tile-micro span.md renders at 14 px or more at 440", { skip: SKIP, timeout: 120000 }, async () => {
  const st = { delay: 0 }, { srv, base } = await serve(st), b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  try {
    const g = await b.newPage(); await g.setViewport(vp(440));
    await g.goto(base + "/sheet-index.html?pfOffline=1", { waitUntil: "load", timeout: 90000 }); await new Promise((ok) => setTimeout(ok, 2500));
    const m = await g.evaluate(() => [...document.querySelectorAll(".tile-micro span.md")].filter((n) => n.getClientRects().length).map((n) => parseFloat(getComputedStyle(n).fontSize)));
    console.log("# COLDLOAD1 tile-micro span.md at 440: " + m.length + " rendered, sizes " + JSON.stringify([...new Set(m)]));
    assert.ok(m.length >= 1, "tile-micro words render"); for (const px of m) assert.ok(px >= 14, `span.md ${px}px`);
  } finally { await b.close(); srv.close(); }
});
