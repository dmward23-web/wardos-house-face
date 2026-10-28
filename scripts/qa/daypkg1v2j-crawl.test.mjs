/* DAYPKG1 v2j · ONE real-browser crawl of every kid-reachable page (scripts/qa/daypkg1v2j_crawl.py, Playwright Chromium).
   Skips under QA_NO_BROWSER=1. One browser per viewport (440 and 1280), launched and closed in turn.
   Harness per Alfred's v2i rulings: served under /wardos-house-face/ like Pages; /api/pair redeem mocked 200 with a synthetic
   key, /api/pair/mint stays 403; every request to a non-local host is ABORTED (never answered); the feed carries a money goal.
   Seeds: the three kid boards, mercury-run and sheet-index; links, header, Home and taps are followed; Dad pages are never entered.
   Every page: 0 '$' in the rendered DOM (hidden included), 0 transient '$' writes (MutationObserver + setter hooks installed
   before any script) and 0 '$' in localStorage / sessionStorage. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
const D = String.fromCharCode(36);
const BOARDS = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html"];

for (const [w, h] of [[440, 956], [1280, 800]]) {
  test("DAYPKG1 v2j browser crawl @" + w + ": all kid-reachable pages, 0 '" + D + "' in DOM, transient writes and storage", { ...SKIP, timeout: 900000 }, () => {
    const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), String(w), String(h)], { encoding: "utf8", timeout: 880000 });
    if (process.env.V2J_DRIVER_LOG) { try { fs.appendFileSync(process.env.V2J_DRIVER_LOG, JSON.stringify({ w, h, pid: r.pid, status: r.status, signal: r.signal }) + "\n"); } catch (e) {} }
    assert.equal(r.status, 0, "crawl exit " + r.status + " " + String(r.stderr).slice(-600));
    const o = JSON.parse(r.stdout.trim().split("\n").pop());
    const names = Object.keys(o.pages);
    assert.ok(o.count >= 27, "closure " + o.count + ": " + names.join(","));
    assert.ok(names.includes("sheet-groceries.html"), "groceries reached");
    assert.deepEqual(o.dad_edges, [], "no kid page links a Dad page");
    for (const b of BOARDS) assert.ok((o.edges[b] || []).includes("sheet-index.html"), b + " reaches sheet-index: " + JSON.stringify(o.edges[b]));
    assert.ok(!("mint200" in o.api), "mint never 200");
    /* DESKCUT1 (Atlas): no kid-reachable page links to, opens, navigates or sets location to any wardos-desk-face host */
    assert.deepEqual(o.desk, [], "wardos-desk-face hits " + JSON.stringify(o.desk));
    assert.ok(o.desk_checks.links > 0 && o.desk_checks.navs > 0 && o.desk_checks.markup_pages >= 27, "desk checks ran: " + JSON.stringify(o.desk_checks));
    for (const [n, p] of Object.entries(o.pages)) {
      assert.ok(p.loaded && !p.err, n + " crawled: " + (p.err || "not loaded"));
      assert.deepEqual(p.dom, [], n + " DOM '" + D + "' " + JSON.stringify(p.dom));
      assert.deepEqual(p.transient, [], n + " transient '" + D + "' " + JSON.stringify(p.transient));
      assert.deepEqual(p.storageWrites, [], n + " storage writes '" + D + "' " + JSON.stringify(p.storageWrites));
      assert.deepEqual(p.storage, [], n + " storage '" + D + "' " + JSON.stringify(p.storage));
    }
  });
}

test("DAYPKG1 v2j static: groceries footer chip reads GROCERIES (no '" + D + "'), its links carry ?v=DAYPKG1V2J", () => {
  const g = fs.readFileSync(path.join(ROOT, "sheet-groceries.html"), "utf8");
  assert.match(g, /<span class="ftr-chip">GROCERIES<\/span>/);
  assert.ok(!/ftr-chip">[^<]*\$/.test(g));
  for (const f of ["sheet-index.html", "sheet-gallery.html"]) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(s.includes('href="sheet-groceries.html?v=DAYPKG1V2J"'), f + " bumps the groceries token");
    assert.ok(!/href="sheet-groceries\.html"/.test(s), f + " has no unversioned groceries link");
  }
});

/* DESKCUT1 (Atlas) · static: the kid-reachable page set (Alfred's 27-page closure) and every local script / style it loads
   never name a wardos-desk-face host; the sheet-desk-gate House to Desk bridge is gone. */
const KID_REACHABLE = ["kid-hayes", "kid-harris", "kid-ainsley", "mercury-run", "sheet-index", "index", "month", "month-chat", "sheet-chores",
  "sheet-today", "sheet-lights", "sheet-google-home", "sheet-groceries", "sheet-spotify", "sheet-weekend", "sheet-win", "wall", "sheet-status",
  "sheet-us", "sheet-load-day", "sheet-pack", "nest-webrtc", "sheet-desk-gate", "sheet-dinner", "sheet-gallery-hero", "sheet-gallery",
  "sheet-countdowns"].map((n) => n + ".html");
test("DESKCUT1 static: no kid-reachable page or the local js/css it loads names wardos-desk-face", () => {
  assert.equal(KID_REACHABLE.length, 27);
  const files = new Set();
  for (const f of KID_REACHABLE) {
    files.add(f);
    const h = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of h.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css|mjs))(?:\?[^"]*)?"/g)) if (fs.existsSync(path.join(ROOT, m[1]))) files.add(m[1]);
  }
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => { if (/wardos-desk-face/i.test(l)) hits.push(f + ":" + (i + 1)); });
  assert.deepEqual(hits, []);
  const g = fs.readFileSync(path.join(ROOT, "sheet-desk-gate.html"), "utf8");
  assert.ok(!/class="bridge(?:-row)?"/.test(g), "the bridge is cut");
});
