/* DAYPKG1 v2j · ONE real-browser crawl of every kid-reachable page (scripts/qa/daypkg1v2j_crawl.py, Playwright Chromium).
   Skips under QA_NO_BROWSER=1. One browser per viewport (440 and 1280), launched and closed in turn.
   Harness per Alfred's v2i rulings: served under /wardos-house-face/ like Pages; /api/pair redeem mocked 200 with a synthetic
   key, /api/pair/mint stays 403; every request to a non-local host is ABORTED (never answered); the feed carries a money goal.
   Seeds: the three kid boards, mercury-run and sheet-index; links, header, Home and taps are followed; Dad pages are never entered.
   Every page: 0 '$' in the rendered DOM (hidden included), 0 transient '$' writes (MutationObserver + setter hooks installed
   before any script) and 0 '$' in localStorage / sessionStorage. */
import { ciOnlySkip } from "./ci-only-skip.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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
  /* ADULTCUT1 (Atlas ruling 7:56): app stores and app deep links are adult surfaces on kid pages too */
  String.raw`(?:apps|itunes)\.apple\.com|play\.google\.com|itms-apps?:|market://|sensi://`,
].join("|"), "i");
/* ADULTCUT2 (Atlas 9:07) · outbound sign-in / OAuth / authorize targets. Same JS / Python common subset; handed to the crawl as
   OUTBOUND_AUTH_RE and applied to every TAPPABLE target on kid-reachable pages (a/area href, data-href, form action,
   formaction, window.open, every navigation a tap or a location set starts), and statically to the 27 pages and their js/css.
   Hosts: accounts.* / account.* / login.* / signin.* / auth.* / oauth.* / sso.* / id.* / identity.* / idp.*;
   absolute-URL paths ending /authorize, /oauth, /oauth2, /login, /log-in, /signin, /sign-in, /sso, /auth;
   OAuth query markers response_type= client_id= redirect_uri= code_challenge=; well-known sign-in hosts. */
const OUTBOUND_AUTH_RE = new RegExp([
  String.raw`(?:https?:)?//(?:[a-z0-9-]+\.)*(?:accounts?|logins?|signin|sign-in|auth|oauth2?|sso|id|identity|idp)\.[a-z0-9-]+\.[a-z]{2,}`,
  String.raw`//[^\s"'<>]*?/(?:o?authori[sz]e|oauth2?|login|log-in|signin|sign-in|sso|auth)(?:[/?#"'\s<>]|\.html?|$)`,
  String.raw`[?&](?:response_type|client_id|redirect_uri|code_challenge)=`,
  String.raw`(?:appleid\.apple\.com|login\.microsoftonline\.com|github\.com/login|facebook\.com/(?:v[0-9.]+/)?dialog/oauth)`,
].join("|"), "i");
/* ADULTCUT2 (Atlas) · the off-house allowlist: ONLY the house origin and prefix the crawl serves (http://127.0.0.1:PORT/wardos-house-face/,
   the loopback stand-in for https://dmward23-web.github.io/wardos-house-face/). Non-house targets that must stay: none. */
const OFFSITE_ALLOW = [];

for (const [w, h] of [[440, 956], [1280, 800]]) {
  test("DAYPKG1 v2j browser crawl @" + w + ": all kid-reachable pages, 0 '" + D + "' in DOM, transient writes and storage", { ...SKIP, timeout: 900000 }, () => {
    const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), String(w), String(h)], { encoding: "utf8", timeout: 880000, env: { ...process.env, ADULT_DENY_RE: ADULT_DENY_RE.source, OUTBOUND_AUTH_RE: OUTBOUND_AUTH_RE.source, OFFSITE_ALLOW: JSON.stringify(OFFSITE_ALLOW) } });
    if (process.env.V2J_DRIVER_LOG) { try { fs.appendFileSync(process.env.V2J_DRIVER_LOG, JSON.stringify({ w, h, pid: r.pid, status: r.status, signal: r.signal }) + "\n"); } catch (e) {} }
    assert.equal(r.status, 0, "crawl exit " + r.status + " " + String(r.stderr).slice(-600));
    const o = JSON.parse(r.stdout.trim().split("\n").pop());
    if (process.env.V2J_CRAWL_OUT_DIR) { try { fs.writeFileSync(path.join(process.env.V2J_CRAWL_OUT_DIR, "crawl-" + w + ".json"), JSON.stringify(o)); } catch (e) {} } /* ADULTCUT2: crawl tables for the gate request */
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
      /* ADULTCUT1 P3 (Alfred): no '$' comes back out of storage (getItem) or through JSON.parse on a kid page */
      assert.deepEqual(p.reads, [], n + " read sentinels '" + D + "' " + JSON.stringify(p.reads));
    }
    /* SPOTCUT (Alfred, ADULTCUT1): no kid-reachable page has a Spotify credential field or a Client ID save path; a direct
       HouseSpotify.setup() call on a kid page refuses (dad_only), sends nothing and stores nothing */
    assert.deepEqual(o.spotify_cred, [], "Spotify credential field / save path on a kid page " + JSON.stringify(o.spotify_cred));
    assert.deepEqual(o.spotify_setup_requests, [], "a kid page POSTed /api/spotify/setup " + JSON.stringify(o.spotify_setup_requests));
    assert.ok(o.spotify_checks.pages >= 27 && o.spotify_checks.probes >= 2, "Spotify checks ran: " + JSON.stringify(o.spotify_checks));
    assert.ok(!names.includes("sheet-spotify-setup.html"), "the Spotify setup sheet is not kid-reachable");
    /* positive controls (Dad pages, own context): the read sentinels and the DOM hooks see '$' on sheet-allowance, and CRED
       sees the Client ID field on sheet-spotify-setup, so the zeros above are real zeros */
    const ca = o.control["sheet-allowance.html"], cs = o.control["sheet-spotify-setup.html"];
    assert.ok(ca && !ca.err, "allowance control ran " + JSON.stringify(ca));
    assert.ok(ca.reads.some((x) => /^getItem/.test(x[0]) && x.join(" ").includes(D)), "getItem sentinel sees '" + D + "' on sheet-allowance " + JSON.stringify(ca.reads));
    assert.ok(ca.reads.some((x) => x[0] === "JSON.parse" && x[1].includes(D)), "JSON.parse sentinel sees '" + D + "' on sheet-allowance " + JSON.stringify(ca.reads));
    assert.ok(ca.dom + ca.transient + (ca.dom_injected || 0) > 0 && ca.dom_injected > 0, "DOM / transient hooks see an appended '" + D + "' on sheet-allowance " + JSON.stringify(ca));
    assert.ok(cs && !cs.err && cs.cred.some((x) => x[1] === "spw-client"), "CRED sees the Client ID field on the Dad setup sheet " + JSON.stringify(cs));
    adultcut2Asserts(o, "tip");
  });
}

