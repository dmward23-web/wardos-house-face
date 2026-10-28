/* H1P2D3 (Alfred FAIL of halloween1 f4de40c6, gate ship-2026-10-24T0754-halloween1-p2delta2) · three wall fixes, one file.
   P1  blank kid name on the 1920 wall when the kid has something today: lh.css put an !important brass gradient on
       .lh-kw .name.today, wg-sway copied that background onto its skin, and the baked plaque art (which carries the
       name) was covered by a plain gold slab. The gradient is now for plain-text plaques only (:not([data-asset-baked]));
       the warm ::after dot stays. PIXEL check: synthetic plaque art with green ink on brown, a today kid at 1920.
   P2  hub tiles clipped at 1920 (streak chip over the kid's rows, Dad's second row past the tile): the compact wall grid
       forced four equal minmax(0,1fr) rows. wg-wall-land.css lets each row grow to its content (14/15 px floors kept).
       OVERFLOW check: worst-case faces on index.html (redirects to the hub) and sheet-index.html at 1920 and 2560.
   P2  HCOUNT1 countdown: whole days to Thu Oct 29 (date fallback), the start time only from Dan's calendar event
       "Halloween night with the kids" (by id first, exact title second, Oct 29 only), shown as 5:00 PM.
   Fixtures only (scripts/qa/fixtures/hcount, synthetic, no location); no live json is read. Ainsley's board has no count.
   H1P2D4: the event id is no longer in the repo. scene-packs.js keeps SHOW.idH (SHA-256 of the id, first 16 hex) and hashes
   feed ids at runtime with a sync sha16; the fixtures carry a synthetic id, and these tests point SHOW.idH at its hash
   (node: set and restore; browser: patched as window.LHScenePacks is assigned, no production hook). */
import { assertSealed } from "./temp-home.mjs";
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import http from "node:http"; import os from "node:os"; import path from "node:path";
import zlib from "node:zlib"; import crypto from "node:crypto"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
import { artKey } from "../nest-webrtc-proxy.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("TEMPHOME1: sealed before reading anything", () => { assertSealed(); });
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FXH = (n) => JSON.parse(R(`scripts/qa/fixtures/hcount/cal-live.hcount-${n}.json`));
const Packs = createRequire(import.meta.url)(path.join(ROOT, "livinghouse/scene-packs.js"));
const at = (iso) => new Date(iso);
const H16 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
const FX_ID = "fx-hcount-show-id", FX_IDH = H16(FX_ID), REAL_IDH = Packs.SHOW.idH;
const fx = (fn) => { Packs.SHOW.idH = FX_IDH; try { return fn(); } finally { Packs.SHOW.idH = REAL_IDH; } };
const BAD_TIME = /\b6:00\b|\b5:30\b|\b17:\d\d\b|early/i;

