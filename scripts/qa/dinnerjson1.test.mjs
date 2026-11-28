/* DINNERJSON1 · node --test scripts/qa/dinnerjson1.test.mjs
   JSON rows, 404 fallback, stale week, flagged budget, and the 1920x1080 layout. Each test can fail on its own. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

function run(mode) {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/dinnerjson1_render.py"), mode], { encoding: "utf8", timeout: 90000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-600) + (r.stdout || "").slice(-300));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

test("JSON present renders the JSON meal row", SKIP, () => {
  const row = run("present");
  assert.equal(row.source, "json");
  assert.ok(row.meals.includes("Pizza night"), JSON.stringify(row.meals));
  assert.equal(row.budget, "65.00");
  assert.deepEqual(row.stores, ["40.00", "25.00"]);
});

test("404 renders the client fallback and never a blank list", SKIP, () => {
  const row = run("missing");
  assert.equal(row.meals.length, 0);
  assert.match(row.text, /No pick yet/);
  assert.equal(row.source, "fallback");
  assert.ok(row.rows.length >= 1, JSON.stringify(row.rows));
});

test("a week_start that does not cover today falls back", SKIP, () => {
  const row = run("stale");
  assert.equal(row.meals.length, 0);
  assert.match(row.text, /No pick yet/);
  assert.equal(row.source, "fallback");
});

test("a flagged budget shows the flag and not the amount", SKIP, () => {
  const row = run("flagged");
  assert.ok(row.meals.includes("Pizza night"));
  assert.match(row.budget, /Needs a look/);
  assert.equal(row.budget.includes("65.00"), false);
});

test("dinner rows hit-test, do not overlap, and do not truncate at 1920x1080", SKIP, () => {
  const row = run("layout");
  assert.equal(row.overlap, false);
  assert.equal(row.trunc, 0);
  assert.ok(row.hits.every(Boolean), JSON.stringify(row.hits));
  assert.deepEqual(row.stores, ["40.00", "25.00"]);
});