/* ADULTCUT2 (Atlas 9:07) · the two new crawl asserts, shared by the crawl tests above and the c5295884 RED control below:
   0 outbound sign-in / OAuth links and 0 tappable targets off the house origin, in the main crawl AND in the AUTHPROBE pass
   (Spotify mocked at need_auth so its sign-in would show), with the Dad-only control proving the probe sees an authorize nav. */
function adultcut2Asserts(o, tag) {
  assert.equal(o.auth_re, OUTBOUND_AUTH_RE.source, tag + ": crawl applied the test's outbound-auth regex");
  assert.ok(o.tap_checks.targets > 100, tag + ": tappable targets checked " + JSON.stringify(o.tap_checks));
  assert.deepEqual(o.outbound_auth, [], tag + ": outbound sign-in / OAuth targets on kid pages " + JSON.stringify(o.outbound_auth));
  assert.deepEqual(o.offsite, [], tag + ": tappable targets off the house origin " + JSON.stringify(o.offsite));
  const ap = o.authprobe;
  assert.ok(ap && Object.keys(ap.pages).length >= 27, tag + ": authprobe ran on the closure " + (ap && Object.keys(ap.pages).length));
  for (const [n, p] of Object.entries(ap.pages)) assert.ok(!p.err, tag + ": authprobe " + n + " " + p.err);
  assert.ok(ap.need_auth_pages.includes("sheet-spotify.html") && ap.need_auth_pages.includes("sheet-index.html"), tag + ": Spotify reached need_auth on the player and the hub " + JSON.stringify(ap.need_auth_pages));
  assert.ok(ap.tap_checks.targets > 100, tag + ": authprobe tappables checked " + JSON.stringify(ap.tap_checks));
  assert.deepEqual(ap.outbound_auth, [], tag + ": authprobe outbound sign-in / OAuth targets on kid pages " + JSON.stringify(ap.outbound_auth));
  assert.deepEqual(ap.offsite, [], tag + ": authprobe tappable targets off the house origin " + JSON.stringify(ap.offsite));
  assert.equal(ap.hub_mock.auth_start, 1, tag + ": only the Dad control asked the hub for a sign-in URL " + JSON.stringify(ap.hub_mock));
  const dc = ap.dad_control;
  assert.ok(dc && !dc.page.err && dc.outbound_auth.some((x) => /accounts\.spotify\.com\/authorize/.test(x[2]) && /Connect Spotify/.test(x[1])),
    tag + ": Dad control, Connect Spotify on sheet-spotify-setup reaches accounts.spotify.com/authorize " + JSON.stringify(dc));
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
/* ADULTCUT1 positive control (Alfred 7:56): the SAME crawl, pointed at a 4557b0d2 tree (V2J_BASE_ROOT, made with git archive),
   must catch the Spotify setup panel / Client ID field, the Sensi helper links and the App Store / Google Play links. The two
   tests above are the same crawl on this tree and must come back clean. Runs only when V2J_BASE_ROOT is set. */
test("ADULTCUT1 positive control @1280: the same crawl on 4557b0d2 catches the Spotify setup panel, the Sensi helper and app-store links",
  { ...(browser && process.env.V2J_BASE_ROOT ? {} : { skip: ciOnlySkip("ADULTCUT1-crawl", true, "needs a browser and V2J_BASE_ROOT (a 4557b0d2 tree): " + "browser + baseline tree are box-only (runner has QA_NO_BROWSER=1 and no second checkout)") || "SKIP needs a browser and V2J_BASE_ROOT (a 4557b0d2 tree)" }), timeout: 900000 }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), "1280", "800"], { encoding: "utf8", timeout: 880000,
    env: { ...process.env, ADULT_DENY_RE: ADULT_DENY_RE.source, V2J_CRAWL_ROOT: process.env.V2J_BASE_ROOT } });
  if (process.env.V2J_DRIVER_LOG) { try { fs.appendFileSync(process.env.V2J_DRIVER_LOG, JSON.stringify({ control: "4557b0d2", w: 1280, h: 800, pid: r.pid, status: r.status, signal: r.signal }) + "\n"); } catch (e) {} }
  assert.equal(r.status, 0, "control crawl exit " + r.status + " " + String(r.stderr).slice(-600));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  if (process.env.V2J_CONTROL_OUT) { try { fs.writeFileSync(process.env.V2J_CONTROL_OUT, JSON.stringify({ adult: o.adult, spotify_cred: o.spotify_cred, count: o.count })); } catch (e) {} }
  assert.ok(o.count >= 27, "control closure " + o.count);
  assert.equal(o.adult_re, ADULT_DENY_RE.source);
  const a = JSON.stringify(o.adult);
  for (const want of [/developer\.spotify\.com/i, /manager\.sensicomfort\.com/i, /apps\.apple\.com/i, /play\.google\.com/i, /sensi:\/\//i])
    assert.ok(want.test(a), "control catches " + want + ": " + a.slice(0, 600));
  assert.ok(o.adult.some((x) => x[0] === "sheet-spotify.html" && /developer\.spotify/i.test(x[2])), "dev link caught on sheet-spotify");
  assert.ok(o.adult.some((x) => /^script:house-sensi\.js$/.test(x[1])), "Sensi helper caught in the loaded house-sensi.js");
  assert.ok(o.spotify_cred.some((x) => x[0] === "sheet-spotify.html" && /spw-client/.test(x.join(" "))), "Client ID field caught " + JSON.stringify(o.spotify_cred));
  assert.ok(o.spotify_cred.some((x) => x[1] === "save-path"), "the kid-page Client ID save path is caught " + JSON.stringify(o.spotify_cred));
});

