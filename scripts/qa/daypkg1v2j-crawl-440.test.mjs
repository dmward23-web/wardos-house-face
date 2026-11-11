/* DAYPKG1 v2j · the 440 viewport of the kid crawl, in its own file so the suite's 240s file cap
   covers one viewport. The assertions live in daypkg1v2j-crawl.test.mjs; this file only selects the size. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

test("DAYPKG1 v2j browser crawl @440", browser ? { timeout: 230000 } : { skip: "SKIP no playwright (QA_NO_BROWSER)" }, () => {
  const r = spawnSync(process.execPath, ["--test", "--test-timeout=220000", "--test-name-pattern=browser crawl @440", path.join(ROOT, "scripts/qa/daypkg1v2j-crawl.test.mjs")], {
    encoding: "utf8",
    timeout: 210000,
    env: { ...process.env, CRAWL_ONLY: "440" }
  });
  assert.equal(r.status, 0, "440 crawl\n" + String(r.stdout).slice(-800) + String(r.stderr).slice(-400));
});
