/* KIDMUST1 · Day-0 must rows stay above the jar and the day buttons, and the hidden count is on the chip. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/kidmust1_render.py")], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;

test("KIDMUST1 Day-0 must rows on all 3 kid boards: visible + N equals total, chip text is exact, centres hit, nothing covers the day buttons or the jar, nothing truncates", SKIP, () => {
  for (const kid of ["kid-ainsley", "kid-hayes", "kid-harris"]) {
    const d = data[kid];
    assert.ok(d.total > 0, kid + " " + JSON.stringify(d));
    assert.equal(d.visible + d.hidden, d.total, kid + " count " + JSON.stringify(d));
    const want = d.hidden === 0 ? "" : (kid === "kid-ainsley" ? "More" : ("+" + d.hidden + " more"));
    assert.equal(d.chip, want, kid + " chip " + JSON.stringify(d));
    assert.equal(d.rowHits, true, kid + " row hit");
    assert.equal(d.chipHit, true, kid + " chip hit");
    assert.deepEqual(d.overlaps, [], kid + " overlap");
    assert.equal(d.chipOver, false, kid + " chip overlap");
    assert.deepEqual(d.trunc, [], kid + " trunc");
  }
});
