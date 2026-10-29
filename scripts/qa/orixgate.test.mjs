/* ORIXON1 · Dan's yes (2026-10-28 8:29 PM CT): the r3 extras layer is ON BY DEFAULT for a skin worn by date, so November's
   extras start with the turkey, Sun Nov 1 6:00 AM CT, and never before. ?orix=1 forces them on (preview, e.g. with
   ?skin=turkey before Nov 1); ?orix=0 forces them off. URL only, read on every load, never stored: no storage, no cookie,
   no IndexedDB, no link carries it. (ORIX2 r2 had them preview-only behind ?orix=1.) node:vm, no browser, against the
   real tree and its committed r3 art. */
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ROOT, fullDays } from "./ori1-harness.mjs";

const X = "art/mercury/skins/2026-11/extras/";
const KIDS = ["hayes", "harris", "ainsley"];
const AFTER = { "Sun Nov 1 6:00 AM CT": "2026-11-01T12:00:00Z", "Sun Nov 1 7:00 AM CT": "2026-11-01T13:00:00Z", "Wed Nov 4 7:00 AM CT": "2026-11-04T13:00:00Z", "Mon Nov 30 8:00 PM CT": "2026-12-01T02:00:00Z" };
const BEFORE = { "Wed Oct 28 7:40 PM CT": "2026-10-29T00:40:00Z", "Sat Oct 31 8:00 PM CT": "2026-11-01T01:00:00Z", "Sun Nov 1 5:59 AM CT": "2026-11-01T11:59:00Z" };
const J = (v) => JSON.parse(JSON.stringify(v));
const reqs = (h) => [...h.log.images, ...h.log.fetches].map(String);
const xReqs = (h) => reqs(h).filter((u) => u.includes("/extras/"));
const SRC = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8");

async function play(kid, at, query) {
  const days = at < "2026-11-01" ? ["2026-10-26", "2026-10-27"] : ["2026-11-02", "2026-11-03"];
  const h = boot({ kid, at, dpr: 1, checks: fullDays(kid, days), query: query || "" });
  await h.flush(); h.ready();
  const step = async (n) => { for (let i = 0; i < n; i++) { h.advance(16); if (i % 4 === 0) await h.flush(1); } };
  await step(60);
  h.ctx.__mercFillTest(kid); await step(80);                                  /* a grow pulse: where sweep / grow would fetch */
  h.pointer("pointerdown", 0, 200); await step(160); h.pointer("pointerup", 0, 200); await step(40); /* a fall: splash */
  return h;
}
function noExtras(h, label) {
  assert.deepEqual(xReqs(h), [], `${label}: 0 extras requests`);
  assert.equal(h.ctx.MercuryRun.extras(), null, `${label}: no extras layer`);
  assert.deepEqual(h.log.drawn.map(String).filter((u) => u.includes("/extras/")), [], `${label}: 0 extras draws`);
  assert.doesNotMatch(h.texts(), /extras|orix/i, `${label}: 0 extras nodes in the DOM`);
  assert.deepEqual(h.log.writes.filter(([, v]) => /extras|orix/i.test(String(v))), [], `${label}: 0 extras writes`);
}

function allAsserts(h, kid, label) {
  const x = J(h.ctx.MercuryRun.extras());
  assert.ok(x && x.anchors === "ok" && x.fx === "ok", `${label}: extras layer loaded`);
  assert.ok(xReqs(h).length > 0 && xReqs(h).every((u) => u.startsWith(X + kid + "/") || u.startsWith(X + "fx/")), `${label}: host kid + fx extras requested`);
  assert.ok(h.log.drawn.map(String).some((u) => /\/extras\/\w+\/1x\/(shine|rim)-/.test(u)), `${label}: shine / rim drawn`);
  assert.deepEqual(reqs(h).filter((u) => /pebble-today|\bdrop-\d|grow-cream|cream|\.webp|sheet/i.test(u)), [], `${label}: 0 notWired requests`);
  const all = [h.texts(), ...h.log.writes.map(([, v]) => String(v)), ...Object.entries(h.map).map((e) => e.join("="))].join("\n");
  assert.doesNotMatch(all, /\$|\b\d+(\.\d{1,2})?\s*(dollars?|bucks|cents?)\b/i, `${label}: 0 '$' or bare money`);
  const peb = J(h.ctx.__mercPebbles());
  if (kid === "ainsley") {
    assert.deepEqual(x.pebblesHidden, ["ainsley"]);
    assert.equal(peb.length, 0, `${label}: 0 pebble boxes`);
    assert.deepEqual(reqs(h).filter((u) => /pebble/.test(u)), [], `${label}: 0 pebble requests`);
    assert.deepEqual(h.log.drawn.map(String).filter((u) => /pebble/.test(u)), [], `${label}: 0 pebble draws`);
    assert.doesNotMatch(h.texts().replace(/<[^>]*>/g, " "), /\d|\u2605|\u2606|stars?\b|points?\b/i, `${label}: 0 digits / counts / stars`);
  } else {
    for (const p of peb) assert.ok(p.y > 60, `${label}: pebble below the HUD band`);
  }
}

