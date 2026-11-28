/* B6 · node --test scripts/qa/nowfreeze1.test.mjs
   Two ?now= values with freeze=1 must change the date text and the Ahead rows. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("two frozen ?now values change the date text and the Ahead rows", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/nowfreeze1_render.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  const row = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.notEqual(row.a.date, row.b.date, JSON.stringify(row));
  assert.match(row.a.date, /Dec/);
  assert.match(row.b.date, /Dec/);
  assert.notEqual(row.a.ahead, row.b.ahead, JSON.stringify(row));
  assert.ok(row.a.ahead.length >= 1 && row.b.ahead.length >= 1, JSON.stringify(row));
});