/* ADULTCUT1 (Atlas 7:56) · static: the Sensi connect helper is gone from the kid-loaded house-sensi.js */
test("SENSICUT static: house-sensi.js carries no connect helper, web login, app-store link or app deep link", () => {
  const t = fs.readFileSync(path.join(ROOT, "house-sensi.js"), "utf8");
  for (const k of ["connectOpenWeb", "connectTryApp", "connectOpenIos", "connectOpenAndroid", "connectOpenProduct", "WEB_LOGIN", "APP_IOS", "APP_ANDROID", "APP_SCHEME", "openUrl", "window.open"])
    assert.ok(!t.includes(k), "house-sensi.js still has " + k);
  assert.ok(!ADULT_DENY_RE.test(t), "house-sensi.js clean under the denylist");
});

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
const DESK_RE = /wardos-desk-face|desk-face|desk-index/i; /* ADULTCUT1 P3 (Alfred): widened */
test("DESKCUT1 static: no kid-reachable page or the local js/css it loads names wardos-desk-face, desk-face or desk-index", () => {
  for (const u of ["https://dmward23-web.github.io/wardos-desk-face/", "desk-face.html", "desk-index.html"]) assert.ok(DESK_RE.test(u), "desk grep bites " + u);
  assert.ok(!DESK_RE.test("sheet-desk-gate.html"), "desk grep spares sheet-desk-gate.html");
  assert.equal(KID_REACHABLE.length, 27);
  const files = kidFiles();
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => { if (DESK_RE.test(l)) hits.push(f + ":" + (i + 1)); });
  assert.deepEqual(hits, []);
  const g = fs.readFileSync(path.join(ROOT, "sheet-desk-gate.html"), "utf8");
  assert.ok(!/class="bridge(?:-row)?"/.test(g), "the bridge is cut");
  assert.ok(!/\.bridge\b/.test(g), "the dead .bridge CSS is gone (ADULTCUT1 P3)");
});

/* ADULTCUT1 (Atlas) · static: the same 27-page set and its local js/css name no developer console, admin panel, billing or
   account-management host or path (ADULT_DENY_RE above). Controls prove the regex bites and does not over-bite. */
test("ADULTCUT1 static: no kid-reachable page or the local js/css it loads names a dev, admin, billing or account surface", () => {
  for (const u of ["https://developer.spotify.com/dashboard/create", "https://manager.sensicomfort.com/", "https://dash.cloudflare.com/x",
    "https://console.cloud.google.com/billing", "https://dashboard.stripe.com/", "https://github.com/dmward23-web/wardos-house-face/settings",
    "https://github.com/settings/tokens", "https://example.com/admin/", "https://accounts.spotify.com/en/status", "https://myaccount.google.com/",
    "https://portal.azure.com/", "https://console.aws.amazon.com/", "href=\"/billing.html\"",
    "https://apps.apple.com/us/app/sensi/id792612452", "https://play.google.com/store/apps/details?id=com.asynchrony.emerson.sensi",
    "itms-apps://itunes.apple.com/app/id792612452", "market://details?id=com.asynchrony.emerson.sensi", "iframe.src = \"sensi://\""]) assert.ok(ADULT_DENY_RE.test(u), "denylist bites " + u);
  for (const u of ["https://api.weather.gov/stations/KOJC/observations/latest", "https://sensi.copeland.com/en-us", "https://www.apple.com/", "https://www.google.com/",
    "http://127.0.0.1:8787/api/pair", "the supermarket opens at 8", "https://dmward23-web.github.io/wardos-house-face/spotify-callback.html",
    "console.log(x)", "console.warn.bind(console)", "<!-- the developer-console link is cut -->", "A grown-up creates the House board app once"]) assert.ok(!ADULT_DENY_RE.test(u), "denylist spares " + u);
  const files = kidFiles();
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => { const m = l.match(ADULT_DENY_RE); if (m) hits.push(f + ":" + (i + 1) + " " + m[0]); });
  assert.deepEqual(hits, []);
});

/* SPOTCUT (Alfred, ADULTCUT1) · static: the one-time Spotify setup (Client ID field, save, steps) lives only on the Dad-only
   sheet-spotify-setup.html. No kid-reachable page or the js/css it loads carries the field or its handlers, nothing kid-reachable
   links the setup sheet, need_app on sheet-spotify reads one plain line, and HouseSpotify.setup() sends nothing off that sheet. */
