// node livinghouse/tests/lh-l2.test.mjs
// Layer 2 rules: memory yard, fog priority, creature pose, mirror hooks, hub origin. Synthetic fixtures only.
import { assertSealed } from "../../scripts/qa/temp-home.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
assertSealed();
const req = createRequire(import.meta.url);
const R = req("../lh-rules.js");
const root = fileURLToPath(new URL("../..", import.meta.url));
const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

// fog: today and tomorrow sharp, later days deeper, capped. Rank is days out.
assert.deepEqual(R.fogPriority(0), { fog: false, fo: 0, rank: 0 });
assert.deepEqual(R.fogPriority(1), { fog: false, fo: 0, rank: 1 });
assert.equal(R.fogPriority(2).fog, true);
assert.ok(Math.abs(R.fogPriority(2).fo - 0.16) < 1e-9, "two days out");
assert.ok(Math.abs(R.fogPriority(3).fo - 0.32) < 1e-9);
assert.equal(R.fogPriority(6).fo, 0.5);
assert.equal(R.fogPriority(40).fo, 0.5);
assert.equal(R.fogPriority(-3).rank, 0);
let prev = 0;
for (let d = 2; d <= 8; d++) { const fo = R.fogPriority(d).fo; assert.ok(fo >= prev, "fog never thins as days grow"); prev = fo; }

// creatures: absent while away, pace only inside the window when motion is allowed
assert.equal(R.creaturePose({ away: true, soon: true, reduced: false }), "absent");
assert.equal(R.creaturePose({ away: false, soon: true, reduced: false }), "pace");
assert.equal(R.creaturePose({ away: false, soon: true, reduced: true }), "perch");
assert.equal(R.creaturePose({ away: false, soon: false, reduced: false }), "perch");
assert.equal(R.creaturePose({}), "perch");

// mirror: lights and nest when live; garage and smoke always missing; a hot thermostat is not smoke
const heat = { thermostat: { online: true, mode: "Heat", ambient: 18, heatSetpoint: 21 } };
const on = R.mirrorRead({ lightsLive: true, lights: { lights: [{ id: "harris-room", on: true, online: true }] }, nestLive: true, nest: { cameras: [{ online: true, snapshotUrl: null }] }, sensi: heat });
assert.equal(on.harris, true);
assert.equal(on.cam, true);
assert.equal(on.garage.feed, "missing");
assert.equal(on.smoke.feed, "missing");
assert.match(on.smoke.why, /no chimney smoke feed/);
const off = R.mirrorRead({ lightsLive: true, lights: { lights: [{ id: "harris-room", on: false, online: true }] }, nestLive: true, nest: { cameras: [{ online: false, snapshotUrl: null, streamUrl: null }] }, sensi: heat });
assert.equal(off.harris, false);
assert.equal(off.cam, false);
const stale = R.mirrorRead({ lightsLive: false, lights: { lights: [{ id: "harris-room", on: true }] }, nestLive: false, nest: { cameras: [{ online: true }] }, sensi: heat });
assert.equal(stale.harris, null);
assert.equal(stale.cam, false);
assert.equal(R.mirrorRead({ nestLive: true, nest: { cameras: [{ online: false, snapshotUrl: "snaps/item-1.jpg" }] } }).cam, true);

// hub origin: https stays, loopback http stays, anything else is refused
assert.equal(R.hubBase("https://hub.example.test"), "https://hub.example.test");
assert.equal(R.hubBase("http://127.0.0.1:9"), "http://127.0.0.1:9");
assert.equal(R.hubBase("http://localhost:8787/"), "http://localhost:8787");
assert.equal(R.hubBase("http://[::1]:9"), "http://[::1]:9");
for (const bad of ["", "http://192.168.1.9:8787", "http://127.0.0.1.evil.test", "http://evil.test", "http://127.0.0.1:9/x@y", "file:///tmp/taps"]) assert.equal(R.hubBase(bad), "", bad);

