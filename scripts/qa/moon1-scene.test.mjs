/* MOON1 · the board moon is that night's real moon. night/scene.html and wall.html carry the same inline MOON1 block (byte-identical):
   phase from the mean synodic month (ref new moon 2000-01-06 18:14Z, 29.530588853 d), illuminated fraction (1 - cos(2 pi age / P)) / 2,
   waxing lit on the right and waning on the left (northern hemisphere), and a SunCalc-style altitude so there is no moon before moonrise
   or after moonset over the Kansas City cell. bgCompose paints it over the night plate's baked disc, so the live scene and the still
   posters show the same moon. Static half always runs; the browser half needs puppeteer-core + chrome (skips cleanly otherwise). */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BEGIN = "// MOON1 · real moon (begin)", END = "// MOON1 · real moon (end)";
const block = (f) => { const s = read(f), i = s.indexOf(BEGIN), j = s.indexOf(END); assert.ok(i > 0 && j > i, f + ": MOON1 block"); return s.slice(i, j); };
const HOME = { lat: 38.9, lon: -94.7 };   /* the hub's coarse metro cell (one decimal), as in realmoon1; the pages carry no location */
const M = new Function("CELL", block("night/scene.html") + ";return MOON1")(HOME);
const ms = (d) => Date.parse(d), H = 36e5, ct = (t) => new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago" });

test("static: one MOON1 block, byte-identical in the scene and the wall, called from bgCompose and keyed into the plate signature", () => {
  assert.equal(block("night/scene.html"), block("wall.html"), "the moon helpers are the same bytes in both pages");
  for (const f of ["night/scene.html", "wall.html"]) { const s = read(f);
    assert.equal(s.split(BEGIN).length, 2, f + ": one block");
    assert.match(s, /const sig=vidOn\|\|fxOn\?null:\[MOON1\.key\(envNow\(\)\),W,H,/, f + ": a still plate is re-composited when the moon changes (minute tick)");
    assert.match(s, /try\{MOON1\.mask\(c,P,sx,sy,\(!sA\|\|va==='night'\?1:0\)\*\(1-\(sB2\?ph\.m:0\)\)\+\(sB2&&vb==='night'\?ph\.m:0\),envNow\(\)\)\}catch\(e\)\{\}/, f + ": masked by the night plate's weight only");
    assert.ok(!/gl=soft/.test(s.slice(s.indexOf(BEGIN), s.indexOf(END))), f + ": nothing about ?gl=soft in the moon"); }
});

test("phase: known full, new and first quarter", () => {
  const full = M.at(ms("2024-04-23T23:49:00Z")), nw = M.at(ms("2024-04-08T18:21:00Z")), fq = M.at(ms("2024-04-15T19:13:00Z"));
  assert.ok(full.fraction > 0.99, "full 2024-04-23 " + full.fraction);
  assert.ok(nw.fraction < 0.01, "new 2024-04-08 " + nw.fraction);
  assert.ok(Math.abs(fq.fraction - 0.5) < 0.08 && fq.waxing, "first quarter 2024-04-15 " + fq.fraction + " waxing " + fq.waxing);
  const lq = M.at(ms("2024-05-01T11:27:00Z")); assert.ok(Math.abs(lq.fraction - 0.5) < 0.08 && !lq.waxing, "last quarter 2024-05-01 " + lq.fraction);
  assert.ok(Math.abs(M.SYN - 29.530588853) < 1e-9);
});

test("today: Oct 25 2026 is computed (near full); the waxing side flips within a day of the full moon", () => {
  const t = ms("2026-10-26T04:00:00Z"), k = M.at(t);   /* 11 PM CDT Oct 25 */
  const age = (((t - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853;
  assert.ok(Math.abs(k.fraction - (1 - Math.cos(2 * Math.PI * age / 29.530588853)) / 2) < 1e-12, "the formula, not a literal");
  assert.ok(k.fraction > 0.99, "about full tonight " + k.fraction);
  let flip = null, w = M.at(ms("2026-10-25T05:00:00Z")).waxing; for (let x = ms("2026-10-25T05:00:00Z"); x < ms("2026-10-27T05:00:00Z"); x += 6e4) { const v = M.at(x).waxing; if (v !== w) { flip = x; break; } }
  assert.ok(flip && Math.abs(flip - ms("2026-10-26T04:12:00Z")) < 1 * H, "the mean full moon is within an hour of the true one (11:12 PM CDT): " + (flip && ct(flip)));
});

test("visibility: Thu Oct 29 2026 the moon is below the horizon 5 to 8 PM CT; rise and set are self-consistent", () => {
  for (let x = ms("2026-10-29T22:00:00Z"); x <= ms("2026-10-30T01:00:00Z"); x += 6e5) assert.equal(M.at(x).up, false, "down at " + ct(x));
  const r = M.times(ms("2026-10-29T05:00:00Z"), ms("2026-10-30T05:00:00Z"));
  assert.equal(r.rise.length, 1); assert.equal(r.set.length, 1);
  const rise = r.rise[0], set = r.set[0];
  assert.ok(rise > ms("2026-10-30T01:00:00Z") && rise < ms("2026-10-30T03:30:00Z"), "rise in the evening " + ct(rise));
  assert.equal(M.at(rise - 6e5).up, false); assert.equal(M.at(rise + 6e5).up, true); assert.equal(M.at(set - 6e5).up, true); assert.equal(M.at(set + 6e5).up, false);
  assert.ok(M.at(rise + 2 * H).alt > M.at(rise + 6e5).alt, "climbing after rise");
  /* cross-check against the repo's own Meeus-grade moon (livinghouse/moon-real.js, REALMOON1) over the same coarse cell */
  const RM = createRequire(import.meta.url)("../../livinghouse/moon-real.js"); const t = RM.times(new Date("2026-10-29T05:00:00Z"), HOME.lat, HOME.lon);
  assert.ok(Math.abs(rise - t.rise.getTime()) < 15 * 6e4, "rise within 15 min of REALMOON1: " + ct(rise) + " vs " + ct(t.rise));
  assert.ok(Math.abs(set - t.set.getTime()) < 15 * 6e4, "set within 15 min of REALMOON1: " + ct(set) + " vs " + ct(t.set));
  assert.equal(M.at(ms("2026-10-26T04:00:00Z")).up, true, "up at 11 PM Oct 25");
});

const NO_BROWSER = process.env.QA_NO_BROWSER === "1";   /* DAYPKG1 item 3 · QA_NO_BROWSER=1: puppeteer-core is never loaded and no Chrome path is resolved, so nothing below can launch */
let pp = null; if (!NO_BROWSER) for (const base of [import.meta.url, (process.env.WARDOS_DEPS || "/nonexistent") + "/", "/tmp/h1-deps/node_modules/", "/tmp/ori-qa/node_modules/"]) { try { pp = createRequire(base)("puppeteer-core"); break; } catch (_) {} }
const CHROME = NO_BROWSER ? null : (process.env.CHROME_PATH || ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].find((c) => fs.existsSync(c)) || null);
const SKIP = NO_BROWSER ? "SKIP QA_NO_BROWSER=1 (no Chrome launch)" : (!(pp && CHROME) && "needs puppeteer-core + chrome");
const CELLSET = (c) => { try { localStorage.setItem("wxsky", JSON.stringify(c)); } catch (e) {} };   /* what the hub's /wx reply leaves cached */
const CLOCK = (t0) => { const real = Date.now.bind(Date); window.__realNow = real; window.__clk = t0; window.__clkAt = real(); Date.now = () => window.__clk + (window.__realNow() - window.__clkAt); };
export const serve = async () => { const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(new URL(q.url, "http://x").pathname); if (rel === "/wx") { r.writeHead(404); r.end(); return; }
    const f = path.join(ROOT, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); r.end(b); }); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); return { srv, base: "http://127.0.0.1:" + srv.address().port }; };   /* loopback only */
