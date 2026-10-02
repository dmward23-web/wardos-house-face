// NICEONE1 + JARTILE1 · node scripts/wall/nice-one.test.mjs · hub PIN gate (route auth, wrong PIN, lockout + persistence,
// one grant per unlock in 60 s, tapId idempotency, not-configured), client hold/pad/gate with Ledger's HouseJar, jar tile
// (wallDisplay only: no digits, no $, no fill), kid pages never render it, parent-pin.mjs (--help writes nothing), git guards.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createNiceOne, GRANT_SEC } from "../house/nice-one.mjs";
import { createPinStore, MAX_FAILS, LOCK_MS } from "../house/parent-pin-store.mjs";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const HouseJar = require(path.join(ROOT, "house-jar.js"));
const W = require(path.join(ROOT, "house-jar-wall.js"));
const SEED = JSON.parse(read("data/house-jar.json"));
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "nice1-"));
const U = (i) => `0000000${i}-1111-4222-8333-444444444444`.slice(-36);
const clock = (t0 = Date.parse("2026-10-01T20:30:00-05:00")) => { let v = t0; const f = () => v; f.add = (ms) => { v += ms; }; return f; };
function hub(dir, now) { const pins = createPinStore({ dir, now }); return { pins, n1: createNiceOne({ dir, now, pins }) }; }
const call = (h, p, m, b) => h.n1.handle(p, m, b);
const memStore = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

/* the proxy's real checkAuth (lifted from the file) in front of the real route, same order as lights-write-proxy.mjs */
function proxyAuth() {
  const src = read("scripts/lights-write-proxy.mjs");
  const m = /function checkAuth\(req, args\) \{[\s\S]*?\n\}\n/.exec(src); assert.ok(m, "checkAuth found");
  return new Function(m[0] + "; return checkAuth;")();
}
async function serve(n1, args) {
  const checkAuth = proxyAuth();
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (s, o) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (!checkAuth(req, args)) return send(401, { error: "unauthorized" });
    let raw = ""; for await (const c of req) raw += c;
    const r = await n1.handle(u.pathname, req.method, raw ? JSON.parse(raw) : {});
    return r ? send(r.status, r.body) : send(404, {});
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}

