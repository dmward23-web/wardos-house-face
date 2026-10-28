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
/* ADULTCUT1 (Atlas) · the ONE denylist for developer consoles, admin panels, billing and account-management surfaces.
   Used by the static grep below and handed to the crawl (ADULT_DENY_RE) for hrefs, window.open, navigations, requests
   and markup. Written in the JS / Python common subset so both engines read the same source. */
const ADULT_DENY_RE = new RegExp([
  String.raw`(?:https?:)?//(?:[a-z0-9-]+\.)*(?:developers?|console|dashboard|dash|admin|billing|manager|manage|accounts?|myaccount|portal|appstoreconnect|play-console)\.[a-z0-9-]+\.[a-z]{2,}`,
  String.raw`//[^\s"'<>]*?/(?:dashboard|admin|administrator|wp-admin|billing|console|settings|account|accounts|myaccount|manage|subscriptions?)(?:[/?#"'\s<>]|\.html?|$)`,
  String.raw`github\.com/(?:settings|organizations/[^\s"'/]+/settings|[^\s"'/]+/[^\s"'/]+/settings)`,
  String.raw`(?:dash\.cloudflare\.com|console\.cloud\.google\.com|cloud\.google\.com/console|console\.firebase\.google\.com|dashboard\.stripe\.com|billing\.stripe\.com|portal\.azure\.com|console\.aws\.amazon\.com|vercel\.com/dashboard|app\.netlify\.com|supabase\.com/dashboard|myaccount\.google\.com|payments\.google\.com|appleid\.apple\.com|developer\.apple\.com)`,
  String.raw`["'][^"'\s<>]*/(?:admin|wp-admin|billing)(?:[/?#"']|\.html?)`,
].join("|"), "i");

for (const [w, h] of [[440, 956], [1280, 800]]) {
  test("DAYPKG1 v2j browser crawl @" + w + ": all kid-reachable pages, 0 '" + D + "' in DOM, transient writes and storage", { ...SKIP, timeout: 900000 }, () => {
    const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), String(w), String(h)], { encoding: "utf8", timeout: 880000, env: { ...process.env, ADULT_DENY_RE: ADULT_DENY_RE.source } });
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
    /* ADULTCUT1 (Atlas): no dev, admin, billing or account surface in any href, window.open, navigation, request or markup */
    assert.equal(o.adult_re, ADULT_DENY_RE.source, "crawl applied the test's denylist");
    assert.deepEqual(o.adult, [], "adult-surface hits " + JSON.stringify(o.adult));
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
function kidFiles() {
  const files = new Set();
  for (const f of KID_REACHABLE) {
    files.add(f);
    const h = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of h.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css|mjs))(?:\?[^"]*)?"/g)) if (fs.existsSync(path.join(ROOT, m[1]))) files.add(m[1]);
  }
  return files;
}
test("DESKCUT1 static: no kid-reachable page or the local js/css it loads names wardos-desk-face", () => {
  assert.equal(KID_REACHABLE.length, 27);
  const files = kidFiles();
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => { if (/wardos-desk-face/i.test(l)) hits.push(f + ":" + (i + 1)); });
  assert.deepEqual(hits, []);
  const g = fs.readFileSync(path.join(ROOT, "sheet-desk-gate.html"), "utf8");
  assert.ok(!/class="bridge(?:-row)?"/.test(g), "the bridge is cut");
});

/* ADULTCUT1 (Atlas) · static: the same 27-page set and its local js/css name no developer console, admin panel, billing or
   account-management host or path (ADULT_DENY_RE above). Controls prove the regex bites and does not over-bite. */
test("ADULTCUT1 static: no kid-reachable page or the local js/css it loads names a dev, admin, billing or account surface", () => {
  for (const u of ["https://developer.spotify.com/dashboard/create", "https://manager.sensicomfort.com/", "https://dash.cloudflare.com/x",
    "https://console.cloud.google.com/billing", "https://dashboard.stripe.com/", "https://github.com/dmward23-web/wardos-house-face/settings",
    "https://github.com/settings/tokens", "https://example.com/admin/", "https://accounts.spotify.com/en/status", "https://myaccount.google.com/",
    "https://portal.azure.com/", "https://console.aws.amazon.com/", "href=\"/billing.html\""]) assert.ok(ADULT_DENY_RE.test(u), "denylist bites " + u);
  for (const u of ["https://api.weather.gov/stations/KOJC/observations/latest", "https://sensi.copeland.com/en-us", "https://apps.apple.com/us/app/sensi/id792612452",
    "https://play.google.com/store/apps/details?id=com.asynchrony.emerson.sensi", "http://127.0.0.1:8787/api/pair", "https://dmward23-web.github.io/wardos-house-face/spotify-callback.html",
    "console.log(x)", "console.warn.bind(console)", "<!-- the developer-console link is cut -->", "A grown-up creates the House board app once"]) assert.ok(!ADULT_DENY_RE.test(u), "denylist spares " + u);
  const files = kidFiles();
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => { const m = l.match(ADULT_DENY_RE); if (m) hits.push(f + ":" + (i + 1) + " " + m[0]); });
  assert.deepEqual(hits, []);
});