/* mean luminance of the moon disc's left part, right part, and the sky ring beside it, read from a canvas (poster or the live GL) */
const DISC = (id) => { const cv = document.getElementById(id); let src = cv; if (id === "gl") { src = document.createElement("canvas"); src.width = cv.width; src.height = cv.height; src.getContext("2d").drawImage(cv, 0, 0); }
  const x = src.getContext("2d"), k = dpr, cx = k * (OX + P.moon[0] * S), cy = k * (OY + P.moon[1] * S), r = k * P.moon[2] * S, d = x.getImageData(0, 0, src.width, src.height).data, W = src.width;
  const L = (px, py) => { const i = (Math.round(py) * W + Math.round(px)) * 4; return .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]; };
  let l = 0, nl = 0, rr = 0, nr = 0, s = 0, ns = 0; for (let yy = -r; yy <= r; yy += 1) for (let xx = -r; xx <= r; xx += 1) { const q = Math.hypot(xx, yy) / r;
    if (q < .8 && xx < -.35 * r) { l += L(cx + xx, cy + yy); nl++; } if (q < .8 && xx > .35 * r) { rr += L(cx + xx, cy + yy); nr++; } }
  for (let a = 0; a < 6.28; a += .2) { s += L(cx + Math.cos(a) * r * 2.2, cy + Math.sin(a) * r * 2.2); ns++; }
  return { left: l / nl, right: rr / nr, sky: s / ns, last: MOON1.last, plate: window.__fb && __fb.plate }; };
const ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"];
const poster = async (b, base, t, w, h) => { const g = await b.newPage(); await g.setViewport({ width: w, height: h }); await g.evaluateOnNewDocument(CLOCK, t); await g.evaluateOnNewDocument(CELLSET, HOME);
  await g.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await g.goto(base + "/night/scene.html", { waitUntil: "load" });
  await g.waitForFunction(() => window.__fb && __fb.draws >= 1 && __fb.plate, { timeout: 30000, polling: 100 }); await new Promise((r) => setTimeout(r, 400)); return g; };

test("browser: the night poster shows the real moon: full and up at 11 PM Oct 25, lit on the right on the first quarter evening, none before Oct 29 moonrise, day plate untouched", { skip: SKIP, timeout: 180000 }, async () => {
  const { srv, base } = await serve(); const b = await pp.launch({ executablePath: CHROME, args: ARGS });
  try {
    const want = M.at(ms("2026-10-26T04:00:00Z"));
    let g = await poster(b, base, ms("2026-10-26T04:00:00Z"), 1280, 720); let d = await g.evaluate(DISC, "poster"); await g.close();
    assert.equal(d.plate, "night"); assert.ok(d.last && d.last.up && Math.abs(d.last.fraction - want.fraction) < 1e-3, "the page computed tonight's fraction " + JSON.stringify(d.last));
    assert.ok(d.left > d.sky + 40 && d.right > d.sky + 40, "about full: both halves lit " + JSON.stringify([d.left, d.right, d.sky]));
    const fq = M.at(ms("2026-10-19T02:30:00Z")); assert.ok(fq.up && fq.waxing && fq.fraction > .4 && fq.fraction < .75, "Oct 18 9:30 PM CDT is waxing near first quarter " + JSON.stringify(fq));
    g = await poster(b, base, ms("2026-10-19T02:30:00Z"), 1280, 720); d = await g.evaluate(DISC, "poster"); await g.close();
    assert.equal(d.plate, "night"); assert.ok(d.right > d.left + 40, "waxing: lit on the right " + JSON.stringify([d.left, d.right, d.sky]));
    assert.ok(Math.abs(d.left - d.sky) < 25, "the dark part is painted to the sky beside it " + JSON.stringify([d.left, d.sky]));
    g = await poster(b, base, ms("2026-10-30T01:15:00Z"), 1280, 720); d = await g.evaluate(DISC, "poster"); await g.close();
    assert.equal(d.plate, "night"); assert.equal(d.last.up, false); assert.ok(Math.abs(d.left - d.sky) < 25 && Math.abs(d.right - d.sky) < 25, "8:15 PM Oct 29 (night plate, before moonrise): no moon " + JSON.stringify([d.left, d.right, d.sky]));
    g = await poster(b, base, ms("2026-10-25T14:00:00Z"), 440, 956);
    const same = await g.evaluate(() => { const c = document.getElementById("poster"), x = c.getContext("2d"); fbDraw(); const a = x.getImageData(0, 0, c.width, c.height).data.slice();
      const keep = MOON1.mask; MOON1.mask = () => null; fbDraw(); const z = x.getImageData(0, 0, c.width, c.height).data; MOON1.mask = keep; let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== z[i]) diff++; return { diff, plate: __fb.plate, last: MOON1.last }; });
    await g.close(); assert.equal(same.plate, "day"); assert.equal(same.diff, 0, "the day plate is pixel-identical with and without the moon"); assert.equal(same.last, null, "no mask on the day plate");
  } finally { await b.close(); srv.close(); }
});

test("browser: the live scene (?gl=soft) and the poster show the same moon", { skip: SKIP, timeout: 180000 }, async () => {
  const { srv, base } = await serve(); const b = await pp.launch({ executablePath: CHROME, args: ARGS }); const T = ms("2026-10-19T02:30:00Z");
  try {
    let g = await poster(b, base, T, 1280, 720); const p = await g.evaluate(DISC, "poster"); await g.close();
    g = await b.newPage(); await g.setViewport({ width: 1280, height: 720 }); await g.evaluateOnNewDocument(CLOCK, T); await g.evaluateOnNewDocument(CELLSET, HOME);
    await g.goto(base + "/night/scene.html?gl=soft", { waitUntil: "load" });
    await g.waitForFunction(() => { try { return MOON1.last && document.documentElement.getAttribute("data-scene-mode") !== "poster"; } catch (e) { return false; } }, { timeout: 60000, polling: 250 });
    await new Promise((r) => setTimeout(r, 1500)); const l = await g.evaluate(DISC, "gl"); await g.close();
    assert.ok(Math.abs(l.last.fraction - p.last.fraction) < 1e-4, "same fraction live and poster"); assert.equal(l.last.waxing, p.last.waxing); assert.equal(l.last.up, p.last.up);
    assert.ok(l.right > l.left + 30, "live: lit on the right " + JSON.stringify([l.left, l.right, l.sky]));
    assert.ok(Math.sign(l.right - l.left) === Math.sign(p.right - p.left), "same side live and poster");
  } finally { await b.close(); srv.close(); }
});