await t("route is behind the proxy's checkAuth: no key -> 401, wrong key -> 401, hub key -> 200 {pinSet} only", async () => {
  const src = read("scripts/lights-write-proxy.mjs");
  const gate = src.indexOf("if (!checkAuth(req, args))"), route = src.indexOf('pathname.startsWith("/api/nice-one/")'), sensi = src.indexOf('pathname === "/api/sensi"');
  assert.ok(gate > 0 && route > gate, "nice-one route sits after the auth gate (same as Sensi/Kasa)"); assert.ok(sensi > gate);
  assert.doesNotMatch(src, /house\.jar\.shared\.v1/, "TAP_KEY_RE untouched (Dan's last-yes)");
  assert.match(src, /const TAP_KEY_RE = \/\^house-checkoffs:/);
  const dir = tmpDir(); const { n1 } = hub(dir, clock());
  const { srv, base } = await serve(n1, { authToken: "hub-key-x", lan: true });
  try {
    for (const [p, m] of [["/api/nice-one/status", "GET"], ["/api/nice-one/verify", "POST"], ["/api/nice-one/consume", "POST"], ["/api/nice-one/check", "POST"]]) {
      assert.equal((await fetch(base + p, { method: m })).status, 401, p + " without key");
      assert.equal((await fetch(base + p, { method: m, headers: { "X-Lights-Proxy-Token": "nope" } })).status, 401, p + " wrong key");
    }
    const ok = await fetch(base + "/api/nice-one/status", { headers: { "X-Lights-Proxy-Token": "hub-key-x" } });
    assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { pinSet: false }, "status leaks nothing but pinSet");
  } finally { srv.close(); }
});
await t("not configured (no PIN): status pinSet false, verify/consume/check answer 503 and spend no attempt", async () => {
  const dir = tmpDir(), h = hub(dir, clock());
  assert.deepEqual((await call(h, "/api/nice-one/status", "GET")).body, { pinSet: false });
  assert.equal((await call(h, "/api/nice-one/verify", "POST", { pin: "1234" })).status, 503);
  assert.equal((await call(h, "/api/nice-one/consume", "POST", { tapId: U(1), action: "nice-one", grantToken: "x" })).status, 503);
  assert.equal((await call(h, "/api/nice-one/check", "POST", { grantToken: "x" })).status, 503);
  assert.equal(fs.existsSync(path.join(dir, "parent-pin-lock.json")), false, "no attempt counted");
  assert.equal((await call(h, "/api/nice-one/status", "POST")).status, 405);
});
await t("PIN storage: salted scrypt hash, mode 600, PIN never stored; verify response never carries the hash", async () => {
  const dir = tmpDir(), h = hub(dir, clock()); h.pins.set("4821");
  const file = path.join(dir, "parent-pin.json"), rec = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(rec.algo, "scrypt"); assert.ok(Buffer.from(rec.salt, "base64").length >= 16); assert.ok(rec.hash.length > 20);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /4821/);
  const rec2 = (h.pins.set("4821"), JSON.parse(fs.readFileSync(file, "utf8"))); assert.notEqual(rec2.salt, rec.salt, "fresh salt each set");
  const r = await call(h, "/api/nice-one/verify", "POST", { pin: "4821" });
  assert.equal(r.status, 200); assert.deepEqual(Object.keys(r.body).sort(), ["expiresIn", "grantToken", "ok"]); assert.equal(r.body.expiresIn, GRANT_SEC);
  assert.ok(!JSON.stringify(r.body).includes(rec2.hash) && !JSON.stringify(r.body).includes(rec2.salt));
  assert.deepEqual((await call(h, "/api/nice-one/status", "GET")).body, { pinSet: true });
  assert.throws(() => h.pins.set("12a4")); assert.throws(() => h.pins.set("12345"));
  assert.match(read("scripts/house/parent-pin-store.mjs"), /timingSafeEqual/);
});
await t("wrong PIN -> 403 with tries left; non-4-digit input counts as wrong", async () => {
  const dir = tmpDir(), h = hub(dir, clock()); h.pins.set("4821");
  let r = await call(h, "/api/nice-one/verify", "POST", { pin: "0000" }); assert.equal(r.status, 403); assert.equal(r.body.error, "wrong-pin"); assert.equal(r.body.triesLeft, 4);
  r = await call(h, "/api/nice-one/verify", "POST", { pin: "48211" }); assert.equal(r.body.triesLeft, 3);
  r = await call(h, "/api/nice-one/verify", "POST", {}); assert.equal(r.body.triesLeft, 2);
  r = await call(h, "/api/nice-one/verify", "POST", { pin: "4821" }); assert.equal(r.status, 200, "right PIN still works before the 5th miss");
  r = await call(h, "/api/nice-one/verify", "POST", { pin: "1111" }); assert.equal(r.body.triesLeft, 4, "a good PIN resets the count");
});
await t("lockout: 5 wrong PINs lock 10 min (even the right PIN is refused), persisted across a proxy restart, then fresh tries", async () => {
  const dir = tmpDir(), now = clock(), h = hub(dir, now); h.pins.set("4821");
  for (let i = 0; i < MAX_FAILS - 1; i++) assert.equal((await call(h, "/api/nice-one/verify", "POST", { pin: "0000" })).status, 403);
  const r5 = await call(h, "/api/nice-one/verify", "POST", { pin: "0000" }); assert.equal(r5.status, 423); assert.equal(r5.body.retryAfterSec, LOCK_MS / 1000);
  assert.equal((await call(h, "/api/nice-one/verify", "POST", { pin: "4821" })).status, 423, "right PIN refused while locked");
  const lock = path.join(dir, "parent-pin-lock.json"); assert.equal(fs.statSync(lock).mode & 0o777, 0o600);
  const h2 = hub(dir, now); /* restart: new process state, same config dir */
  now.add(9 * 60 * 1000);
  const r = await call(h2, "/api/nice-one/verify", "POST", { pin: "4821" }); assert.equal(r.status, 423, "still locked after restart"); assert.ok(r.body.retryAfterSec <= 60);
  now.add(61 * 1000);
  assert.equal((await call(h2, "/api/nice-one/verify", "POST", { pin: "4821" })).status, 200, "lock served");
  assert.equal(fs.existsSync(lock), false);
});
await t("one grant per unlock within 60 s: second consume refused, expired grant refused, check doesn't spend it", async () => {
  const dir = tmpDir(), now = clock(), h = hub(dir, now); h.pins.set("4821");
  let g = (await call(h, "/api/nice-one/verify", "POST", { pin: "4821" })).body.grantToken;
  assert.equal((await call(h, "/api/nice-one/check", "POST", { grantToken: g })).status, 200);
  assert.equal((await call(h, "/api/nice-one/check", "POST", { grantToken: g + "x" })).status, 403);
  let r = await call(h, "/api/nice-one/consume", "POST", { grantToken: g, tapId: U(1), action: "nice-one" }); assert.equal(r.status, 200); assert.equal(r.body.duplicate, undefined);
  r = await call(h, "/api/nice-one/consume", "POST", { grantToken: g, tapId: U(2), action: "nice-one" }); assert.equal(r.status, 403); assert.equal(r.body.error, "grant-used");
  assert.equal((await call(h, "/api/nice-one/check", "POST", { grantToken: g })).status, 403, "spent grant can't open the parent view");
  g = (await call(h, "/api/nice-one/verify", "POST", { pin: "4821" })).body.grantToken;
  now.add(GRANT_SEC * 1000 + 1);
  r = await call(h, "/api/nice-one/consume", "POST", { grantToken: g, tapId: U(3), action: "redeem" }); assert.equal(r.status, 403); assert.equal(r.body.error, "grant-expired");
  r = await call(h, "/api/nice-one/consume", "POST", { grantToken: "", tapId: U(4), action: "nice-one" }); assert.equal(r.body.error, "no-grant");
  r = await call(h, "/api/nice-one/consume", "POST", { grantToken: g, tapId: U(5), action: "cash" }); assert.equal(r.status, 400, "only nice-one / redeem / reverse");
});
await t("tapId idempotency: a resync of a spent tapId answers duplicate (no new grant needed, survives restart); tapId must be a uuid", async () => {
  const dir = tmpDir(), now = clock(), h = hub(dir, now); h.pins.set("4821");
  const g = (await call(h, "/api/nice-one/verify", "POST", { pin: "4821" })).body.grantToken;
  assert.equal((await call(h, "/api/nice-one/consume", "POST", { grantToken: g, tapId: U(7), action: "nice-one" })).status, 200);
  let r = await call(h, "/api/nice-one/consume", "POST", { grantToken: "whatever", tapId: U(7), action: "nice-one" });
  assert.equal(r.status, 200); assert.equal(r.body.duplicate, true);
  r = await call(hub(dir, now), "/api/nice-one/consume", "POST", { tapId: U(7), action: "nice-one" }); assert.equal(r.body.duplicate, true, "after restart");
  assert.equal(fs.statSync(path.join(dir, "nice-one-taps.json")).mode & 0o777, 0o600);
  assert.equal((await call(h, "/api/nice-one/consume", "POST", { tapId: "tap-1", action: "nice-one" })).status, 400);
});
await t("short tap does nothing; a 1.5 s hold opens (progress shown, reset on early release)", () => {
  let tm = 0, q = []; const timers = { setTimeout: (f, ms) => { q.push({ f, at: tm + ms, iv: 0 }); return q.length; }, clearTimeout: (id) => { if (q[id - 1]) q[id - 1].dead = true; },
    setInterval: (f, ms) => { q.push({ f, at: tm + ms, iv: ms }); return q.length; }, clearInterval: (id) => { if (q[id - 1]) q[id - 1].dead = true; } };
  const advance = (ms) => { const end = tm + ms; for (;;) { const due = q.filter((x) => !x.dead && x.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; tm = due.at; if (due.iv) due.at += due.iv; else due.dead = true; due.f(); } tm = end; };
  let opened = 0, prog = []; const h = W.createHold({ ms: 1500, timers, now: () => tm, onOpen: () => opened++, onProgress: (p) => prog.push(p) });
  h.down(); advance(300); assert.equal(h.up(), false); assert.equal(opened, 0, "short tap"); assert.equal(prog.at(-1), 0);
  h.down(); advance(1400); h.up(); advance(500); assert.equal(opened, 0, "1.4 s is still not a hold");
  prog = []; h.down(); advance(1500); assert.equal(opened, 1); assert.equal(prog.at(-1), 1); assert.ok(prog.some((p) => p > 0 && p < 1), "progress indicator moves");
  assert.equal(W.HOLD_MS, 1500);
  const pad = W.createPad(4); pad.digit("1"); pad.digit("x"); pad.digit("2"); assert.equal(pad.dots(), "\u25CF\u25CF\u25CB\u25CB"); pad.back(); assert.equal(pad.value(), "1");
  assert.equal(pad.digit("2") || pad.digit("3") || pad.digit("4"), true); assert.equal(pad.digit("5"), true); assert.equal(pad.value(), "1234");
});
await t("client gate + Ledger's HouseJar: Nice one writes only after hub verify + consume; parentGate armed for one call; tapId replay adds nothing", async () => {
  const dir = tmpDir(), now = clock(), h = hub(dir, now); h.pins.set("4821");
  const fakeFetch = async (url, o) => { const u = new URL(url); assert.equal(o.headers["X-Lights-Proxy-Token"], "k"); const r = await h.n1.handle(u.pathname, o.method, o.body ? JSON.parse(o.body) : {}); return { status: r.status, json: async () => r.body }; };
  const storage = memStore();
  const gate = W.createGate({ fetch: fakeFetch, base: () => "http://hub", token: () => "k", now, storage });
  const book = HouseJar.create({ seed: SEED, storage, now, parentGate: gate.parentGate });
  assert.equal(book.niceOne({ jar: "hayes", chip: "min-10", reason: "positive-attitude", pinOk: true }).error, "parent-gate", "pinOk alone is not enough: gate hook is closed");
  assert.equal((await gate.act("nice-one", U(8), (ok) => book.niceOne({ jar: "hayes", chip: "min-10", reason: "positive-attitude", pinOk: ok }))).error, "grant-expired", "no verify yet");
  assert.equal((await gate.status()).pinSet, true);
  assert.equal((await gate.verify("0000")).error, "wrong-pin");
  assert.equal((await gate.verify("4821")).ok, true);
  assert.equal(gate.view, undefined, "JAR-VIEW-01: the wall gate has no totals view");
  const r = await gate.act("nice-one", U(8), (ok) => book.niceOne({ jar: "hayes", chip: "min-10", reason: "positive-attitude", pinOk: ok }));
  assert.equal(r.ok, true); assert.equal(r.entry.qty, 10); assert.equal(r.entry.unit, "min");
  assert.equal(gate.parentGate(), false, "hook closed again");
  const again = await gate.act("nice-one", U(8), () => { throw new Error("must not run"); }); assert.equal(again.duplicate, true);
  assert.equal((await gate.act("nice-one", U(9), (ok) => book.niceOne({ jar: "hayes", chip: "pick-1", reason: "extra-effort", pinOk: ok }))).ok, false, "one grant per unlock");
  assert.equal(book.entries().length, 1); assert.equal(book.pending().length, 1, "queued per device (Not synced)");
  assert.equal(book.wallDisplay().syncLabel, "Not synced");
  assert.deepEqual(book.chips().map((c) => c.label), ["+10 min", "+15 min", "+1 pick"]);
  /* no key / no hub -> status false (control stays hidden), no request made */
  let calls = 0; const g2 = W.createGate({ fetch: () => { calls++; }, base: () => "", token: () => "", now, storage });
  assert.equal((await g2.status()).pinSet, false); assert.equal(calls, 0);
});
await t("jar tile = wallDisplay only: rule + names + 'Not synced'; no digits, no $, no fill, no balance; hidden without seed", () => {
  const book = HouseJar.create({ seed: SEED, storage: memStore() });
  const html = W.jarTileHtml(W.jarTileModel(book.wallDisplay())), text = html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  assert.match(text, /The jar pays time and picks\. Never cash\./); for (const nm of ["Family jar", "Harris", "Hayes", "Ainsley"]) assert.ok(text.includes(nm));
  assert.match(text, /Not synced/);
  assert.doesNotMatch(text, /\d/, "no digits on the tile"); assert.doesNotMatch(html, /\$|<progress|<meter|fill|balance|width:/i, "no $, fill or balance");
  book.niceOne; /* even with entries, the tile can't show numbers */
  const tile = { hidden: false, innerHTML: "x" };
  assert.equal(W.paintJarTile(tile, HouseJar.create({ seed: null, storage: memStore() }).wallDisplay()), false); assert.equal(tile.hidden, true);
  assert.equal(W.paintJarTile(tile, null), false); assert.equal(tile.hidden, true);
  assert.match(read("wall.html"), /data-house-jar hidden/); assert.match(read("sheet-index.html"), /data-house-jar data-owner="Ledger" data-tile-id="house-jar" hidden/);
});
await t("JAR-VIEW-01 + JAR5 guard: no wall-loaded script calls HouseJar.parentView(); tile = wallDisplay() fields only, ruleText then ruleLine2 verbatim", () => {
  const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");
  const wallSrc = read("wall.html");
  const loaded = [...wallSrc.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
  assert.ok(loaded.includes("house-jar.js") && loaded.includes("house-jar-wall.js"));
  const own = fs.readdirSync(ROOT).filter((f) => /^house-wall-.*\.js$/.test(f));
  for (const f of ["wall.html", ...own, ...loaded.filter((f) => f !== "house-jar.js")]) {
    assert.doesNotMatch(strip(read(f)), /parentView\s*\(|\.parentView\b|\[\s*["']parentView["']\s*\]/, f + " calls parentView");
    assert.doesNotMatch(strip(read(f)), /data-grant-view|data-grant-totals|Jar totals/, f + " has a totals view");
  }
  assert.match(read("house-jar.js"), /function parentView\(g\)/, "parentView stays in Ledger's module");
  const book = HouseJar.create({ seed: SEED, storage: memStore() }), d = book.wallDisplay();
  assert.deepEqual(Object.keys(d).sort(), ["jars", "ruleLine2", "ruleText", "syncLabel", "synced"]);
  assert.equal(d.ruleText, "A stolen close zeros that personal jar for the day.");
  assert.equal(d.ruleLine2, "The jar pays time and picks. Never cash.");
  const html = W.jarTileHtml(W.jarTileModel(d));
  const i1 = html.indexOf('data-jar-rule>' + d.ruleText + "</p>"), i2 = html.indexOf('data-jar-rule2>' + d.ruleLine2 + "</p>");
  assert.ok(i1 > 0 && i2 > i1, "ruleText then ruleLine2, verbatim, adjacent");
  assert.equal(html.slice(i1).indexOf("</p>") + 4 + i1, html.indexOf("<p", i1 + 1), "ruleLine2 directly under ruleText");
  const text = html.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /\d|balance|total|min\b|picks? ·/i, "no digits, totals or balances");
  for (const lit of [d.ruleText, d.ruleLine2]) assert.ok(!read("house-jar-wall.js").includes(lit) && !wallSrc.includes(lit), "never hardcoded: " + lit);
  /* only wallDisplay() fields reach the tile: a display with an extra numeric field prints nothing extra */
  const html2 = W.jarTileHtml(W.jarTileModel(Object.assign({}, d, { totals: [{ jar: "hayes", min: 40 }], balance: 12 })));
  assert.equal(html2, html);
});
await t("kid pages never render Nice one or the jar tile; wall + hub seats have hosts", () => {
  assert.equal(W.allowedPage("/kid-ainsley.html", null), false); assert.equal(W.allowedPage("/x/kid-hayes.html", null), false);
  assert.equal(W.allowedPage("/sheet-index.html", "harris"), false, "body data-kid = a kid page");
  assert.equal(W.allowedPage("/wall.html", null), true); assert.equal(W.allowedPage("/sheet-index.html", null), true);
  const kidDoc = { body: { getAttribute: (k) => (k === "data-kid" ? "hayes" : null) }, querySelectorAll() { throw new Error("must not touch a kid page DOM"); } };
  assert.equal(W.mount({ document: kidDoc, location: { pathname: "/kid-hayes.html" }, book: {}, gate: {} }), null);
  for (const f of ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]) assert.doesNotMatch(read(f), /house-jar-wall\.js|house-jar\.js|data-nice-one|data-house-jar|data-nice-pad/, f);
  const wall = read("wall.html");
  for (const k of ["ainsley", "hayes", "harris"]) assert.match(wall, new RegExp('data-nice-one-host="' + k + '"'));
  assert.match(wall, /<script src="house-jar\.js"><\/script>\s*<script src="house-jar-wall\.js"><\/script>/); assert.match(wall, /HouseJarWall\.boot\(\)/);
  assert.match(read("sheet-index.html"), /house-jar-wall\.js\?v=NICEONE1/);
  assert.doesNotMatch(read("house-jar-wall.js"), /<input|contenteditable|prompt\(/, "no keyboard path");
});
await t("parent-pin.mjs: --help/-h and bad args write nothing (temp HOME); status/clear; set refuses without a terminal", () => {
  const H = tmpDir(), env = { ...process.env, HOME: H };
  const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, "scripts/parent-pin.mjs"), ...a], { env, encoding: "utf8", input: "1234\n1234\n" });
  for (const a of [["--help"], ["-h"], ["set", "--help"]]) { const r = run(...a); assert.equal(r.status, 0); assert.match(r.stdout, /^Usage: node scripts\/parent-pin\.mjs/); }
  assert.equal(run("bogus").status, 2); assert.equal(run().status, 2); assert.equal(run("set", "1234").status, 2);
  const s = run("set"); assert.equal(s.status, 2, "piped stdin is not a terminal"); assert.match(s.stderr, /needs a terminal/);
  assert.match(run("status").stdout, /parent PIN: not set/);
  assert.deepEqual(fs.readdirSync(H), [], "nothing written under the temp HOME");
  createPinStore({ dir: path.join(H, ".config", "wardos") }).set("4821");
  assert.match(run("status").stdout, /parent PIN: set/); assert.match(run("clear").stdout, /cleared/); assert.match(run("status").stdout, /not set/);
});
await t("git guard: no parent PIN / lock / grant file or scrypt hash is committed; .gitignore covers them", () => {
  const files = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  assert.deepEqual(files.filter((f) => /parent-pin[^/]*\.json$|nice-one-taps\.json$/.test(f)), []);
  for (const f of files.filter((x) => /\.json$/.test(x))) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!(/"algo"\s*:\s*"scrypt"/.test(s) && /"salt"\s*:/.test(s)), f + " looks like a PIN hash");
  }
  const gi = read(".gitignore"); for (const p of ["parent-pin.json", "**/parent-pin*.json", "nice-one-taps.json"]) assert.ok(gi.includes(p), p);
  const ig = spawnSync("git", ["check-ignore", "parent-pin.json", "data/parent-pin.json", "config/parent-pin-lock.json", "nice-one-taps.json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(ig.stdout.trim().split("\n").length, 4);
});
console.log(`nice-one: ${n} tests PASS`);
