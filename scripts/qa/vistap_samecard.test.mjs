/* VISTAP-SAMECARD1 + VISTAP-EDGE1 · a nested button on its own card, and a bottom-edge overlap, are COVER. */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };

test("VISTAP same-card nested control and an inset edge both count as COVER", SKIP, () => {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/vistap_gate.py"), ROOT, ROOT, "/tmp/vistap-samecard", "--self-test"], { encoding: "utf8", timeout: 60000 });
  assert.match(r.stdout || "", /DIV\.what/, (r.stdout || "") + (r.stderr || ""));
  assert.match(r.stdout || "", /DIV\.edge/, (r.stdout || "") + (r.stderr || ""));
  assert.equal(r.status, 0);
});
