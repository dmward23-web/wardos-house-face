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

/* RUNTESTS1 guard · run-tests.sh allows a "CI-ONLY <id>:" skip ONLY on the runner; a plain skip or a failing test still fails it. */
function fakeSuite(body) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "runtests1-guard-"));
  fs.mkdirSync(path.join(d, "scripts/qa"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts/qa/run-tests.sh"), path.join(d, "scripts/qa/run-tests.sh"));
  fs.writeFileSync(path.join(d, "scripts/qa/a.test.mjs"), 'import test from "node:test";\nimport assert from "node:assert/strict";\n' + body);
  fs.mkdirSync(path.join(d, "deps/ws"), { recursive: true });
  fs.writeFileSync(path.join(d, "deps/ws/package.json"), "{}"); /* stub: run-tests.sh only checks that ws is present */
  return d;
}
function runSuite(d, ci) {
  const env = { PATH: process.env.PATH, HOME: d, WARDOS_DEPS: path.join(d, "deps"), QA_NO_BROWSER: "1" };
  if (ci) env.GITHUB_ACTIONS = "true";
  return spawnSync("bash", [path.join(d, "scripts/qa/run-tests.sh")], { cwd: d, env, encoding: "utf8" }).status;
}
test("RUNTESTS1 guard · a CI-ONLY skip passes on the runner, fails off it; plain skips and failures still fail on the runner", () => {
  const cases = [
    ['test("x", { skip: "CI-ONLY X: box-only file" }, () => {});\ntest("y", () => {});', true, 0],
    ['test("x", { skip: "CI-ONLY X: box-only file" }, () => {});\ntest("y", () => {});', false, 3],
    ['test("x", { skip: "no file here" }, () => {});', true, 3],
    ['test("x", { skip: "CI-ONLY X: a" }, () => {});\ntest("y", { skip: "CI-ONLY Y: b" }, () => {});\ntest("z", { skip: "plain" }, () => {});', true, 3],
    ['test("x", { skip: "CI-ONLY X: a" }, () => {});\ntest("y", () => { assert.equal(1, 2); });', true, 1],
  ];
  for (const [body, ci, want] of cases) {
    const d = fakeSuite(body);
    try { assert.equal(runSuite(d, ci), want, (ci ? "runner" : "box") + ": " + body.replace(/\n/g, " | ")); }
    finally { fs.rmSync(d, { recursive: true, force: true }); }
  }
  assert.match(read("scripts/qa/run-tests.sh"), /if \[ "\$\{GITHUB_ACTIONS:-\}" = "true" \]; then\n  cionly=/, "CI-ONLY counting is gated on the runner");
});
test("RUNTESTS1 guard · the TESTS job checks out full history (fetch-depth: 0) so LIVEFIX3 runs", () => {
  const wf = read(".github/workflows/privacy-scan.yml");
  const job = wf.slice(wf.indexOf("House-face test suite") - 1200, wf.indexOf("House-face test suite"));
  assert.match(job, /fetch-depth: 0/, "house-face-tests checkout has fetch-depth: 0");
});

/* FACESTRIP1DATE1 P3a · only ci-only-skip.mjs may produce a "CI-ONLY" skip reason. Every other suite source must not carry the
   text at all (so no test can hand-write "# SKIP CI-ONLY ..." and slip past run-tests.sh). Exempt: ci-only-skip.mjs itself, this
   guard (its fake suites are synthetic), and run-tests.sh (it only counts). */
const CI_ONLY_EXEMPT = new Set(["ci-only-skip.mjs", "testfix1-guard.test.mjs", "run-tests.sh"]);
test("FACESTRIP1DATE1 guard · only scripts/qa/ci-only-skip.mjs emits a CI-ONLY skip reason", () => {
  const hits = [];
  for (const f of fs.readdirSync(path.join(ROOT, "scripts/qa")).filter((f) => /\.(mjs|js|cjs|py|sh)$/.test(f) && !CI_ONLY_EXEMPT.has(f)))
    if (/CI-ONLY/.test(read("scripts/qa/" + f))) hits.push(f);
  assert.deepEqual(hits, [], "CI-ONLY text outside ci-only-skip.mjs");
  assert.match(read("scripts/qa/ci-only-skip.mjs"), /const reason = "CI-ONLY " \+ id \+ ": " \+ why;/, "the one emitter");
});
/* FACESTRIP1DATE1 P3b · the CI-ONLY skip budget. Each ciOnlySkip call site (by its id expression) is listed with how many skips it
   yields on the runner with fetch-depth: 0. The total may not exceed 11; a new or unlisted id fails until it is added here
   on purpose (with its reason in the call). */
const CI_ONLY_ALLOW = {
  '"ARTALLOW1-real-bytes"': 1, '"ADULTCUT1-crawl"': 1, '"ADULTCUT2-crawl"': 1, '"FACESTRIP1-nolb@" + w': 2, '"FACESTRIP1-red"': 1,
  '"FACESTRIP1"': 3, '"FACESTRIP1-r2-parity"': 1, '"TEMPHOME1"': 1,
  '"LIVEFIX3"': 0, /* shallow-checkout only; the TESTS job has fetch-depth: 0, so on CI it runs */
};
test("FACESTRIP1DATE1 guard · at most 11 CI-ONLY skips, and every ciOnlySkip id is on the explicit allow list", () => {
  const found = {};
  for (const f of fs.readdirSync(path.join(ROOT, "scripts/qa")).filter((f) => /\.(mjs|js|cjs)$/.test(f) && !CI_ONLY_EXEMPT.has(f)))
    for (const m of read("scripts/qa/" + f).matchAll(/ciOnlySkip\(([^,]+),/g)) found[m[1].trim()] = (found[m[1].trim()] || 0) + 1;
  const unlisted = Object.keys(found).filter((k) => !(k in CI_ONLY_ALLOW));
  assert.deepEqual(unlisted, [], "ciOnlySkip id not on CI_ONLY_ALLOW: add it here on purpose");
  for (const k of Object.keys(found)) assert.equal(found[k], 1, k + " is used at exactly one call site");
  const total = Object.keys(found).reduce((n, k) => n + CI_ONLY_ALLOW[k], 0);
  assert.ok(total <= 11, "CI-ONLY skip budget: " + total + " > 11");
  assert.ok(Object.values(CI_ONLY_ALLOW).reduce((a, b) => a + b, 0) <= 11, "the allow list itself stays within 11");
});
