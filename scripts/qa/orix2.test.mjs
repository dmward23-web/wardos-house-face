/* ORIX2 · Ori P2 extras r3 wire gate (Alfred 2026-10-28 7:15 PM CT conditions, r3 delta 7:24 PM CT). Static, node:vm, no
   browser, against the REAL tree: the committed r3 art under art/mercury/skins/2026-11/extras/ and the real registry.
   1. Ainsley: 0 pebble draws, 0 pebble requests, 0 pebble boxes, 0 counts; her row is hidden and her progress shows only
      through creature state (shine, rim, grow ripple).
   2. 0 "$" or bare money anywhere a kid can reach: DOM html + text (hidden nodes too), every textContent / innerHTML /
      attribute write, canvas text, localStorage and sessionStorage writes (transient ones included).
   3. 0 references to fx.json notWired names (pebble-today, drop-1..4, grow-cream) in code, requests or committed art,
      and no theme selection (no ?theme=, no data-theme read). fx/fx.json is carried byte for byte (sha256 6e2f10d7...),
      so its own notWired list is the one place those names appear, as data that names what is NOT wired.
   Plus: pebbles stay away from the jar and money copy (canvas only, no DOM node, no shared code), sweep-happy over the
   happy pose, the README draw order, and pebbles for Hayes and Harris only. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ROOT, fullDays } from "./ori1-harness.mjs";

const NOV4 = "2026-11-04T13:00:00Z"; /* Wed Nov 4, 7:00 AM CT: Mon + Tue filled */
const X = "art/mercury/skins/2026-11/extras/";
const KIDS = ["hayes", "harris", "ainsley"];
const NOTWIRED = /pebble-today|\bdrop-\d|grow-cream|cream/i;
const THEMESEL = /[?&]theme=|data-theme|get\(\s*["']theme["']\s*\)/;
const MONEY = /\$|\bUSD\b|\u00a2|\b\d+(?:\.\d{1,2})?\s*(?:dollars?|bucks|cents?)\b|(?:^|[^\w.#-])\d+\.\d{2}(?![\w%.])/i;
const J = (v) => JSON.parse(JSON.stringify(v));
const xReqs = (h) => [...h.log.images, ...h.log.fetches].map(String).filter((u) => u.includes(X));
const allReqs = (h) => [...h.log.images, ...h.log.fetches].map(String);
const stripTags = (s) => String(s).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ");

async function play(kid, opts = {}) {
  const checks = Object.assign({}, fullDays(kid, ["2026-11-02", "2026-11-03"]));
  const h = boot(Object.assign({ kid, at: NOV4, dpr: 1, checks }, opts, { query: "orix=1" + (opts.query ? "&" + opts.query : "") })); /* switch ON */
  if (opts.theme) h.ctx.document.documentElement.setAttribute("data-theme", opts.theme);
  await h.flush(); h.ready();
  const seen = new Set(), peb = [];
  const step = async (n) => { for (let i = 0; i < n; i++) { h.advance(16); if (i % 4 === 0) await h.flush(1); const x = h.ctx.MercuryRun.extras(); if (x) x.order.forEach((o) => seen.add(o)); peb.push(...J(h.ctx.__mercPebbles())); } };
  await step(60);
  h.ctx.__mercFillTest(kid); await step(80);           /* a grow pulse: sweep / sweep-happy + grove ripple */
  h.pointer("pointerdown", 0, 200); await step(160); h.pointer("pointerup", 0, 200); await step(40); /* a fall: splash */
  return { h, seen, peb };
}
function moneyHits(h) {
  const hits = [];
  const chk = (where, s) => { if (MONEY.test(s)) hits.push(`${where}: ${String(s).slice(0, 120)}`); };
  chk("dom-text", stripTags(h.texts()));
  if (/\$/.test(h.texts())) hits.push("dom-html has $");
  for (const [k, v] of h.log.writes) {
    if (k === "innerHTML") { chk(k, stripTags(v)); if (/\$/.test(v)) hits.push("innerHTML raw $"); }
    else if (/Storage$/.test(k)) { if (/\$/.test(v)) hits.push(`${k} $`); chk(k, String(v).replace(/"[\w:.-]*":/g, " ")); }
    else chk(k, v);
  }
  for (const [k, v] of Object.entries(h.map)) if (/\$/.test(k + v)) hits.push(`storage ${k}`);
  return hits;
}

const runs = {};
async function get(kid, opts, key) { key = key || kid + JSON.stringify(opts || {}); return (runs[key] = runs[key] || await play(kid, opts)); }

test("r3 art in the tree is byte for byte the Alfred-checked drop: fx/fx.json sha256 6e2f10d7442dcf77..., every copied file in the r3 SUMS", () => {
  const fj = fs.readFileSync(path.join(ROOT, X, "fx/fx.json"));
  assert.equal(crypto.createHash("sha256").update(fj).digest("hex").slice(0, 16), "6e2f10d7442dcf77");
  const nw = JSON.parse(fj).notWired;
  assert.deepEqual([...nw].sort(), ["drop-1", "drop-2", "drop-3", "drop-4", "grow-cream-1", "grow-cream-2", "grow-cream-3", "grow-cream-4", "grow-cream-5", "grow-cream-6", "grow-cream-sheet", "pebble-today-1", "pebble-today-2", "pebble-today-3"]);
  for (const kid of KIDS) for (const s of ["1x", "2x", "3x"]) {
    const n = fs.readdirSync(path.join(ROOT, X, kid, s)).filter((f) => f.endsWith(".png"));
    assert.equal(n.length, 46, `${kid}/${s}: 46 layers`);
    for (const i of [1, 2, 3, 4, 5, 6]) assert.ok(n.includes(`sweep-happy-${i}.png`));
  }
});

test("ASSERT 1 · Ainsley: 0 pebble draws, 0 pebble requests, 0 pebble boxes, 0 counts; her progress shows only through creature state", async () => {
  const { h, seen, peb } = await get("ainsley");
  assert.equal(h.skin().hero, "art");
  assert.deepEqual(J(h.ctx.MercuryRun.extras().pebblesHidden), ["ainsley"]);
  const pebDraws = h.log.ops.filter(([u]) => /pebble/.test(u)).length + [...seen].filter((o) => /pebble/.test(o)).length;
  assert.equal(pebDraws, 0, "0 pebble draws");
  assert.deepEqual(allReqs(h).filter((u) => /pebble/.test(u)), [], "0 pebble requests");
  assert.deepEqual(peb.filter((p) => p.kid === "ainsley"), [], "0 pebble boxes painted for her");
  assert.doesNotMatch(h.texts(), /pebble/i, "0 pebble DOM nodes");
  assert.doesNotMatch(stripTags(h.texts()), /\d|\u2605|\u2606|\u2b50|\bstars?\b|\bpoints?\b/i, "0 counts, digits or stars in her kid-facing text");
  for (const [k, v] of h.log.writes) if (k === "textContent" || k === "fillText") assert.doesNotMatch(v, /\d|\bstars?\b/i, `no count written (${k}: ${v})`);
  assert.equal(h.merc()[0].lit, 3, "she still grows: Mon + Tue + the grow pulse");
  for (const k of ["shine", "rim"]) assert.ok(seen.has(k), `${k} drawn for her`);
  assert.ok([...seen].some((o) => /^grow-\d$/.test(o)), "grove grow ripple drawn for her");
});

test("ASSERT 1 control · Hayes and Harris do get the matte amber pebbles (filled = lit), drawn source-over, never screen / lighter", async () => {
  for (const kid of ["hayes", "harris"]) {
    const { h, peb } = await get(kid);
    const m = h.merc()[0];
    assert.ok(peb.some((p) => p.kid === kid), `${kid}: pebbles painted`);
    const ops = h.log.ops.filter(([u]) => /fx\/1x\/pebble-(filled|empty)\.png$/.test(u));
    assert.ok(ops.length > 0 && ops.every(([, op]) => op === "source-over"), `${kid}: matte (normal blend)`);
    assert.ok(m.lit >= 2);
  }
});

for (const kid of KIDS) {
  test(`ASSERT 2 · ${kid}: 0 "$" or bare money in DOM (hidden too), every write, canvas text and storage`, async () => {
    for (const opts of [{}, { query: "fixture=1" }]) {
      const { h } = await get(kid, opts);
      assert.ok(h.log.writes.length > 0, "writes were captured");
      assert.deepEqual(moneyHits(h), [], `${kid} ${JSON.stringify(opts)}`);
    }
  });
}

test("ASSERT 3 · 0 notWired references: code, requests (every kid, data-theme=cream and ?theme=cream too) and committed art", async () => {
  for (const f of ["mercury-run.js", "mercury-run.html", "mercury-run.css"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(src, NOTWIRED, `${f}: no notWired name`);
    assert.doesNotMatch(src, THEMESEL, `${f}: no theme selection`);
  }
  const files = []; const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.relative(ROOT, path.join(d, e.name))));
  walk(path.join(ROOT, X));
  assert.deepEqual(files.filter((f) => NOTWIRED.test(path.basename(f))), [], "no notWired art committed");
  assert.deepEqual(files.filter((f) => /sheet|\.webp$/.test(f)), [], "no sheets, no webp");
  const allow = fs.readFileSync(path.join(ROOT, "scripts/privacy-art-allowlist.txt"), "utf8").split("\n").filter((l) => !l.startsWith("#"));
  assert.deepEqual(allow.filter((l) => NOTWIRED.test(l)), [], "allow-list lists none");
  for (const kid of KIDS) for (const opts of [{}, { theme: "cream" }, { query: "theme=cream" }, { query: "fixture=1" }]) {
    const { h, seen } = await get(kid, opts);
    assert.deepEqual(allReqs(h).filter((u) => NOTWIRED.test(u)), [], `${kid} ${JSON.stringify(opts)}: requests`);
    assert.deepEqual([...seen].filter((o) => NOTWIRED.test(o)), [], `${kid} ${JSON.stringify(opts)}: draws`);
  }
});

test("pebbles keep away from the jar and money copy: canvas only (no DOM node), no shared code with the jar, and painted below the hero, never in the HUD band", async () => {
  const src = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");
  const pf = src.slice(src.indexOf("function paintFill"), src.indexOf("if (b.fillK > 0.01)", src.indexOf("function paintFill")));
  const ep = src.slice(src.indexOf("function exPebble"), src.indexOf("var EX_PEBBLE_PX"));
  for (const blk of [pf, ep]) assert.doesNotMatch(blk, /jar|JarEngine|\bje\b|money|cash|bank|\$|allowance|paid|fillText|innerHTML|textContent/i);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "jar-engine.js"), "utf8"), /pebble/i, "the jar never draws or knows a pebble");
  for (const kid of ["hayes", "harris"]) {
    const { h, peb } = await get(kid);
    assert.doesNotMatch(h.texts(), /pebble/i, "no pebble DOM node next to the jar");
    const hero = h.merc()[0];
    for (const p of peb.filter((q) => q.kid === kid).slice(-12)) assert.ok(p.y > 60, `pebble box top ${p.y} is under the HUD band`);
    assert.ok(hero.r > 0);
  }
});

