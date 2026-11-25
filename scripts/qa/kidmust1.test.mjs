/* KIDMUST1 · Day-0 and overflow must rows. The total is the fixture quest count, not whatever the DOM happened to render. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function quests(dir) {
  const feed = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/qa/fixtures", dir, "feed-kids-week.json"), "utf8"));
  const out = {};
  for (const [kid, row] of Object.entries(feed.kids)) {
    if (kid === "dan") continue;
    out["kid-" + kid] = (row.quests || []).length;
  }
  return out;
}

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/kidmust1_render.py")], {
    encoding: "utf8",
    timeout: 180000,
    env: process.env,
  });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;
const DAY = quests("day0-dec4");
const OVER = quests("overflow-r3");

function checkBoard(set, counts, label) {
  for (const kid of ["kid-ainsley", "kid-hayes", "kid-harris"]) {
    const d = set[kid];
    assert.equal(d.total, counts[kid], label + " " + kid + " dropped a fixture quest " + JSON.stringify(d));
    assert.equal(d.visible + d.hidden, d.total, label + " " + kid + " count");
    const want = d.hidden === 0 ? "" : (kid === "kid-ainsley" ? "More" : ("+" + d.hidden + " more"));
    assert.equal(d.chip, want, label + " " + kid + " chip");
    assert.equal(d.rowHits, true, label + " row hit");
    assert.equal(d.chipHit, true, label + " chip hit");
    assert.deepEqual(d.overlaps, [], label + " overlap");
    assert.equal(d.chipOver, false, label + " chip overlap");
    assert.deepEqual(d.trunc, [], label + " trunc");
    if (d.hidden > 0) assert.ok(d.chipH >= 64, label + " chip height " + d.chipH);
    assert.equal(d.homeHit, true, label + " home");
  }
}

test("KIDMUST1 Day-0 must rows match the fixture quest count and stay tappable", SKIP, () => {
  checkBoard(data.day0, DAY, "day0");
});

test("KIDMUST1 overflow shows More and +7 more, and the chip pages back", SKIP, () => {
  checkBoard(data.overflow, OVER, "overflow");
  assert.equal(data.overflow["kid-ainsley"].chip, "More");
  assert.equal(data.overflow["kid-hayes"].chip, "+7 more");
  assert.equal(data.overflow["kid-harris"].chip, "+7 more");
  assert.equal(data.tap.before, "+7 more");
  assert.equal(data.tap.mid, "Back");
  assert.ok(data.tap.midTitles.includes(data.tap.hid), JSON.stringify(data.tap));
  assert.equal(data.tap.after, "+7 more");
  assert.equal(data.tap.home, true);
  assert.ok(data.tap.chipH >= 64, data.tap.chipH);
});
