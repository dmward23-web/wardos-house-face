/* PRIVFEED3 · Alfred's privfeed1 FAIL defects stay fixed (node --test scripts/qa/privfeed3.test.mjs). Synthetic names only. */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1 (LHVID1): WARDOS_* unset and a temp HOME before any private-list reader loads
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
process.env.WARDOS_NAMES = "partner=Partnerly;coparent=Coparentia";
const scan = (...extra) => spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--generic-only", ...extra], { cwd: ROOT, encoding: "utf8" });

assertSealed();
test("P1 · no camera stills or page screenshots anywhere; every tracked image is on the art allow-list", () => {
  const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const allow = new Set(read("scripts/privacy-art-allowlist.txt").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean));
  const IMGX = /\.(png|jpe?g|webp|gif|heic|heif|avif|bmp|tiff?|svg|mp4|mov|m4v|webm)$/i;
  for (const f of files) {
    if (!IMGX.test(f)) continue;
    assert.doesNotMatch(f, /(^|\/)snaps\/|cam-live|-heat\.png$|hub-header-|hub-heat-pass\.png$|screenshot|phone-shots\//i, f);
    assert.ok(allow.has(f), "image not on the art allow-list: " + f);
  }
  for (const f of allow) assert.ok(files.includes(f), "allow-list names a file that is not tracked: " + f);
  for (const f of allow) assert.match(f, /^[A-Za-z0-9_./-]+\.(png|jpe?g|webp|gif|svg)$/, "allow-list holds art file paths only");
});

test("P1 · privacy-scan flags ANY image or video outside the allow-list (tree, and --images --rev for pre-push)", () => {
  assert.equal(scan("--skip", "(^|/)zz-").status, 0);
  const rev = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--images", "--generic-only", "--rev", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  assert.match(rev.stdout, /privacy-scan/);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4ae0000000049454e44ae426082", "hex");
  const plants = ["plates/zz-plant/frame.png", "plates-receipt/zz-plant/x.jpg", "zz-plant-shot.png", "ori/plates/zz-plant.webp", "assets/zz-plant.webp", "art/zz-plant.gif", "zz-plant-clip.mp4", "theme-tiles/zz-plant.svg"].map((f) => path.join(ROOT, f));
  try {
    for (const p of plants) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, png); }
    const r = scan("--only", "(^|/)zz-plant");
    assert.equal(r.status, 1);
    const n = (r.stdout.match(/PRIVACY unlisted_image /g) || []).length;
    assert.equal(n, plants.length, r.stdout);
  } finally {
    for (const p of plants) fs.rmSync(p, { force: true });
    for (const d of ["plates/zz-plant", "plates-receipt/zz-plant"]) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });
  }
});