test("H1P2D3 static: plaque gradient scoped off baked art, dot kept; wall grid grows; tokens (H1P2D4 where bumped)", () => {
  const css = R("livinghouse/lh.css"), land = R("wg-wall-land.css");
  assert.match(css, /\.lh-kw \.name\.today:not\(\[data-asset-baked\]\) \{ background: linear-gradient/);
  assert.doesNotMatch(css, /^\.lh-kw \.name\.today \{[^}]*!important/m, "no unscoped !important gradient on the wall plaque");
  assert.match(css, /\.lh-kw \.name\.today::after \{ content: ""/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.lh-count \.pumpkin \{ animation: none !important/);
  assert.match(land, /tile-grid--cams \{ grid-template-rows: repeat\(4, minmax\(min-content, 1fr\)\) !important/);
  assert.match(land, /tile-grid--cams > \.tile \{ height: auto !important; max-height: none !important; \}/);
  const LH = R("livinghouse/index.html"), SI = R("sheet-index.html");
  for (const t of ['href="lh.css?v=LHPATH3"' /* LHPATH3 (efd454b6) changed lh.css and moved its token on purpose */, 'src="scene-packs.js?v=H1P2D4"', 'src="lh.js?v=H1P2D3"']) assert.ok(LH.includes(t), t);
  for (const t of ['href="wg-wall-land.css?v=H1P2D4"', 'src="wg-assets.js?v=H1P2D3"']) assert.ok(SI.includes(t), t);
  for (const k of ["ainsley", "hayes", "harris"]) { const s = R(`kid-${k}.html`);
    assert.ok(s.includes('src="wg-assets.js?v=H1P2D3"'), k + " wg-assets"); assert.ok(s.includes('src="livinghouse/scene-packs.js?v=H1P2D4"'), k + " scene-packs");
    assert.doesNotMatch(s, /\?v=LIVEWX2B"/, k); }
});

test("H1P2D3 HCOUNT1: the dates file cites Dan's event (title, when, id hash), no address, no early entry", () => {
  const raw = R("livinghouse/ambient/halloween-dates.json"), j = JSON.parse(raw);
  assert.equal(j.countdown.civil, "2026-10-29");
  assert.equal(j.event.title, "Halloween night with the kids"); assert.equal("id" in j.event, false, "H1P2D4: no raw event id"); assert.match(j.event.idSha16, /^[0-9a-f]{16}$/);
  assert.equal(j.event.start, "2026-10-29T17:00:00-05:00"); assert.match(j.event.when, /Thu Oct 29 2026, 5:00-8:00 PM CDT/);
  assert.equal("early" in j, false); assert.doesNotMatch(raw, /17\.5|5:30|"early"/); assert.doesNotMatch(raw, /location|address|\b\d{3,5} [A-Z][a-z]+ (St|Ave|Rd|Dr|Ln|Ct)\b/);
  assert.deepEqual([Packs.SHOW.civil, Packs.SHOW.idH], [j.countdown.civil, j.event.idSha16]); assert.equal("id" in Packs.SHOW, false);
  assert.doesNotMatch(j._note, /never a clock time/i, "H1P2D4: the note matches the event-keyed 5:00 PM"); assert.match(j._note, /5:00 PM start comes from Dan's calendar event/);
  assert.match(j.countdown.source, /Thu Oct 29 2026 5:00 PM CDT \(event-keyed/); assert.doesNotMatch(j.countdown.source, /Oct 23/);
  assert.ok(Packs.SHOW.title.test(j.event.title));
});

test("H1P2D3 HCOUNT1: event present = Thu 5:00 PM and 5 days on Sat Oct 24; missing = date fallback", () => fx(() => {
  const p = Packs.forDate(at("2026-10-24T08:00:00-05:00"), FXH("present"));
  assert.equal(p.id, "october-count"); assert.equal(p.days, 5); assert.equal(p.via, "id"); assert.equal(p.at, "5:00\u00a0PM");
  const t = Packs.showTarget(FXH("present")); assert.equal(+t.start, Date.parse("2026-10-29T17:00:00-05:00")); assert.equal(+t.end, Date.parse("2026-10-29T20:00:00-05:00"));
  assert.deepEqual(Object.keys(t).sort(), ["end", "start", "via"], "no title or location leaves the seam");
  for (const [n, via] of [["renamed-id", "id"], ["title-only", "title"]]) { const q = Packs.forDate(at("2026-10-24T08:00:00-05:00"), FXH(n)); assert.equal(q.days, 5, n); assert.equal(q.via, via, n); assert.equal(q.at, "5:00\u00a0PM", n); }
  for (const cal of [FXH("absent"), null, undefined, {}, { upcomingLeaves: "x" }]) {
    const q = Packs.forDate(at("2026-10-24T08:00:00-05:00"), cal); assert.equal(q.days, 5); assert.equal(q.via, "date"); assert.equal(q.at, "");
  }
  assert.equal(Packs.showTarget(FXH("absent")), null, "the 9:30 parade decoy and the all-day row never match");
  assert.equal(Packs.forDate(at("2026-10-28T21:00:00-05:00"), FXH("present")).days, 1);
  assert.equal(Packs.forDate(at("2026-10-23T21:00:00-05:00"), FXH("present")).id, "october", "the count starts Oct 24");
}));

test("H1P2D3 HCOUNT1: the Oct 29 day itself (Tonight, Time to go!, then the quiet night); only 5:00 PM", () => fx(() => {
  const P = FXH("present");
  const m = Packs.forDate(at("2026-10-29T07:00:00-05:00"), P); assert.equal(m.days, 0); assert.equal(m.tonight, true); assert.equal(m.go, false); assert.equal(m.at, "5:00\u00a0PM");
  const g = Packs.forDate(at("2026-10-29T17:01:00-05:00"), P); assert.equal(g.tonight, true); assert.equal(g.go, true);
  assert.equal(Packs.forDate(at("2026-10-29T20:01:00-05:00"), P).id, "october", "after the show ends: no Tonight");
  const f = Packs.forDate(at("2026-10-29T19:00:00-05:00"), FXH("absent")); assert.equal(f.tonight, true); assert.equal(f.go, false); assert.equal(f.at, "", "date fallback never invents a time");
  assert.equal(Packs.forDate(at("2026-10-30T12:00:00-05:00"), P).id, "october"); assert.equal(Packs.forDate(at("2026-10-31T18:00:00-05:00"), P).id, "october-street");
  for (const n of ["present", "absent", "renamed-id", "title-only"]) for (const iso of ["2026-10-24T08:00:00-05:00", "2026-10-29T07:00:00-05:00", "2026-10-29T17:30:00-05:00"]) {
    const s = JSON.stringify(Packs.forDate(at(iso), FXH(n))); assert.doesNotMatch(s, BAD_TIME, n + " " + iso); }
  const src = R("livinghouse/scene-packs.js") + R("livinghouse/lh.js");
  assert.doesNotMatch(src.match(/HCOUNT1[\s\S]*?function forDate/)[0], /17\.5|5:30|early/);
}));

test("H1P2D4 id hash: sync sha16 = node sha256 (first 16 hex); id, instance id, then title, then date; no raw id in the repo files", () => {
  for (const s of ["", "a", "abc", "x".repeat(55), "y".repeat(56), "z".repeat(63), "w".repeat(64), "v".repeat(119), "fx-hcount-show-id", "Halloween \u00e9\u4e2d\ud83c\udf83"]) assert.equal(Packs.sha16(s), H16(s), JSON.stringify(s).slice(0, 20));
  assert.match(REAL_IDH, /^[0-9a-f]{16}$/); assert.notEqual(REAL_IDH, FX_IDH);
  const P = FXH("present"), day = "2026-10-24T08:00:00-05:00";
  assert.equal(Packs.forDate(at(day), P).via, "title", "real hash: the synthetic id does not match, the exact title does");
  fx(() => {
    assert.equal(Packs.forDate(at(day), P).via, "id");
    const inst = JSON.parse(JSON.stringify(P)); for (const e of inst.upcomingLeaves || inst.events || []) if (e.id === FX_ID) { e.id = FX_ID + "_20261029T220000Z"; e.summary = "Renamed"; }
    assert.equal(Packs.forDate(at(day), inst).via, "id", "a recurring instance id hashes its base");
  });
  const files = ["livinghouse/scene-packs.js", "livinghouse/ambient/halloween-dates.json", ...fs.readdirSync(path.join(ROOT, "scripts/qa/fixtures/hcount")).map((f) => "scripts/qa/fixtures/hcount/" + f)];
  for (const f of files) { const t = R(f); for (const m of t.matchAll(/[a-v0-9]{26}/g)) assert.notEqual(H16(m[0]), REAL_IDH, f + ": the raw event id is back"); }
});

test("H1P2D3 HCOUNT1: Ainsley sees no digits (no count on any kid board)", () => {
  for (const k of ["ainsley", "hayes", "harris"]) { const s = R(`kid-${k}.html`); assert.doesNotMatch(s, /lh-count|livinghouse\/lh\.js/, k); }
  const wa = R("wg-assets.js"); assert.match(wa, /forDate\(C && C\.now \? C\.now\(\) : new Date\(\)\)\.id/); assert.doesNotMatch(wa, /\.days\b|\.at\b|tonight/);
});

/* ---------------- browser ---------------- */
const NO_BROWSER = process.env.QA_NO_BROWSER === "1";   /* DAYPKG1 item 3 · QA_NO_BROWSER=1: puppeteer-core is never loaded and no Chrome path is resolved, so nothing below can launch */
let pp = null; if (!NO_BROWSER) for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = NO_BROWSER ? null : (process.env.CHROME_PATH || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : null));
const SKIP = NO_BROWSER ? "SKIP QA_NO_BROWSER=1 (no Chrome launch)" : (!(pp && CHROME) && "needs puppeteer-core + chrome");
/* a synthetic plaque: brown board with a green "ink" bar where the name sits (no real art) */
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) px(x, y).forEach((v, i) => { raw[y * (w * 4 + 1) + 1 + x * 4 + i] = v; }); }
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PLAQUE = png(240, 80, (x, y) => (x > 50 && x < 190 && y > 28 && y < 52 ? [20, 220, 40, 255] : [107, 74, 42, 255]));
const KIDS = ["ainsley", "hayes", "harris"], NAMES = KIDS.flatMap((k) => [`signs/plaque-${k}-v2-hang.png`, `signs/plaque-${k}-v2-hang-phone@3x.png`]);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".jpg": "image/jpeg" };
async function serveLH(st) {
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "");
    const json = (o) => { r.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); r.end(JSON.stringify(o)); };
    if (rel === "night/media/caps.json") return json({ video: false, artH: NAMES.map(artKey) });
    if (rel.startsWith("night/media/art/halloween/")) { if (!NAMES.includes(rel.slice(26))) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }); return r.end(PLAQUE); }
    if (rel === "data/cal-live.json" || rel === "data/cal-live.raw.json") return json(st.cal);
    if (rel === "api/private/cal-live.json") return json(st.cal);   /* private-feed.js routes data/cal-live.json to the hub (pfBase = this loopback server) */
    if (rel.startsWith("api/private/")) { r.writeHead(404); return r.end(); }
    if (rel.startsWith("data/") || rel === "kids-week.json" || rel.startsWith("night/media/")) { r.writeHead(404); return r.end(); }
    const f = path.join(ROOT, path.normalize(rel || "index.html").replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); r.end(b); });
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); return { srv, base: "http://127.0.0.1:" + srv.address().port };
}
/* the hcount fixture plus one synthetic Hayes row on the clock day, so Hayes's plaque is "today" */
const withKid = (cal, day) => ({ ...cal, status: "live", fetchedAt: new Date().toISOString(),
  upcomingLeaves: [...(cal.upcomingLeaves || cal.events || []), { id: "fx-hayes", summary: "Hayes soccer", start: day + "T16:00:00-05:00", end: day + "T17:00:00-05:00", allDay: false, location: "" }] });