test("(1) no switch, Sun Nov 1 6:00 / 7:00 AM CT and later: turkey worn AND extras PRESENT by default, every Alfred assert, every kid", async () => {
  for (const [when, at] of Object.entries(AFTER)) for (const kid of KIDS) for (const q of ["", "fixture=1", "orix=true", "orix=yes"]) {
    const h = await play(kid, at, q), label = `${kid} ${when} ?${q}`;
    const s = h.skin();
    assert.deepEqual([s.month, s.id, s.hero], ["2026-11", "turkey", "art"], `${label}: turkey skin present and worn`);
    allAsserts(h, kid, label);
  }
});

test("(1c) ?orix=0 forces the extras off from Nov 1 on (QA compare): turkey worn, 0 extras", async () => {
  for (const [when, at] of Object.entries(AFTER)) for (const kid of KIDS) {
    const h = await play(kid, at, "orix=0&fixture=1"), label = `${kid} ${when} ?orix=0`;
    assert.deepEqual([h.skin().id, h.skin().hero], ["turkey", "art"], `${label}: turkey worn`);
    noExtras(h, label);
  }
});

test("(2) no switch, before Nov 1 (and 5:59 AM CT Nov 1): October skin, 0 extras; a ?skin=turkey preview of a month not yet reached is still extras-free", async () => {
  for (const [when, at] of Object.entries(BEFORE)) for (const kid of KIDS) {
    const h = await play(kid, at, "");
    assert.deepEqual([h.skin().month, h.skin().id], ["2026-10", "pumpkin"], `${kid} ${when}: October skin`);
    noExtras(h, `${kid} ${when}`);
    const t = await play(kid, at, "skin=turkey&fixture=1");
    assert.deepEqual([t.skin().id, t.skin().hero], ["turkey", "art"], `${kid} ${when} ?skin=turkey: turkey worn`);
    noExtras(t, `${kid} ${when} ?skin=turkey`);
  }
});

test("(3) ?orix=1 preview override: before Nov 1 with ?skin=turkey, and on Nov 1 7:00 AM CT: extras present, every Alfred assert", async () => {
  for (const kid of KIDS) for (const [at, q] of [[BEFORE["Wed Oct 28 7:40 PM CT"], "skin=turkey&orix=1"], [BEFORE["Sun Nov 1 5:59 AM CT"], "skin=turkey&orix=1&fixture=1"], [AFTER["Sun Nov 1 7:00 AM CT"], "orix=1&fixture=1"]]) {
    const h = await play(kid, at, q);
    allAsserts(h, kid, `${kid} ${at} ?${q}`);
  }
});