test("sweep-happy-1..6 play over the happy pose only; sweep-1..6 over idle only; draw order shadow, body, eyes, shine, rim, then sweep / grow", async () => {
  const h = boot({ kid: "hayes", at: NOV4, dpr: 1, checks: fullDays("hayes", ["2026-11-02", "2026-11-03"]), query: "orix=1" });
  await h.flush(); h.ready(); for (let i = 0; i < 40; i++) { h.advance(16); await h.flush(1); }
  h.ctx.__mercFillTest("hayes");
  const frames = [];
  for (let i = 0; i < 90; i++) { h.advance(16); await h.flush(1); frames.push(J(h.ctx.MercuryRun.extras().order).filter((x) => !/^pebble/.test(x))); }
  const hap = frames.filter((o) => o.some((x) => /^sweep-happy-\d$/.test(x)));
  assert.ok(hap.length > 0, "sweep-happy drew during the grow pulse");
  for (const o of hap) assert.ok(o.includes("body:happy"), `${o}`);
  for (const o of frames.filter((o) => o.some((x) => /^sweep-\d$/.test(x)))) assert.ok(o.some((x) => /^body:(idle|breathe-)/.test(x)), `${o}`);
  const got = xReqs(h).map((u) => u.slice(u.lastIndexOf("/") + 1));
  for (let i = 1; i <= 6; i++) assert.ok(got.includes(`sweep-happy-${i}.png`));
  for (const o of frames) {
    const ix = (re) => o.findIndex((x) => re.test(x));
    const seq = [/^shadow$/, /^body:/, /^eyes$/, /^shine$/, /^rim$/].map(ix).filter((i) => i >= 0);
    assert.deepEqual(seq, [...seq].sort((a, b) => a - b), `${o}`);
    const sw = ix(/^sweep/), gr = ix(/^grow-/);
    if (sw >= 0) assert.ok(sw > ix(/^rim$/) || ix(/^rim$/) < 0);
    if (gr >= 0) assert.ok(gr > Math.max(ix(/^rim$/), sw));
  }
  h.log.ops.length = 0; h.ctx.__mercFillTest("hayes");
  for (let i = 0; i < 30; i++) { h.advance(16); await h.flush(1); }
  const op = (re) => (h.log.ops.find(([s]) => re.test(s)) || [])[1];
  assert.equal(op(/extras\/hayes\/1x\/shadow-/), "multiply");
  assert.equal(op(/extras\/hayes\/1x\/(shine|rim|sweep)/), "screen");
  assert.ok(["screen", "lighter"].includes(op(/extras\/fx\/1x\/grow-\d/)), "grow screen / lighter");
});
