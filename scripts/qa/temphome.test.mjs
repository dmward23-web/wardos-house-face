/* TEMPHOME1 · node --test scripts/qa/temphome.test.mjs: the shared guard seals HOME before any private-list reader loads */
import { assertSealed, sealedRequire, TEMP_HOME } from "./temp-home.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("HOME is a fresh temp folder, WARDOS_* unset, no names file at any reader path", () => {
  assert.equal(os.homedir(), TEMP_HOME);
  assert.deepEqual(Object.keys(process.env).filter((k) => k.startsWith("WARDOS_")), []);
  assert.equal(assertSealed(), TEMP_HOME);
  const S = sealedRequire(createRequire(import.meta.url), path.join(ROOT, "school-names.js"));
  assert.deepEqual(S.schoolTokens(), [], "sealed: no school rows reach the reader");
});
test("the guard fails when HOME is put back or a reader path leaves the temp folder", () => {
  const was = process.env.HOME;
  try {
    process.env.WARDOS_PRIVATE_NAMES = "/nonexistent-real/private-names.tsv";
    assert.throws(() => assertSealed(), /outside the temp folder/);
  } finally { delete process.env.WARDOS_PRIVATE_NAMES; }
  try { process.env.HOME = "/"; assert.throws(() => assertSealed(), /TEMPHOME1/); } finally { process.env.HOME = was; }
  assert.equal(assertSealed(), TEMP_HOME);
  assert.ok(fs.existsSync(TEMP_HOME));
});