async function openLH(b, base, iso, w, h) {
  const g = await b.newPage(); await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]); await g.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await g.evaluateOnNewDocument(() => { try { localStorage.setItem("wardos-private-feed-token", "test-token-0123456789abcdef"); } catch (e) {} });
  await g.evaluateOnNewDocument((h) => { let v; Object.defineProperty(window, "LHScenePacks", { configurable: true, get: () => v, set: (x) => { if (x && x.SHOW) x.SHOW.idH = h; v = x; } }); }, FX_IDH);
  await g.goto(`${base}/livinghouse/index.html?now=${encodeURIComponent(iso)}&freeze=1&spook=0&pfBase=${encodeURIComponent(base)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await g.waitForFunction(() => document.fonts.status === "loaded" && [...document.querySelectorAll(".lh-kw .name")].every((el) => el.hasAttribute("data-asset-baked")), { timeout: 60000 });
  await new Promise((ok) => setTimeout(ok, 1800)); return g;
}
const COUNT = () => { const c = document.getElementById("lh-count"), w = c.querySelector("[data-lh=when]");
  return { hidden: c.hidden, n: c.querySelector("[data-lh=count]").textContent, when: w && !w.hidden && getComputedStyle(w).display !== "none" ? w.textContent : "", via: c.getAttribute("data-via"), aria: c.getAttribute("aria-label") || "", pumpkins: c.querySelectorAll(".pumpkin").length, lit: c.querySelectorAll(".pumpkin.lit").length, anim: c.querySelector(".pumpkin") ? getComputedStyle(c.querySelector(".pumpkin")).animationName : "" }; };

test("H1P2D3 browser P1 PIXEL: a today kid's name ink shows through on the 1920 and 2560 wall plaques (dot kept)", { skip: SKIP, timeout: 240000 }, async () => {
  const st = { cal: withKid(FXH("present"), "2026-10-24") }, { srv, base } = await serveLH(st), b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  try {
    for (const [w, h] of [[1920, 1080], [2560, 1440]]) {
      const g = await openLH(b, base, "2026-10-24T15:00:00-05:00", w, h);
      await g.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }" });
      const r = await g.evaluate(() => [...document.querySelectorAll(".lh-kw .name")].map((el) => { const bx = el.getBoundingClientRect(), a = getComputedStyle(el, "::after");
        return { kid: el.dataset.kid, today: el.classList.contains("today"), baked: el.hasAttribute("data-asset-baked"), dot: a.content !== "none" && a.backgroundColor !== "rgba(0, 0, 0, 0)", box: { x: bx.x, y: bx.y, width: bx.width, height: bx.height } }; }));
      const hy = r.find((x) => x.kid === "hayes"); assert.ok(hy.today, `${w}: Hayes is today`); assert.ok(hy.baked, `${w}: baked plaque`); assert.ok(hy.dot, `${w}: the warm dot stays`);
      for (const x of r) {
        const buf = Buffer.from(await g.screenshot({ clip: { x: Math.max(0, x.box.x), y: Math.max(0, x.box.y), width: Math.max(1, x.box.width), height: Math.max(1, x.box.height) } }));
        const ink = await g.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const t = c.getContext("2d"); t.drawImage(i, 0, 0);
          const d = t.getImageData(0, 0, i.width, i.height).data; let k = 0; for (let j = 0; j < d.length; j += 4) if (d[j + 1] > 140 && d[j] < 110 && d[j + 2] < 110) k++; ok(k); }; i.src = u; }), "data:image/png;base64," + buf.toString("base64"));
        console.log(`# H1P2D3 ${w} ${x.kid} today=${x.today} ink px=${ink}`);
        assert.ok(ink > 150, `${w} ${x.kid} (today=${x.today}): the plaque's name ink is painted (${ink} px)`);
      }
      await g.close();
    }
  } finally { await b.close(); srv.close(); }
});

