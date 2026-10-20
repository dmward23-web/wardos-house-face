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

/* LHVID1 (Alfred P3 0622) · structural: every test that names a private-list reader imports the temp-home helper first and calls assertSealed */
test("TEMPHOME1 structural: every test naming a private-list reader is on the helper and calls assertSealed", () => {
  const ROOTD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const dirs = ["scripts/qa", "livinghouse/tests"], READER = /school-names\.js|private-dir\.mjs|text_law\.py|cal-months\.py|lh-rules\.js/;
  const bad = [];
  for (const d of dirs) for (const f of fs.readdirSync(path.join(ROOTD, d)).filter((x) => x.endsWith(".test.mjs"))) {
    if (f === "temphome.test.mjs") continue;
    const s = fs.readFileSync(path.join(ROOTD, d, f), "utf8");
    if (!READER.test(s)) continue;
    const firstImport = s.split("\n").find((l) => /^import\s/.test(l)) || "";
    if (!/temp-home\.mjs/.test(firstImport) || !/\bassertSealed\(/.test(s.replace(/import \{ assertSealed \}[^\n]*/, ""))) bad.push(d + "/" + f);
  }
  assert.deepEqual(bad, []);
});

/* LHVID1' (Alfred P2 0720) · python playwright stays reachable under the temp HOME without unsealing the lists */
test("tool paths pass through the HOME swap; private-list reader paths do not", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/qa/temp-home.mjs"), "utf8");
  assert.match(src, /PYTHONUSERBASE/); assert.match(src, /PLAYWRIGHT_BROWSERS_PATH/);
  assert.equal(process.env.PYTHONUSERBASE, undefined, "LHVID1'': the whole user base never crosses over");
  if (process.env.PYTHONPATH) assert.match(process.env.PYTHONPATH, /site-packages$/, "only the site-packages folder crosses over");
  assert.equal(assertSealed(), TEMP_HOME, "still sealed with the tool paths set");
});
/* LHVID1' teardown · the helper deletes its own temp HOME by exact path when the process exits */
test("teardown: a child that imports the helper leaves no temp HOME behind", async () => {
  const { spawnSync } = await import("node:child_process");
  const helper = path.join(ROOT, "scripts/qa/temp-home.mjs");
  for (const how of ["process.exit(0)", "throw new Error('boom')"]) {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", `import { TEMP_HOME } from ${JSON.stringify(helper)}; console.log(TEMP_HOME); ${how};`], { encoding: "utf8" });
    const made = r.stdout.trim().split("\n")[0];
    assert.match(path.basename(made), /^wardos-temphome-/);
    assert.equal(fs.existsSync(made), false, "removed on " + how);
  }
  const { withTempHome } = await import("./temp-home.mjs");
  assert.equal(typeof withTempHome, "function");
  assert.match(fs.readFileSync(helper, "utf8"), /rmSync\(TEMP_HOME/, "exact path, never a glob");
});
/* LHVID1'' (Alfred 0803 P4 seal) · no reader path resolves under a passed-through tool path; the private folder is unreachable */
test("seal: reader and private-list paths never sit under PYTHONPATH / PYTHONUSERBASE / PLAYWRIGHT_BROWSERS_PATH", async () => {
  const { passThroughPaths, REAL_PRIVATE } = await import("./temp-home.mjs");
  const under = (p, b) => { const a = path.resolve(p), c = path.resolve(b); return a === c || a.startsWith(c + path.sep); };
  for (const t of passThroughPaths()) for (const p of REAL_PRIVATE) assert.ok(!under(p, t), "private path under a tool path");
  assert.equal(fs.existsSync(path.join(os.homedir(), ".local/share/wardos-private")), false, "private folder unreachable from the sealed HOME");
  const was = process.env.PYTHONUSERBASE;
  try { process.env.PYTHONUSERBASE = path.dirname(path.dirname(REAL_PRIVATE[0])); assert.throws(() => assertSealed(), /passed-through tool path/, "a user base that is the private folder's parent fails the seal"); }
  finally { if (was === undefined) delete process.env.PYTHONUSERBASE; else process.env.PYTHONUSERBASE = was; }
  assert.equal(assertSealed(), TEMP_HOME);
  { const link = path.join(os.homedir(), ".local/share"); fs.mkdirSync(link, { recursive: true });
    const tgt = path.join(link, "wardos-private"); fs.symlinkSync(path.dirname(REAL_PRIVATE[1]), tgt);
    try { assert.throws(() => { try { fs.realpathSync(tgt); } catch { throw new Error("TEMPHOME1: a private-list path is reachable from the sealed HOME"); } assertSealed(); }, /reachable from the sealed HOME/, "a link from the temp HOME to the real private folder fails the seal"); }
    finally { fs.unlinkSync(tgt); } }
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("python3", ["-c", "import playwright, sys; sys.stdout.write('ok')"], { encoding: "utf8" });
  assert.equal(r.stdout, "ok", "python playwright still importable with PYTHONPATH = site-packages only");
});