test("SPOTCUT static: no Spotify credential field or save path on any kid-reachable page; setup is Dad-only", () => {
  const files = kidFiles();
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => {
    if (/spw-client|spw-setup-go|spw-copy-btn|placeholder="[^"]*client\s*id|["'=]sheet-spotify-setup/i.test(l)) hits.push(f + ":" + (i + 1));
    if (f !== "house-spotify.js" && /api\/spotify\/setup|\.setup\(/.test(l)) hits.push(f + ":" + (i + 1) + " setup call");
  });
  assert.deepEqual(hits, []);
  const page = fs.readFileSync(path.join(ROOT, "sheet-spotify-setup.html"), "utf8");
  assert.ok(/<html[^>]*\bdata-dad-only\b/.test(page), "setup sheet is data-dad-only");
  assert.ok(/id="spw-client"/.test(page) && /id="spw-setup-go"/.test(page) && /sheet-spotify-setup\.js/.test(page), "the setup panel moved here");
  assert.ok(/href="sheet-spotify-setup\.html"/.test(fs.readFileSync(path.join(ROOT, "sheet-dan.html"), "utf8")), "Dad reaches it from sheet-dan");
  const js = fs.readFileSync(path.join(ROOT, "sheet-spotify.js"), "utf8");
  const line = "Music isn't set up yet. Ask Dad.";
  assert.ok(js.includes('if (ph === "need_app" || ph === "need_auth") { msg = "' + line + '"; }'), "need_app and need_auth show the plain line, no button (ADULTCUT2)");
  for (const m of js.matchAll(/(?:msg|sub|btn) = "([^"]*)"/g)) assert.ok(!/[\u2014\u2192]/.test(m[1]) && !m[1].includes(D), "kid copy: " + m[1]);
  const hs = fs.readFileSync(path.join(ROOT, "house-spotify.js"), "utf8");
  for (const m of hs.matchAll(/(?:title|artist|dev|connectTxt) = "([^"]*)"/g)) if (/set up|Ask Dad/.test(m[1])) assert.ok(!/[\u2014\u2192]/.test(m[1]) && !m[1].includes(D), "tile copy: " + m[1]);
  /* behaviour: load house-spotify.js in a sandbox with a hub and a key; setup() off the Dad sheet sends nothing */
  const run = (pathname, dad) => {
    const calls = []; const store = { "wardos-lights-proxy-token": "qa-key" };
    const win = { HouseHub: { lights: () => "http://hub.invalid", okForKey: () => true },
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
      location: { pathname, href: "https://x.invalid" + pathname, hostname: "x.invalid", search: "", hash: "" },
      document: { documentElement: { hasAttribute: (a) => dad && a === "data-dad-only" }, addEventListener() {}, querySelectorAll: () => [], visibilityState: "visible" },
      addEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, URL, JSON, Math, Date, console,
      fetch: (u, o) => { calls.push([u, o && o.method]); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }); } };
    win.window = win; vm.createContext(win); vm.runInContext(fs.readFileSync(path.join(ROOT, "house-spotify.js"), "utf8"), win);
    return win.HouseSpotify.setup("0123456789abcdef0123456789abcdef", "sheet-spotify.html").then((j) => ({ j, calls, store }));
  };
  return Promise.all([run("/wardos-house-face/sheet-spotify.html", false), run("/wardos-house-face/sheet-spotify.html", true),
    run("/wardos-house-face/sheet-index.html", false), run("/wardos-house-face/sheet-spotify-setup.html", true)]).then(([kid, kidAttr, idx, dad]) => {
    for (const r of [kid, kidAttr, idx]) { assert.equal(r.j.error, "dad_only"); assert.deepEqual(r.calls, []); assert.ok(!JSON.stringify(r.store).includes("0123456789abcdef")); }
    assert.deepEqual(dad.calls.map((c) => c[1] + " " + c[0]), ["POST http://hub.invalid/api/spotify/setup"], "control: the Dad sheet does POST");
    assert.ok(!JSON.stringify(dad.store).includes("0123456789abcdef"), "the Client ID is never stored in the browser");
  });
});

/* ADULTCUT2 RED control (Atlas 9:07): the SAME crawl and the SAME two asserts, pointed at a c5295884 tree (V2J_AC1_ROOT, made with
   git archive), must go RED, from the kid Connect Spotify button (the sheet-index tile and the sheet-spotify gate). */
test("ADULTCUT2 RED control @1280: the same crawl on c5295884 fails the outbound sign-in assert from the kid Connect Spotify button",
  { ...(browser && process.env.V2J_AC1_ROOT ? {} : { skip: ciOnlySkip("ADULTCUT2-crawl", true, "needs a browser and V2J_AC1_ROOT (a c5295884 tree): " + "browser + baseline tree are box-only (runner has QA_NO_BROWSER=1 and no second checkout)") || "SKIP needs a browser and V2J_AC1_ROOT (a c5295884 tree)" }), timeout: 900000 }, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), "1280", "800"], { encoding: "utf8", timeout: 880000,
    env: { ...process.env, ADULT_DENY_RE: ADULT_DENY_RE.source, OUTBOUND_AUTH_RE: OUTBOUND_AUTH_RE.source, OFFSITE_ALLOW: JSON.stringify(OFFSITE_ALLOW), V2J_CRAWL_ROOT: process.env.V2J_AC1_ROOT } });
  if (process.env.V2J_DRIVER_LOG) { try { fs.appendFileSync(process.env.V2J_DRIVER_LOG, JSON.stringify({ control: "c5295884", w: 1280, h: 800, pid: r.pid, status: r.status, signal: r.signal }) + "\n"); } catch (e) {} }
  assert.equal(r.status, 0, "control crawl exit " + r.status + " " + String(r.stderr).slice(-600));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  if (process.env.V2J_CONTROL_OUT) { try { fs.writeFileSync(process.env.V2J_CONTROL_OUT, JSON.stringify({ count: o.count, outbound_auth: o.outbound_auth, offsite: o.offsite, authprobe: o.authprobe })); } catch (e) {} }
  let red = null; try { adultcut2Asserts(o, "c5295884"); } catch (e) { red = e; }
  assert.ok(red && /outbound sign-in/.test(red.message), "c5295884 goes RED on the outbound sign-in assert: " + (red ? red.message.slice(0, 300) : "it passed"));
  const hits = o.authprobe.outbound_auth;
  assert.ok(hits.some((x) => x[0] === "sheet-spotify.html" && /Connect Spotify/.test(x[1]) && /accounts\.spotify\.com\/authorize/.test(x[2])), "RED from the sheet-spotify Connect Spotify button " + JSON.stringify(hits).slice(0, 600));
  assert.ok(hits.some((x) => x[0] === "sheet-index.html" && /sp-connect|Connect Spotify/.test(x[1]) && /accounts\.spotify\.com/.test(x[2])), "RED from the sheet-index tile Connect Spotify button " + JSON.stringify(hits).slice(0, 600));
});

/* ADULTCUT2 (Atlas 9:07) · static: no kid-reachable page or the local js/css it loads names an outbound sign-in / OAuth /
   authorize URL; none of them carries a "Connect Spotify" control or calls the Spotify sign-in; need_auth reads the plain line on
   the player and the tile; HouseSpotify.connect() sends nothing and never navigates off the Dad-only sheet; that sheet has it. */