test("H1P2D3 browser HCOUNT1: the wall count reads 5 + Thu 5:00 PM (event), 5 (fallback), Tonight 5:00 PM on the day", { skip: SKIP, timeout: 240000 }, async () => {
  const st = { cal: null }, { srv, base } = await serveLH(st), b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const NB = "\u00a0";
  try {
    const run = async (fx, iso, w = 1920, h = 1080) => { st.cal = withKid(FXH(fx), iso.slice(0, 10)); const g = await openLH(b, base, iso, w, h); const c = await g.evaluate(COUNT); await g.close(); return c; };
    let c = await run("present", "2026-10-24T15:00:00-05:00");
    assert.deepEqual([c.hidden, c.n, c.when, c.via, c.pumpkins], [false, "5", `Thu 5:00${NB}PM`, "id", 5]); assert.equal(c.aria, `5 days to Halloween night, Thursday 5:00${NB}PM`);
    assert.equal(c.anim, "none", "reduced motion: the embers are still");
    c = await run("absent", "2026-10-24T15:00:00-05:00"); assert.deepEqual([c.hidden, c.n, c.when, c.via], [false, "5", "", "date"]);
    c = await run("present", "2026-10-29T12:00:00-05:00"); assert.deepEqual([c.n, c.pumpkins, c.lit, c.when], [`Tonight 5:00${NB}PM`, 1, 1, ""]);
    c = await run("present", "2026-10-29T17:30:00-05:00"); assert.equal(c.n, "Time to go!");
    c = await run("absent", "2026-10-29T12:00:00-05:00"); assert.equal(c.n, "Tonight");
    c = await run("present", "2026-10-29T20:30:00-05:00"); assert.equal(c.hidden, true);
    c = await run("present", "2026-10-24T15:00:00-05:00", 440, 956); assert.deepEqual([c.hidden, c.n, c.when], [false, "5", ""], "the phone keeps its footprint: digits only");
    for (const s of [c.n, c.when, c.aria]) assert.doesNotMatch(s, BAD_TIME);
  } finally { await b.close(); srv.close(); }
});