test("(4) the default and the switch never persist: 0 storage, cookie or IndexedDB writes; one flag; the override is read from the URL only", async () => {
  for (const kid of KIDS) {
    const sw = (r) => r.log.writes.filter(([k]) => /Storage$|^cookie$|^indexedDB$/.test(k));
    const h = await play(kid, AFTER["Sun Nov 1 7:00 AM CT"], "fixture=1");            /* default on, by date */
    const off = await play(kid, AFTER["Sun Nov 1 7:00 AM CT"], "orix=0&fixture=1");   /* forced off */
    const on = await play(kid, AFTER["Sun Nov 1 7:00 AM CT"], "orix=1&fixture=1");    /* forced on */
    assert.ok(h.ctx.MercuryRun.extras() && !off.ctx.MercuryRun.extras() && on.ctx.MercuryRun.extras(), `${kid}: default on, orix=0 off, orix=1 on`);
    assert.deepEqual(J(sw(on)), J(sw(off)), `${kid}: forced on writes exactly what forced off writes`);
    assert.deepEqual(h.log.writes.filter(([k]) => k === "cookie"), [], `${kid}: 0 cookie writes`);
    assert.deepEqual(h.log.writes.filter(([k]) => k === "indexedDB"), [], `${kid}: 0 IndexedDB opens or writes`);
    assert.deepEqual(h.log.nav.filter(([, u]) => /orix/i.test(u)), [], `${kid}: the URL is never rewritten to carry or drop the switch`);
    const hrefs = (h.texts().match(/href="[^"]*"/g) || []);
    assert.ok(hrefs.length > 0, `${kid}: the run's links were read`);
    assert.deepEqual(hrefs.filter((x) => /orix/i.test(x)), [], `${kid}: no link on the run carries the switch`);
    assert.deepEqual(sw(h).filter(([, v]) => /orix|extras|preview/i.test(v)), [], `${kid}: no switch in storage`);
    assert.deepEqual(J(sw(h)), J(sw(off)), `${kid}: default on writes exactly what forced off writes`);
    assert.deepEqual(Object.keys(h.map).filter((k) => /orix|extras|preview/i.test(k + h.map[k])), [], `${kid}: storage holds no switch`);
  }
  assert.equal((SRC.match(/^\s*var ORIX_EXTRAS_LIVE = true;/gm) || []).length, 1, "one flag, on (Dan's yes)");
  assert.equal((SRC.match(/ORIX_Q\b/g) || []).length, 3, "ORIX_Q: read once from the URL, used twice in orixOn");
  assert.match(SRC, /var ORIX_Q = q\.get\("orix"\);/, "the override is read from the URL query only");
  assert.equal((SRC.match(/orixOn\(/g) || []).length, 2, "orixOn: defined once, called once (exOn)");
  assert.match(SRC, /function orixOn\(s\) \{ return ORIX_Q === "1" \|\| \(ORIX_Q !== "0" && ORIX_EXTRAS_LIVE && !!s && s\.month === skinMonthFor\(ctNow\(\)\)\); \}/, "by date: the worn month must be the clock's month");
  assert.doesNotMatch(SRC, /\.cookie\b|cookieStore/, "mercury-run.js never touches cookies");
  assert.doesNotMatch(SRC, /(setItem|\.cookie)[^\n]*(orix|ORIX)|(orix|ORIX)[^\n]*(setItem|\.cookie)/, "the switch is never written");
});

/* (1b) grep: the switch name lives in mercury-run.js's one URL read and nowhere else that ships. No kid-nav, wall, board, hub or
   data file links to, builds or stores ?orix=1 (scans every non-test text file of the tree under test). */
test("(1b) grep: no kid-nav, wall or board link (or any shipped file) carries the switch; mercury-run.js reads it once", () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (/^(\.git|node_modules|art|fixtures)$/.test(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (path.relative(ROOT, f) !== path.join("scripts", "qa")) walk(f); }
    else if (/\.(html?|js|mjs|cjs|json|css|md|txt|sh|py|webmanifest)$/.test(e.name)) files.push(f);
  } };
  walk(ROOT);
  assert.ok(files.some((f) => /kid-world\.js$/.test(f)) || !fs.existsSync(path.join(ROOT, "kid-world.js")), "kid nav scanned");
  const hits = [];
  for (const f of files) fs.readFileSync(f, "utf8").split("\n").forEach((ln, i) => { if (/[?&]orix=|["'`]orix["'`]|orix=1/i.test(ln)) hits.push(path.relative(ROOT, f) + ":" + (i + 1)); });
  const mr = fs.readFileSync(path.join(ROOT, "mercury-run.js"), "utf8").split("\n");
  const c0 = mr.findIndex((ln) => /\/\* ORIXON1 · Dan's yes/.test(ln)), c1 = mr.findIndex((ln, i) => i >= c0 && /\*\/\s*$/.test(ln));
  const allowed = mr.map((ln, i) => ((i >= c0 && i <= c1 && c0 >= 0) || /^\s*var ORIX_Q = q\.get\("orix"\);/.test(ln) ? "mercury-run.js:" + (i + 1) : null)).filter(Boolean);
  assert.ok(c0 >= 0 && c1 - c0 < 8, "the ORIXON1 comment block");
  assert.ok(hits.includes("mercury-run.js:" + (mr.findIndex((ln) => /var ORIX_Q = q\.get\("orix"\);/.test(ln)) + 1)), "the one URL read is seen by the scan");
  assert.deepEqual(hits.filter((x) => !allowed.includes(x)), [], "no other file names the switch");
  for (const f of files.filter((f) => /\.(html?|js)$/.test(f))) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /indexedDB\s*\.\s*open[^\n]*orix|cookieStore[^\n]*orix/i, `${path.relative(ROOT, f)}: no switch persistence`);
});