// nightly yard: device record is 0 or 1, never a count, never an away night, never before 21:00
const fill = { done: 2, total: 3 }, none = { done: 0, total: 3 };
assert.equal(R.MEMORY_HOUR, 21);
let n = R.memoryNight(null, { day: "2026-10-23", hour: 20.5, fill: fill, away: false });
assert.equal(n.wrote, false);
assert.deepEqual(n.items, []);
n = R.memoryNight(n.store, { day: "2026-10-23", hour: 21, fill: fill, away: false });
assert.equal(n.wrote, true);
assert.deepEqual(n.store.days["2026-10-23"], 1);
assert.deepEqual(n.items, ["2026-10-23"]);
n = R.memoryNight(n.store, { day: "2026-10-23", hour: 22, fill: fill, away: false });
assert.equal(n.wrote, false, "same night does not rewrite");
n = R.memoryNight(n.store, { day: "2026-10-25", hour: 23, fill: fill, away: true });
assert.equal(n.wrote, false);
assert.equal(n.store.days["2026-10-25"], undefined, "away night is not stored");
n = R.memoryNight(n.store, { day: "2026-10-26", hour: 21, fill: null, away: false });
assert.equal(n.wrote, false, "no fill, no invented night");
n = R.memoryNight(n.store, { day: "2026-10-26", hour: 21, fill: none, away: false });
assert.equal(n.store.days["2026-10-26"], 0);
assert.ok(!n.items.includes("2026-10-26"), "a zero night draws no pebble");
const junk = { days: { "2026-10-01": 1, "note": "Kid A secret", "2026-10-02": 5, "2026-10-23": 1 } };
n = R.memoryNight(junk, { day: "2026-10-27", hour: 10, fill: fill, away: false });
assert.deepEqual(Object.keys(n.store.days).sort(), ["2026-10-01", "2026-10-23"]);
const many = { days: {} };
for (let i = 1; i <= 25; i++) many.days["2026-09-" + String(i).padStart(2, "0")] = 1;
n = R.memoryNight(many, { day: "2026-10-01", hour: 12, fill: null, away: false });
assert.equal(Object.keys(n.store.days).length, 21);
assert.equal(n.items.length, R.SHOW_NIGHTS);
assert.ok(!JSON.stringify(n.items).includes("secret"));

// page contract: taps route, shared away filter, no score text, no direct withDan read
const js = src("../lh.js"), html = src("../index.html"), feeds = src("../FEEDS.md");
assert.match(js, /\/api\/taps/);
assert.match(js, /LHRules\.hubBase/);
assert.match(js, /A\.isAwayAt\(t\)/);
assert.ok(!/function wd\(/.test(js), "no second away reader");
assert.ok(!/\.withDan\b/.test(js), "lh.js does not read the day flag itself");
assert.match(js, /if \(cu && cu\.away && KID\.test\(t\)\) return false/);
assert.ok(!/textContent = cu\.away \? "Resting"/.test(js), "away pot has no word");
assert.match(js, /\[data-lh=chores-sub\]"\)\.textContent = f == null && !cu\.away \? "No chore feed yet" : ""/);
assert.match(js, /data-art", "missing"/);
assert.match(js, /sill-/);
assert.match(html, /id="lh-garage"/);
assert.match(html, /id="lh-yard-week"/);
assert.match(html, /no chimney smoke feed/);
assert.match(feeds, /DEVICE LOCAL/);
assert.match(feeds, /no chimney smoke feed/);
assert.match(feeds, /no garage door state/);
assert.match(feeds, /no shared chore history/);
assert.match(feeds, /sill-cat\.webp/);
assert.ok(!/Chimney smoke \| REAL/.test(feeds), "smoke is a hook, not a heat inference");
for (const f of ["../lh.js", "../lh-rules.js"]) {
  const s = src(f);
  assert.ok(!/Date\.now\(\)|new Date\(\)/.test(s), f + " does not read the current time");
}

if (process.env.LH_SKIP_BROWSER === "1") {
  console.log("lh-l2: ok (browser skipped)");
} else {
  const r = spawnSync("python3", ["livinghouse/tests/l2_board.py", "check"], {
    cwd: root, encoding: "utf8", timeout: 240000,
    env: process.env
  });
  if (r.stdout) process.stdout.write(r.stdout.endsWith("\n") ? r.stdout : r.stdout + "\n");
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    assert.fail("l2 board check failed: " + (r.error ? r.error.message : "exit " + r.status));
  }
  console.log("lh-l2: ok");
}
