/* ORIX2 · preview switch (Atlas ruling 2026-10-28 7:38 PM CT): the r3 extras layer is PREVIEW ONLY until Dan's own yes.
   Extras draw only when this load's URL carries ?orix=1 (one flag, ORIX_EXTRAS_LIVE = false in mercury-run.js; Dan's yes
   flips that one line). Without it every date renders the month skin alone; the November turkey still flips on its own
   date (Sun Nov 1 6:00 AM CT). The switch is read from the URL on every load and never stored: no storage, no cookie.
   node:vm, no browser, against the real tree and its committed r3 art. */
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

test("(1) no switch, Sun Nov 1 6:00 / 7:00 AM CT and later: turkey worn, 0 extras requests, draws or nodes, every kid", async () => {
  for (const [when, at] of Object.entries(AFTER)) for (const kid of KIDS) for (const q of ["", "fixture=1", "orix=0", "orix=true", "orix=yes"]) {
    const h = await play(kid, at, q), label = `${kid} ${when} ?${q}`;
    const s = h.skin();
    assert.deepEqual([s.month, s.id, s.hero], ["2026-11", "turkey", "art"], `${label}: turkey skin present and worn`);
    noExtras(h, label);
  }
});

test("(2) no switch, before Nov 1 (and 5:59 AM CT Nov 1): October skin, 0 extras; ?skin=turkey preview of the base is still extras-free", async () => {
  for (const [when, at] of Object.entries(BEFORE)) for (const kid of KIDS) {
    const h = await play(kid, at, "");
    assert.deepEqual([h.skin().month, h.skin().id], ["2026-10", "pumpkin"], `${kid} ${when}: October skin`);
    noExtras(h, `${kid} ${when}`);
    const t = await play(kid, at, "skin=turkey&fixture=1");
    assert.deepEqual([t.skin().id, t.skin().hero], ["turkey", "art"], `${kid} ${when} ?skin=turkey: turkey worn`);
    noExtras(t, `${kid} ${when} ?skin=turkey`);
  }
});

test("(3) switch on (?orix=1), Sun Nov 1 7:00 AM CT: extras present; Ainsley 0 pebbles / counts; 0 '$'; 0 notWired; pebbles under the HUD", async () => {
  for (const kid of KIDS) for (const q of ["orix=1", "orix=1&fixture=1"]) {
    const h = await play(kid, AFTER["Sun Nov 1 7:00 AM CT"], q), label = `${kid} ?${q}`;
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
      assert.doesNotMatch(h.texts().replace(/<[^>]*>/g, " "), /\d|\u2605|\u2606|stars?\b|points?\b/i, `${label}: 0 digits / counts / stars`);
    } else {
      for (const p of peb) assert.ok(p.y > 60, `${label}: pebble below the HUD band`);
    }
  }
});

test("(4) the switch never persists: 0 storage writes, 0 cookie writes; one flag, read from the URL only", async () => {
  for (const kid of KIDS) {
    const h = await play(kid, AFTER["Sun Nov 1 7:00 AM CT"], "orix=1&fixture=1");
    const off = await play(kid, AFTER["Sun Nov 1 7:00 AM CT"], "fixture=1");
    const sw = (r) => r.log.writes.filter(([k]) => /Storage$|^cookie$|^indexedDB$/.test(k));
    assert.deepEqual(h.log.writes.filter(([k]) => k === "cookie"), [], `${kid}: 0 cookie writes`);
    assert.deepEqual(h.log.writes.filter(([k]) => k === "indexedDB"), [], `${kid}: 0 IndexedDB opens or writes`);
    assert.deepEqual(h.log.nav.filter(([, u]) => /orix/i.test(u)), [], `${kid}: the URL is never rewritten to carry or drop the switch`);
    const hrefs = (h.texts().match(/href="[^"]*"/g) || []);
    assert.ok(hrefs.length > 0, `${kid}: the run's links were read`);
    assert.deepEqual(hrefs.filter((x) => /orix/i.test(x)), [], `${kid}: no link on the run carries the switch`);
    assert.deepEqual(sw(h).filter(([, v]) => /orix|extras|preview/i.test(v)), [], `${kid}: no switch in storage`);
    assert.deepEqual(J(sw(h)), J(sw(off)), `${kid}: switch on writes exactly what switch off writes`);
    assert.deepEqual(Object.keys(h.map).filter((k) => /orix|extras|preview/i.test(k + h.map[k])), [], `${kid}: storage holds no switch`);
  }
  assert.equal((SRC.match(/^\s*var ORIX_EXTRAS_LIVE = false;$/gm) || []).length, 1, "one flag, off");
  assert.equal((SRC.match(/ORIX_ON/g) || []).length, 2, "ORIX_ON: defined once, read once (exOn)");
  assert.match(SRC, /var ORIX_ON = ORIX_EXTRAS_LIVE \|\| q\.get\("orix"\) === "1";/, "read from the URL query only");
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
  const allowed = mr.map((ln, i) => (/var ORIX_ON = ORIX_EXTRAS_LIVE \|\| q\.get\("orix"\) === "1";/.test(ln) || (/^\s*(\/\*|\*|[a-z])/i.test(ln) && /carries \?orix=1/.test(ln)) ? "mercury-run.js:" + (i + 1) : null)).filter(Boolean);
  assert.equal(allowed.length, 2, "the one URL read + its comment");
  assert.deepEqual(hits.filter((x) => !allowed.includes(x)), [], "no other file names the switch");
  for (const f of files.filter((f) => /\.(html?|js)$/.test(f))) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /indexedDB\s*\.\s*open[^\n]*orix|cookieStore[^\n]*orix/i, `${path.relative(ROOT, f)}: no switch persistence`);
});
