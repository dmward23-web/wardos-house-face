/* TESTFIX1 guard (node --test scripts/qa/testfix1-guard.test.mjs) · the CI test fixes cannot hide a real privacy failure:
   (1) privacy-scan run exactly as the CI privacy job runs it (--tree --generic-only) still EXITS 1 on a planted generic hit
       and on an unlisted image, so --generic-only never turns a hit into a pass;
   (2) the PRIVACY and PII jobs in privacy-scan.yml stay blocking: no continue-on-error, no "|| true" / "|| exit 0" after a scan;
   (3) the suite job still fails hard on a red suite, and run-tests.sh still fails on any test failure;
   (4) ciOnlySkip skips ONLY on the runner AND only when the precondition is really absent, and always says why.
   Plants are synthetic, built at run time, inside a private temp repo (never the working tree), removed in finally. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ciOnlySkip } from "./ci-only-skip.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function tempRepo(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "testfix1-guard-"));
  fs.mkdirSync(path.join(d, "scripts"));
  for (const f of ["scripts/privacy-scan.mjs", "scripts/privacy-art-allowlist.txt"]) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
  for (const [rel, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), body); }
  execFileSync("git", ["init", "-q", d]);
  execFileSync("git", ["-C", d, "add", "-A"]);
  return d;
}
const ciScan = (d) => spawnSync("node", [path.join(d, "scripts/privacy-scan.mjs"), "--tree", "--generic-only"], { cwd: d, encoding: "utf8" });

test("TESTFIX1 guard · privacy-scan --tree --generic-only (the CI command) still FAILS (exit 1) on a planted generic hit", () => {
  const tok = ["gh", "p_"].join("") + "Zz9".repeat(12);              /* synthetic token shape, built at run time */
  const d = tempRepo({ "zz-plant/notes.md": "x " + tok + "\n" });
  try {
    const r = ciScan(d);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /PRIVACY token_shape +zz-plant\/notes\.md:1/);
    assert.ok(!r.stdout.includes(tok), "category + path only, never the value");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test("TESTFIX1 guard · privacy-scan --tree --generic-only still FAILS (exit 1) on an unlisted image", () => {
  const d = tempRepo({ "zz-plant/pic.jxl": "synthetic-media-bytes" });
  try {
    const r = ciScan(d);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /PRIVACY unlisted_image +zz-plant\/pic\.jxl/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test("TESTFIX1 guard · the same clean temp repo passes (exit 0), so the two failures above come from the plants", () => {
  const d = tempRepo({ "zz-plant/ok.md": "plain words\n" });
  try { const r = ciScan(d); assert.equal(r.status, 0, r.stdout + r.stderr); } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

/* tiny job splitter for privacy-scan.yml: "  <job-id>:" at 2-space indent starts a job */
function jobs(yml) {
  const out = {}; let cur = null;
  for (const ln of yml.split("\n")) { const m = /^  ([A-Za-z0-9_-]+):\s*$/.exec(ln); if (m) { cur = m[1]; out[cur] = []; continue; } if (/^\S/.test(ln)) cur = null; if (cur) out[cur].push(ln); }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n")]));
}
test("TESTFIX1 guard · the PRIVACY and PII jobs stay blocking: no continue-on-error, no swallowed exit after a scan", () => {
  const J = jobs(read(".github/workflows/privacy-scan.yml"));
  for (const id of ["privacy-scan", "pii-guard"]) {
    assert.ok(J[id], "job " + id + " exists");
    assert.doesNotMatch(J[id], /continue-on-error/, id + " has no continue-on-error");
    assert.doesNotMatch(J[id], /\|\|\s*(?:true|:|exit 0)|;\s*true\b|set \+e/, id + " never swallows a scan exit");
  }
  assert.match(J["privacy-scan"], /run: node scripts\/privacy-scan\.mjs --tree --generic-only/, "the CI tree scan is the command pinned above");
  assert.match(J["pii-guard"], /run: node scripts\/qa\/pii-guard\.mjs --tree/, "the PII tree guard still runs");
});
test("TESTFIX1 guard · a red suite still fails the TESTS job, and run-tests.sh still fails on any failing test", () => {
  const J = jobs(read(".github/workflows/privacy-scan.yml"));
  assert.match(J["house-face-tests"], /SUITE_OUTCOME" != "success"[\s\S]*?exit 1/, "the report-only window step exits 1 on a red suite");
  const rt = read("scripts/qa/run-tests.sh");
  assert.match(rt, /if \[ "\$rc" -ne 0 \]; then echo "QA1: FAIL \(node --test exit \$rc\)" >&2; exit "\$rc"; fi/, "run-tests.sh exits non-zero on a failing test");
});
test("TESTFIX1 guard · ciOnlySkip skips only on the runner AND only when the precondition is absent, with a printed reason", () => {
  const was = process.env.GITHUB_ACTIONS;
  try {
    delete process.env.GITHUB_ACTIONS;
    assert.equal(ciOnlySkip("X", true, "why"), false, "off the runner a missing file still runs (and fails)");
    process.env.GITHUB_ACTIONS = "1";
    assert.equal(ciOnlySkip("X", true, "why"), false, "only the exact runner value true");
    process.env.GITHUB_ACTIONS = "true";
    assert.equal(ciOnlySkip("X", false, "why"), false, "on the runner, present precondition still runs");
    assert.equal(ciOnlySkip("X", 1, "why"), false, "absent must be exactly true");
    assert.equal(ciOnlySkip("X", true, "why"), "CI-ONLY X: why", "reason is visible");
  } finally { if (was === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = was; }
});
test("TESTFIX1 guard · no privacy or pii test file skips through ciOnlySkip", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "scripts/qa")).filter((f) => /(privacy|pii|scan)/i.test(f) && f.endsWith(".test.mjs") && f !== "testfix1-guard.test.mjs" && f !== "scanmedia1.test.mjs"))
    assert.doesNotMatch(read("scripts/qa/" + f), /ciOnlySkip/, f + " must not skip via ciOnlySkip");
  assert.doesNotMatch(read("scripts/qa/scanmedia1.test.mjs"), /ciOnlySkip|skip:/, "scanmedia1 never skips");
});
