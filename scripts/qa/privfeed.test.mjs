/* PRIVFEED1 · private runtime feed tests (node --test scripts/qa/privfeed.test.mjs). No real data: temp dirs + synthetic fixtures. */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1 (LHVID1): WARDOS_* unset and a temp HOME before any private-list reader loads
import { spawnListening } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FX = path.join(ROOT, "scripts/qa/fixtures/private");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "privfeed-"));
const PRIV = path.join(TMP, "private");
fs.mkdirSync(path.join(PRIV, "nest-snaps"), { recursive: true });
for (const n of ["cal-live", "cal-months", "kids-week"]) fs.copyFileSync(path.join(FX, n + ".synthetic.json"), path.join(PRIV, n + ".json"));
fs.writeFileSync(path.join(PRIV, "nest-snaps", "cam-a.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]));
/* FOLLOWUP1 · synthetic private names, so the producers run the same on CI (no box files) as on the box */
fs.writeFileSync(path.join(PRIV, "private-names.tsv"), "partner\tSynthpartner\ncoparent\tSynthco\n", { mode: 0o600 });
process.env.WARDOS_PRIVATE_DIR = PRIV;
const { handlePrivate } = await import("../private-feed.mjs");

const TOKEN = "test-token-0123456789abcdef";
const ORIGIN = "https://dmward23-web.github.io";
const server = http.createServer((req, res) => {
  if (!handlePrivate(req, res, { tokens: [TOKEN], origins: new Set([ORIGIN]), dir: PRIV })) { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function get(p, headers = {}) {
  /* the sync privacy-scan/gate tests block this process for seconds on a loaded box; a pooled keep-alive socket the
     server closed meanwhile then fails the next fetch ("fetch failed"). One connection per request. */
  const r = await fetch(BASE + p, { headers: { Connection: "close", ...headers } });
  return { status: r.status, headers: r.headers, body: Buffer.from(await r.arrayBuffer()) };
}

assertSealed();
test("no token → 401, house Origin alone never unlocks", async () => {
  assert.equal((await get("/api/private/cal-live.json")).status, 401);
  assert.equal((await get("/api/private/cal-live.json", { Origin: ORIGIN })).status, 401);
  assert.equal((await get("/api/private/cal-live.json", { "X-Private-Feed-Token": "wrong-token-0123456789" })).status, 401);
  assert.equal((await get("/api/private/nest/cam-a.jpg", { Origin: ORIGIN })).status, 401);
});

test("token → feed bytes, no-store, CORS only for the house origin", async () => {
  for (const n of ["cal-live", "cal-months", "kids-week"]) {
    const r = await get(`/api/private/${n}.json`, { "X-Private-Feed-Token": TOKEN, Origin: ORIGIN });
    assert.equal(r.status, 200, n);
    assert.deepEqual(JSON.parse(r.body.toString()), JSON.parse(fs.readFileSync(path.join(PRIV, n + ".json"), "utf8")));
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  }
  const other = await get("/api/private/cal-live.json", { Authorization: "Bearer " + TOKEN, Origin: "https://evil.example" });
  assert.equal(other.status, 200);
  assert.equal(other.headers.get("access-control-allow-origin"), null, "foreign origin gets no CORS grant");
});

test("cam stills: token only, slug only, no path tricks", async () => {
  const ok = await get("/api/private/nest/cam-a.jpg", { "X-Lights-Proxy-Token": TOKEN });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");
  assert.equal((await get("/api/private/nest/cam-b.jpg", { "X-Lights-Proxy-Token": TOKEN })).status, 404, "missing still = 404 offline");
  assert.equal((await get("/api/private/nest/Cam-A.jpg", { "X-Lights-Proxy-Token": TOKEN })).status, 404, "uppercase slug refused");
  assert.equal((await get("/api/private/nest/cam--a.jpg", { "X-Lights-Proxy-Token": TOKEN })).status, 404, "double hyphen refused");
  assert.equal((await get("/api/private/nest/" + "a".repeat(41) + ".jpg", { "X-Lights-Proxy-Token": TOKEN })).status, 404, "long slug refused");
  for (const p of ["/api/private/nest/..%2F..%2Fcal-live.jpg", "/api/private/%2e%2e/qa/cash.contract.json", "/api/private/nest/%2e%2e%2fcal-live.jpg", "/api/private/cal-live.json.bak", "/api/private/qa/cash.contract.json"]) {
    assert.notEqual((await get(p, { "X-Lights-Proxy-Token": TOKEN })).status, 200, p);
  }
});

test("health lists freshness only, never contents", async () => {
  const r = await get("/api/private/health", { "X-Private-Feed-Token": TOKEN });
  assert.equal(r.status, 200);
  const j = JSON.parse(r.body.toString());
  assert.equal(j.ok, true);
  assert.ok(j.files["cal-live"].bytes > 0);
  assert.ok(!r.body.toString().includes("Sample"), "no feed contents in health");
});

test("producers refuse to write private data inside a git work tree", () => {
  const ev = path.join(ROOT, "scripts/qa/fixtures/allday-nextleave.events.json");
  const a = spawnSync("node", [path.join(ROOT, "scripts/cal-from-events.mjs"), "--events", ev, "--out", path.join(ROOT, "data", "cal-live.json")], { encoding: "utf8" });
  assert.equal(a.status, 9, a.stderr);
  assert.ok(!fs.existsSync(path.join(ROOT, "data", "cal-live.json")));
  const wk = path.join(ROOT, "kids-week.json");
  fs.copyFileSync(path.join(FX, "kids-week.synthetic.json"), wk);
  try {
    const b = spawnSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", ev, "--week", wk, "--now", "2026-10-13T06:40:00-05:00"], { encoding: "utf8" });
    assert.equal(b.status, 9, b.stderr);
  } finally { fs.rmSync(wk, { force: true }); }
  const c = spawnSync("python3", [path.join(ROOT, "scripts/cal-months.py"), path.join(ROOT, "data", "cal-months.json"), ev], { encoding: "utf8", env: { ...process.env } });
  assert.notEqual(c.status, 0);
  assert.match(c.stderr + c.stdout, /PRIVFEED1 HARD FAIL|privacy-scrub\.tsv missing/);
  assert.ok(!fs.existsSync(path.join(ROOT, "data", "cal-months.json")));
});

test("producers write to the private folder by default", () => {
  const ev = path.join(ROOT, "scripts/qa/fixtures/allday-nextleave.events.json");
  const out = path.join(PRIV, "cal-live.json");
  fs.rmSync(out, { force: true });
  const a = spawnSync("node", [path.join(ROOT, "scripts/cal-from-events.mjs"), "--events", ev], { encoding: "utf8", env: { ...process.env, WARDOS_PRIVATE_DIR: PRIV } });
  assert.equal(a.status, 0, a.stderr);
  assert.ok(fs.existsSync(out));
});

test("public tree carries no private data files and no embedded copy", () => {
  for (const f of ["data/cal-live.json", "data/cal-months.json", "kids-week.json", "data/kids-week.json", "scripts/qa/fixtures/cash.contract.json",
    "data/nest-snaps/cam-a.jpg"]) {
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", f], { cwd: ROOT });
    assert.notEqual(tracked.status, 0, f + " must not be tracked");
  }
  const snaps = spawnSync("git", ["ls-files", "data/nest-snaps"], { cwd: ROOT, encoding: "utf8" });
  assert.deepEqual(snaps.stdout.split("\n").filter((f) => f && !f.endsWith("/.gitkeep")), [], "no camera still is tracked");
  const kd = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
  assert.match(kd, /var EMBEDDED = null;/);
  assert.ok(!fs.existsSync(path.join(ROOT, "phone-shots")) || spawnSync("git", ["ls-files", "phone-shots"], { cwd: ROOT, encoding: "utf8" }).stdout.trim() === "");
  /* OAUTHPAGES · the Google consent-screen pages are plain static text: no scripts at all, so no feed and no hub key */
  const STATIC_PAGES = new Set(["about.html", "privacy.html"]);
  for (const f of STATIC_PAGES) assert.deepEqual(staticPageViolations(fs.readFileSync(path.join(ROOT, f), "utf8"), f), [], f + " passes the static-page allowlist");
  for (const f of fs.readdirSync(ROOT).filter((n) => /\.html$/.test(n) && !STATIC_PAGES.has(n))) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    /* HUBPIN1 · house-hub.js (the key allow-list guard) loads first, then private-feed.js before everything else */
    const i = s.indexOf("private-feed.js"), j = s.search(/<script(?![^>]*(private-feed|house-hub))[^>]*>/), h = s.indexOf("house-hub.js");
    assert.ok(i > 0, f + " loads private-feed.js");
    assert.ok(h > 0 && h < i, f + " loads house-hub.js before private-feed.js");
    assert.ok(j < 0 || i < j, f + " loads private-feed.js before any other script");
  }
});

/* FOLLOWUP1 · OAUTHPAGES allowlist (replaces the old 5-pattern blocklist). The consent pages may only use these tags and
   attributes, carry no handler/src/data:/javascript:/http-equiv/CSS escape, and link only to the sibling page, the Google
   permissions page, the Google user data policy and the one public contact mailto. Anything else is a violation. */
const STATIC_TAGS = new Set(["html", "head", "meta", "title", "style", "body", "main", "h1", "h2", "p", "a", "footer"]);
const STATIC_ATTRS = new Set(["lang", "charset", "name", "content", "href"]);
const STATIC_SIBLING = { "about.html": "privacy.html", "privacy.html": "about.html" };
/* FOLLOWUP2 · the <style> block is pinned by exact text (sha256 per page): any CSS change, including rules that hide text
   or inject it with content:, must be a deliberate edit of these hashes */
const STATIC_STYLE_SHA256 = {
  "about.html": "796eb8b952f2c1f560d40e7b1288fd7b048abef5f4fb41da77dbc369f83a7e29",
  "privacy.html": "c64d50aaa987cee51f33cea8bc67c654356e897517a909758f46de22fe8e5eb1",
};
const STATIC_META_NAMES = new Set(["viewport", "description", "robots"]);
const STATIC_LINKS = ["https://myaccount.google.com/permissions", "https://developers.google.com/terms/api-services-user-data-policy", "mailto:atlasward" + "@" + "mail.grokbot.com"];
function staticPageViolations(html, name) {
  const bad = [];
  const body = html.replace(/^<!doctype html>\s*/i, "");
  if (/<!/.test(body)) bad.push("comment or declaration");
  if (/\son[a-z]+\s*=/i.test(html)) bad.push("on* handler");
  for (const [rx, why] of [[/\bsrc\s*=/i, "src="], [/\bsrcset\s*=/i, "srcset="], [/data:/i, "data:"], [/javascript:/i, "javascript:"], [/http-equiv/i, "http-equiv"],
    [/\\/, "backslash escape"], [/url\s*\(/i, "url("], [/image-set/i, "image-set"], [/@import/i, "@import"], [/expression\s*\(/i, "expression("]]) if (rx.test(html)) bad.push(why);
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  if (styles.length > 1) bad.push("more than one style block");
  for (const css of styles) if (crypto.createHash("sha256").update(css).digest("hex") !== STATIC_STYLE_SHA256[name]) bad.push("style block changed");
  if ((html.match(/<\s*style\b/gi) || []).length !== styles.length) bad.push("style tag with attributes or unclosed");
  for (const m of body.matchAll(/<\s*\/?\s*([^\s>\/]+)([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    if (!STATIC_TAGS.has(tag)) bad.push("tag " + tag);
    if (tag === "meta") {
      const at = {};
      for (const a of m[2].matchAll(/([^\s="'\/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) at[a[1].toLowerCase()] = (a[2] || "").replace(/^["']|["']$/g, "");
      const keys = Object.keys(at).sort().join(",");
      const okCharset = keys === "charset";
      const okNamed = keys === "content,name" && STATIC_META_NAMES.has(at.name.toLowerCase()) && !/\/\/|:/.test(at.content);
      if (!okCharset && !okNamed) bad.push("meta not allowed");
    }
    for (const a of m[2].matchAll(/([^\s="'\/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const attr = a[1].toLowerCase();
      if (!STATIC_ATTRS.has(attr)) { bad.push("attr " + attr + " on " + tag); continue; }
      if (attr === "href") {
        const v = (a[2] || "").replace(/^["']|["']$/g, "");
        if (tag !== "a") bad.push("href on " + tag);
        else if (v !== STATIC_SIBLING[name] && !STATIC_LINKS.includes(v)) bad.push("link " + v.slice(0, 40));
      }
    }
  }
  if (/</.test(body.replace(/<[^>]*>/g, ""))) bad.push("stray or unclosed tag");
  return bad;
}

test("FOLLOWUP1 static-page allowlist catches every hidden-content trick", () => {
  const base = fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8");
  assert.deepEqual(staticPageViolations(base, "privacy.html"), []);
  const inject = (frag) => base.replace("</main>", frag + "\n</main>");
  const mustFail = {
    "img onerror": '<img src="x" onerror="alert(1)">',
    "svg onload": '<svg onload="alert(1)"></svg>',
    "javascript: link": '<a href="javascript:alert(1)">x</a>',
    "javascript: link unquoted": "<a href=javascript:alert(1)>x</a>",
    "meta refresh": '<meta http-equiv="refresh" content="0;url=https://example.invalid/">',
    "base href": '<base href="https://example.invalid/">',
    "CSS-escaped url": "<style>body { background: \\75rl(https://example.invalid/x.png); }</style>",
    "image-set": '<style>body { background: image-set("https://example.invalid/x.png" 1x); }</style>',
    "script": "<script>1</script>",
    "uppercase script": "<SCRIPT>1</SCRIPT>",
    "link stylesheet": '<link rel="stylesheet" href="https://example.invalid/x.css">',
    "iframe": '<iframe src="https://example.invalid/"></iframe>',
    "object": '<object data="x.swf"></object>',
    "embed": '<embed src="x">',
    "form": '<form action="https://example.invalid/"></form>',
    "frameset": "<frameset><frame></frameset>",
    "video src": '<video src="x.mp4"></video>',
    "srcset": '<p srcset="a.png 1x">x</p>',
    "data: image": '<a href="data:text/html;base64,PGI+">x</a>',
    "outside link": '<a href="https://example.invalid/">x</a>',
    "other mailto": '<a href="mailto:someone' + '@' + 'example.invalid">x</a>',
    "comment": "<!-- hidden --" + ">",
    "data attribute": '<p data-x="1">x</p>',
    "style attribute": '<p style="color:red">x</p>',
    "css import": "<style>@import 'x.css';</style>",
    "css url": "<style>body { background: url(x.png); }</style>",
    "og meta": '<meta property="og:title" content="x">',
    "og:image outside URL": '<meta name="og:image" content="https://example.invalid/x.png">',
    "twitter:image outside URL": '<meta name="twitter:image" content="https://example.invalid/x.png">',
    "meta referrer": '<meta name="referrer" content="unsafe-url">',
    "meta description with URL": '<meta name="description" content="see https://example.invalid">',
    "meta robots with colon": '<meta name="robots" content="x:y">',
    "CSS content injection": "<style>h2::after { content: 'Call now'; }</style>",
    "CSS hide text": "<style>h2 + p { display: none; }</style>",
  };
  for (const [why, frag] of Object.entries(mustFail)) assert.notDeepEqual(staticPageViolations(inject(frag), "privacy.html"), [], "must fail: " + why);
});

test("FOLLOWUP2 static pages: an edited style block fails; plain description/robots meta passes", () => {
  const base = fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8");
  assert.notDeepEqual(staticPageViolations(base.replace("main {", "h2 + p { display: none; }\n  main {"), "privacy.html"), []);
  assert.notDeepEqual(staticPageViolations(base.replace("main {", "h1::after { content: 'x'; }\n  main {"), "privacy.html"), []);
  const ok = base.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="description" content="Privacy policy">\n<meta name="robots" content="index, follow">');
  assert.deepEqual(staticPageViolations(ok, "privacy.html"), []);
});

test("FOLLOWUP2 privacy-scan email: the one allowed address only as an exact whole match on privacy.html; encoded @ caught everywhere", async () => {
  const { emailHit, decodeAt } = await import("../privacy-scan.mjs");
  const A = "atlasward" + "@" + "mail.grokbot.com";
  assert.equal(emailHit("privacy.html", A), false);
  assert.equal(emailHit("privacy.html", '<a href="mailto:' + A + '">' + A + "</a>"), false);
  for (const bad of [A + ".evil", A.replace(/\.com$/, ".company"), "x" + A, "evil." + A, A + " and bob" + "@" + "example.org", A.toUpperCase()]) {
    assert.equal(emailHit("privacy.html", bad), true, "must hit on privacy.html (" + bad.length + " chars)");
  }
  assert.equal(emailHit("about.html", A), true, "allowed only on privacy.html");
  assert.equal(emailHit("scripts/x.mjs", A), true);
  /* encoded forms are assembled at run time so this file itself carries none */
  for (const sep of ["%" + "40", "%" + "40", "&#" + "64;", "&#" + "064;", "&#" + "x40;", "&" + "commat;"]) {
    assert.equal(emailHit("README.md", "bob" + sep + "example.org"), true, "encoded @ must hit: " + sep.length);
  }
  assert.equal(emailHit("README.md", "bob" + "%" + "40" + "EXAMPLE.org"), true);
  assert.equal(emailHit("privacy.html", A.replace("@", "%" + "40")), false, "the allowed address encoded on its own page stays allowed");
  assert.equal(emailHit("about.html", A.replace("@", "&#" + "64;")), true);
  assert.equal(decodeAt("a&" + "commat;b"), "a@b");
});

test("gitignore keeps private files out", () => {
  for (const f of ["data/cal-live.json", "data/cal-months.json", "kids-week.json", "data/kids-week.json", "data/nest-snaps/cam-a.jpg", "phone-shots/x.png", "x.private.json"]) {
    const r = spawnSync("git", ["check-ignore", "-q", "--no-index", f], { cwd: ROOT });
    assert.equal(r.status, 0, f + " should be ignored");
  }
});

test("privacy-scan: clean tree passes; planted secrets fail with category only", () => {
  const clean = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--skip", "(^|/)zz-"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(clean.status, 0, clean.stdout);
  /* per-run name so parallel runs never share or delete each other's plant */
  const plantName = "zz-privfeed-plant-" + process.pid + "-" + crypto.randomBytes(4).toString("hex") + ".txt";
  const plant = path.join(ROOT, plantName);
  const planted = ["someone@" + "example-mail.com", "$" + "12,345.67", "#QX7" + "K2M", "WN" + "1234", "1234 Main" + " Street", "LAT" + " = 39.12345"].join("\n");
  fs.writeFileSync(plant, planted);
  try {
    const r = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)" + plantName.replace(/\./g, "\\.") + "$"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 1);
    for (const cat of ["email", "money_figure", "booking_code", "flight_number", "street_address", "precise_coords"]) assert.match(r.stdout, new RegExp("PRIVACY " + cat + " "));
    assert.ok(!r.stdout.includes("12,345.67") && !r.stdout.includes("Main Street"), "values never printed");
  } finally { fs.rmSync(plant, { force: true }); }
});

test("GATE 2 runs on the synthetic contract when the private one is absent and prints no figures", () => {
  const r = spawnSync("node", [path.join(ROOT, "scripts/qa/gate2-numbers-contract.mjs")], { encoding: "utf8", env: { ...process.env, WARDOS_PRIVATE_DIR: path.join(TMP, "none") } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /SYNTHETIC fixture/);
  assert.ok(!/\$\d/.test(r.stdout.split("\n").filter((l) => /PASS/.test(l)).join("\n")));
});

/* ───────────── PRIVFEED2 · house device state, hub address, nest proxy, money, birthday ───────────── */
for (const n of ["lights-live", "sensi-live", "nest-live"]) fs.copyFileSync(path.join(FX, n + ".synthetic.json"), path.join(PRIV, n + ".json"));

test("PRIVFEED2 device feeds: token only, bytes from the private folder", async () => {
  for (const n of ["lights-live", "sensi-live", "nest-live"]) {
    assert.equal((await get(`/api/private/${n}.json`)).status, 401, n);
    assert.equal((await get(`/api/private/${n}.json`, { Origin: ORIGIN })).status, 401, n + " origin alone");
    const r = await get(`/api/private/${n}.json`, { "X-Private-Feed-Token": TOKEN, Origin: ORIGIN });
    assert.equal(r.status, 200, n);
    assert.equal(JSON.parse(r.body.toString()).source, "synthetic");
    assert.match(r.headers.get("cache-control"), /no-store/);
  }
});

test("PRIVFEED2 device files are not tracked, are ignored, and the hub address is not in the tree", () => {
  for (const f of ["data/lights-live.json", "data/sensi-live.json", "data/nest-live.json"]) {
    assert.notEqual(spawnSync("git", ["ls-files", "--error-unmatch", f], { cwd: ROOT }).status, 0, f + " tracked");
    assert.equal(spawnSync("git", ["check-ignore", "-q", "--no-index", f], { cwd: ROOT }).status, 0, f + " not ignored");
  }
  const g = spawnSync("git", ["grep", "-n", "-E", "\"(writeProxy|nestProxy)\"\\s*:\\s*\"https://", "--", ".", ":!scripts/qa/fixtures"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(g.stdout.trim(), "", "hub address baked into a tracked file");
  const pf = fs.readFileSync(path.join(ROOT, "private-feed.js"), "utf8");
  assert.ok(!/origFetch\("data\/lights-live\.json/.test(pf), "shim must not discover the hub from a public file");
});

test("PRIVFEED2 nest-live producer refuses repo output and defaults to the private folder", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pf-home-"));
  const priv = path.join(TMP, "priv-nest");
  const env = { ...process.env, HOME: home, WARDOS_PRIVATE_DIR: priv };
  const a = spawnSync("node", [path.join(ROOT, "scripts/nest-fetch.mjs"), "--out", path.join(ROOT, "data", "nest-live.json")], { encoding: "utf8", env });
  assert.equal(a.status, 9, a.stderr);
  assert.ok(!fs.existsSync(path.join(ROOT, "data", "nest-live.json")));
  spawnSync("node", [path.join(ROOT, "scripts/nest-fetch.mjs")], { encoding: "utf8", env });
  assert.ok(fs.existsSync(path.join(priv, "nest-live.json")), "need-token payload lands in the private folder");
});

test("PRIVFEED2 nest proxy (tunnel-reachable) serves only public page code", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pf-nest-"));
  fs.mkdirSync(path.join(home, ".config", "wardos"), { recursive: true });
  fs.writeFileSync(path.join(home, ".config", "wardos", "nest-refresh.token"), "fake-refresh\n");
  fs.writeFileSync(path.join(home, ".config", "wardos", "nest-sdm.json"), '{"projectId":"p","clientId":"c","clientSecret":"s"}');
  fs.writeFileSync(path.join(home, ".config", "wardos", "nest-device.token"), "test-nest-key-0123456789\n", { mode: 0o600 }); /* FOLLOWUP2 · env key is label-only */
  const env = { ...process.env, HOME: home }; delete env.NEST_PROXY_TOKEN;
  const h = spawnListening("node", [path.join(ROOT, "scripts/nest-webrtc-proxy.mjs"), "--host", "127.0.0.1", "--port", "0"], { env }); /* CAMLOCK1 · no token, no start; LHVID1' · port 0 */
  const child = h.child;
  try {
    assert.ok(await h.ready, "nest proxy test instance did not start");
    const port = h.port;
    for (const p of ["/.git/config", "/.git/HEAD", "/data/nest-snaps/.gitkeep", "/scripts/privacy-scan.mjs", "/%2e%2e/%2e%2e/etc/passwd", "/LIGHTS-LIVE.md", "/plates/x.html", "/package.json"]) {
      assert.equal((await fetch(`http://127.0.0.1:${port}${p}`)).status, 404, p);
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/private-feed.js`)).status, 200);
  } finally { child.kill(); }
});

test("PRIVFEED2 no allowance figures or kid birthday names in markup (street label: box denylist scan)", () => {
  const files = spawnSync("git", ["ls-files", "*.html", "*.js"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter(Boolean).filter((f) => !f.startsWith("scripts/qa/fixtures/"));
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/\$\d{1,3}\s?(?:ea\s?)?(?:wk|\/\s?hr)\b|\bJar\s*·\s*\$\d+/i.test(s), f + " carries an allowance figure");
    assert.ok(!/\b(?:Ainsley|Hayes|Harris)(?:'s)?\s+birthday\b/i.test(s), f + " names a kid's birthday");
  }
  const allowance = fs.readFileSync(path.join(ROOT, "sheet-allowance.html"), "utf8");
  /* AINSSTAR1 (Atlas Oct 20) · Ainsley's jar carries no money or star rate; the boys' jars stay bound to the private feed */
  assert.match(allowance, /data-jar-goal="victory-jar"/);
  assert.match(allowance, /data-jar-goal="gem-jar"/);
  assert.doesNotMatch(allowance, /data-jar-goal="tour-jar"/);
  assert.match(allowance, /house-money-bind\.js/);
});

test("privacy-scan catches the PRIVFEED2 categories without printing values", () => {
  const plant = path.join(ROOT, "zz-privfeed2-plant.txt");
  fs.writeFileSync(plant, [
    "enterprises/" + "abcdef123456/devices/" + "ZYXWVU987654",
    "36-6f-92" + "-aa-bb-cc-dd-ee",
    '"writeProxy": "' + "https://" + 'hub.example.org"',
    "Tour Jar · " + "$42",
    "$11" + " ea wk",
    "Hayes" + " birthday",
  ].join("\n"));
  try {
    const r = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-privfeed2-plant"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 1);
    for (const cat of ["device_path", "hardware_id", "hub_url", "allowance_figure", "kid_birthday"]) assert.match(r.stdout, new RegExp("PRIVACY " + cat + " "), cat);
    assert.ok(!r.stdout.includes("hub.example.org") && !r.stdout.includes("$42"));
  } finally { fs.rmSync(plant, { force: true }); }
});

test("CALSCRUB1 · privacy-scan catches seat codes and calendar-derived strings without printing them", () => {
  const plant = path.join(ROOT, "zz-calscrub1-plant.txt");
  const list = path.join(os.tmpdir(), "calscrub1-" + process.pid + ".txt");
  fs.writeFileSync(list, "# test list\nT\tZebra Quokka Gala at Mossfield\nC\tQX7" + "Z9P\n", { mode: 0o600 });
  fs.writeFileSync(plant, ["Sec" + " 77 Row Q 3-4", "Row" + " 9 Seats 1-2", "see you at the Zebra Quokka" + " Gala at Mossfield", "conf qx7" + "z9p", "a second row of seating"].join("\n"));
  try {
    const r = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-calscrub1-plant"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, WARDOS_CAL_STRINGS: list } });
    assert.equal(r.status, 1);
    const seat = (r.stdout.match(/PRIVACY seat_code /g) || []).length, cal = (r.stdout.match(/PRIVACY calendar_string /g) || []).length;
    assert.equal(seat, 2, "both seat shapes, not the plain sentence");
    assert.equal(cal, 2, "title and confirmation code, case-insensitive");
    assert.ok(!/Quokka|QX7|Row Q/i.test(r.stdout));
  } finally { fs.rmSync(plant, { force: true }); fs.rmSync(list, { force: true }); }
});

test("FOLLOWUP4 · privacy-scan fails when the loaded denylist falls below the floor recorded in the list header", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denyfloor-"));
  const names = path.join(dir, "names.tsv"), deny = path.join(dir, "deny.txt");
  const scan = () => spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-no-such-file-denyfloor$"],
    { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH, HOME: dir, WARDOS_PRIVATE_NAMES: names, WARDOS_PRIVACY_DENYLIST: deny, WARDOS_CAL_STRINGS: path.join(dir, "none.txt") } });
  try {
    fs.writeFileSync(names, "partner\tZqfloorp\ncoparent\tZqfloorc\n", { mode: 0o600 });
    fs.writeFileSync(deny, "# wardos-min-patterns: 4\nzzsynthone\nzzsynthtwo\n", { mode: 0o600 });
    let r = scan();
    assert.equal(r.status, 0, "4 loaded, floor 4: " + r.stdout);
    assert.match(r.stdout, /denylist patterns 4/);
    fs.writeFileSync(deny, "# wardos-min-patterns: 4\nzzsynthone\n", { mode: 0o600 });
    r = scan();
    assert.equal(r.status, 2, "3 loaded, floor 4 must fail");
    assert.match(r.stdout, /below the recorded floor 4/);
    assert.ok(!/zzsynth|Zqfloor/.test(r.stdout), "no list values printed");
    fs.writeFileSync(names, "# wardos-min-patterns: 9\npartner\tZqfloorp\n", { mode: 0o600 });
    fs.writeFileSync(deny, "zzsynthone\nzzsynthtwo\n", { mode: 0o600 });
    assert.equal(scan().status, 2, "a floor in the names list counts too");
    fs.writeFileSync(names, "partner\tZqfloorp\n", { mode: 0o600 });
    assert.equal(scan().status, 0, "no floor recorded: old behaviour");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("FOLLOWUP5 · privacy-scan exits 2 on an empty or missing required list and on a malformed floor line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "denyempty-"));
  const names = path.join(dir, "names.tsv"), deny = path.join(dir, "deny.txt");
  const scan = (...extra) => spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-no-such-file-denyempty$", ...extra],
    { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH, HOME: dir, WARDOS_PRIVATE_NAMES: names, WARDOS_PRIVACY_DENYLIST: deny, WARDOS_CAL_STRINGS: path.join(dir, "none.txt") } });
  try {
    fs.writeFileSync(names, "partner\tZqemptyp\ncoparent\tZqemptyc\n", { mode: 0o600 });
    fs.writeFileSync(deny, "# wardos-min-patterns: 3\nzzsynthone\nzzsynthtwo\n", { mode: 0o600 });
    assert.equal(scan("--require-denylist").status, 0, "both lists present and at the floor");
    fs.writeFileSync(deny, "", { mode: 0o600 });
    let r = scan();
    assert.equal(r.status, 2, "0-byte denylist must fail even with names present");
    assert.match(r.stdout, /deny list loaded 0 entries/);
    assert.equal(scan("--require-denylist").status, 2, "0-byte denylist with --require-denylist");
    fs.writeFileSync(deny, "# only a comment\n\n", { mode: 0o600 });
    assert.equal(scan().status, 2, "comments-only denylist loads 0 entries");
    fs.writeFileSync(deny, "zzsynthone\n", { mode: 0o600 });
    fs.writeFileSync(names, "", { mode: 0o600 });
    assert.equal(scan().status, 2, "0-byte names list must fail");
    fs.rmSync(names);
    assert.equal(scan().status, 0, "names list absent without the flag: generic + denylist still run");
    r = scan("--require-denylist");
    assert.equal(r.status, 2, "names list missing with --require-denylist");
    assert.match(r.stdout, /names list missing/);
    fs.writeFileSync(names, "partner\tZqemptyp\n", { mode: 0o600 });
    fs.writeFileSync(deny, "# wardos-min-patterns: 15 (note text after the number)\nzzsynthone\n", { mode: 0o600 });
    r = scan();
    assert.equal(r.status, 2, "a floor line with trailing text must not silently set no floor");
    assert.match(r.stdout, /1 malformed wardos-min-patterns line/);
    fs.writeFileSync(deny, "# wardos-min-patterns: 15\n# note text on its own line\nzzsynthone\n", { mode: 0o600 });
    r = scan();
    assert.equal(r.status, 2, "fixed floor line now enforces the floor (2 loaded, floor 15)");
    assert.match(r.stdout, /below the recorded floor 15/);
    assert.ok(!/zzsynth|Zqempty|note text/.test(r.stdout + r.stderr), "no list values printed");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
