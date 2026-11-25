/* COVERSYNC1 · node --test scripts/qa/coversync1.test.mjs
   Force night then day with ?now. The #acer-cover ground colour must flip when HouseScene notifies. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("acer cover ground colour flips with HouseScene after night ?now", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/coversync1_render.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  const row = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(row.before && row.before.phase, "night", JSON.stringify(row.before));
  assert.ok(row.delta >= 30, "ground did not flip " + JSON.stringify(row));
  assert.match(row.after.bg, /wall-day/);
});
