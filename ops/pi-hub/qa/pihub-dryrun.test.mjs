import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SH = path.join(ROOT, "ops/pi-hub/pi-hub-install.sh");
const ARM = path.join(ROOT, "ops/pi-hub/deps/kasa-aarch64-cp313.lock.txt");
const BOX = path.join(ROOT, "ops/box-recover/reference/kasa-requirements.lock.txt");

function hashes(file) {
  const out = new Map();
  let name = "";
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const s = line.trim().replace(/\\$/, "").trim();
    if (s.includes("==") && !s.startsWith("#") && !s.startsWith("--")) name = s.split("==")[0];
    if (s.startsWith("--hash=sha256:") && name) out.set(name, s.split("sha256:")[1]);
  }
  return out;
}

test("plan does not write and corrects the lock count", () => {
  const r = spawnSync("bash", [SH, "--plan"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NOT AN INSTALL/);
  assert.match(r.stdout, /21 package declarations and 21 hashes, not 22/);
  assert.match(r.stdout, /not imported on aarch64/);
  assert.match(r.stdout, /separate Pi is not required by the code/);
  assert.doesNotMatch(r.stdout, /SSH is on/);
});

test("aarch64 lock matches the box versions and splits pure hashes from compiled hashes", () => {
  const arm = hashes(ARM);
  const box = hashes(BOX);
  assert.equal(arm.size, 21);
  assert.equal(box.size, 21);
  assert.deepEqual([...arm.keys()], [...box.keys()]);
  for (const name of ["python-kasa", "tplink-cloud-api", "requests", "pycparser"]) {
    assert.equal(arm.get(name), box.get(name), name);
  }
  for (const name of ["aiohttp", "cffi", "cryptography", "frozenlist", "multidict", "propcache", "yarl", "charset-normalizer"]) {
    assert.notEqual(arm.get(name), box.get(name), name);
  }
});

test("stage and rollback stay inside the dest and do not define a camera or tunnel start", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-"));
  const neighbor = path.join(path.dirname(dest), "live-feed.json");
  fs.writeFileSync(neighbor, "{\"ok\":true}\n");
  const before = fs.readFileSync(neighbor);
  const staged = spawnSync("bash", [SH, "--stage", "--dest", dest], { encoding: "utf8" });
  assert.equal(staged.status, 0, staged.stderr + staged.stdout);
  const unit = fs.readFileSync(path.join(dest, "units/wardos-pi-lights.service"), "utf8");
  assert.doesNotMatch(unit, /\[Install\]|nest-webrtc|cloudflared|8787/);
  assert.equal(fs.existsSync(path.join(dest, "node_modules")), false);
  const rolled = spawnSync("bash", [SH, "--rollback", "--dest", dest], { encoding: "utf8" });
  assert.equal(rolled.status, 0, rolled.stderr + rolled.stdout);
  assert.equal(fs.existsSync(path.join(dest, "units/wardos-pi-lights.service")), false);
  assert.equal(fs.readFileSync(neighbor).equals(before), true);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.rmSync(neighbor, { force: true });
});
