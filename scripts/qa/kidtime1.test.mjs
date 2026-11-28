/* R3-4 · the kid Today strip shows the clock time, not FRI 4. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function measure() {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/kidtime1_render.py")], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-400));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

const data = browser ? measure() : null;

test("R3 Hayes Today strip shows 5:00 PM Make bed and does not stop at FRI 4", SKIP, () => {
  const rows = data.rows;
  assert.ok(rows.length > 0, JSON.stringify(rows));
  assert.ok(rows.some((row) => /5:00 PM/.test(row) && /Make bed/.test(row)), JSON.stringify(rows));
  assert.equal(rows.some((row) => /^FRI 4\b/.test(row) && !/5:00 PM/.test(row)), false, JSON.stringify(rows));
});