test("ADULTCUT2 static: no outbound sign-in, OAuth or off-house target on kid pages; Connect Spotify is Dad-only", () => {
  for (const u of ["https://accounts.spotify.com/authorize?client_id=x&response_type=code", "https://accounts.google.com/o/oauth2/v2/auth", "//login.microsoftonline.com/common/oauth2/v2.0/authorize",
    "https://auth.example.com/", "https://example.com/oauth/authorize", "https://example.com/login", "https://example.com/sign-in?next=/", "https://github.com/login/oauth/authorize",
    "https://appleid.apple.com/auth/authorize", "https://sso.example.org/x", "https://id.example.com/", "https://www.facebook.com/v19.0/dialog/oauth", "?client_id=abc", "&redirect_uri=https%3A"])
    assert.ok(OUTBOUND_AUTH_RE.test(u), "auth regex bites " + u);
  for (const u of ["https://api.weather.gov/stations/KOJC/observations/latest", "https://open.spotify.com/track/x", "https://dmward23-web.github.io/wardos-house-face/spotify-callback.html",
    "/api/spotify/auth-start", "https://hub.qa.invalid/api/spotify/auth-start", "http://127.0.0.1:8787/api/pair", "Music isn't set up yet. Ask Dad.", "the login streak", "authorized",
    "sheet-index.html?kid=hayes", "https://www.google.com/", "data-sp-act=\"connect\""]) assert.ok(!OUTBOUND_AUTH_RE.test(u), "auth regex spares " + u);
  assert.deepEqual(OFFSITE_ALLOW, [], "the off-house allowlist is the house origin only");
  const files = kidFiles();
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => {
    const m = l.match(OUTBOUND_AUTH_RE); if (m) hits.push(f + ":" + (i + 1) + " " + m[0]);
    if (/connect\s*spotify/i.test(l) && !/^\s*(?:\/\*|\*|\/\/|<!--)/.test(l) && !/\/\*[^*]*connect\s*spotify/i.test(l)) hits.push(f + ":" + (i + 1) + " Connect Spotify");
    if (/(?:SP|HouseSpotify)\.connect\(|(?:^|[^.\w])connect\(\s*["']|api\/spotify\/auth-start/.test(l) && f !== "house-spotify.js") hits.push(f + ":" + (i + 1) + " sign-in call");
    if (f === "house-spotify.js" && /(?:^|[^.\w])connect\(\s*["']/.test(l)) hits.push(f + ":" + (i + 1) + " tile sign-in call");
    for (const t of l.matchAll(/(?:href|action|formaction|data-href)\s*=\s*["']([^"']+)["']/gi)) if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(t[1]) && !/^javascript:/i.test(t[1])) hits.push(f + ":" + (i + 1) + " off-house " + t[1].slice(0, 60));
    for (const t of l.matchAll(/window\.open\(\s*["']([^"']+)["']/g)) if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(t[1])) hits.push(f + ":" + (i + 1) + " off-house open " + t[1].slice(0, 60));
  });
  assert.deepEqual(hits, []);
  const line = "Music isn't set up yet. Ask Dad.";
  const hs = fs.readFileSync(path.join(ROOT, "house-spotify.js"), "utf8");
  assert.ok(hs.includes('} else if (ph === "need_auth") {\n      title = "Spotify"; artist = "' + line + '"; connectTxt = "";'), "need_auth tile shows the plain line, no button");
  const setupHtml = fs.readFileSync(path.join(ROOT, "sheet-spotify-setup.html"), "utf8"), setupJs = fs.readFileSync(path.join(ROOT, "sheet-spotify-setup.js"), "utf8");
  assert.ok(/<html[^>]*\bdata-dad-only\b/.test(setupHtml) && /id="sss-connect"[^>]*>Connect Spotify</.test(setupHtml), "the Dad-only setup sheet carries Connect Spotify");
  assert.ok(setupJs.includes('SP.connect("sheet-spotify.html")'), "the Dad sheet starts the sign-in, returning to the player (box RETURN_OK)");
  /* behaviour: connect() in a sandbox with a hub, a key and an auth-start that answers an authorize URL */
  const run = (pathname, dad) => {
    const calls = []; const store = { "wardos-lights-proxy-token": "qa-key" };
    const loc = { pathname, href: "https://x.invalid" + pathname, hostname: "x.invalid", search: "", hash: "" };
    const win = { HouseHub: { lights: () => "http://hub.invalid", okForKey: () => true },
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
      location: loc, document: { documentElement: { hasAttribute: (a) => dad && a === "data-dad-only" }, addEventListener() {}, querySelectorAll: () => [], visibilityState: "visible" },
      addEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, URL, JSON, Math, Date, console,
      fetch: (u, o) => { calls.push([u, o && o.method]); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, url: "https://accounts.spotify.com/authorize?client_id=qa" }) }); } };
    win.window = win; vm.createContext(win); vm.runInContext(hs, win);
    return win.HouseSpotify.connect("sheet-spotify.html").then((j) => ({ j, calls, href: loc.href }));
  };
  return Promise.all([run("/wardos-house-face/sheet-spotify.html", false), run("/wardos-house-face/sheet-index.html", false), run("/wardos-house-face/sheet-spotify.html", true),
    run("/wardos-house-face/sheet-spotify-setup.html", false), run("/wardos-house-face/sheet-spotify-setup.html", true)]).then(([kid, idx, kidAttr, setupNoAttr, dad]) => {
    for (const r of [kid, idx, kidAttr, setupNoAttr]) { assert.equal(r.j.error, "dad_only"); assert.deepEqual(r.calls, []); assert.ok(!/accounts\.spotify/.test(r.href), "no navigation " + r.href); }
    assert.deepEqual(dad.calls.map((c) => c[1] + " " + c[0]), ["POST http://hub.invalid/api/spotify/auth-start"], "control: the Dad sheet does ask for the sign-in");
    assert.equal(dad.href, "https://accounts.spotify.com/authorize?client_id=qa", "control: the Dad sheet navigates to the sign-in");
  });
});

/* ADULTCUT2B · Atlas 2026-10-28 9:59 CT: when music is not set up, no kid surface labels Spotify CONNECT; the hub tile pill reads SETUP like sheet-spotify */
const SPOTIFY_CONNECT_WORD = /(["'>])\s*CONNECT\s*(["'<])/;
const spotifyScope = (f, l) => /spotify/i.test(f) || /spotify|\bsp-|need_app|need_auth/i.test(l);
const notComment = (l) => !/^\s*(?:\/\*|\*|\/\/|<!--)/.test(l);
test("ADULTCUT2B static: no kid surface shows CONNECT for Spotify; the hub tile pill reads SETUP like sheet-spotify", () => {
  for (const l of ['need_app: "CONNECT", need_auth: "CONNECT",', "<span class=\"sp-pill\">CONNECT</span>", "pill = 'CONNECT';"])
    assert.ok(SPOTIFY_CONNECT_WORD.test(l) && spotifyScope("house-spotify.js", l), "bites " + l);
  for (const l of ["NEED CONNECT", "NOT CONNECTED", "CONNECTING", "CONNECT \u00b7 need Kasa on Atlas", 'need_app: "SETUP"', "Spotify Connect rooms"])
    assert.ok(!SPOTIFY_CONNECT_WORD.test(l), "spares " + l);
  const files = kidFiles();
  assert.ok(files.size > 40, "scanned " + files.size);
  const hits = [];
  for (const f of files) fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((l, i) => {
    if (notComment(l) && SPOTIFY_CONNECT_WORD.test(l) && spotifyScope(f, l)) hits.push(f + ":" + (i + 1) + " " + l.trim().slice(0, 90));
  });
  assert.deepEqual(hits, []);
  const hs = fs.readFileSync(path.join(ROOT, "house-spotify.js"), "utf8"), ss = fs.readFileSync(path.join(ROOT, "sheet-spotify.js"), "utf8");
  assert.ok(hs.includes('need_app: "SETUP", need_auth: "SETUP",'), "hub tile pill reads SETUP");
  assert.ok(ss.includes('need_app: "SETUP", need_auth: "SETUP",'), "sheet-spotify pill reads SETUP (the match)");
  for (const f of ["sheet-index.html", "sheet-spotify.html", "sheet-spotify-setup.html"])
    assert.ok(fs.readFileSync(path.join(ROOT, f), "utf8").includes('src="house-spotify.js?v=ADULTCUT2B"'), f + " re-tokened");
});

/* FACESTRIP1 (Alfred D2 P2 + 10:10 item 3) · in-render write assert on month.html and sheet-load-day.html. The crawl's facestrip
   pass feeds BOTH calendar feeds money rows (every sign form, whole amounts, k/m edges, two no-strip controls) and records any
   write that carries a money sign or a bare amount: DOM text (hidden included), attributes, form values, every transient
   setter / MutationObserver write, and storage (writes and the final dump). GREEN = 0 on both pages at 440 and 1280, the
   controls painted (not vacuous) and HouseFaceLaw.moneyFree loaded. RED control = the same pass served from a c5295884 (or
   f81262ee) tree via V2J_FS_RED_ROOT: sign hits on both pages. */
const fsRun = (w, h, root, mode = "facestrip", now = null) => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), String(w), String(h), mode], { encoding: "utf8", timeout: 600000,
    env: { ...process.env, ...(root ? { V2J_CRAWL_ROOT: root } : {}), ...(now ? { FS_NOW: now } : {}) } });
  if (process.env.V2J_DRIVER_LOG) { try { fs.appendFileSync(process.env.V2J_DRIVER_LOG, JSON.stringify({ facestrip: root ? "red" : "tip", mode, w, h, pid: r.pid, status: r.status, signal: r.signal }) + "\n"); } catch (e) {} }
  assert.equal(r.status, 0, "facestrip pass exit " + r.status + " " + String(r.stderr).slice(-600));
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  if (process.env.V2J_CRAWL_OUT_DIR) { try { fs.writeFileSync(path.join(process.env.V2J_CRAWL_OUT_DIR, mode + "-" + (root ? "red-" : "") + w + ".json"), JSON.stringify(o)); } catch (e) {} }
  return o;
};
const FS_PAGES = ["month.html", "sheet-load-day.html"];
const FS_CONTROLS = ["5km run", "Room 5m", "Focus 5 USB 50 BUS 5"];
function facestripAsserts(o, tag, mode = "facestrip") {
  assert.equal(o.mode, mode, tag + ": " + mode + " pass");
  assert.deepEqual(o.controls, FS_CONTROLS, tag + ": the crawl's control list");
  for (const p of FS_PAGES) {
    const r = o.pages[p]; assert.ok(r && r.loaded, tag + " " + p + " loaded " + JSON.stringify(r).slice(0, 300));
    assert.deepEqual(r.controls.slice().sort(), FS_CONTROLS.slice().sort(), tag + " " + p + ": the no-strip control rows painted (pass is not vacuous)");
    assert.ok(r.writes > 0, tag + " " + p + ": writes were observed");
    assert.deepEqual(r.transient, [], tag + " " + p + ": 0 money in transient writes");
    assert.deepEqual(r.dom, [], tag + " " + p + ": 0 money in DOM text (hidden included), attributes, values");
    assert.deepEqual(r.store, [], tag + " " + p + ": 0 money in storage");
  }
}
for (const [w, h] of [[440, 956], [1280, 800]]) {
  test("FACESTRIP1 in-render @" + w + ": month.html and sheet-load-day write no money sign or bare amount from either calendar feed", { ...SKIP, timeout: 620000 }, () => {
    const o = fsRun(w, h, null);
    facestripAsserts(o, "tip@" + w);
    for (const p of FS_PAGES) { assert.equal(o.pages[p].law, true, p + " loads HouseFaceLaw.moneyFree"); assert.equal(o.pages[p].lb, true, p + " native lookbehind"); }
  });
}
/* FACESTRIP1 r2 · old Safari (< 16.4, no lookbehind). BUILT, NOT RUN by Wright (Alfred holds the render slot). Opt-in only: needs a
   browser AND V2J_FS_NOLB=1, so a default browser run never takes it. The crawl's facestrip-nolb mode adds FS_NOLB (a Playwright
   init script, test-only, unreachable from any page or kid) that makes RegExp throw on lookbehind sources, so the law runs its
   capture fallback. GREEN = fallback taken on both pages (lb false, lbThrows > 0) and 0 money in DOM, storage and transient writes. */
