import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
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

test("offline verify does not install and refuses activation", () => {
  const r = spawnSync("bash", [SH, "--offline-verify"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /ARM_IMPORT: NOT TESTED/);
  assert.match(r.stdout, /WHEEL_HASH_IS_NOT_INSTALL: true/);
  assert.match(r.stdout, /SENSI: excluded/);
  const act = spawnSync("bash", [SH, "--activate"], { encoding: "utf8" });
  assert.equal(act.status, 78);
  assert.match(act.stdout, /REFUSE activation/);
});

test("install refuses live paths and the startup script does not listen", () => {
  for (const dest of ["/etc/systemd/system", "/home/dan/wardos", "/workspace/wardos-ops"]) {
    const r = spawnSync("bash", [SH, "--install", "--dest", dest], { encoding: "utf8" });
    assert.notEqual(r.status, 0, dest);
    assert.match(r.stdout + r.stderr, /REFUSE dest/);
  }
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-install-"));
  const staged = spawnSync("bash", [SH, "--install", "--dest", dest], { encoding: "utf8" });
  assert.equal(staged.status, 0, staged.stderr + staged.stdout);
  assert.equal(fs.existsSync(path.join(dest, "bin/sensi-control.mjs")), false);
  const plan = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
  assert.equal(plan.status, 0, plan.stderr + plan.stdout);
  assert.match(plan.stdout, /PLAN lights exec:/);
  const noGate = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), ["--activate"], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
  assert.equal(noGate.status, 78);
  fs.rmSync(dest, { recursive: true, force: true });
});

test("stage and rollback stay inside the dest and do not define a camera or tunnel start", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-"));
  const neighbor = path.join(path.dirname(dest), "live-feed.json");
  fs.writeFileSync(neighbor, "{\"ok\":true}\n");
  const before = fs.readFileSync(neighbor);
  const staged = spawnSync("bash", [SH, "--stage", "--dest", dest], { encoding: "utf8" });
  assert.equal(staged.status, 0, staged.stderr + staged.stdout);
  const unit = fs.readFileSync(path.join(dest, "lib/systemd/system/wardos-pi-lights.service"), "utf8");
  assert.match(unit, /\[Install\]/);
  assert.doesNotMatch(unit, /nest-webrtc|8787/);
  const rolled = spawnSync("bash", [SH, "--rollback", "--dest", dest], { encoding: "utf8" });
  assert.equal(rolled.status, 0, rolled.stderr + rolled.stdout);
  assert.equal(fs.existsSync(path.join(dest, "lib/systemd/system/wardos-pi-lights.service")), false);
  assert.equal(fs.existsSync(path.join(dest, "bin/hub")), false);
  assert.equal(fs.readFileSync(neighbor).equals(before), true);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.rmSync(neighbor, { force: true });
});

function listeners(port) {
  const r = spawnSync("ss", ["-ltnpH", `sport = :${port}`], { encoding: "utf8" });
  return [...r.stdout.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
}

test("gated startup binds lights and both connectors and never cameras", async () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "pi-hub-bind-"));
  const cf = path.join(os.tmpdir(), "wardos-fake-cloudflared");
  if (!fs.existsSync(cf)) {
    const built = spawnSync("gcc", ["-O2", "-o", cf, path.join(ROOT, "ops/box-recover/qa/fake-cloudflared.c")]);
    assert.equal(built.status, 0, String(built.stderr));
  }
  const ports = [40111, 40121, 40122];
  const kids = [];
  try {
    assert.equal(spawnSync("bash", [SH, "--install", "--prefix", dest], { encoding: "utf8" }).status, 0);
    const run = path.join(dest, "run/scripts");
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(path.join(run, "lights-write-proxy.mjs"), "import http from 'node:http'; const i = process.argv.indexOf('--port'); const port = Number(process.argv[i+1]); http.createServer((q,s)=>s.end('{\"ok\":true}')).listen(port,'127.0.0.1');\n");
    fs.writeFileSync(path.join(dest, "secrets/lights-proxy.token"), "fixture-token-value-0123456789\n", { mode: 0o600 });
    fs.writeFileSync(path.join(dest, "etc/tunnel.yml"), "tunnel: wardos-test-hub\ningress:\n  - service: http_status:404\n");
    fs.appendFileSync(path.join(dest, "etc/hub.env"), `LIGHTS_PORT=${ports[0]}\nMETRICS_R1=${ports[1]}\nMETRICS_R2=${ports[2]}\nTUNNEL_NAME=wardos-test-hub\nRUN_TREE=${dest}/run\nWARDOS_CLOUDFLARED=${cf}\n`);
    const gate = path.join(dest, "gate.json");
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-activate.gate/1", activate: "lights-and-tunnel", cams: "start", ssh: "leave-off", secrets: "paths-only" }));
    const refused = spawnSync(path.join(dest, "bin/wardos-pi-lights.sh"), ["--activate", "--gate", gate], { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest } });
    assert.equal(refused.status, 78, refused.stdout + refused.stderr);
    fs.writeFileSync(gate, JSON.stringify({ schema: "wardos.pi-activate.gate/1", activate: "lights-and-tunnel", cams: "parked", ssh: "leave-off", secrets: "paths-only", arm_import: "unmet" }));
    const spawnOne = (args) => {
      const child = spawn(args[0], args.slice(1), { env: { ...process.env, WARDOS_PREFIX: dest }, stdio: "ignore" });
      kids.push(child);
      return child;
    };
    spawnOne([path.join(dest, "bin/wardos-pi-lights.sh"), "--activate", "--gate", gate]);
    spawnOne([path.join(dest, "bin/wardos-pi-tunnel.sh"), "--activate", "--connector", "r1", "--gate", gate]);
    spawnOne([path.join(dest, "bin/wardos-pi-tunnel.sh"), "--activate", "--connector", "r2", "--gate", gate]);
    for (let i = 0; i < 40 && (listeners(ports[0]).length === 0 || listeners(ports[1]).length === 0 || listeners(ports[2]).length === 0); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(listeners(ports[0]).length > 0, "lights");
    assert.ok(listeners(ports[1]).length > 0, "r1");
    assert.ok(listeners(ports[2]).length > 0, "r2");
    assert.equal(listeners(8787).length, 0);
    const venv = spawnSync(path.join(dest, "bin/wardos-pi-venv.sh"), { encoding: "utf8", env: { ...process.env, WARDOS_PREFIX: dest, PATH: "/no/such:" + process.env.PATH } });
    assert.equal(venv.status, 78);
    assert.match(fs.readFileSync(path.join(dest, "bin/wardos-pi-venv.sh"), "utf8"), /--require-hashes/);
  } finally {
    for (const child of kids) { try { child.kill("SIGKILL"); } catch { /* gone */ } }
    for (const port of ports) for (const pid of listeners(port)) { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
    fs.rmSync(dest, { recursive: true, force: true });
  }
});
