/* PRIVFEED1 · private runtime feed tests (node --test scripts/qa/privfeed.test.mjs). No real data: temp dirs + synthetic fixtures. */
import { freePortSync } from "./free-port.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FX = path.join(ROOT, "scripts/qa/fixtures/private");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "privfeed-"));
const PRIV = path.join(TMP, "private");
fs.mkdirSync(path.join(PRIV, "nest-snaps"), { recursive: true });
for (const n of ["cal-live", "cal-months", "kids-week"]) fs.copyFileSync(path.join(FX, n + ".synthetic.json"), path.join(PRIV, n + ".json"));
fs.writeFileSync(path.join(PRIV, "nest-snaps", "garage.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]));
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
  const r = await fetch(BASE + p, { headers });
  return { status: r.status, headers: r.headers, body: Buffer.from(await r.arrayBuffer()) };
}

test("no token → 401, house Origin alone never unlocks", async () => {
  assert.equal((await get("/api/private/cal-live.json")).status, 401);
  assert.equal((await get("/api/private/cal-live.json", { Origin: ORIGIN })).status, 401);
  assert.equal((await get("/api/private/cal-live.json", { "X-Private-Feed-Token": "wrong-token-0123456789" })).status, 401);
  assert.equal((await get("/api/private/nest/garage.jpg", { Origin: ORIGIN })).status, 401);
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

test("cam stills: token only, known cams only, no path tricks", async () => {
  const ok = await get("/api/private/nest/garage.jpg", { "X-Lights-Proxy-Token": TOKEN });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");
  assert.equal((await get("/api/private/nest/backyard.jpg", { "X-Lights-Proxy-Token": TOKEN })).status, 404, "missing still = 404 offline");
  assert.equal((await get("/api/private/nest/kitchen.jpg", { "X-Lights-Proxy-Token": TOKEN })).status, 404);
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
    "data/nest-snaps/front-door.jpg", "data/nest-snaps/garage.jpg", "data/nest-snaps/backyard.jpg"]) {
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", f], { cwd: ROOT });
    assert.notEqual(tracked.status, 0, f + " must not be tracked");
  }
  const kd = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
  assert.match(kd, /var EMBEDDED = null;/);
  assert.ok(!fs.existsSync(path.join(ROOT, "phone-shots")) || spawnSync("git", ["ls-files", "phone-shots"], { cwd: ROOT, encoding: "utf8" }).stdout.trim() === "");
  for (const f of fs.readdirSync(ROOT).filter((n) => /\.html$/.test(n))) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    /* HUBPIN1 · house-hub.js (the key allow-list guard) loads first, then private-feed.js before everything else */
    const i = s.indexOf("private-feed.js"), j = s.search(/<script(?![^>]*(private-feed|house-hub))[^>]*>/), h = s.indexOf("house-hub.js");
    assert.ok(i > 0, f + " loads private-feed.js");
    assert.ok(h > 0 && h < i, f + " loads house-hub.js before private-feed.js");
    assert.ok(j < 0 || i < j, f + " loads private-feed.js before any other script");
  }
});

test("gitignore keeps private files out", () => {
  for (const f of ["data/cal-live.json", "data/cal-months.json", "kids-week.json", "data/kids-week.json", "data/nest-snaps/garage.jpg", "phone-shots/x.png", "x.private.json"]) {
    const r = spawnSync("git", ["check-ignore", "-q", "--no-index", f], { cwd: ROOT });
    assert.equal(r.status, 0, f + " should be ignored");
  }
});

test("privacy-scan: clean tree passes; planted secrets fail with category only", () => {
  const clean = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--skip", "(^|/)zz-"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(clean.status, 0, clean.stdout);
  const plant = path.join(ROOT, "zz-privfeed-plant.txt");
  const planted = ["someone@" + "example-mail.com", "$" + "12,345.67", "#QX7" + "K2M", "WN" + "1234", "1234 Main" + " Street", "LAT" + " = 39.12345"].join("\n");
  fs.writeFileSync(plant, planted);
  try {
    const r = spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-privfeed-plant"], { cwd: ROOT, encoding: "utf8" });
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
  const port = freePortSync();
  const { spawn } = await import("node:child_process");
  const child = spawn("node", [path.join(ROOT, "scripts/nest-webrtc-proxy.mjs"), "--host", "127.0.0.1", "--port", String(port)], { env: { ...process.env, HOME: home, NEST_PROXY_TOKEN: "test-nest-key-0123456789" }, stdio: "ignore" }); /* CAMLOCK1 · no token, no start */
  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) { await new Promise((r) => setTimeout(r, 100)); try { up = (await fetch(`http://127.0.0.1:${port}/nest-webrtc.html`)).status === 200; } catch { /* starting */ } }
    assert.ok(up, "nest proxy test instance did not start");
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
  assert.match(allowance, /data-jar-goal="tour-jar"/);
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
