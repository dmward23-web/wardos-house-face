/* r55 · these four run in a browser with house-event-display.js loaded as a script.
   A node vm that never loads the display script misses all four. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

let cached = null;
function probe() {
  if (cached) return cached;
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r55_dom.py")], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-400));
  cached = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.equal(cached.loaded, true, "house-event-display.js did not load in the page");
  return cached;
}

test("r55 kid container name is not an event title", { skip: browser ? false : "SKIP no playwright" }, () => {
  assert.equal(probe().kidKept, true);
});

test("r55 shared view keeps a plain activity title", { skip: browser ? false : "SKIP no playwright" }, () => {
  assert.equal(probe().sharedTitle, true);
});

test("r55 a rejected row does not fall back to its raw title", { skip: browser ? false : "SKIP no playwright" }, () => {
  assert.equal(probe().rawGone, true);
});

test("r55 a legal row stays hidden", { skip: browser ? false : "SKIP no playwright" }, () => {
  assert.equal(probe().legalHidden, true);
});