test("pre-push hook runs the image check and refuses non-noreply authors", () => {
  const hook = read("scripts/hooks/pre-push");
  assert.match(hook, /privacy-scan\.mjs" --images --rev "\$lsha"/);
  assert.match(hook, /users\\\.noreply\\\.github\\\.com/);
});

test("P2 · TEXTLAW1 cleanText: no em dashes, arrows, booking codes, partner or co-parent names", async () => {
  const { cleanText, cleanWeek } = await import("../cal-from-events.mjs");
  const cases = [
    ["Practice MOVED → Thu", /moved to Thu/],
    ["Pickup — gym → home", /^Pickup · gym to home$/],
    ["Hotel #" + "QX7" + "K2M check-in", /^Hotel check-in$/],
    ["Dinner with Partnerly", /^Dad: Dinner$/],
    ["Kids — pickup at their mom's", /^Kids (?:· )?pickup$/], /* CALSCRUB1: the exact title rule is box-only */
  ];
  for (const [inp, want] of cases) {
    const out = cleanText(inp);
    assert.match(out, want, inp + " -> " + out);
    assert.doesNotMatch(out, /[\u2014\u2192]|#\w|Partnerly|Coparentia/, out);
  }
  assert.equal(cleanText("2026-10-17"), "2026-10-17");
  const wk = cleanWeek({ kids: { ainsley: { today: [{ when: "Fri", what: "QXS Orange Day" }, { when: "Fri", what: "Dress-up day: wear a hat" }, { when: "Fri 3:00", what: "Dance — studio" }] } } });
  assert.deepEqual(wk.kids.ainsley.today.map((r) => r.what), ["Dance · studio"]);
});

test("P2 · TEXTLAW2 Python reader matches (cal-months labels)", () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/text_law.py")], { input: JSON.stringify(["A — B", "X → Y", "Code #AB12CD"]), encoding: "utf8", env: { ...process.env } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ["A · B", "X to Y", "Code"]);
});

test("P2 · LAW8C1 glass law: dress-up and colour days drop, face text has no em dash, arrow or '#'", () => {
  createRequire(import.meta.url)(path.join(ROOT, "house-face-law.js"));
  const L = globalThis.HouseFaceLaw;
  const cal = L.cleanFeed("cal-live", {
    upcomingLeaves: [{ summary: "QXS Red Day", start: "2026-10-20" }, { summary: "Pajama day", start: "2026-10-21" }, { summary: "Dentist — 3:00", start: "2026-10-22T15:00:00-05:00" }],
    boardStrip: { queue: [{ what: "Spirit week: wear blue" }, { what: "Swim MOVED → 5:00" }] },
    dan: { week: [{ what: "HD #2209 pickup", theme: "#e8b64a" }] },
  });
  assert.deepEqual(cal.upcomingLeaves.map((e) => e.summary), ["Dentist · 3:00"]);
  assert.deepEqual(cal.boardStrip.queue.map((e) => e.what), ["Swim moved to 5:00"]);
  assert.equal(cal.dan.week[0].what, "HD pickup");
  assert.equal(cal.dan.week[0].theme, "#e8b64a", "colours are not text");
  assert.equal(cal.upcomingLeaves[0].start, "2026-10-22T15:00:00-05:00", "times untouched");
  const months = L.cleanFeed("cal-months", { days: { "2026-10-20": { withDan: true, items: [{ c: "aware", l: "Orange Day" }, { c: "kid", l: "Game → Field 2" }] } } });
  assert.deepEqual(months.days["2026-10-20"].items, [{ c: "kid", l: "Game to Field 2" }]);
  assert.equal(months.days["2026-10-20"].withDan, true);
  assert.doesNotMatch(read("house-face-law.js"), /147th/, "no street label in the law");
});

test("P2 · private-feed applies the law to every calendar payload; pages load the law right after the feed", () => {
  const feed = read("private-feed.js");
  assert.match(feed, /HouseFaceLaw\.cleanFeed/);
  for (const f of ["sheet-index.html", "sheet-dan.html", "kid-ainsley.html", "kid-harris.html", "kid-hayes.html"]) {
    const s = read(f);
    const a = s.search(/private-feed\.js\?v=/), b = s.search(/house-face-law\.js\?v=/), c = s.search(/house-pair\.js\?v=/);
    assert.ok(a > 0 && b > a && c > b, f);
  }
});

test("P2 · offline hub: no bare em dash placeholder, no 'Oct → Nov horizon' label", () => {
  const hub = read("sheet-index.html");
  assert.doesNotMatch(hub, /data-mtile="m[01]">\u2014</);
  assert.doesNotMatch(hub, /horizon"\)/);
  assert.doesNotMatch(hub, /This month \u2192 next/);
});

test("P3 · camera stills never hit the static data/nest-snaps path (no 404s offline)", () => {
  const nest = read("house-nest.js"), hub = read("sheet-index.html");
  assert.doesNotMatch(hub, /<img[^>]+\ssrc="data\/nest-snaps\//);
  assert.match(nest, /PF\.bindSnap\(img, bust\)/);
  assert.match(nest, /privSnap && !\(PF && PF\.canSnap/);
  assert.match(read("private-feed.js"), /bindSnap: function/);
});

test("P3 · ?lightsProxyToken seed: 16+ chars like the server, then stripped from the address bar", () => {
  const feed = read("private-feed.js");
  assert.match(feed, /\[A-Za-z0-9_-\]\{16,\}\$\/\.test\(seed\)/);
  assert.match(feed, /stripParams\(\["lightsProxyToken", "proxyToken"\]\)/);
  for (const f of ["house-lights.js", "house-tapsync.js", "hub-key-entry.js"]) assert.match(read(f), /replaceState/, f);
  assert.doesNotMatch(read("house-spotify.js"), /function key\(\) \{ return qs\(/);
});

/* visible copy only: strip <script>/<style> blocks and comments, then look at what a screen can show */
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
test("P2 · fixed page text: allowance, chores, kid pages and Dad carry no em dash or arrow", () => {
  for (const f of ["sheet-allowance.html", "sheet-chores.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "sheet-dan.html", "sheet-index.html"]) {
    const v = visible(read(f));
    assert.doesNotMatch(v, /\u2014/, f + " em dash");
    assert.doesNotMatch(v, /[\u2192\u21d2\u27a1]|&rarr;/, f + " arrow");
  }
  for (const f of ["house-lights.js", "house-sensi.js", "house-clock.js", "house-board-strip.js", "house-weather.js", "house-kid-engage.js"]) {
    assert.doesNotMatch(read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /["']\u2014["']|>\u2014</, f + " dash placeholder");
  }
});

test("P3 · layout: Hayes never pans sideways (storm ring clipped), Dad rows wrap on a phone", () => {
  assert.match(read("kid-hayes.html"), /body\.theme-hayes \.panel\.cmd-kid \{ overflow-x: clip !important/);
  assert.match(read("sheet-dan.html"), /@media \(max-width:600px\)\{\.ds-rw\{white-space:normal/);
});

test("house host serves the vendored QR library and nothing else new", async () => {
  const { STATIC_OK } = await import(path.join(ROOT, "scripts/nest-webrtc-proxy.mjs"));
  assert.ok(STATIC_OK.test("vendor/qrcode-generator-2.0.4.js"));
  for (const p of ["vendor/x.json", "vendor/a/b.js", "data/cal-live.json", "scripts/lights-write-proxy.mjs", ".git/config"]) assert.ok(!STATIC_OK.test(p), p);
  assert.match(read("sheet-dan.html"), /src="vendor\/qrcode-generator-2\.0\.4\.js/);
});

test("LHVID1 · privacy-scan fails closed (exit 2) when 0 denylist patterns load, unless --generic-only says so", () => {
  const empty = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "lhvid1-nolists-"));
  const env = { ...process.env, HOME: empty, WARDOS_PRIVATE_NAMES: path.join(empty, "none.tsv"), WARDOS_PRIVATE_DIR: path.join(empty, "none"), WARDOS_PRIVACY_DENYLIST: path.join(empty, "none.txt") };
  const run = (...x) => spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-no-such-file-lhvid1$", ...x], { cwd: ROOT, encoding: "utf8", env });
  const r = run();
  assert.equal(r.status, 2, "0 patterns is a failure, not a WARN and a pass");
  assert.match(r.stdout, /FAIL: 0 denylist patterns/);
  assert.equal(run("--require-denylist").status, 2);
  const g = run("--generic-only");
  assert.equal(g.status, 0); assert.match(g.stdout, /WARN: no private names/);
});