const NOLB = browser && process.env.V2J_FS_NOLB === "1" ? {} : { skip: "SKIP needs a browser and V2J_FS_NOLB=1 (old-Safari no-lookbehind pass, opt-in)" };
for (const [w, h] of [[440, 956], [1280, 800]]) {
  test("FACESTRIP1 r2 old-Safari no-lookbehind @" + w + ": the law's capture fallback writes no money on month.html or sheet-load-day", { ...(NOLB.skip ? { skip: ciOnlySkip("FACESTRIP1-nolb@" + w, true, "opt-in old-Safari pass needs a browser and V2J_FS_NOLB=1, box-only (runner has QA_NO_BROWSER=1)") || NOLB.skip } : NOLB), timeout: 620000 }, () => {
    const o = fsRun(w, h, null, "facestrip-nolb");
    facestripAsserts(o, "nolb@" + w, "facestrip-nolb");
    for (const p of FS_PAGES) { const r = o.pages[p];
      assert.equal(r.law, true, p + " loads HouseFaceLaw.moneyFree"); assert.equal(r.nolb, true, p + " ran under FS_NOLB");
      assert.equal(r.lb, false, p + ": HouseFaceLaw.MONEY_LB_OK false (fallback taken)"); assert.ok(r.lbThrows > 0, p + ": the law's lookbehind compile threw " + r.lbThrows);
      assert.deepEqual(r.errors, [], p + ": no page errors under the no-lookbehind engine"); }
  });
}
test("FACESTRIP1 RED control @1280: the same pass on V2J_FS_RED_ROOT (c5295884 / f81262ee) writes money on both pages",
  { ...(browser && process.env.V2J_FS_RED_ROOT ? {} : { skip: ciOnlySkip("FACESTRIP1-red", true, "RED control needs a browser and V2J_FS_RED_ROOT (a c5295884 or f81262ee tree): " + "browser + baseline tree are box-only (runner has QA_NO_BROWSER=1 and no second checkout)") || "SKIP needs a browser and V2J_FS_RED_ROOT (a c5295884 or f81262ee tree)" }), timeout: 620000 }, () => {
  const o = fsRun(1280, 800, process.env.V2J_FS_RED_ROOT);
  let red = null; try { facestripAsserts(o, "red"); } catch (e) { red = e; }
  assert.ok(red && /0 money/.test(red.message), "the RED tree fails a 0-money assert: " + (red ? red.message.slice(0, 300) : "it passed"));
  for (const p of FS_PAGES) {
    const r = o.pages[p], all = [].concat(r.transient || [], r.dom || []);
    assert.ok(all.some((x) => x[0] === "sign"), "RED " + p + " has sign hits " + JSON.stringify(all).slice(0, 400));
  }
});
/* FACESTRIP1DATE1 · the facestrip rows are relative to ctNow (CT wall clock), never hard-dated. The 10-28 22:00 CT box FAIL:
   the wall rows sat on days 1-7, which late in the month are hidden past weeks and fixture away days, so @1280 painted no
   control. FS_NOW fakes ctNow for the driver AND pins the page clock to the same instant. */