/* P2: tiles at wall widths, with worst-case faces as house-kid-engage paintFace and the tiles-bind Dad seat render them */
test("H1P2D3 browser P2 OVERFLOW: 0 clipped or covered tile text at 1920 and 2560 on index.html and sheet-index.html", { skip: SKIP, timeout: 300000 }, async () => {
  const PRIV = fs.mkdtempSync(path.join(os.homedir(), "h1p2d3-priv-")), FX = path.join(ROOT, "scripts/qa/fixtures/private");
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
  const b = await pp.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  try {
    for (const pg of ["index.html", "sheet-index.html"]) for (const w of [1920, 2560]) {
      const g = await b.newPage(); await g.setViewport({ width: w, height: Math.round(w * 9 / 16), deviceScaleFactor: 1 }); await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await g.evaluateOnNewDocument((t) => { try { localStorage.setItem("wardos-private-feed-token", t); } catch (e) {} }, TOKEN);
      await g.goto(`${base}/${pg}?spook=0&pfBase=${encodeURIComponent(base)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await g.waitForFunction(() => document.querySelectorAll(".tile .kf-stage").length >= 4, { timeout: 60000 }); await new Promise((ok) => setTimeout(ok, 4000));
      await g.evaluate(() => {
        const rows = (a) => '<div class="kf-rows">' + a.map(([m, t]) => '<div class="kf-row"><span class="kf-mt">' + m + '</span><span class="kf-md">' + t + "</span></div>").join("") + "</div>";
        const face = (k, l, t, r) => '<div class="kf-face kf-day"><div class="kf-kicker">' + k + '</div><div class="kf-loud">' + l + '</div><div class="kf-title">' + t + "</div>" + (r ? rows(r) : "") + "</div>";
        const F = { ainsley: face("Next", "TUE", "Library day with the class", [["3:00", "Art club"]]), hayes: face("Today", "SAT · 3:15", "Jones 9th birthday party · 4:00", [["5:30", "Pumpkin patch"]]),
          harris: face("Today", "SAT · 12:40", "Harris flag · vs Smith (home) · arrive 1:00 · game 1:30", [["4:00", "Costume parade"]]),
          dan: face("Next leave", "TODAY · 12:40", "Harris flag · vs Smith (home) · arrive 1:00", [["3:15", "Hayes · Jones 9th birthday party · 4:00"], ["5:30", "Pumpkin patch"]]) };
        for (const k in F) { const s = document.querySelector(".tile." + k + " .kf-stage"); if (s) s.innerHTML = F[k]; }
        document.querySelectorAll(".kf-streak-chip").forEach((c) => { c.textContent = "3 day streak"; });
      });
      await new Promise((ok) => setTimeout(ok, 800));
      const r = await g.evaluate(() => {
        const vis = (e) => { const s = getComputedStyle(e); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0; };
        const nm = (e) => e.tagName.toLowerCase() + "." + String(e.className || "").trim().split(/\s+/).slice(0, 2).join(".");
        const ov = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const bad = [];
        for (const t of document.querySelectorAll(".tile-grid > .tile")) { if (!vis(t)) continue; const tb = t.getBoundingClientRect(); if (tb.width < 1) continue;
          const blk = [...t.querySelectorAll(".tile-foot, .kf-streak-chip, .kf-xp")].filter(vis).map((x) => [x, x.getBoundingClientRect()]);
          const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
          for (let n; (n = tw.nextNode());) { if (!n.textContent.trim()) continue; const e = n.parentElement; if (!vis(e)) continue; const rg = document.createRange(); rg.selectNodeContents(n);
            for (const b of rg.getClientRects()) { if (b.width < 1) continue;
              if (Math.max(b.right - tb.right, tb.left - b.left, b.bottom - tb.bottom, tb.top - b.top) > 1) bad.push("outside " + nm(t) + " " + n.textContent.trim().slice(0, 40));
              for (const [x, xb] of blk) if (!x.contains(e) && !e.contains(x) && ov(b, xb)) bad.push("under " + nm(x) + " in " + nm(t) + " " + n.textContent.trim().slice(0, 40));
              for (let a = e; a && a !== t.parentElement; a = a.parentElement) { const s = getComputedStyle(a); if (!/hidden|clip/.test(s.overflowX + s.overflowY)) continue; const ab = a.getBoundingClientRect();
                if (Math.max(b.bottom - ab.bottom, ab.top - b.top) > 1 && /hidden|clip/.test(s.overflowY)) { bad.push("clipped by " + nm(a) + " " + n.textContent.trim().slice(0, 40)); break; } } } } }
        const gw = document.querySelector(".grid-wrap"), de = document.documentElement;
        if (gw && gw.scrollHeight > gw.clientHeight + 2) bad.push("grid-wrap scrolls " + (gw.scrollHeight - gw.clientHeight));
        if (de.scrollWidth > de.clientWidth + 1) bad.push("hscroll");
        const floor = [...document.querySelectorAll(".tile .kf-loud, .tile .kf-title, .tile .tile-fact")].filter(vis).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((px) => px < 14);
        return { bad, floor, page: location.pathname, tiles: document.querySelectorAll(".tile-grid > .tile").length };
      });
      console.log(`# H1P2D3 ${pg}@${w} (${r.page}) tiles=${r.tiles} overflows=${r.bad.length}`);
      assert.ok(r.tiles >= 9, pg); assert.deepEqual(r.bad, [], `${pg}@${w}`); assert.deepEqual(r.floor, [], `${pg}@${w}: 14 px floor`);
      await g.close();
    }
  } finally { await b.close(); srv.close(); fs.rmSync(PRIV, { recursive: true, force: true }); }
});
