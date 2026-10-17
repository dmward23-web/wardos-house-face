// FOLLOWUP3 · nest-stills-refresh fails closed: with no still list it skips, never captures every camera.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(ROOT, "scripts", "nest-stills-refresh.sh");

function run(fileBody, env = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "stillsfail-"));
  try {
    if (fileBody !== null) {
      fs.mkdirSync(path.join(home, ".config", "wardos"), { recursive: true });
      fs.writeFileSync(path.join(home, ".config", "wardos", "nest-still-cams"), fileBody, { mode: 0o600 });
    }
    const base = { PATH: process.env.PATH, HOME: home };
    const r = spawnSync("bash", [SCRIPT], { cwd: ROOT, env: { ...base, ...env }, encoding: "utf8", timeout: 20000 });
    let log = "";
    try { log = fs.readFileSync(path.join(home, ".cache", "wardos", "nest-stills.log"), "utf8"); } catch {}
    return { status: r.status, out: r.stdout, err: r.stderr, log };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

for (const [name, body, env] of [
  ["no env, no file", null, {}],
  ["empty env, no file", null, { STILL_CAMS: "" }],
  ["empty file", "", {}],
  ["blank file (spaces, commas, newline)", " , ,\n", {}],
  ["blank env, blank file", "\n", { STILL_CAMS: " , " }],
]) {
  test("stills fail closed: " + name, () => {
    const r = run(body, env);
    assert.equal(r.status, 0, "exit 0");
    assert.match(r.out, /no still list, skipping/);
    assert.match(r.log, /no still list, skipping/);
    assert.doesNotMatch(r.log, /stills start/, "never starts a capture");
    assert.equal(r.err, "", "quiet: nothing on stderr (no 'No such file')");
  });
}

test("stills script never runs the capture without --cams", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  const calls = src.split("\n").filter((l) => /nest-webrtc-still\.mjs/.test(l) && !/^\s*#/.test(l));
  assert.ok(calls.length >= 1);
  for (const l of calls) assert.match(l, /--cams "\$CAMS"/, l);
});