const FS_NOWS = [
  ["today", "2026-10-28T12:00:00-05:00"], ["+1", "2026-10-29T12:00:00-05:00"], ["+7", "2026-11-04T12:00:00-06:00"],
  ["+30", "2026-11-27T12:00:00-06:00"], ["CT 10-28, UTC already 10-29", "2026-10-28T23:30:00-05:00"],
  ["just past CT midnight", "2026-10-29T00:30:00-05:00"], ["month end", "2026-10-31T23:59:00-05:00"], ["DST end day", "2026-11-01T01:30:00-06:00"]];
test("FACESTRIP1DATE1 date sweep @1280: controls paint and 0 money on both pages for every fake ctNow", { ...SKIP, timeout: 900000 }, () => {
  for (const [tag, now] of FS_NOWS) {
    const o = fsRun(1280, 800, null, "facestrip", now);
    assert.equal(Date.parse(o.ct_now), Date.parse(now), tag + ": driver ctNow is the fake now");
    facestripAsserts(o, "sweep " + tag + " " + now);
  }
});
test("FACESTRIP1DATE1 static: injected days follow ctNow in CT (real offset), inside its month, including today", () => {
  const py = String.raw`
import ast, os, json, datetime as dt
src = open(os.path.join(${JSON.stringify(ROOT)}, "scripts/qa/daypkg1v2j_crawl.py")).read()
ns = {"os": os}
for n in ast.parse(src).body:
    if isinstance(n, ast.FunctionDef) and n.name in ("fs_ct_now", "fs_off", "fs_days", "fs_month_days"): exec(compile(ast.Module([n], []), "x", "exec"), ns)
out = []
for now in ${JSON.stringify(FS_NOWS.map((x) => x[1]))}:
    os.environ["FS_NOW"] = now
    t0, t1 = ns["fs_days"](); m = ns["fs_month_days"](t0, 7)
    out.append([now, t0.isoformat(), t1.isoformat(), [d.isoformat() for d in m], ns["fs_off"](t0)])
print(json.dumps(out))`;
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const want = { "2026-10-28T12:00:00-05:00": "2026-10-28", "2026-10-29T12:00:00-05:00": "2026-10-29", "2026-11-04T12:00:00-06:00": "2026-11-04",
    "2026-11-27T12:00:00-06:00": "2026-11-27", "2026-10-28T23:30:00-05:00": "2026-10-28", "2026-10-29T00:30:00-05:00": "2026-10-29",
    "2026-10-31T23:59:00-05:00": "2026-10-31", "2026-11-01T01:30:00-06:00": "2026-11-01" };
  for (const [now, t0, t1, days, off] of JSON.parse(r.stdout.trim())) {
    assert.equal(t0, want[now], now + ": CT today (not the UTC date)");
    assert.equal(Date.parse(t1 + "T12:00:00Z") - Date.parse(t0 + "T12:00:00Z"), 86400000, now + ": tomorrow");
    assert.equal(days.length, 7, now + ": 7 wall days"); assert.ok(days.includes(t0), now + ": today's week holds the rows");
    assert.ok(days.every((d) => d.slice(0, 7) === t0.slice(0, 7)), now + ": all in the shown month " + days);
    assert.equal(off, t0 < "2026-11-01" ? "-05:00" : "-06:00", now + ": real CT offset");
  }
  const src = fs.readFileSync(path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), "utf8");
  assert.doesNotMatch(src, /replace\(day=1 \+ i \/\/ 3\)/, "no fixed days 1-7");
  assert.match(src, /for dd in \[md\[0\] - _dt\.timedelta\(days=1\)\] \+ md \+ \[md\[-1\] \+ _dt\.timedelta\(days=1\)\]:/, "neighbours are with-Dan too (no switch day)");
  assert.match(src, /pg\.clock\.install\(time=fs_ct_now\(\)\.timestamp\(\)\)/, "page clock pinned to ctNow under FS_NOW");
});
test("FACESTRIP1 static: the facestrip pass covers every money form, its bare regex bites each residue and spares the controls", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), "utf8");
  for (const k of ["FS_MONEY", "FS_OBS", "FS_SCAN", "FS_SIGN", "FS_BARE", "FS_NOLB", 'MODE in ("facestrip", "facestrip-nolb")', 'if MODE == "facestrip-nolb": ctx.add_init_script(FS_NOLB)', '"month.html", "sheet-load-day.html"', "fs_inject(name, d)"]) assert.ok(src.includes(k), "crawl has " + k);
  const raw = (n) => { const m = src.match(new RegExp("^" + n + ' = r"([^"]*)"', "m")); assert.ok(m, n); return m[1]; };
  const SG = new RegExp(raw("FS_SIGN")), BR = new RegExp(raw("FS_BARE"));
  const S = String.fromCharCode(36), FW = "\uFF04", SM = "\uFE69";
  for (const t of [S, FW, SM]) assert.ok(SG.test("a " + t + "5"), "sign regex bites U+" + t.codePointAt(0).toString(16));
  for (const t of ["Book fair 1,256", "fair ,256", "Snack .77 each", "Fee  193 due", "Cards 6135 swap".replace("6135", "613"), "Gala 2.5m goal", "Bus 5k raffle", "Gift jar 613",
    "Fee USD due", "Fee 7,471 due", "Trip 7,472", "Trip USD", "Club US now", "Club 7,473 now", "Gate USD", "Gate US", "Gate 7,474", "Jar 1,256 goal", "Cards 613 5 swap", "Gift box 613"]) assert.ok(BR.test(t), "bare regex bites " + t);
  for (const t of ["5km run", "Room 5m", "Grade 2nd", "3:15 pm", "Room 213", "2026-10-28", "Age 7", "Focus 5 USB 50 BUS 5", "USB 50", "BUS 5", "Focus 5", "Join us", "Fee due", "Club now", "Gate"]) assert.ok(!BR.test(t) && !SG.test(t), "spares " + t);
  for (const t of ["(bring ", "1,256", ".77", " 193", "613", "5k", "2.5m", "5km run", "Room 5m"]) assert.ok(src.includes(t), "fixture form " + t);
  assert.ok(/FW \+ "5/.test(src) && /SM \+ "5/.test(src) && /"Gift jar 613 " \+ S/.test(src) && /"Cards 613" \+ S \+ "5/.test(src), "fullwidth, small, '613 sign', '613 sign 5' rows");
  for (const t of ['"Fee USD 7,471 due"', '"Trip 7,472 USD"', '"Club US" + S + "7,473 now"', '"Gate USD" + S + "7,474"', '"Jar 1,256 " + S + " goal"', '"Cards 613 " + S + "5 swap"', '"Gift box 613 " + FW', '"Focus 5 USB 50 BUS 5"'])
    assert.ok(src.includes(t), "r2 row " + t);
  assert.ok(src.includes('FS_CONTROLS = ["5km run", "Room 5m", "Focus 5 USB 50 BUS 5"]'), "r2 controls");
});
test("FACESTRIP1 r2 static: the old-Safari pass forces the fallback only through the harness, and the glass has no lookbehind literal", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/qa/daypkg1v2j_crawl.py"), "utf8");
  const nolb = src.match(/^FS_NOLB = r"""([\s\S]*?)"""/m); assert.ok(nolb, "FS_NOLB defined");
  /* run FS_NOLB in a vm window: lookbehind sources throw SyntaxError, everything else is a native RegExp */
  const win = { RegExp }; win.window = win; vm.createContext(win); vm.runInContext(nolb[1], win);
  assert.equal(win.__fsNolb, true); assert.notEqual(win.RegExp, RegExp);
  assert.throws(() => new win.RegExp("(?<![A-Za-z_])x", "g"), { name: "SyntaxError" }); assert.throws(() => new win.RegExp("(?<=a)b"), { name: "SyntaxError" });
  const ok = new win.RegExp("(^|[^A-Za-z_])x", "g"); assert.ok(ok instanceof RegExp && ok.flags === "g" && ok.test(" x"), "lookbehind-free source builds a native RegExp");
  assert.equal(win.__fsLbThrows, 2);
  /* the law under FS_NOLB takes the fallback and still strips */
  const law = fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8");
  const box = { window: null }; box.window = box; vm.createContext(box); vm.runInContext(nolb[1], box); vm.runInContext(law, box);
  assert.equal(box.HouseFaceLaw.MONEY_LB_OK, false, "fallback taken under FS_NOLB"); assert.ok(box.__fsLbThrows >= 1);
  const S = String.fromCharCode(36);
  for (const [x, want] of [["Field trip (bring " + S + "5)", "Field trip (bring)"], ["Fee USD 7,471 due", "Fee due"], ["Club US" + S + "7,473 now", "Club now"], ["Gift jar 613 " + S, "Gift jar"], ["Focus 5 USB 50 BUS 5", "Focus 5 USB 50 BUS 5"]])
    assert.equal(box.HouseFaceLaw.faceText(x), want, x);
  /* no kid path: the law and the glass read no switch for it, and the only RegExp swap lives in scripts/qa */
  for (const f of ["house-face-law.js", "private-feed.js", "month.html", "sheet-load-day.html"]) {
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(t, /__fsNolb|__fsLbThrows|FS_NOLB|nolb/i, f + " holds no no-lookbehind switch");
    const code = t.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
    assert.doesNotMatch(code, /\(\?<[!=]/, f + " holds no lookbehind outside a string (a literal would be a parse error on old Safari)");
  }
  assert.doesNotMatch(law, /location|URLSearchParams|localStorage|sessionStorage|document\.cookie/, "the law reads no URL, storage or cookie switch");
});
