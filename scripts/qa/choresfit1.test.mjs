/* R3-1 · a chore row that does not fully clear the more chip is hidden and counted. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/choresfit1_render.py")], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;

test("R3 chores rows end above the more chip and every day-tap hits at centre, top, and bottom", SKIP, () => {
  const cols = data.cols.filter((c) => /Ainsley|Hayes|Harris/.test(c.name));
  assert.equal(cols.length, 3, JSON.stringify(data.cols));
  for (const col of cols) {
    assert.equal(col.low, 0, col.name + " " + JSON.stringify(col));
    assert.equal(col.misses, 0, col.name + " misses");
    assert.equal(col.chipTag, "BUTTON");
    assert.ok(col.chipH >= 64, col.name + " chip " + col.chipH);
  }
  const hayes = cols.find((c) => /Hayes/.test(c.name));
  const harris = cols.find((c) => /Harris/.test(c.name));
  assert.equal(hayes.chip, "+4 more", JSON.stringify(hayes));
  assert.equal(harris.chip, "+4 more", JSON.stringify(harris));
});
